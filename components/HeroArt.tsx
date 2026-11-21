import type { CSSProperties } from "react";

// « Barrières → passage »
//
// Le champ de traits verticaux représente les barrières. Un passage libre le traverse : les
// traits proches s'inclinent dans le sens du flux (les barrières s'écartent), et au centre
// la voie est entièrement dégagée. Dans cette voie, « sans barrières » est écrit en braille
// français (14 cellules). Décor purement graphique (aria-hidden) généré par calcul : aucune
// image, aucun hasard, le même dessin à chaque construction.

const W = 900;
const H = 700;

// Le passage : une courbe de Bézier qui monte de la gauche vers la droite.
const P = [
  [-60, 640],
  [260, 700],
  [470, 30],
  [960, 120],
] as const;

const SAMPLES = 500;
const LANE = 36; // demi-largeur de la voie dégagée
const REACH = 120; // distance sur laquelle les traits s'alignent sur le flux
const GRID = 34;

type Sample = { x: number; y: number; angle: number; s: number };

function bezier(t: number): [number, number] {
  const u = 1 - t;
  const [a, b, c, d] = P;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}

function tangent(t: number): number {
  const u = 1 - t;
  const [a, b, c, d] = P;
  const dx =
    3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]);
  const dy =
    3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1]);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

const samples: Sample[] = [];
let travelled = 0;
for (let i = 0; i <= SAMPLES; i += 1) {
  const t = i / SAMPLES;
  const [x, y] = bezier(t);
  if (i > 0) {
    const previous = samples[i - 1];
    travelled += Math.hypot(x - previous.x, y - previous.y);
  }
  samples.push({ x, y, angle: tangent(t), s: travelled });
}
const LENGTH = travelled;

const f = (n: number) => n.toFixed(1);
const whole = (n: number) => String(Math.round(n));

// Petit bruit déterministe pour éviter un quadrillage trop mécanique.
function noise(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

// --- Le champ de barrières -------------------------------------------------------------

const BUCKET_OPACITY = [0.2, 0.34, 0.55, 0.8];
const buckets: string[] = BUCKET_OPACITY.map(() => "");

for (let row = 0; row * GRID < H + GRID; row += 1) {
  for (let col = 0; col * GRID < W + GRID; col += 1) {
    const x = GRID / 2 + col * GRID + (row % 2 ? GRID / 4 : 0);
    const y = GRID / 2 + row * GRID;

    let nearest = samples[0];
    let best = Infinity;
    for (const sample of samples) {
      const d = Math.hypot(x - sample.x, y - sample.y);
      if (d < best) {
        best = d;
        nearest = sample;
      }
    }
    if (best < LANE) continue; // la voie est dégagée

    const q = (best - LANE) / REACH;
    const pull = Math.exp(-q * q); // 1 près de la voie, 0 loin

    // Orientation d'une droite (modulo 180°) : de la verticale vers la direction du flux.
    const toward = ((((nearest.angle - 90 + 90) % 180) + 180) % 180) - 90;
    const angle = ((90 + pull * toward) * Math.PI) / 180;

    const half = (8 + 9 * pull) * (0.85 + 0.3 * noise(col, row));
    const dx = Math.cos(angle) * half;
    const dy = Math.sin(angle) * half;

    const bucket = pull < 0.12 ? 0 : pull < 0.35 ? 1 : pull < 0.65 ? 2 : 3;
    buckets[bucket] += `M${whole(x - dx)} ${whole(y - dy)}L${whole(x + dx)} ${whole(y + dy)}`;
  }
}

// --- « sans barrières » en braille français --------------------------------------------
// Numérotation des points : 1 2 3 de haut en bas à gauche, 4 5 6 de haut en bas à droite.

const BRAILLE: Record<string, number[]> = {
  s: [2, 3, 4],
  a: [1],
  n: [1, 3, 4, 5],
  b: [1, 2],
  r: [1, 2, 3, 5],
  i: [2, 4],
  è: [2, 3, 4, 6],
  e: [1, 5],
};

const TEXT = "sans barrières"; // ⠎⠁⠝⠎ ⠃⠁⠗⠗⠊⠮⠗⠑⠎ (U+280E U+2801 U+281D U+280E · U+2803 U+2801 U+2817 U+2817 U+280A U+282E U+2817 U+2811 U+280E)
const ADVANCE = 60;
const DOT_X = 9.5;
const DOT_Y = 17;
const RAISED = 5.4;
const FLAT = 2;

function at(distance: number): Sample {
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (samples[mid].s < distance) low = mid + 1;
    else high = mid;
  }
  return samples[low];
}

const raised: { x: number; y: number; order: number }[] = [];
const flat: { x: number; y: number }[] = [];
const start = LENGTH * 0.5 - (TEXT.length * ADVANCE) / 2;
let order = 0;

[...TEXT].forEach((letter, index) => {
  const dots = BRAILLE[letter];
  if (!dots) return; // l'espace entre deux mots reste vide
  const centre = at(start + (index + 0.5) * ADVANCE);
  const angle = (centre.angle * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let dot = 1; dot <= 6; dot += 1) {
    const column = dot <= 3 ? -1 : 1;
    const line = ((dot - 1) % 3) - 1;
    const lx = column * DOT_X;
    const ly = line * DOT_Y;
    const x = centre.x + lx * cos - ly * sin;
    const y = centre.y + lx * sin + ly * cos;
    if (dots.includes(dot)) {
      raised.push({ x, y, order });
      order += 1;
    } else {
      flat.push({ x, y });
    }
  }
});

export default function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
        <g className="hero-bars">
          {buckets.map((d, i) => (
            <path key={i} d={d} style={{ opacity: BUCKET_OPACITY[i] }} />
          ))}
        </g>
        <g className="hero-braille">
          {flat.map((dot, i) => (
            <circle key={i} className="hero-braille-flat" cx={f(dot.x)} cy={f(dot.y)} r={FLAT} />
          ))}
          {raised.map((dot, i) => (
            <circle
              key={i}
              className="hero-braille-dot"
              cx={f(dot.x)}
              cy={f(dot.y)}
              r={RAISED}
              style={{ "--i": dot.order } as CSSProperties}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
