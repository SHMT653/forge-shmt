# CLAUDE.md

Leitfaden für Claude Code (claude.ai/code) in diesem Repository.

## Sprache

Codebasis, Kommentare, Commit-Messages und UI sind auf **Deutsch**. Neue
Kommentare/Texte ebenfalls auf Deutsch halten.

## Befehle

```bash
npm run dev          # Dev-Server
npm run build        # Produktions-Build (prüft auch Typen)
npm run lint         # tsc --noEmit && eslint .
npm run typecheck    # nur tsc --noEmit
npm run test         # Vitest einmalig
npm run test:watch   # Vitest im Watch-Modus
npx vitest run tests/dates.test.ts   # Einzelne Testdatei
```

## FORGE ist eine von drei Apps

| App | Repo | Thema | Datenbank |
|-----|------|-------|-----------|
| **NEO** | `shmt-assistent` | Haushalt & Alltag | Supabase-Projekt A |
| **VAULT** | `vault-shmt` | Finanzen, Fixkosten, Zähler | dasselbe Projekt A |
| **FORGE** | dieses Repo | Training & Ernährung | **eigenes** Projekt (`forge_*`) |

Getrennte Deployments, ein Erscheinungsbild. Was daraus folgt:

- **Gleiche Design-Tokens und Klassennamen** in allen drei `globals.css`
  (`.app-shell`, `.sidebar`, `.nav-button`, `.panel`, `.pill`, `.profile-card`,
  `.icon-button`, `.app-switch`). Farben **nie** hart schreiben — immer Token,
  sonst bricht Hell/Dunkel und die Akzentumschaltung.
- **Einstellungen sind kein Navigationspunkt.** Man erreicht sie über die
  Profilkarte im Sidebar-Fuß — in allen drei Apps gleich.
- **Klicks warten nicht.** Jeder Screen ist eine Client-Fläche in `ROUTE_PANES`
  (`src/web/AppShell.tsx`); einmal geöffnet bleibt er montiert und wird nur aus-
  und eingeblendet (`RoutePane`, `src/web/components/RoutePanes.tsx`). Ein neuer
  Screen gehört deshalb in `ROUTE_PANES`, sonst fällt er auf den Server-Umweg
  zurück. Detailseiten mit ID (`/plans/:id`, `/workout/:id`) laufen über
  `transientViewFor` und werden beim Verlassen abgeräumt. Hooks laden leise nach
  mit `load(true)` + `useRefreshWhenVisible()`; der Spinner gehört nur ans erste
  Laden. Dasselbe Muster liegt spiegelbildlich in NEO.
- `src/lib/navigation/apps.ts` liegt spiegelbildlich in allen drei Repos und
  listet die App-URLs für den Umschalter.

### Brücke zu NEO

FORGE hat eine eigene Datenbank, deshalb läuft alles über HTTP mit dem
geteilten Geheimnis `NEO_FORGE_API_SECRET` im `x-api-secret`-Header:

| Richtung | Route | Zweck |
|---|---|---|
| NEO → FORGE | `app/api/integrations/neo/sleep` | Schlafauswahl aus NEOs Zeitenrechner |
| NEO → FORGE | `app/api/integrations/neo/today` | Tagesstand für NEOs Kachel „SHMT heute" |
| FORGE → NEO | `src/services/neo/client.ts` | Freie Kalenderslots, Trainingstermine |
| FORGE ↔ NEO | `app/api/design` | Hell/Dunkel + Akzentfarbe abgleichen |

`app/api/design` ist die einzige Route, die sich am **Nutzer** authentifiziert:
der Browser schickt sein Supabase-Access-Token, die Route bestimmt daraus die
E-Mail und fragt damit NEO. Das Geheimnis bleibt server-seitig.

### Theme

`<html>` trägt `class="dark"` und `data-accent`. Ein Skript in `app/layout.tsx`
setzt beides vor dem ersten Pixel, `src/web/hooks/useTheme.tsx` danach. Der
helle Tokensatz steht unter `html:not(.dark)` — **keine**
`prefers-color-scheme`-Abfragen mehr, sonst lässt sich das Theme nicht bewusst
wählen.

## Architektur

Siehe [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (Schichten, Zeitzonen-Regel)
und [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) (Tokens, Komponenten,
Tonalität). Kurzfassung:

```
app/**              Route-Wrapper (dünn, keine Logik)
 └── src/web/views       Screens
      └── src/web/hooks       Zustand + Datenbeschaffung pro Screen
           └── src/data       Supabase-Repositories (snake_case ↔ camelCase)
                └── src/domain     Reine Logik, keine IO, testbar
```

**`src/domain` importiert nie aus `src/data` oder `src/web`.**

Tagesdaten hängen an einem lokalen `YYYY-MM-DD`-Schlüssel (`src/domain/dates.ts`).
Nie `toISOString().slice(0,10)` — das ist UTC und verschiebt abends den Tag.

Gleiches Essen eines Tages zeigt die Liste als einen Eintrag: zweimal Milch ist
„2× Milch" mit der Summe darunter (`src/domain/mealStacks.ts`). Gestapelt wird
nur in der Anzeige — in der Datenbank bleibt jede Portion ihre eigene Zeile,
sonst ließe sich später keine einzelne zurücknehmen. Wer eine Menge loggt,
schreibt sie deshalb in `servings` und **lässt den Namen wie er ist**; ein
„2 Portionen Milch" im Namen fällt aus dem Stapel heraus.

## Next 16

`params` und `searchParams` sind Promises und müssen `await`-et werden.
Synchroner Zugriff wurde entfernt und liefert stillschweigend `undefined`.
Nach dem Löschen oder Anlegen von Routen `npx next typegen` laufen lassen.

## Umgebungsvariablen

Siehe `.env.example`. Pflicht: Supabase-URL/Anon-Key. Server-seitig zusätzlich
`SUPABASE_SERVICE_ROLE_KEY`, `NEO_API_URL` und `NEO_FORGE_API_SECRET` für die
NEO-Brücke sowie `CRON_SECRET` für den Tagesplaner.
