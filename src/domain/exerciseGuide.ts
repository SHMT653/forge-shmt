import { foldExerciseText, type ExerciseEntry, type MuscleKey } from './exerciseDatabase';
import { MUSCLE_LABEL } from './trainingAnalysis';

/**
 * Coaching detail for an exercise: how to do it, and what usually goes wrong.
 *
 * Written per movement pattern rather than per exercise. 176 hand-written
 * paragraphs would be 176 chances to contradict each other, and the cues that
 * matter genuinely are pattern-level: every hinge fails the same way (rounding
 * the back and squatting instead of hinging), every lateral raise fails the
 * same way (shrugging and using momentum). What is exercise-specific — which
 * machine, which regions get loaded — already lives in the exercise table.
 */

export type MovementPattern =
  | 'horizontal-push' | 'vertical-push' | 'fly' | 'raise'
  | 'vertical-pull' | 'horizontal-pull' | 'back-extension'
  | 'squat' | 'lunge' | 'hinge' | 'hip-bridge'
  | 'knee-extension' | 'knee-flexion' | 'hip-abduction' | 'hip-adduction' | 'calf'
  | 'curl' | 'triceps-extension'
  | 'core-flexion' | 'core-rotation' | 'core-hold' | 'iso-hold'
  | 'complex' | 'carry' | 'cardio';

export type ExerciseGuide = {
  pattern: MovementPattern;
  patternLabel: string;
  /** One line: what the movement is, in plain words. */
  summary: string;
  /** Ordered execution cues. */
  steps: string[];
  /** What usually goes wrong. */
  mistakes: string[];
  /** Tempo and breathing, the part everybody skips. */
  tempo: string;
  primary: MuscleKey[];
  secondary: MuscleKey[];
  /** Ready-to-render "Brust (Mitte)" style labels. */
  primaryLabels: string[];
  secondaryLabels: string[];
};

type PatternInfo = Omit<ExerciseGuide, 'pattern' | 'primary' | 'secondary' | 'primaryLabels' | 'secondaryLabels'>;

const PATTERNS: Record<MovementPattern, PatternInfo> = {
  'horizontal-push': {
    patternLabel: 'Horizontales Drücken',
    summary: 'Du drückst ein Gewicht von der Brust weg — die Grundbewegung für Brust, vordere Schulter und Trizeps.',
    steps: [
      'Schulterblätter zusammen und nach unten ziehen, bevor du das Gewicht bewegst. Sie bleiben die ganze Zeit dort.',
      'Ellbogen etwa 45° zum Körper — nicht rechtwinklig abgespreizt.',
      'Kontrolliert bis zur Brust senken, kurz Spannung halten statt abfedern.',
      'Wegdrücken, ohne die Schultern nach vorne rollen zu lassen.',
    ],
    mistakes: [
      'Ellbogen 90° abgespreizt — belastet das Schultergelenk statt die Brust.',
      'Gewicht von der Brust abprallen lassen.',
      'Schultern heben sich am Ende der Bewegung nach vorne.',
    ],
    tempo: '2 Sek. runter, kurz halten, zügig drücken. Beim Senken einatmen, beim Drücken aus.',
  },
  'vertical-push': {
    patternLabel: 'Überkopf-Drücken',
    summary: 'Du drückst über den Kopf — vordere und seitliche Schulter, dazu Trizeps und Rumpf als Stabilisatoren.',
    steps: [
      'Rumpf fest anspannen, Rippen nicht nach vorne kippen lassen.',
      'Aus Schulterhöhe starten, Ellbogen leicht vor der Körperlinie.',
      'Nach oben drücken und den Kopf am Ende leicht durchschieben.',
      'Kontrolliert zurück bis zur Schulterhöhe.',
    ],
    mistakes: [
      'Hohlkreuz, weil die Schultern die Bewegung nicht hergeben — Gewicht runter.',
      'Nur bis zur Stirn drücken statt komplett zu strecken.',
      'Mit den Beinen nachhelfen, ohne dass es geplant ist.',
    ],
    tempo: '2 Sek. runter, kontrolliert drücken. Vor dem Drücken einatmen, oben aus.',
  },
  fly: {
    patternLabel: 'Fliegende Bewegung',
    summary: 'Gestreckte Arme führen zusammen oder auseinander — isoliert den Zielmuskel, weil kein zweites Gelenk mitarbeitet.',
    steps: [
      'Ellbogen leicht gebeugt und in diesem Winkel fixieren — er ändert sich nicht mehr.',
      'Bewegung kommt allein aus dem Schultergelenk.',
      'In der Dehnung kurz halten, dann bewusst zusammenführen.',
    ],
    mistakes: [
      'Ellbogen beugen und strecken — dann wird daraus ein Drücken.',
      'Zu schwer gewählt, dadurch Schwung aus dem Oberkörper.',
      'Über den schmerzfreien Bereich hinaus dehnen.',
    ],
    tempo: 'Langsam, 2–3 Sek. pro Richtung. Isolation lebt von Kontrolle, nicht von Gewicht.',
  },
  raise: {
    patternLabel: 'Heben (Schulter-Isolation)',
    summary: 'Der gestreckte Arm wird gegen den Widerstand angehoben — die einzige Art, die seitliche Schulter direkt zu treffen.',
    steps: [
      'Aufrecht stehen, Rumpf fest, Arme leicht gebeugt.',
      'Bis Schulterhöhe heben — nicht höher, darüber übernimmt der Trapez.',
      'Kontrolliert absenken statt fallen lassen.',
    ],
    mistakes: [
      'Schwung aus dem Oberkörper.',
      'Schultern hochziehen — dann arbeitet der Nacken, nicht die Schulter.',
      'Zu schweres Gewicht. Hier sind leichte Hanteln mit sauberer Form die schnellere Strecke.',
    ],
    tempo: '1 Sek. hoch, 2–3 Sek. runter. Die Absenkphase ist der Reiz.',
  },
  'vertical-pull': {
    patternLabel: 'Vertikales Ziehen',
    summary: 'Du ziehst dich hoch oder etwas von oben zu dir — die Hauptübung für den Latissimus und die Rückenbreite.',
    steps: [
      'Erst die Schulterblätter nach unten ziehen, dann erst die Arme beugen.',
      'Brust zur Stange führen statt Kinn über die Stange zu bringen.',
      'Ganz nach unten ausstrecken, ohne die Spannung komplett zu verlieren.',
    ],
    mistakes: [
      'Nur mit den Armen ziehen — der Rücken macht dann kaum etwas.',
      'Mit den Beinen schwingen (außer Kipping ist gewollt).',
      'Halbe Bewegung: weder ganz oben noch ganz unten.',
    ],
    tempo: '1–2 Sek. ziehen, 2–3 Sek. kontrolliert ablassen.',
  },
  'horizontal-pull': {
    patternLabel: 'Horizontales Ziehen',
    summary: 'Du ziehst ein Gewicht zum Rumpf — trifft die Rückenmitte, die beim Drücken sonst zu kurz kommt.',
    steps: [
      'Rücken gerade, Bewegung startet mit den Schulterblättern.',
      'Zum unteren Brustkorb oder Bauch ziehen, Ellbogen eng am Körper.',
      'Am Ende kurz zusammenziehen, dann kontrolliert strecken.',
    ],
    mistakes: [
      'Oberkörper mit hoch- und runterschwingen.',
      'Zu hoch ziehen, wodurch die Schulter statt des Rückens arbeitet.',
      'Rücken rundet sich in der Streckung.',
    ],
    tempo: '1 Sek. ziehen, 1 Sek. halten, 2 Sek. zurück.',
  },
  'back-extension': {
    patternLabel: 'Rückenstreckung',
    summary: 'Der Oberkörper wird gegen die Schwerkraft aufgerichtet — kräftigt den unteren Rücken und die Rückseite der Hüfte.',
    steps: [
      'Hüfte fixiert, Bewegung findet dort statt — nicht in der Wirbelsäule.',
      'Nur bis zur geraden Linie aufrichten, nicht ins Hohlkreuz.',
      'Gesäß am Ende bewusst anspannen.',
    ],
    mistakes: [
      'Überstrecken am oberen Punkt.',
      'Mit Schwung hochreißen.',
      'Zusatzgewicht zu früh — hier ist der Nutzen in der Kontrolle.',
    ],
    tempo: 'Langsam in beide Richtungen, oben 1 Sek. halten.',
  },
  squat: {
    patternLabel: 'Kniebeuge',
    summary: 'Hüfte und Knie beugen sich gleichzeitig — die zentrale Übung für Oberschenkel und Gesäß.',
    steps: [
      'Füße schulterbreit, Zehen leicht nach außen.',
      'Vor dem Absenken einatmen und den Bauch fest machen.',
      'Hüfte und Knie zusammen beugen, Knie folgen der Richtung der Füße.',
      'Mindestens bis die Oberschenkel parallel sind, dann durch die ganze Fußsohle drücken.',
    ],
    mistakes: [
      'Knie fallen nach innen.',
      'Fersen heben sich — meist zu unbewegliche Sprunggelenke, Absatzschuhe oder Scheibe unter die Ferse helfen.',
      'Zu kurze Bewegung mit zu viel Gewicht.',
    ],
    tempo: '2–3 Sek. runter, unten nicht abfedern, zügig hoch. Oben ausatmen.',
  },
  lunge: {
    patternLabel: 'Ausfallschritt (einbeinig)',
    summary: 'Ein Bein trägt die Arbeit — deckt Seitenunterschiede auf, die bei beidbeinigen Übungen unsichtbar bleiben.',
    steps: [
      'Aufrechter Oberkörper, Blick geradeaus.',
      'Absenken, bis das hintere Knie fast den Boden berührt.',
      'Vorderes Knie über dem Fuß, nicht nach innen kippend.',
      'Über die Ferse des vorderen Fußes hochdrücken.',
    ],
    mistakes: [
      'Zu kurzer Schritt — dann wird die Belastung zum Knieproblem.',
      'Oberkörper kippt nach vorne.',
      'Das schwächere Bein zuerst trainieren wird vergessen; beginne damit.',
    ],
    tempo: '2 Sek. runter, kontrolliert hoch. Gleiche Wiederholungszahl auf beiden Seiten, orientiert an der schwächeren.',
  },
  hinge: {
    patternLabel: 'Hüftbeuge',
    summary: 'Die Hüfte wandert nach hinten, der Rücken bleibt gerade — trainiert Rückseite der Oberschenkel, Gesäß und den ganzen Rücken.',
    steps: [
      'Leicht gebeugte Knie, dann die Hüfte nach hinten schieben.',
      'Rücken bleibt über die gesamte Bewegung gerade.',
      'Gewicht nah am Körper führen.',
      'Über die Hüfte aufrichten und oben das Gesäß anspannen.',
    ],
    mistakes: [
      'Runder Rücken — das ist die Bewegung, bei der es tatsächlich gefährlich wird. Lieber weniger Gewicht.',
      'Daraus eine Kniebeuge machen, statt die Hüfte zu schieben.',
      'Gewicht wandert vom Körper weg.',
    ],
    tempo: '2–3 Sek. runter, kraftvoll aufrichten. Vor der Wiederholung Luft holen und halten.',
  },
  'hip-bridge': {
    patternLabel: 'Hüftstreckung',
    summary: 'Die Hüfte wird gegen den Widerstand nach oben gestreckt — die direkteste Gesäßübung überhaupt.',
    steps: [
      'Fersen so setzen, dass die Schienbeine oben senkrecht stehen.',
      'Kinn leicht angezogen, Rippen unten halten.',
      'Über das Gesäß strecken, bis Oberkörper und Oberschenkel eine Linie bilden.',
      'Oben 1 Sek. halten.',
    ],
    mistakes: [
      'Ins Hohlkreuz strecken statt über das Gesäß.',
      'Über die Fußballen drücken — Fersen tragen.',
      'Oben nicht halten, dadurch geht der beste Teil verloren.',
    ],
    tempo: '1 Sek. hoch, 1 Sek. halten, 2 Sek. runter.',
  },
  'knee-extension': {
    patternLabel: 'Beinstreckung (Isolation)',
    summary: 'Isoliert die Oberschenkelvorderseite über das Kniegelenk.',
    steps: [
      'Drehpunkt der Maschine auf Kniehöhe einstellen.',
      'Vollständig strecken und oben kurz anspannen.',
      'Kontrolliert ablassen, ohne die Gewichte aufsetzen zu lassen.',
    ],
    mistakes: ['Mit Schwung hochreißen.', 'Gesäß hebt sich vom Sitz.', 'Gewichte klacken unten auf.'],
    tempo: '1 Sek. strecken, 1 Sek. halten, 2–3 Sek. ablassen.',
  },
  'knee-flexion': {
    patternLabel: 'Beinbeugung (Isolation)',
    summary: 'Isoliert die Oberschenkelrückseite — der Gegenspieler, ohne den Kniebeugen allein ein Ungleichgewicht erzeugen.',
    steps: [
      'Hüfte bleibt fest auf der Unterlage.',
      'Ferse so weit wie möglich anziehen.',
      'Langsam zurück; die Absenkphase ist hier besonders wirksam.',
    ],
    mistakes: ['Hüfte hebt sich an.', 'Nur halbe Bewegung.', 'Zu schnelles Ablassen.'],
    tempo: '1 Sek. beugen, 3 Sek. zurück.',
  },
  'hip-abduction': {
    patternLabel: 'Hüftabduktion',
    summary: 'Das Bein wird nach außen oder hinten geführt — trifft den mittleren Gesäßmuskel, der die Hüfte seitlich stabilisiert.',
    steps: [
      'Rumpf fest, Becken bleibt ruhig.',
      'Bewegung kommt aus der Hüfte, nicht aus dem Oberkörper.',
      'Am Endpunkt kurz halten.',
    ],
    mistakes: ['Oberkörper kippt zur Gegenseite.', 'Zu großer Bewegungsradius aus dem Rücken.', 'Zu schnell.'],
    tempo: 'Langsam, 1 Sek. halten. Höhere Wiederholungszahlen (15–20) passen hier besser.',
  },
  'hip-adduction': {
    patternLabel: 'Hüftadduktion',
    summary: 'Die Beine werden gegen Widerstand zusammengeführt — trifft die Innenseite der Oberschenkel.',
    steps: ['Aufrecht sitzen, Rücken an der Lehne.', 'Kontrolliert zusammenführen.', 'Langsam in die Dehnung zurück.'],
    mistakes: ['Zu weit öffnen und in die Dehnung fallen.', 'Mit Schwung schließen.'],
    tempo: 'Langsam in beide Richtungen, 12–20 Wiederholungen.',
  },
  calf: {
    patternLabel: 'Wadenheben',
    summary: 'Der Fuß drückt gegen Widerstand nach unten — Waden brauchen vollen Bewegungsradius, nicht viel Gewicht.',
    steps: [
      'Fersen so weit wie möglich absenken.',
      'So hoch wie möglich auf die Fußballen drücken.',
      'Oben 1 Sek. halten.',
    ],
    mistakes: [
      'Nur kleine Auf-und-ab-Bewegungen mit viel Gewicht.',
      'Federn statt kontrolliert bewegen.',
      'Zu wenige Wiederholungen — 12–20 funktionieren hier besser.',
    ],
    tempo: '1 Sek. hoch, 1 Sek. halten, 2–3 Sek. runter.',
  },
  curl: {
    patternLabel: 'Bizeps-Curl',
    summary: 'Das Ellbogengelenk beugt gegen Widerstand — direkte Arbeit für den Bizeps.',
    steps: [
      'Ellbogen bleiben am Körper und wandern nicht nach vorne.',
      'Bis zur vollen Beugung hochführen.',
      'Kontrolliert bis fast zur Streckung ablassen.',
    ],
    mistakes: [
      'Oberkörper schwingt mit.',
      'Ellbogen wandern nach vorne — dann übernimmt die Schulter.',
      'Unten nicht ganz ausstrecken.',
    ],
    tempo: '1 Sek. hoch, 2–3 Sek. runter. Kein Schwung.',
  },
  'triceps-extension': {
    patternLabel: 'Trizeps-Streckung',
    summary: 'Das Ellbogengelenk streckt gegen Widerstand. Über Kopf trifft es zusätzlich den langen Trizepskopf.',
    steps: [
      'Oberarm fixieren — nur der Unterarm bewegt sich.',
      'Vollständig strecken und kurz anspannen.',
      'Kontrolliert in die Dehnung zurück.',
    ],
    mistakes: [
      'Ellbogen wandern nach außen oder vorne.',
      'Mit dem Oberkörper nachdrücken.',
      'Nicht vollständig strecken.',
    ],
    tempo: '1 Sek. strecken, 1 Sek. halten, 2 Sek. zurück.',
  },
  'core-flexion': {
    patternLabel: 'Rumpfbeugung',
    summary: 'Die Wirbelsäule beugt sich gegen Widerstand — die gerade Bauchmuskulatur arbeitet gegen ihre eigentliche Funktion.',
    steps: [
      'Bewegung startet mit dem Einrollen der Wirbelsäule, nicht mit dem Kopf.',
      'Am Ende ausatmen und kurz halten.',
      'Kontrolliert zurück, ohne die Spannung ganz abzugeben.',
    ],
    mistakes: [
      'Am Nacken ziehen.',
      'Aus der Hüfte statt aus dem Bauch arbeiten.',
      'Zu schnell — Bauchmuskeln reagieren auf Spannungszeit, nicht auf Wiederholungszahl.',
    ],
    tempo: 'Langsam, am Endpunkt 1 Sek. halten. Ausatmen beim Einrollen.',
  },
  'core-rotation': {
    patternLabel: 'Rumpfrotation',
    summary: 'Der Oberkörper dreht gegen Widerstand — trifft die seitliche Bauchmuskulatur.',
    steps: [
      'Becken bleibt ruhig, die Drehung kommt aus dem Brustkorb.',
      'Kontrolliert bis zum Endpunkt, dort kurz halten.',
      'Gleich viele Wiederholungen pro Seite.',
    ],
    mistakes: ['Mit Schwung rotieren.', 'Nur die Arme bewegen.', 'Becken dreht mit.'],
    tempo: 'Langsam. Bei Rotation gewinnt Kontrolle immer gegen Tempo.',
  },
  'core-hold': {
    patternLabel: 'Rumpfstabilisation (Halten)',
    summary: 'Du hältst eine Position gegen die Schwerkraft. Der Rumpf arbeitet hier so, wie er es im Alltag tut: er verhindert Bewegung.',
    steps: [
      'Position aufbauen: Rumpf fest, Gesäß angespannt, Rippen unten.',
      'Gerade Linie von Kopf bis Ferse.',
      'Ruhig weiteratmen — nicht die Luft anhalten.',
      'Beenden, sobald die Form nachlässt, nicht erst wenn du zitterst.',
    ],
    mistakes: [
      'Hüfte hängt durch oder wandert nach oben.',
      'Luft anhalten.',
      'Auf Zeit trainieren statt auf saubere Form — 30 Sek. sauber schlagen 2 Min. durchhängend.',
    ],
    tempo: 'Nutze die Stoppuhr in FORGE. Steigere in kleinen Schritten, 5–10 Sek. pro Woche.',
  },
  'iso-hold': {
    patternLabel: 'Statisches Halten',
    summary: 'Eine Position wird unter Spannung gehalten — Kraftaufbau ohne Bewegung.',
    steps: [
      'Position sauber aufbauen, bevor die Zeit läuft.',
      'Spannung bewusst aufrechterhalten, nicht in die Gelenke hängen.',
      'Gleichmäßig weiteratmen.',
    ],
    mistakes: ['Position schleichend verlieren.', 'Luft anhalten.', 'Bis zum kompletten Versagen halten.'],
    tempo: 'Mit der Stoppuhr messen, wöchentlich um wenige Sekunden steigern.',
  },
  complex: {
    patternLabel: 'Komplexbewegung',
    summary: 'Mehrere Bewegungen in einer Übung. Technik zuerst, Gewicht deutlich später.',
    steps: [
      'Die Einzelschritte zuerst ohne Gewicht lernen.',
      'Jede Position kurz halten, bevor die nächste beginnt.',
      'Erst Gewicht ergänzen, wenn der Ablauf sitzt.',
    ],
    mistakes: ['Zu früh zu schwer.', 'Schritte verschleifen.', 'Ungleiche Wiederholungen pro Seite.'],
    tempo: 'Bewusst langsam. Niedrige Wiederholungszahlen, hohe Aufmerksamkeit.',
  },
  carry: {
    patternLabel: 'Tragen',
    summary: 'Gewicht wird über eine Strecke getragen — Griffkraft, Rumpf und oberer Rücken auf einmal.',
    steps: [
      'Aufrecht, Schultern zurück und unten.',
      'Kurze kontrollierte Schritte.',
      'Gewicht sauber ablegen statt fallen lassen.',
    ],
    mistakes: ['Nach vorne gebeugt laufen.', 'Schultern hängen lassen.', 'Zu lange Sätze, bis der Griff versagt.'],
    tempo: 'Nach Zeit oder Strecke, nicht nach Wiederholungen. 30–45 Sek. pro Satz.',
  },
  cardio: {
    patternLabel: 'Ausdauer',
    summary: 'Dauerbelastung für Herz und Kreislauf.',
    steps: [
      'Locker beginnen, die ersten Minuten sind Aufwärmen.',
      'Ein Tempo wählen, das du die geplante Dauer durchhältst.',
      'Am Ende ausrollen statt abrupt zu stoppen.',
    ],
    mistakes: [
      'Zu schnell starten.',
      'Jede Einheit gleich intensiv — der Wechsel aus locker und hart bringt mehr.',
      'Verbrannte Kalorien vom Gerät als exakt nehmen; sie sind eine Schätzung.',
    ],
    tempo: 'Dauer und Distanz zählen hier, nicht Sätze.',
  },
};

/**
 * Rules are checked in order, first match wins. Order matters a lot: a rule for
 * "Curl" would otherwise swallow "Bein-Curl", which is a hamstring exercise.
 */
const RULES: { pattern: MovementPattern; test: (folded: string, entry: ExerciseEntry) => boolean }[] = [
  { pattern: 'cardio', test: (_f, e) => e.type === 'cardio' || e.muscle === 'Cardio' },

  { pattern: 'carry', test: (f) => f.includes('farmer') || f.includes('walk') && f.includes('carry') },

  // Before 'curl': these are knee flexion, not elbow flexion.
  { pattern: 'knee-flexion', test: (f) => f.includes('bein-curl') || f.includes('beincurl') || f.includes('nordic') },
  { pattern: 'knee-extension', test: (f) => f.includes('beinstrecker') },

  { pattern: 'complex', test: (f) => f.includes('get-up') || f.includes('getup') || f.includes('halo') },

  { pattern: 'hinge', test: (f) => f.includes('kreuzheben') || f.includes('deadlift') || f.includes('swing') || f.includes('pull-through') || f.includes('good morning') },
  { pattern: 'hip-bridge', test: (f) => f.includes('hip thrust') || f.includes('glute bridge') },
  { pattern: 'hip-abduction', test: (f) => f.includes('abduktor') || f.includes('kickback') && !f.includes('trizeps') || f.includes('lateral walk') },
  { pattern: 'hip-adduction', test: (f) => f.includes('adduktor') },
  { pattern: 'back-extension', test: (f) => f.includes('hyperextension') || f.includes('ruckenstrecker') || f.includes('superman') },

  { pattern: 'calf', test: (f) => f.includes('wadenheben') || f.includes('calf') },

  { pattern: 'iso-hold', test: (f) => f.includes('wall sit') || f.includes('dead hang') },
  { pattern: 'core-hold', test: (f) => f.includes('ab-roller') || f.includes('ab roller') || f.includes('plank') || f.includes('hollow') || f.includes('dead bug') || f.includes('bird dog') || f.includes('pallof') },
  { pattern: 'core-rotation', test: (f) => f.includes('twist') || f.includes('wood chop') || f.includes('woodchop') },
  { pattern: 'core-flexion', test: (_f, e) => e.muscle === 'Bauch' },

  // Dips and close-grip pressing are triceps-led but still a horizontal press,
  // so they are matched before the elbow-isolation rule below.
  { pattern: 'horizontal-push', test: (f) => f.includes('dips') || f.includes('bench dip') || f.includes('close-grip') || f.includes('diamant') },
  { pattern: 'triceps-extension', test: (f) => f.includes('trizeps') || f.includes('skull') || f.includes('overhead extension') },
  { pattern: 'curl', test: (f) => f.includes('curl') },

  { pattern: 'vertical-pull', test: (f) => f.includes('klimmzug') || f.includes('pull-up') && !f.includes('australian') || f.includes('chin-up') || f.includes('latzug') || f.includes('latziehen') || f.includes('pulldown') || f.includes('scapula') || f.includes('toes to bar') },
  { pattern: 'horizontal-pull', test: (f) => f.includes('rudern') && !f.includes('aufrechtes') || f.includes('row') && !f.includes('upright') && !f.includes('aufrechtes') || f.includes('face pull') || f.includes('facepull') || f.includes('australian') },

  { pattern: 'fly', test: (f) => f.includes('fliegende') || f.includes('fly') || f.includes('pec-deck') || f.includes('butterfly') || f.includes('snow angel') || f.includes('y-t-w') || f.includes('hintere schulter') },
  { pattern: 'raise', test: (f) => f.includes('seitheben') || f.includes('frontheben') || f.includes('upright row') || f.includes('aufrechtes rudern') },

  { pattern: 'vertical-push', test: (f) => f.includes('schulterdrucken') || f.includes('arnold') || f.includes('pike push') || f.includes('handstand') || f.includes('overhead press') },
  { pattern: 'lunge', test: (f) => f.includes('ausfallschritt') || f.includes('lunge') || f.includes('split squat') || f.includes('step-up') || f.includes('step up') },
  { pattern: 'squat', test: (f) => f.includes('squat') || f.includes('kniebeug') || f.includes('beinpresse') },

  { pattern: 'horizontal-push', test: (f) => f.includes('liegestutz') || f.includes('push-up') || f.includes('pushup') || f.includes('bankdrucken') || f.includes('drucken') || f.includes('presse') || f.includes('press') },
];

/** Last resort, chosen from the coarse muscle group rather than guessed. */
const FALLBACK_BY_MUSCLE: Record<string, MovementPattern> = {
  Brust: 'horizontal-push',
  Rücken: 'horizontal-pull',
  Schultern: 'raise',
  Beine: 'squat',
  Bizeps: 'curl',
  Trizeps: 'triceps-extension',
  Bauch: 'core-flexion',
  Cardio: 'cardio',
};

export function patternOf(entry: ExerciseEntry): MovementPattern {
  const folded = foldExerciseText(entry.name);
  for (const rule of RULES) {
    if (rule.test(folded, entry)) return rule.pattern;
  }
  return FALLBACK_BY_MUSCLE[entry.muscle] ?? 'horizontal-push';
}

export function guideFor(entry: ExerciseEntry): ExerciseGuide {
  const pattern = patternOf(entry);
  const info = PATTERNS[pattern];
  // The exercise table lists the primary target first; the rest assist.
  const primary = entry.muscles.slice(0, 1);
  const secondary = entry.muscles.slice(1);
  return {
    pattern,
    ...info,
    primary,
    secondary,
    primaryLabels: primary.map((m) => MUSCLE_LABEL[m]),
    secondaryLabels: secondary.map((m) => MUSCLE_LABEL[m]),
  };
}
