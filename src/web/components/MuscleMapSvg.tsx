import type { MuscleKey } from '@/domain/exerciseDatabase';

const MUSCLE_LABELS: Record<MuscleKey, string> = {
  'chest':      'Brust',
  'front-delt': 'Vordere Schulter',
  'side-delt':  'Seitliche Schulter',
  'rear-delt':  'Hintere Schulter',
  'lats':       'Latissimus',
  'rhomboids':  'Rhomboiden',
  'traps':      'Trapezius',
  'lower-back': 'Unterer Rücken',
  'biceps':     'Bizeps',
  'triceps':    'Trizeps',
  'forearms':   'Unterarme',
  'quads':      'Quadrizeps',
  'hamstrings': 'Hamstrings',
  'glutes':     'Gesäß',
  'calves':     'Waden',
  'abs':        'Bauch',
  'obliques':   'Schrägmuskeln',
};

export function MuscleMapSvg({ muscles }: { muscles: MuscleKey[] }) {
  const active = new Set(muscles);
  const on  = '#7b5cf0';   // violet for active
  const off = 'rgba(255,255,255,0.07)';
  const f   = (k: MuscleKey) => (active.has(k) ? on : off);
  const bodyOutline = 'rgba(255,255,255,0.1)';

  return (
    <div>
      <svg
        viewBox="0 0 224 290"
        width="100%"
        style={{ maxWidth: 320, display: 'block', margin: '0 auto' }}
        aria-hidden
      >
        {/* ── Labels ───────────────────────────────────── */}
        <text x="53"  y="9" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="7.5" fontFamily="sans-serif">Vorne</text>
        <text x="171" y="9" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="7.5" fontFamily="sans-serif">Hinten</text>

        {/* ── FRONT SILHOUETTE (cx 53) ─────────────────── */}
        {/* Head */}
        <circle cx="53" cy="23" r="14" fill="rgba(255,255,255,0.05)" stroke={bodyOutline} strokeWidth="1" />
        {/* Neck */}
        <rect x="49" y="36" width="8" height="9" rx="3" fill="rgba(255,255,255,0.05)" stroke={bodyOutline} strokeWidth="1" />
        {/* Torso */}
        <rect x="29" y="45" width="48" height="94" rx="10" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        {/* Upper arms */}
        <rect x="10" y="55" width="17" height="65" rx="8"  fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        <rect x="79" y="55" width="17" height="65" rx="8"  fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        {/* Forearms */}
        <rect x="8"  y="121" width="14" height="50" rx="7" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        <rect x="84" y="121" width="14" height="50" rx="7" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        {/* Legs */}
        <rect x="29" y="141" width="20" height="130" rx="10" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        <rect x="57" y="141" width="20" height="130" rx="10" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />

        {/* ── FRONT MUSCLES ────────────────────────────── */}
        {/* Chest — two pec ovals */}
        <ellipse cx="43" cy="67" rx="13" ry="11" fill={f('chest')} />
        <ellipse cx="63" cy="67" rx="13" ry="11" fill={f('chest')} />
        {/* Front delts */}
        <ellipse cx="26" cy="58" rx="10" ry="10" fill={f('front-delt')} />
        <ellipse cx="80" cy="58" rx="10" ry="10" fill={f('front-delt')} />
        {/* Side delts */}
        <ellipse cx="15" cy="66" rx="8"  ry="10" fill={f('side-delt')} />
        <ellipse cx="91" cy="66" rx="8"  ry="10" fill={f('side-delt')} />
        {/* Biceps */}
        <ellipse cx="15" cy="92" rx="7"  ry="15" fill={f('biceps')} />
        <ellipse cx="91" cy="92" rx="7"  ry="15" fill={f('biceps')} />
        {/* Forearms */}
        <ellipse cx="13" cy="134" rx="6" ry="12" fill={f('forearms')} />
        <ellipse cx="93" cy="134" rx="6" ry="12" fill={f('forearms')} />
        {/* Abs */}
        <rect x="42" y="88" width="22" height="42" rx="5" fill={f('abs')} />
        {/* Obliques */}
        <rect x="30" y="93" width="11" height="30" rx="4" fill={f('obliques')} />
        <rect x="65" y="93" width="11" height="30" rx="4" fill={f('obliques')} />
        {/* Quads */}
        <ellipse cx="39" cy="186" rx="14" ry="27" fill={f('quads')} />
        <ellipse cx="67" cy="186" rx="14" ry="27" fill={f('quads')} />
        {/* Calves front */}
        <ellipse cx="38" cy="247" rx="10" ry="17" fill={f('calves')} />
        <ellipse cx="68" cy="247" rx="10" ry="17" fill={f('calves')} />

        {/* ── DIVIDER ──────────────────────────────────── */}
        <line x1="112" y1="12" x2="112" y2="280" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

        {/* ── BACK SILHOUETTE (cx 171) ─────────────────── */}
        {/* Head */}
        <circle cx="171" cy="23" r="14" fill="rgba(255,255,255,0.05)" stroke={bodyOutline} strokeWidth="1" />
        {/* Neck */}
        <rect x="167" y="36" width="8" height="9" rx="3" fill="rgba(255,255,255,0.05)" stroke={bodyOutline} strokeWidth="1" />
        {/* Torso */}
        <rect x="147" y="45" width="48" height="94" rx="10" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        {/* Upper arms */}
        <rect x="127" y="55" width="17" height="65" rx="8" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        <rect x="198" y="55" width="17" height="65" rx="8" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        {/* Forearms */}
        <rect x="125" y="121" width="14" height="50" rx="7" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        <rect x="203" y="121" width="14" height="50" rx="7" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        {/* Legs */}
        <rect x="147" y="141" width="20" height="130" rx="10" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />
        <rect x="175" y="141" width="20" height="130" rx="10" fill="rgba(255,255,255,0.04)" stroke={bodyOutline} strokeWidth="1" />

        {/* ── BACK MUSCLES ─────────────────────────────── */}
        {/* Traps */}
        <ellipse cx="171" cy="53" rx="19" ry="11" fill={f('traps')} />
        {/* Rear delts */}
        <ellipse cx="144" cy="61" rx="12" ry="11" fill={f('rear-delt')} />
        <ellipse cx="198" cy="61" rx="12" ry="11" fill={f('rear-delt')} />
        {/* Rhomboids (center upper back) */}
        <rect x="158" y="67" width="26" height="22" rx="5" fill={f('rhomboids')} />
        {/* Lats */}
        <ellipse cx="147" cy="98" rx="13" ry="27" fill={f('lats')} />
        <ellipse cx="195" cy="98" rx="13" ry="27" fill={f('lats')} />
        {/* Lower back */}
        <rect x="159" y="98" width="24" height="18" rx="4" fill={f('lower-back')} />
        {/* Triceps */}
        <ellipse cx="131" cy="92" rx="7"  ry="15" fill={f('triceps')} />
        <ellipse cx="211" cy="92" rx="7"  ry="15" fill={f('triceps')} />
        {/* Forearms back — same key */}
        <ellipse cx="130" cy="134" rx="6" ry="12" fill={f('forearms')} />
        <ellipse cx="212" cy="134" rx="6" ry="12" fill={f('forearms')} />
        {/* Glutes */}
        <ellipse cx="158" cy="163" rx="15" ry="17" fill={f('glutes')} />
        <ellipse cx="184" cy="163" rx="15" ry="17" fill={f('glutes')} />
        {/* Hamstrings */}
        <ellipse cx="157" cy="205" rx="13" ry="23" fill={f('hamstrings')} />
        <ellipse cx="185" cy="205" rx="13" ry="23" fill={f('hamstrings')} />
        {/* Calves back */}
        <ellipse cx="156" cy="248" rx="10" ry="16" fill={f('calves')} />
        <ellipse cx="186" cy="248" rx="10" ry="16" fill={f('calves')} />
      </svg>

      {/* Legend */}
      {muscles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 8, justifyContent: 'center' }}>
          {muscles.map((m) => (
            <span
              key={m}
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(123,92,240,0.18)', color: '#a990ff', fontWeight: 600 }}
            >
              {MUSCLE_LABELS[m]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
