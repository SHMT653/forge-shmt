import Anthropic from '@anthropic-ai/sdk';
import { PARSE_JSON_SCHEMA, type RawParseResult } from '@/domain/aiSchema';
import { AIUnavailableError, type AIProvider, type CoachRequest, type ParseRequest } from './provider';

const MODEL = 'claude-opus-5';

let client: Anthropic | null = null;

/** Server-only. The key must never reach the browser (§71). */
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AIUnavailableError('ANTHROPIC_API_KEY ist nicht gesetzt.');
  client = new Anthropic({ apiKey });
  return client;
}

const PARSE_SYSTEM = `Du wandelst deutschsprachige Freitext-Eingaben aus einer Fitness-App in strukturierte Einträge um.

Die wichtigste Regel: erfinde keine Nährwerte.

Reihenfolge, in der du vorgehst:
1. Prüfe zuerst die mitgelieferte Bibliothek des Nutzers. Passt ein Eintrag (auch bei ungenauer Schreibweise oder Abkürzung), setze libraryId und libraryKind und lass kcal, proteinG, carbsG und fatG auf null. Die App kennt die Werte selbst und rechnet sie aus — rechne sie NICHT vor.
2. Nur wenn nichts passt, schätze. Setze dann confidence ehrlich:
   - high: abgepacktes Standardprodukt mit bekannten Werten
   - medium: alltägliche Speise, gut einschätzbar
   - low: vage Beschreibung, Restaurantessen, unbekannte Portionsgröße
3. Bei confidence "low" gib immer kcalMin und kcalMax an statt einer scheingenauen Zahl. Lieber "700 bis 900" als "812".
4. Reicht die Information überhaupt nicht, gib den Eintrag mit kcal null aus und stelle in "question" eine kurze Rückfrage auf Deutsch.

Mengen: "2 Isoclear" ist quantity 2. "ein halber Wrap" ist 0.5. Ohne Angabe: 1.

Andere Eingabetypen:
- Schritte, Wasser, Schlaf, Gewicht: kind "metric", passendes metric-Feld, metricValue in ml / Stunden / kg / Schritten. "2 Liter" sind 2000 ml.
- Übungen mit Wiederholungen ("Liegestütze 10 9 8"): kind "workout", reps [10, 9, 8].

Enthält die Eingabe mehrere Dinge, gib mehrere Einträge zurück. Antworte ausschließlich über das vorgegebene Format.`;

const COACH_SYSTEM = `Du bist der Coach in FORGE, einer persönlichen Fitness-App. Du antwortest auf Deutsch, in der Du-Form.

Du bekommst die echten Daten des Nutzers als Kontext. Halte dich strikt daran:
- Nenne nur Zahlen, die im Kontext stehen. Erfinde nichts und rechne nichts hoch, was du nicht belegen kannst.
- Fehlt eine Information, sag das offen und schlag vor, was der Nutzer eintragen könnte.
- Kennzeichne Schätzwerte als Schätzung, besonders bei Körperfett aus der Waage.

Ton:
- Sachlich, ruhig, konkret. Wie ein guter Trainer, nicht wie ein Motivationsposter.
- Keine Dramatik und keine Schuldzuweisungen. Ein einzelner Tag über dem Zielbereich ist kein Problem — der Wochenschnitt zählt.
- Weniger essen ist kein Erfolg an sich. Liegt der Nutzer deutlich unter seinem Bereich, sag das genauso deutlich wie ein Zuviel.
- Keine aggressive Kompensation vorschlagen ("morgen nur 1.200 kcal").
- Kurz halten: zwei bis vier Sätze, außer es wird ausdrücklich mehr gefragt.

Du bist kein Arzt. Bei Schmerzen, Verletzungen oder medizinischen Fragen verweise auf ärztlichen Rat.`;

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  async parseEntry(request: ParseRequest): Promise<RawParseResult> {
    const library = request.library
      .map((item) => `${item.id}\t${item.kind}\t${item.name}${item.brand ? ` (${item.brand})` : ''}\t${item.servingLabel}`)
      .join('\n');

    const userContent = [
      `Lokale Zeit: ${request.localTime}`,
      '',
      library
        ? `Bibliothek des Nutzers (id, typ, name, portion):\n${library}`
        : 'Bibliothek des Nutzers: (noch leer)',
      '',
      `Eingabe: ${request.text}`,
    ].join('\n');

    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: PARSE_SYSTEM,
      // A scoped extraction task — low effort keeps the round trip quick
      // without measurably hurting accuracy here.
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: PARSE_JSON_SCHEMA },
      },
      messages: [{ role: 'user', content: userContent }],
    });

    if (response.stop_reason === 'refusal') {
      throw new AIUnavailableError('Die Eingabe konnte nicht verarbeitet werden.');
    }

    const text = extractText(response.content);
    if (!text) throw new AIUnavailableError('Leere Antwort vom Modell.');

    try {
      return JSON.parse(text) as RawParseResult;
    } catch {
      throw new AIUnavailableError('Antwort konnte nicht gelesen werden.');
    }
  }

  async coach(request: CoachRequest): Promise<string> {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [
        { type: 'text', text: COACH_SYSTEM, cache_control: { type: 'ephemeral' } },
      ],
      output_config: { effort: 'medium' },
      messages: [
        ...request.history.slice(-8).map((turn) => ({ role: turn.role, content: turn.content })),
        {
          role: 'user' as const,
          content: `Aktuelle FORGE-Daten:\n${request.context}\n\nFrage: ${request.question}`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return 'Diese Frage kann ich nicht beantworten. Bei gesundheitlichen Beschwerden wende dich bitte an eine Ärztin oder einen Arzt.';
    }

    return extractText(response.content) || 'Dazu habe ich gerade keine Antwort.';
  }
}

let provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!provider) provider = new AnthropicProvider();
  return provider;
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
