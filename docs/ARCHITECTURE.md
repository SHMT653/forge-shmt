# FORGE — Architektur

## Schichten

```
app/**                Route-Wrapper (dünn, keine Logik)
 └── src/web/views    Screens
      └── src/web/hooks    Datenbeschaffung + Zustand pro Screen
           └── src/data    Supabase-Repositories (snake_case ↔ camelCase)
                └── src/domain   Reine Logik, keine IO, testbar
```

`src/services` enthält externe Anbindungen (Supabase-Clients, Neo, AI).

Die Regel: **`src/domain` importiert nie aus `src/data` oder `src/web`.** Damit
bleibt die gesamte Auswertungs- und Coach-Logik ohne Datenbank testbar — genau
das machen die 136 Tests in `tests/`.

## Die drei Ebenen aus dem Konzept

| Ebene | Wo sie lebt |
|---|---|
| 1 — Tracking | `src/data/*`, Supabase-Tabellen `forge_*` |
| 2 — Auswertung | `src/domain/goalPhase.ts`, `nutritionMath.ts`, `progression.ts`, `weightTrend.ts`, `weeklyReview.ts` |
| 3 — Coach | `src/domain/coach.ts` (deterministisch) und `src/services/ai/*` (Sprachmodell) |

Ebene 3 ist bewusst zweigeteilt. Der Coach-Text auf dem Heute-Screen wird
**ohne** Sprachmodell erzeugt: er ist sofort da, kostet nichts und funktioniert
offline. Das Modell kommt nur dort ins Spiel, wo natürliche Sprache wirklich
gebraucht wird — Freitexteingabe und Rückfragen im Chat.

## Abgeleitet statt gespeichert

Tagessummen, Wochenschnitte und Portionswerte werden aus den Einzeleinträgen
berechnet, nicht zusätzlich persistiert (§51). Einzige Ausnahme ist
`forge_nutrition_logs`: eine Zeile pro Tag als Cache, die nach jeder Änderung
über `syncNutritionTotals` neu geschrieben wird, damit andere Screens die
Tagessumme in einer Query lesen können.

Schritte, Wasser und Schlaf liegen weiterhin in den Habit-Tabellen. Statt sie
zu duplizieren, liest `src/data/dailyMetrics.ts` sie unter richtigen Namen
wieder heraus.

## Datum und Zeitzone

Alle Tagesdaten hängen an einem lokalen `YYYY-MM-DD`-Schlüssel
(`src/domain/dates.ts`). Nie `toISOString().slice(0,10)` benutzen — das ist UTC
und verschiebt abends den Tag. Getestet in `tests/dates.test.ts`, inklusive
Sommerzeitwechsel.

## AI

```
Freitext
  → /api/ai/parse            (Server, Auth über Supabase-Token)
  → Modell erhält die Bibliothek des Nutzers und referenziert daraus
  → validateParseResult()    (Plausibilitätsgrenzen, verwirft Unsinn)
  → Vorschlag im UI
  → Nutzer bestätigt
  → Speichern
```

Drei Punkte sind nicht verhandelbar:

1. Der API-Key liegt ausschließlich serverseitig (`ANTHROPIC_API_KEY`).
2. Das Modell schreibt nie direkt in die Datenbank.
3. Der Coach-Kontext wird serverseitig aus der Datenbank gebaut, nicht vom
   Client geschickt — sonst wären die Zahlen manipulierbar.

`AIProvider` (`src/services/ai/provider.ts`) hält den Anbieter austauschbar.

## Migrationen

`supabase/coach_migration.sql` ist additiv und idempotent: nur
`add column if not exists` und `create table if not exists`, kein `drop`, kein
Typwechsel. Bestehende Workouts, Gewichte, Mahlzeiten und Einstellungen bleiben
unverändert. Die Datei kann gefahrlos mehrfach ausgeführt werden.

## Tests

```
npm test          # einmal
npm run test:watch
npm run typecheck
```

Getestet wird die Domain-Schicht: Zielbereiche, Rezept- und Meal-Prep-Portionen,
Progression über Wiederholungen und Sekunden, Gewichtstrend, Wochenschnitte,
Datumsgrenzen, AI-Validierung und die Tonalität des Coaches.

## Lebensmittel-Erkennung

Vier Quellen, ein Ranking. Die Reihenfolge ist die Vertrauenswürdigkeit der
Zahlen, nicht die Trefferqualität — beides fließt getrennt in den Score ein:

| Quelle | Datei | Qualität | Bonus |
|---|---|---|---|
| Eigene Produkte + Rezepte | `forge_food_items`, `forge_recipes` | `verified` | +26 |
| Zuletzt gegessen | `forge_meal_entries` | wie gespeichert | +16 |
| Kuratierte Gerichte (613) | `domain/foodDatabase.ts` | `estimated` | +6 |
| Open Food Facts (~3 Mio.) | `data/foodSearch.ts` | `estimated` | 0–8 nach Scans |

`domain/foodResolver.ts` bewertet jeden Kandidaten gegen die Eingabe
(exakt 100, Präfix 88, enthalten 74, Token-Überlappung mit Tippfehler-Toleranz
über eine begrenzte Levenshtein-Distanz), addiert den Quellen-Bonus und wirft
alles unter 30 weg. Auf echten OFF-Daten filtert das rund die Hälfte der
Treffer als Rauschen heraus — OFF matcht auch über Zutatenlisten, weshalb bei
„skyr" Dinge wie „MUSCLY FROMAGE 24" zurückkommen.

**Lerneffekt:** Wird ein OFF-Produkt eingetragen, landet es in
`forge_food_items`. Beim nächsten Mal ist es lokal, sofort, offline verfügbar
und wird vom Textparser erkannt. Die eigene Datenbank wächst durch Benutzung.

**Kein Netz nötig für den Normalfall.** Bibliothek, kürzlich Gegessenes und die
kuratierte Tabelle antworten lokal. Open Food Facts wird nur angefragt, wenn
lokal nichts überzeugend passt — und dann entprellt, gecacht und mit einem
Wiederholungsversuch, weil der Endpunkt gelegentlich Anfragen fallen lässt.

### Warum kein eigenes Sprachmodell

Ein selbst trainiertes Modell wäre für „2 Isoclear → Eintrag" um Größenordnungen
zu teuer und zu langsam, und es hätte kein Produktwissen, das OFF nicht schon
kostenlos bereitstellt. Die Kombination aus Regelparser
(`domain/localParse.ts`), Ranking (`domain/foodResolver.ts`) und offener
Produktdatenbank löst dieselbe Aufgabe deterministisch, nachvollziehbar und
ohne laufende Kosten. Das Sprachmodell bleibt optional und nur für wirklich
unstrukturierte Eingaben zuständig.
