import Capacitor
import Foundation
import HealthKit

/**
 * FORGE ↔ HealthKit bridge.
 *
 * Deliberately small (§7). It exposes aggregate queries only — no raw sample
 * streaming — because FORGE stores day totals and has no use for individual
 * samples. Everything is read-only: FORGE never writes back to Health (§47).
 *
 * Register in AppDelegate or via the Capacitor plugin list as "ForgeHealth".
 */
@objc(ForgeHealthPlugin)
public class ForgeHealthPlugin: CAPPlugin {

    private let store = HKHealthStore()

    /// The web layer speaks in FORGE metric names; this is the only place that
    /// knows which HealthKit type each one maps to.
    private func quantityType(for metric: String) -> HKQuantityType? {
        switch metric {
        case "steps":        return HKQuantityType.quantityType(forIdentifier: .stepCount)
        case "weight":       return HKQuantityType.quantityType(forIdentifier: .bodyMass)
        case "activeEnergy": return HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)
        case "distance":     return HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)
        default:             return nil
        }
    }

    private func objectType(for metric: String) -> HKObjectType? {
        if metric == "sleep" { return HKObjectType.categoryType(forIdentifier: .sleepAnalysis) }
        if metric == "workouts" { return HKObjectType.workoutType() }
        return quantityType(for: metric)
    }

    // MARK: - Availability & permissions

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    /// Requests READ access only, and only for the metrics FORGE was asked for.
    /// Anything the user declines simply stays manual (§8/§9).
    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": [], "denied": call.getArray("types", String.self) ?? []])
            return
        }

        let requested = call.getArray("types", String.self) ?? []
        let readTypes = Set(requested.compactMap { objectType(for: $0) })

        guard !readTypes.isEmpty else {
            call.resolve(["granted": [], "denied": requested])
            return
        }

        store.requestAuthorization(toShare: [], read: readTypes) { [weak self] success, _ in
            guard let self else { return }
            guard success else {
                call.resolve(["granted": [], "denied": requested])
                return
            }
            // HealthKit deliberately does not reveal read permission, so a
            // probe query is the only honest way to report what works.
            self.probeReadable(requested) { granted in
                let denied = requested.filter { !granted.contains($0) }
                call.resolve(["granted": granted, "denied": denied])
            }
        }
    }

    @objc func getAuthorizationStatus(_ call: CAPPluginCall) {
        let all = ["steps", "sleep", "weight", "activeEnergy", "distance", "workouts"]
        probeReadable(all) { granted in
            call.resolve(["granted": granted])
        }
    }

    /// Runs a cheap query per metric; one that returns without an
    /// authorization error is readable.
    private func probeReadable(_ metrics: [String], completion: @escaping ([String]) -> Void) {
        let group = DispatchGroup()
        var readable: [String] = []
        let lock = NSLock()

        for metric in metrics {
            guard let type = objectType(for: metric) as? HKSampleType else { continue }
            group.enter()
            let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: nil) { _, _, error in
                let denied = (error as? HKError)?.code == .errorAuthorizationDenied
                    || (error as? HKError)?.code == .errorAuthorizationNotDetermined
                if !denied {
                    lock.lock(); readable.append(metric); lock.unlock()
                }
                group.leave()
            }
            store.execute(query)
        }

        group.notify(queue: .main) { completion(readable) }
    }

    // MARK: - Queries

    @objc func querySteps(_ call: CAPPluginCall) {
        sumQuantity(call, metric: "steps", unit: .count())
    }

    @objc func queryActiveEnergy(_ call: CAPPluginCall) {
        sumQuantity(call, metric: "activeEnergy", unit: .kilocalorie())
    }

    @objc func queryDistance(_ call: CAPPluginCall) {
        sumQuantity(call, metric: "distance", unit: .meter())
    }

    /// Sums a cumulative quantity over the LOCAL day. Using the device calendar
    /// rather than UTC is what keeps a late-evening reading on the right date (§52).
    private func sumQuantity(_ call: CAPPluginCall, metric: String, unit: HKUnit) {
        guard let type = quantityType(for: metric), let range = dayRange(from: call) else {
            call.resolve(["value": NSNull()])
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: range.start, end: range.end, options: .strictStartDate)
        let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, _ in
            guard let sum = stats?.sumQuantity() else {
                call.resolve(["value": NSNull()])
                return
            }
            call.resolve(["value": sum.doubleValue(for: unit)])
        }
        store.execute(query)
    }

    /// Total asleep minutes for the night belonging to `date`.
    /// The window runs 18:00 the previous evening to 18:00 on the date itself,
    /// so a night that crosses midnight is attributed to the morning it ends on.
    @objc func querySleep(_ call: CAPPluginCall) {
        guard
            let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis),
            let range = dayRange(from: call)
        else {
            call.resolve(["minutes": NSNull(), "startedAt": NSNull()])
            return
        }

        let calendar = Calendar.current
        let windowEnd = calendar.date(byAdding: .hour, value: 18, to: range.start) ?? range.end
        let windowStart = calendar.date(byAdding: .hour, value: -6, to: range.start) ?? range.start

        let predicate = HKQuery.predicateForSamples(withStart: windowStart, end: windowEnd, options: .strictStartDate)
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
            guard let samples = samples as? [HKCategorySample], !samples.isEmpty else {
                call.resolve(["minutes": NSNull(), "startedAt": NSNull()])
                return
            }

            let asleep = samples.filter { Self.isAsleep($0.value) }
            guard !asleep.isEmpty else {
                call.resolve(["minutes": NSNull(), "startedAt": NSNull()])
                return
            }

            // Overlapping samples from several sources would double-count, so
            // the intervals are merged before summing.
            let merged = Self.mergeIntervals(asleep.map { ($0.startDate, $0.endDate) })
            let seconds = merged.reduce(0.0) { $0 + $1.end.timeIntervalSince($1.start) }
            let formatter = ISO8601DateFormatter()

            call.resolve([
                "minutes": seconds / 60.0,
                "startedAt": merged.first.map { formatter.string(from: $0.start) } ?? NSNull()
            ])
        }
        store.execute(query)
    }

    private static func isAsleep(_ value: Int) -> Bool {
        if #available(iOS 16.0, *) {
            return value == HKCategoryValueSleepAnalysis.asleepCore.rawValue
                || value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue
                || value == HKCategoryValueSleepAnalysis.asleepREM.rawValue
                || value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
        }
        return value == HKCategoryValueSleepAnalysis.asleep.rawValue
    }

    private static func mergeIntervals(_ input: [(start: Date, end: Date)]) -> [(start: Date, end: Date)] {
        let sorted = input.sorted { $0.start < $1.start }
        var merged: [(start: Date, end: Date)] = []
        for interval in sorted {
            if let last = merged.last, interval.start <= last.end {
                merged[merged.count - 1].end = max(last.end, interval.end)
            } else {
                merged.append(interval)
            }
        }
        return merged
    }

    /// Most recent body mass sample on the given day — this is how a smart
    /// scale reaches FORGE without any brand-specific integration (§18).
    @objc func queryWeight(_ call: CAPPluginCall) {
        guard let type = quantityType(for: "weight"), let range = dayRange(from: call) else {
            call.resolve(["kg": NSNull(), "measuredAt": NSNull()])
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: range.start, end: range.end, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
            guard let sample = samples?.first as? HKQuantitySample else {
                call.resolve(["kg": NSNull(), "measuredAt": NSNull()])
                return
            }
            let formatter = ISO8601DateFormatter()
            call.resolve([
                "kg": sample.quantity.doubleValue(for: .gramUnit(with: .kilo)),
                "measuredAt": formatter.string(from: sample.endDate)
            ])
        }
        store.execute(query)
    }

    @objc func queryWorkouts(_ call: CAPPluginCall) {
        guard let range = dayRange(from: call) else {
            call.resolve(["workouts": []])
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: range.start, end: range.end, options: .strictStartDate)
        let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: 50, sortDescriptors: nil) { _, samples, _ in
            let formatter = ISO8601DateFormatter()
            let workouts: [[String: Any]] = (samples as? [HKWorkout] ?? []).map { workout in
                var entry: [String: Any] = [
                    "externalId": workout.uuid.uuidString,
                    "activity": String(describing: workout.workoutActivityType.rawValue),
                    "startedAt": formatter.string(from: workout.startDate),
                    "durationMinutes": workout.duration / 60.0
                ]
                if let energy = workout.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity() {
                    entry["activeEnergyKcal"] = energy.doubleValue(for: .kilocalorie())
                }
                if let distance = workout.statistics(for: HKQuantityType(.distanceWalkingRunning))?.sumQuantity() {
                    entry["distanceM"] = distance.doubleValue(for: .meter())
                }
                return entry
            }
            call.resolve(["workouts": workouts])
        }
        store.execute(query)
    }

    // MARK: - Helpers

    /// Turns a "YYYY-MM-DD" key into the local calendar day it names.
    private func dayRange(from call: CAPPluginCall) -> (start: Date, end: Date)? {
        guard let key = call.getString("date") else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        guard let start = formatter.date(from: key) else { return nil }
        guard let end = Calendar.current.date(byAdding: .day, value: 1, to: start) else { return nil }
        return (start, end)
    }
}
