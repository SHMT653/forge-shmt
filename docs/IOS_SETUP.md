# FORGE auf dem iPhone — Capacitor + HealthKit

FORGE bleibt eine Web-App. Capacitor ist nur eine Hülle, die dieselbe
Anwendung in einen nativen Container legt, damit HealthKit erreichbar wird.
Die Web-App funktioniert unverändert weiter, auch ohne Capacitor (§1, §3).

## Architektur

```
FORGE Web App (Next.js, Vercel)  ← Single Source of Truth
        │
        ├── Browser / PWA          Service Worker cached die Shell
        │
        └── Capacitor (iOS)        lädt dieselbe URL
                 │
                 └── ForgeHealth   Swift-Plugin → HKHealthStore
```

### Warum `server.url` statt statischem Bundle

Capacitor bündelt normalerweise einen statischen Export. Das geht hier nicht:
FORGE hat fünf POST-Route-Handler (`/api/ai/*`, `/api/planner/*`), die einen
Node-Server brauchen — ein `output: 'export'` müsste sie ersatzlos streichen.

Deshalb lädt der Container die deployte Seite. Den Offline-Fall deckt der
Service Worker ab: nach dem ersten Start liegt die Shell im Cache, und
`public/shell/index.html` ist der Fallback, falls schon der erste Start ohne
Netz passiert.

**Konsequenz:** der allererste Start braucht eine Verbindung. Das ist bewusst
in Kauf genommen, weil die Alternative bedeutet hätte, die AI-Funktionen aus
der iOS-App zu entfernen.

## Einmalige Einrichtung

```bash
npm run cap:add:ios     # erzeugt ios/App/
npm run cap:sync        # überträgt Config + Plugins
npm run cap:open        # öffnet Xcode
```

`npm run cap:add:ios` braucht macOS mit Xcode und CocoaPods. Der Ordner
`ios/App/` wird dabei erzeugt und gehört ins Repository.

### Health-Plugin einhängen

Nach `cap add ios`:

1. `ios/plugin/ForgeHealthPlugin.swift` und `ForgeHealthPlugin.m` nach
   `ios/App/App/` kopieren (in Xcode per Drag & Drop, „Copy items if needed").
2. In Xcode: Target **App** → **Signing & Capabilities** → **+ Capability** →
   **HealthKit**. Nur *Read* wird benötigt; „Clinical Health Records" bleibt aus.
3. In `ios/App/App/Info.plist` ergänzen:

```xml
<key>NSHealthShareUsageDescription</key>
<string>FORGE liest Schritte, Schlaf, Gewicht und Trainings aus Apple Health, damit du sie nicht von Hand eintragen musst.</string>
```

`NSHealthUpdateUsageDescription` wird **nicht** gesetzt — FORGE schreibt nichts
zurück (§47). Ein Schreibrecht anzufordern, das nie benutzt wird, ist im
App-Review ein vermeidbares Risiko.

### Bundle Identifier und Signing

`appId` steht in `capacitor.config.ts` auf `de.shmt.forge`. Signing-Zertifikate
gehören ausschließlich in Xcode bzw. in die CI-Secrets — niemals ins
Repository (§45).

### Andere Umgebung

```bash
FORGE_APP_URL=https://staging.forge.shmt.app npm run cap:sync
```

## HealthKit-Umfang

Nur Lesezugriff, nur diese Typen (§8):

| FORGE | HealthKit |
|---|---|
| Schritte | `HKQuantityTypeIdentifierStepCount` |
| Schlaf | `HKCategoryTypeIdentifierSleepAnalysis` |
| Gewicht | `HKQuantityTypeIdentifierBodyMass` |
| Aktive Energie | `HKQuantityTypeIdentifierActiveEnergyBurned` |
| Distanz | `HKQuantityTypeIdentifierDistanceWalkingRunning` |
| Workouts | `HKWorkoutType` |

Mehr wird nicht angefragt. Jede weitere Berechtigung müsste im App-Review
begründet werden und hätte keinen Nutzen.

### Besonderheiten der Implementierung

- **Schlaf über Mitternacht.** Das Fenster läuft vom Vorabend bis 18:00 Uhr des
  Zieltags, damit eine Nacht dem Morgen zugerechnet wird, an dem sie endet.
- **Überlappende Samples.** Uhr und Telefon melden dieselbe Nacht doppelt.
  `mergeIntervals` führt sie zusammen, bevor summiert wird — sonst wären es
  16 statt 8 Stunden.
- **Leseberechtigung ist nicht abfragbar.** HealthKit verrät aus
  Datenschutzgründen nicht, ob Lesen erlaubt ist. `probeReadable` stellt
  deshalb pro Typ eine billige Testabfrage und wertet aus, ob ein
  Autorisierungsfehler kommt.
- **Lokale Zeitzone.** Tagesgrenzen kommen aus `Calendar.current`, nicht aus
  UTC (§52).

## Datenfluss und Datenschutz

Was FORGE speichert (§13, §14):

```
forge_daily_health   ein Datensatz pro Tag: Schritte, Schlaf, Energie, Distanz
                     plus je Metrik die Quelle
forge_body_metrics   Gewicht pro Messung, mit Quelle
```

Was **nicht** gespeichert wird: einzelne HealthKit-Samples, Herzfrequenz,
Standort, Zyklusdaten, klinische Daten. Rohdaten bleiben in Apple Health.

Der AI-Coach bekommt Tagesaggregate — dieselben Zahlen, die auch auf dem
Bildschirm stehen. Keine Rohdaten, keine Health-Werte in Logs.

## Quellenlogik (§43)

```
Apple Health liefert 7.350 Schritte  → gespeichert mit source apple_health
Nutzer korrigiert auf 9.000          → gespeichert mit source manual
Nächster Sync liefert 7.400          → verworfen, manual gewinnt für diesen Tag
```

Werte werden **ersetzt, nie addiert**. Das ist in
`src/domain/health.ts` (`shouldReplace`) implementiert und in
`tests/health.test.ts` abgesichert.

## App Store

- HealthKit-Nutzung im Review-Formular beschreiben.
- Keine medizinischen Aussagen, keine Diagnosen — der Coach ist ausdrücklich
  darauf geprompted, bei Beschwerden auf ärztlichen Rat zu verweisen.
- Datenschutzangaben: Gesundheits- und Fitnessdaten, verknüpft mit dem Konto,
  nicht für Tracking verwendet.
- Apple prüft reine Website-Hüllen kritisch (Richtlinie 4.2). Die HealthKit-
  Integration und der Offline-Cache sind die Funktionen, die über einen
  Browser-Tab hinausgehen — bei einer Ablehnung ist das die Argumentation.
