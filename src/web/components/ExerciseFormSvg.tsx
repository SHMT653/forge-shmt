import type { MovementPattern } from '@/domain/exerciseGuide';

/**
 * How the movement is performed, drawn rather than described.
 *
 * Same visual language as the muscle map: flat, schematic, violet for what is
 * doing the work and faint white for everything else. Photographs would need
 * licences and 176 of them; a figure per *movement pattern* covers the whole
 * table, and the pattern is the level at which execution actually differs.
 *
 * Every figure is built from the same seven joints, so the poses stay
 * consistent with each other and a new one costs a handful of coordinates
 * instead of a drawing. Coordinates are on a 100×100 canvas with the floor at
 * y = 94.
 */

type Point = readonly [number, number];

type Joints = {
  head: Point;
  shoulder: Point;
  elbow: Point;
  hand: Point;
  hip: Point;
  knee: Point;
  foot: Point;
  /** Toe end of the foot. Without it a calf raise looks like standing still. */
  toe?: Point;
  toeB?: Point;
  /** Second arm and leg, for figures drawn from the front. */
  elbowB?: Point;
  handB?: Point;
  kneeB?: Point;
  footB?: Point;
};

type Prop = 'floor' | 'bench' | 'bar-overhead' | 'seat' | 'wall' | 'none';

type Pose = {
  joints: Joints;
  /** The chain that does the work, drawn in violet. */
  active: 'arm' | 'leg' | 'torso';
  load?: 'bar' | 'dumbbell';
  prop?: Prop;
};

type Figure = {
  start: Pose;
  /** Absent for holds — there is only one position. */
  end?: Pose;
  startLabel?: string;
  endLabel?: string;
};

const ON = '#7b5cf0';
const OFF = 'rgba(255,255,255,0.22)';
const PROP_COLOR = 'rgba(255,255,255,0.22)';

// ── Reusable joint sets ─────────────────────────────────────────────────────
const STANDING: Joints = {
  head: [50, 15], shoulder: [50, 27], elbow: [44, 41], hand: [44, 55],
  hip: [50, 52], knee: [50, 73], foot: [50, 94], toe: [60, 94],
};

/** Front view: both arms and both legs are drawn apart. */
const STANDING_FRONT: Joints = {
  head: [50, 15], shoulder: [50, 28], hip: [50, 54],
  elbow: [38, 42], hand: [38, 58], elbowB: [62, 42], handB: [62, 58],
  knee: [44, 74], foot: [44, 94], kneeB: [56, 74], footB: [56, 94],
};

const FIGURES: Record<MovementPattern, Figure> = {
  'horizontal-push': {
    startLabel: 'Arme gestreckt',
    endLabel: 'Am Brustkorb',
    start: {
      prop: 'bench', active: 'arm', load: 'bar',
      joints: {
        head: [22, 54], shoulder: [36, 58], elbow: [37, 45], hand: [38, 32],
        hip: [60, 60], knee: [77, 66], foot: [83, 86],
      },
    },
    end: {
      prop: 'bench', active: 'arm', load: 'bar',
      joints: {
        head: [22, 54], shoulder: [36, 58], elbow: [26, 48], hand: [38, 50],
        hip: [60, 60], knee: [77, 66], foot: [83, 86],
      },
    },
  },

  'vertical-push': {
    startLabel: 'Auf Schulterhöhe',
    endLabel: 'Ganz gestreckt',
    start: {
      prop: 'floor', active: 'arm', load: 'bar',
      joints: { ...STANDING, elbow: [36, 38], hand: [46, 28] },
    },
    end: {
      prop: 'floor', active: 'arm', load: 'bar',
      joints: { ...STANDING, elbow: [48, 17], hand: [50, 5] },
    },
  },

  fly: {
    startLabel: 'Weit geöffnet',
    endLabel: 'Zusammengeführt',
    start: {
      prop: 'floor', active: 'arm',
      joints: {
        ...STANDING_FRONT,
        elbow: [28, 32], hand: [13, 34], elbowB: [72, 32], handB: [87, 34],
      },
    },
    end: {
      prop: 'floor', active: 'arm',
      joints: {
        ...STANDING_FRONT,
        elbow: [38, 34], hand: [47, 42], elbowB: [62, 34], handB: [53, 42],
      },
    },
  },

  raise: {
    startLabel: 'Arme unten',
    endLabel: 'Schulterhöhe',
    start: { prop: 'floor', active: 'arm', load: 'dumbbell', joints: STANDING_FRONT },
    end: {
      prop: 'floor', active: 'arm', load: 'dumbbell',
      joints: {
        ...STANDING_FRONT,
        elbow: [31, 29], hand: [16, 30], elbowB: [69, 29], handB: [84, 30],
      },
    },
  },

  'vertical-pull': {
    startLabel: 'Voll ausgehängt',
    endLabel: 'Brust zur Stange',
    start: {
      prop: 'bar-overhead', active: 'arm',
      joints: {
        head: [50, 28], shoulder: [50, 38], elbow: [50, 24], hand: [50, 11],
        hip: [50, 62], knee: [50, 80], foot: [52, 94],
      },
    },
    end: {
      prop: 'bar-overhead', active: 'arm',
      joints: {
        head: [50, 18], shoulder: [50, 27], elbow: [40, 25], hand: [50, 11],
        hip: [50, 51], knee: [56, 69], foot: [50, 84],
      },
    },
  },

  'horizontal-pull': {
    startLabel: 'Arme lang',
    endLabel: 'Zum Rumpf gezogen',
    start: {
      prop: 'floor', active: 'arm', load: 'bar',
      joints: {
        head: [70, 36], shoulder: [61, 44], elbow: [61, 58], hand: [61, 72],
        hip: [40, 55], knee: [42, 75], foot: [40, 94],
      },
    },
    end: {
      prop: 'floor', active: 'arm', load: 'bar',
      joints: {
        head: [70, 36], shoulder: [61, 44], elbow: [44, 52], hand: [57, 53],
        hip: [40, 55], knee: [42, 75], foot: [40, 94],
      },
    },
  },

  'back-extension': {
    startLabel: 'Flach abgelegt',
    endLabel: 'Brust und Beine an',
    start: {
      prop: 'floor', active: 'torso',
      joints: {
        head: [18, 82], shoulder: [32, 84], elbow: [22, 88], hand: [10, 90],
        hip: [60, 86], knee: [74, 86], foot: [88, 86],
      },
    },
    end: {
      prop: 'floor', active: 'torso',
      joints: {
        head: [14, 66], shoulder: [30, 76], elbow: [18, 70], hand: [6, 64],
        hip: [60, 86], knee: [76, 80], foot: [90, 70],
      },
    },
  },

  squat: {
    startLabel: 'Aufrecht',
    endLabel: 'Mind. parallel',
    start: {
      prop: 'floor', active: 'leg', load: 'bar',
      joints: { ...STANDING, elbow: [60, 33], hand: [60, 26] },
    },
    end: {
      prop: 'floor', active: 'leg', load: 'bar',
      joints: {
        head: [59, 33], shoulder: [54, 44], elbow: [63, 49], hand: [63, 42],
        hip: [41, 66], knee: [59, 75], foot: [51, 94],
      },
    },
  },

  lunge: {
    startLabel: 'Schritt gesetzt',
    endLabel: 'Hinteres Knie tief',
    start: {
      prop: 'floor', active: 'leg',
      joints: {
        head: [48, 15], shoulder: [48, 27], elbow: [43, 40], hand: [43, 53],
        hip: [48, 52], knee: [62, 72], foot: [66, 94],
        kneeB: [38, 72], footB: [30, 94],
      },
    },
    end: {
      prop: 'floor', active: 'leg',
      joints: {
        head: [48, 24], shoulder: [48, 36], elbow: [43, 48], hand: [43, 60],
        hip: [48, 61], knee: [66, 74], foot: [67, 94],
        kneeB: [34, 84], footB: [26, 94],
      },
    },
  },

  hinge: {
    startLabel: 'Aufgerichtet',
    endLabel: 'Hüfte nach hinten',
    start: {
      prop: 'floor', active: 'torso', load: 'bar',
      joints: { ...STANDING, elbow: [48, 40], hand: [48, 55] },
    },
    end: {
      prop: 'floor', active: 'torso', load: 'bar',
      joints: {
        head: [72, 40], shoulder: [62, 45], elbow: [62, 59], hand: [62, 72],
        hip: [40, 54], knee: [50, 74], foot: [46, 94],
      },
    },
  },

  'hip-bridge': {
    startLabel: 'Hüfte am Boden',
    endLabel: 'Gestreckt, oben halten',
    start: {
      prop: 'floor', active: 'leg',
      joints: {
        head: [18, 80], shoulder: [30, 82], elbow: [34, 90], hand: [44, 92],
        hip: [56, 84], knee: [72, 70], foot: [80, 92],
      },
    },
    end: {
      prop: 'floor', active: 'leg',
      joints: {
        head: [18, 80], shoulder: [30, 82], elbow: [34, 90], hand: [44, 92],
        hip: [58, 66], knee: [74, 68], foot: [80, 92],
      },
    },
  },

  'knee-extension': {
    startLabel: 'Knie gebeugt',
    endLabel: 'Voll gestreckt',
    start: {
      prop: 'seat', active: 'leg',
      joints: {
        head: [32, 26], shoulder: [36, 38], elbow: [44, 48], hand: [52, 54],
        hip: [42, 60], knee: [62, 60], foot: [62, 82],
      },
    },
    end: {
      prop: 'seat', active: 'leg',
      joints: {
        head: [32, 26], shoulder: [36, 38], elbow: [44, 48], hand: [52, 54],
        hip: [42, 60], knee: [62, 60], foot: [86, 58],
      },
    },
  },

  'knee-flexion': {
    startLabel: 'Bein lang',
    endLabel: 'Ferse angezogen',
    start: {
      prop: 'bench', active: 'leg',
      joints: {
        head: [14, 68], shoulder: [26, 72], elbow: [32, 80], hand: [40, 84],
        hip: [54, 74], knee: [70, 74], foot: [88, 74],
      },
    },
    end: {
      prop: 'bench', active: 'leg',
      joints: {
        head: [14, 68], shoulder: [26, 72], elbow: [32, 80], hand: [40, 84],
        hip: [54, 74], knee: [70, 74], foot: [76, 50],
      },
    },
  },

  'hip-abduction': {
    startLabel: 'Beine zusammen',
    endLabel: 'Bein nach außen',
    start: {
      prop: 'floor', active: 'leg',
      joints: { ...STANDING_FRONT, knee: [46, 74], foot: [46, 94], kneeB: [54, 74], footB: [54, 94] },
    },
    end: {
      prop: 'floor', active: 'leg',
      joints: { ...STANDING_FRONT, knee: [46, 74], foot: [46, 94], kneeB: [70, 72], footB: [84, 88] },
    },
  },

  'hip-adduction': {
    startLabel: 'Beine geöffnet',
    endLabel: 'Zusammengeführt',
    start: {
      prop: 'floor', active: 'leg',
      joints: { ...STANDING_FRONT, knee: [34, 74], foot: [24, 92], kneeB: [66, 74], footB: [76, 92] },
    },
    end: {
      prop: 'floor', active: 'leg',
      joints: { ...STANDING_FRONT, knee: [46, 74], foot: [46, 94], kneeB: [54, 74], footB: [54, 94] },
    },
  },

  calf: {
    startLabel: 'Ferse abgesenkt',
    endLabel: 'Auf den Ballen',
    start: {
      prop: 'floor', active: 'leg',
      joints: {
        head: [50, 15], shoulder: [50, 27], elbow: [44, 41], hand: [44, 55],
        hip: [50, 52], knee: [50, 73], foot: [48, 95], toe: [62, 95],
      },
    },
    end: {
      prop: 'floor', active: 'leg',
      joints: {
        head: [50, 7], shoulder: [50, 19], elbow: [44, 33], hand: [44, 47],
        hip: [50, 44], knee: [50, 65], foot: [48, 83], toe: [62, 95],
      },
    },
  },

  curl: {
    startLabel: 'Arme gestreckt',
    endLabel: 'Voll gebeugt',
    start: { prop: 'floor', active: 'arm', load: 'dumbbell', joints: STANDING_FRONT },
    end: {
      prop: 'floor', active: 'arm', load: 'dumbbell',
      joints: {
        ...STANDING_FRONT,
        elbow: [36, 47], hand: [45, 35], elbowB: [64, 47], handB: [55, 35],
      },
    },
  },

  'triceps-extension': {
    startLabel: 'Ellbogen gebeugt',
    endLabel: 'Voll gestreckt',
    start: {
      prop: 'floor', active: 'arm',
      joints: {
        ...STANDING_FRONT,
        elbow: [40, 44], hand: [44, 32], elbowB: [60, 44], handB: [56, 32],
      },
    },
    end: {
      prop: 'floor', active: 'arm',
      joints: {
        ...STANDING_FRONT,
        elbow: [40, 44], hand: [42, 60], elbowB: [60, 44], handB: [58, 60],
      },
    },
  },

  'core-flexion': {
    startLabel: 'Flach am Boden',
    endLabel: 'Eingerollt',
    start: {
      prop: 'floor', active: 'torso',
      joints: {
        head: [20, 80], shoulder: [32, 84], elbow: [28, 74], hand: [22, 72],
        hip: [58, 86], knee: [74, 70], foot: [84, 88],
      },
    },
    end: {
      prop: 'floor', active: 'torso',
      joints: {
        head: [30, 64], shoulder: [40, 74], elbow: [34, 66], hand: [30, 62],
        hip: [58, 86], knee: [74, 70], foot: [84, 88],
      },
    },
  },

  'core-rotation': {
    startLabel: 'Mittig',
    endLabel: 'Zur Seite gedreht',
    start: {
      prop: 'floor', active: 'torso',
      joints: {
        ...STANDING_FRONT,
        elbow: [42, 40], hand: [50, 46], elbowB: [58, 40], handB: [50, 46],
      },
    },
    end: {
      prop: 'floor', active: 'torso',
      joints: {
        ...STANDING_FRONT,
        elbow: [62, 38], hand: [78, 34], elbowB: [64, 40], handB: [78, 34],
      },
    },
  },

  'core-hold': {
    startLabel: 'Gerade Linie halten',
    start: {
      prop: 'floor', active: 'torso',
      joints: {
        head: [16, 60], shoulder: [30, 64], elbow: [30, 80], hand: [18, 82],
        hip: [58, 72], knee: [74, 80], foot: [88, 88],
      },
    },
  },

  'iso-hold': {
    startLabel: 'Position halten',
    start: {
      prop: 'wall', active: 'leg',
      joints: {
        head: [40, 26], shoulder: [40, 38], elbow: [46, 48], hand: [54, 54],
        hip: [40, 62], knee: [64, 62], foot: [64, 94],
      },
    },
  },

  carry: {
    startLabel: 'Aufrecht tragen',
    start: {
      prop: 'floor', active: 'torso', load: 'dumbbell',
      joints: STANDING_FRONT,
    },
  },

  complex: {
    startLabel: 'Unten aufbauen',
    endLabel: 'Oben stabil',
    start: {
      prop: 'floor', active: 'torso', load: 'dumbbell',
      joints: { ...STANDING, elbow: [40, 40], hand: [42, 54] },
    },
    end: {
      prop: 'floor', active: 'torso', load: 'dumbbell',
      joints: { ...STANDING, elbow: [48, 16], hand: [50, 4] },
    },
  },

  cardio: {
    startLabel: 'Abdruck',
    endLabel: 'Schwungbein vor',
    start: {
      prop: 'floor', active: 'leg',
      joints: {
        head: [50, 15], shoulder: [50, 27], elbow: [62, 36], hand: [66, 26],
        hip: [48, 54], knee: [64, 68], foot: [70, 88],
        kneeB: [34, 70], footB: [26, 90],
      },
    },
    end: {
      prop: 'floor', active: 'leg',
      joints: {
        head: [50, 15], shoulder: [50, 27], elbow: [38, 36], hand: [34, 26],
        hip: [48, 54], knee: [34, 66], foot: [26, 82],
        kneeB: [64, 70], footB: [72, 90],
      },
    },
  },
};

function Prop({ kind }: { kind: Prop }) {
  if (kind === 'floor') {
    return <line x1="6" y1="95" x2="94" y2="95" stroke={PROP_COLOR} strokeWidth="2" strokeLinecap="round" />;
  }
  if (kind === 'bench') {
    return (
      <>
        <rect x="16" y="64" width="58" height="4" rx="2" fill={PROP_COLOR} />
        <line x1="6" y1="95" x2="94" y2="95" stroke={PROP_COLOR} strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  if (kind === 'bar-overhead') {
    return <line x1="20" y1="10" x2="80" y2="10" stroke={PROP_COLOR} strokeWidth="3" strokeLinecap="round" />;
  }
  if (kind === 'wall') {
    return (
      <>
        <line x1="32" y1="16" x2="32" y2="95" stroke={PROP_COLOR} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="6" y1="95" x2="94" y2="95" stroke={PROP_COLOR} strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  if (kind === 'seat') {
    return (
      <>
        <rect x="24" y="62" width="34" height="5" rx="2.5" fill={PROP_COLOR} />
        <line x1="6" y1="95" x2="94" y2="95" stroke={PROP_COLOR} strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  return null;
}

function Load({ at, kind }: { at: Point; kind: 'bar' | 'dumbbell' }) {
  const [x, y] = at;
  if (kind === 'bar') {
    return <line x1={x - 13} y1={y} x2={x + 13} y2={y} stroke={ON} strokeWidth="3" strokeLinecap="round" />;
  }
  return <rect x={x - 5} y={y - 2.5} width="10" height="5" rx="2" fill={ON} />;
}

function Body({ pose }: { pose: Pose }) {
  const j = pose.joints;
  const armColor = pose.active === 'arm' ? ON : OFF;
  const legColor = pose.active === 'leg' ? ON : OFF;
  const torsoColor = pose.active === 'torso' ? ON : OFF;
  const path = (points: Point[]) => points.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* Legs first, so the torso and arms sit on top. */}
      {j.kneeB && j.footB && (
        <polyline points={path([j.hip, j.kneeB, j.footB])} stroke={legColor} strokeWidth="5" opacity="0.55" />
      )}
      <polyline points={path([j.hip, j.knee, j.foot])} stroke={legColor} strokeWidth="5.5" />
      {j.toe && <line x1={j.foot[0]} y1={j.foot[1]} x2={j.toe[0]} y2={j.toe[1]} stroke={legColor} strokeWidth="4" />}
      {j.toeB && j.footB && (
        <line x1={j.footB[0]} y1={j.footB[1]} x2={j.toeB[0]} y2={j.toeB[1]} stroke={legColor} strokeWidth="3.5" opacity="0.55" />
      )}

      <line x1={j.shoulder[0]} y1={j.shoulder[1]} x2={j.hip[0]} y2={j.hip[1]} stroke={torsoColor} strokeWidth="7" />

      {j.elbowB && j.handB && (
        <polyline points={path([j.shoulder, j.elbowB, j.handB])} stroke={armColor} strokeWidth="4" opacity="0.55" />
      )}
      <polyline points={path([j.shoulder, j.elbow, j.hand])} stroke={armColor} strokeWidth="4.5" />

      <circle cx={j.head[0]} cy={j.head[1]} r="7" fill="rgba(255,255,255,0.06)" stroke={OFF} strokeWidth="2" />

      {pose.load && <Load at={j.hand} kind={pose.load} />}
      {pose.load && j.handB && <Load at={j.handB} kind={pose.load} />}
    </g>
  );
}

function Panel({ pose, label }: { pose: Pose; label: string }) {
  return (
    <figure className="form-figure">
      <svg viewBox="0 0 100 100" width="100%" aria-hidden>
        <Prop kind={pose.prop ?? 'floor'} />
        <Body pose={pose} />
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function ExerciseFormSvg({ pattern, patternLabel }: { pattern: MovementPattern; patternLabel: string }) {
  const figure = FIGURES[pattern];
  if (!figure) return null;

  return (
    <div
      className="form-figures"
      role="img"
      aria-label={`Schematische Darstellung: ${patternLabel}${figure.end ? ' — Start- und Endposition' : ' — Halteposition'}`}
    >
      <Panel pose={figure.start} label={figure.startLabel ?? 'Start'} />
      {figure.end && (
        <>
          <span className="form-arrow" aria-hidden>→</span>
          <Panel pose={figure.end} label={figure.endLabel ?? 'Ende'} />
        </>
      )}
    </div>
  );
}
