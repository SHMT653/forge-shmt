# FORGE — Designsystem

Der visuelle Grundcharakter von FORGE: Purple als Markenfarbe, Türkis für
positive Werte, große klare Typografie, Card-UI, Bottom Navigation, mobile-first.
Dieses Dokument hält fest, was es gibt und wann man was benutzt — damit neue
Screens nicht wie Fremdkörper wirken.

Alle Tokens leben in [`app/globals.css`](../app/globals.css). Es gibt keine
CSS-Framework-Abhängigkeit und keine zweite Quelle für Farben.

## 0. FORGE ist Teil von drei Apps

NEO (Haushalt), FORGE (Training & Ernährung) und VAULT (Finanzen) teilen sich
**denselben Tokensatz und dieselben Klassennamen** — `.app-shell`, `.sidebar`,
`.nav-button`, `.panel`, `.pill`, `.profile-card`, `.icon-button`,
`.app-switch`. Wer hier eine Komponente ändert, ändert sie sinngemäß in allen
dreien. Zwei Regeln folgen daraus:

- **Nie eine Farbe hart schreiben.** Immer Token — sonst bricht Hell/Dunkel
  und die Akzentumschaltung.
- **Einstellungen sind kein Navigationspunkt.** Man erreicht sie über die
  Profilkarte im Sidebar-Fuß. Das ist in allen drei Apps gleich.

### Hell/Dunkel und Akzentfarbe

`<html>` trägt die Klasse `dark` und das Attribut `data-accent`. Ein kleines
Skript in `app/layout.tsx` setzt beides vor dem ersten Pixel, `useTheme`
(`src/web/hooks/useTheme.tsx`) danach. Der helle Tokensatz steht unter
`html:not(.dark)` — **keine** `prefers-color-scheme`-Abfragen mehr, sonst
lässt sich das Theme nicht bewusst wählen.

Die Wahl gilt appübergreifend: FORGE holt sie über `/api/design` von NEO und
schreibt sie dorthin zurück.

---

## 1. Farben

Werte hier sind die des Dunkelmodus; `html:not(.dark)` definiert dieselben
Token für Hell.

| Token | Wert (dunkel) | Verwendung |
|---|---|---|
| `--bg` | `#08070c` | Seitenhintergrund |
| `--bg-2` | `#100e17` | Bottom Sheets |
| `--surface` / `--surface-2` / `--surface-3` | `#16151d` … `#2b2837` | Cards, Inputs, Badges |
| `--border` / `--border-strong` | weiß 9 % / 16 % | Trennlinien, Card-Ränder |
| `--text` | `#f6f5f9` | Fließtext, Zahlen |
| `--muted` | `#a2a0af` | Sekundärtext |
| `--subtle` | `#6d6a7d` | Labels, Hilfstext |
| `--violet` | `#8b5cf6` | Marke, primäre Aktion, aktive Navigation (folgt `data-accent`) |
| `--teal` | `#5fd6c4` | Positiv, im Zielbereich |
| `--gold` | `#f0c674` | Achtung, leicht daneben |
| `--danger` | `#f87171` | Deutlich daneben, Löschen |

### Ampel-Semantik

Die vier Zustände sind zentral in `src/domain/goalPhase.ts` definiert
(`TONE_COLOR`) und dürfen **nicht** pro Screen neu erfunden werden:

| Tone | Farbe | Bedeutung |
|---|---|---|
| `green` | `--teal` | Im Zielbereich, oder unterwegs dorthin |
| `yellow` | `--gold` | Leicht daneben — Hinweis, keine Warnung |
| `red` | `--danger` | Deutlich über dem Bereich |
| `neutral` | `--subtle` | Noch nichts eingetragen — bewusst kein Urteil |

Wichtig: `neutral` ist nicht "schlecht". Ein leerer Tag wird grau dargestellt,
nicht rot.

---

## 2. Typografie

Systemschrift (Inter / SF). Größen bewusst kleiner als früher, damit auf einem
390 px breiten Screen mehr Information ohne Scrollen sichtbar ist (§47/§62).

| Klasse | Größe | Verwendung |
|---|---|---|
| `.h1` | `clamp(28px, 5vw, 48px)` | Nur Landing-/Auth-Kontexte |
| `.h2` | 22 px | Screen-Überschrift |
| `.h3` | 17 px | Card-Titel, Listeneinträge |
| `.copy` | 15 px | Fließtext |
| `.muted-sm` | 12 px | Hilfstext, Metadaten |
| `.section-label` | 12 px, gesperrt, versal | Abschnittsmarke über einer Card |
| `.readout-value` | 30 px, 900 | Die eine große Zahl einer Card |

Zahlen immer mit `toLocaleString('de-DE')` formatieren.

---

## 3. Layout

| Klasse | Verhalten |
|---|---|
| `.panel` | Standard-Card. `.panel.soft` = leiser, `.panel.accent` = Purple-Verlauf |
| `.split` | 2 Spalten, ab 900 px runter auf 1 |
| `.split-3` / `.split-4` | 3 bzw. 4 Spalten, mobil 1 |
| `.stack` / `.stack-sm` | Vertikaler Abstand 12 px / 8 px |
| `.row-between` | Zeile mit Space-between und `min-width: 0` |
| `.tile-grid` | Auto-fit-Kacheln ab 96 px |

`min-width: 0` ist bei jedem Flex-Kind Pflicht — sonst reißen lange
Lebensmittelnamen das Layout auf (§48: keine horizontale Scrollbar).

---

## 4. Komponenten des Coach-Layers

| Komponente | Datei | Zweck |
|---|---|---|
| `RangeBar` | `components/RangeBar.tsx` | Zielbereich als Band statt Einzelwert (§6) |
| `GoalBar` | `components/RangeBar.tsx` | Einfaches Ziel (Schritte, Wasser) |
| `StatusStrip` | `components/StatusStrip.tsx` | Sechs Ampelpunkte für den Tag (§8) |
| `CoachCard` | `components/CoachCard.tsx` | Generierter Coach-Absatz |
| `InsightList` | `components/CoachCard.tsx` | Priorisierte Hinweise darunter |
| `DailyTimeline` | `components/DailyTimeline.tsx` | Chronologischer Tagesverlauf (§9) |
| `Sheet` | `components/Sheet.tsx` | Bottom Sheet, sperrt Hintergrund-Scroll |
| `QuickAddSheet` | `components/QuickAddSheet.tsx` | Primäre Eingabe (§36) |
| `AiQuickInput` | `components/AiQuickInput.tsx` | Freitexteingabe mit Bestätigung (§10) |
| `CoachDrawer` | `components/CoachDrawer.tsx` | Coach-Chat (§33) |
| `WeightTrendChart` | `components/WeightTrendChart.tsx` | Rohgewicht dünn, Trend fett (§25) |
| `PhotoCompare` | `components/PhotoCompare.tsx` | Vorher/Nachher nebeneinander (§28) |

---

## 5. Datenqualität sichtbar machen

Jede Nährwertangabe trägt eine Qualität (`verified` / `estimated` / `unknown`).
Die UI muss das zeigen, nicht verstecken:

- `verified` — normale Darstellung, `812 kcal`
- `estimated` — Tilde plus Badge, `~812 kcal` + `.quality-badge.estimated`
- `unknown` — Bereich statt Zahl, `ca. 700–900 kcal`

Die Helfer dafür stehen in `src/domain/nutritionMath.ts`
(`formatKcal`, `formatKcalRange`). Nie selbst formatieren.

---

## 6. Mobile-Regeln

- Zielgerät 390–430 px. Jede neue Card dort prüfen.
- Touch-Ziele mindestens 40 px (`.chip`, `.icon-button`, `.button.compact`).
- Inputs auf `font-size: 16px` lassen — sonst zoomt iOS beim Fokus.
- `env(safe-area-inset-*)` bei allem, was am Rand klebt.
- Die Bottom Navigation ist 54 px hoch plus Safe Area; `.main` reserviert den
  Platz unten bereits — Inhalte nie darunter schieben.
- `prefers-reduced-motion` schaltet Sheet- und Bar-Animationen ab.

---

## 7. Tonalität (gilt für jeden Text im Interface)

Diese Regeln sind in `src/domain/coach.ts` implementiert und durch Tests
abgesichert — Texte in Komponenten sollen sich genauso verhalten:

- Ein einzelner Tag ist nie ein Urteil. Immer die Woche als Rahmen anbieten.
- Weniger essen ist kein Erfolg. Deutlich unter dem Bereich wird genauso
  benannt wie deutlich darüber.
- Keine Kompensationslogik ("morgen nur 1.200 kcal").
- Keine Schuldsprache: kein "versagt", "schlecht", "undiszipliniert".
- Schätzwerte immer als solche kennzeichnen, besonders BIA-Werte der Waage.
- Kurz. Zwei bis vier Sätze reichen fast immer.
