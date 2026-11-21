"use client";

import { useSyncExternalStore, type CSSProperties } from "react";

// « Barrières → passage »
//
// Le champ de traits verticaux représente les barrières. Un passage libre le traverse : les
// traits proches s'inclinent dans le sens du flux (les barrières s'écartent), et au centre
// la voie est entièrement dégagée. Dans cette voie, « sans barrières » est écrit en braille
// français (14 cellules). Décor purement graphique (aria-hidden) généré par calcul : aucune
// image, aucun hasard, le même dessin à chaque chargement.
//
// Le dessin est calculé dans le navigateur (quelques millisecondes) plutôt que livré dans le
// HTML : il pèserait ~20 Ko compressés de plus à chaque visite pour un simple décor.
//
// Deux compositions issues du même algorithme : une large (ordinateur) et une en hauteur
// (mobile), où le passage occupe le bas de l'écran et les traits s'estompent vers le haut.

type Config = {
  width: number;
  height: number;
  curve: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ];
  lane: number; // demi-largeur de la voie dégagée
  reach: number; // distance sur laquelle les traits s'alignent sur le flux
  grid: number; // pas du champ de traits
  advance: number; // distance entre deux cellules braille
  dotX: number;
  dotY: number;
  raised: number; // rayon d'un point en relief
  flat: number; // rayon d'un point à plat
  halfMin: number;
  halfGain: number;
};

const WIDE: Config = {
  width: 900,
  height: 700,
  curve: [
    [-60, 640],
    [260, 700],
    [470, 30],
    [960, 120],
  ],
  lane: 36,
  reach: 120,
  grid: 36,
  advance: 60,
  dotX: 9.5,
  dotY: 17,
  raised: 5.4,
  flat: 2,
  halfMin: 8,
  halfGain: 9,
};

const TALL: Config = {
  width: 430,
  height: 760,
  curve: [
    [-50, 735],
    [130, 760],
    [290, 560],
    [480, 505],
  ],
  lane: 27,
  reach: 100,
  grid: 30,
  advance: 35,
  dotX: 6.5,
  dotY: 11.5,
  raised: 3.7,
  flat: 1.4,
  halfMin: 7,
  halfGain: 7,
};

const SAMPLES = 500;

// Braille français. Numérotation des points : 1 2 3 de haut en bas à gauche, 4 5 6 à droite.
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

const BUCKET_OPACITY = [0.2, 0.34, 0.55, 0.8];

type Sample = { x: number; y: number; angle: number; s: number };

const f = (n: number) => n.toFixed(1);
const whole = (n: number) => String(Math.round(n));

// Petit bruit déterministe pour éviter un quadrillage trop mécanique.
function noise(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function generate(cfg: Config) {
  const [p0, p1, p2, p3] = cfg.curve;

  const bezier = (t: number): [number, number] => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  };

  const tangent = (t: number): number => {
    const u = 1 - t;
    const dx =
      3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
    const dy =
      3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

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

  // Le champ de barrières.
  const buckets: string[] = BUCKET_OPACITY.map(() => "");
  for (let row = 0; row * cfg.grid < cfg.height + cfg.grid; row += 1) {
    for (let col = 0; col * cfg.grid < cfg.width + cfg.grid; col += 1) {
      const x = cfg.grid / 2 + col * cfg.grid + (row % 2 ? cfg.grid / 4 : 0);
      const y = cfg.grid / 2 + row * cfg.grid;

      let nearest = samples[0];
      let best = Infinity;
      for (const sample of samples) {
        const d = Math.hypot(x - sample.x, y - sample.y);
        if (d < best) {
          best = d;
          nearest = sample;
        }
      }
      if (best < cfg.lane) continue; // la voie est dégagée

      const q = (best - cfg.lane) / cfg.reach;
      const pull = Math.exp(-q * q); // 1 près de la voie, 0 loin

      // Orientation d'une droite (modulo 180°) : de la verticale vers la direction du flux.
      const toward = ((((nearest.angle - 90 + 90) % 180) + 180) % 180) - 90;
      const angle = ((90 + pull * toward) * Math.PI) / 180;

      const half = (cfg.halfMin + cfg.halfGain * pull) * (0.85 + 0.3 * noise(col, row));
      const dx = Math.cos(angle) * half;
      const dy = Math.sin(angle) * half;

      const bucket = pull < 0.12 ? 0 : pull < 0.35 ? 1 : pull < 0.65 ? 2 : 3;
      buckets[bucket] += `M${whole(x - dx)} ${whole(y - dy)}L${whole(x + dx)} ${whole(y + dy)}`;
    }
  }

  // « sans barrières » en braille, le long du passage.
  const at = (distance: number): Sample => {
    let low = 0;
    let high = samples.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (samples[mid].s < distance) low = mid + 1;
      else high = mid;
    }
    return samples[low];
  };

  const raised: { x: number; y: number; order: number }[] = [];
  const flat: { x: number; y: number }[] = [];
  const start = travelled * 0.5 - (TEXT.length * cfg.advance) / 2;
  let order = 0;

  [...TEXT].forEach((letter, index) => {
    const dots = BRAILLE[letter];
    if (!dots) return; // l'espace entre deux mots reste vide
    const centre = at(start + (index + 0.5) * cfg.advance);
    const angle = (centre.angle * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (let dot = 1; dot <= 6; dot += 1) {
      const column = dot <= 3 ? -1 : 1;
      const line = ((dot - 1) % 3) - 1;
      const lx = column * cfg.dotX;
      const ly = line * cfg.dotY;
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

  return { buckets, raised, flat };
}

type Art = ReturnType<typeof generate>;
let cache: { wide: Art; tall: Art } | undefined;

function arts() {
  cache ??= { wide: generate(WIDE), tall: generate(TALL) };
  return cache;
}

function Art({
  cfg,
  art,
  className,
}: {
  cfg: Config;
  art: Art;
  className: string;
}) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${cfg.width} ${cfg.height}`}
      preserveAspectRatio="xMidYMid slice"
      focusable="false"
    >
      <g className="hero-bars">
        {art.buckets.map((d, i) => (
          <path key={i} d={d} style={{ opacity: BUCKET_OPACITY[i] }} />
        ))}
      </g>
      <g className="hero-braille">
        {art.flat.map((dot, i) => (
          <circle key={i} className="hero-braille-flat" cx={f(dot.x)} cy={f(dot.y)} r={cfg.flat} />
        ))}
        {art.raised.map((dot, i) => (
          <circle
            key={i}
            className="hero-braille-dot"
            cx={f(dot.x)}
            cy={f(dot.y)}
            r={cfg.raised}
            style={{ "--i": dot.order } as CSSProperties}
          />
        ))}
      </g>
    </svg>
  );
}

const noop = () => () => {};

export default function HeroArt() {
  // false pendant le rendu serveur et l'hydratation, true ensuite : le décor apparaît sans
  // alourdir le HTML ni provoquer de différence d'hydratation.
  const ready = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  return (
    <div className="hero-art" aria-hidden="true">
      {ready && (
        <>
          <Art cfg={WIDE} art={arts().wide} className="hero-art-wide" />
          <Art cfg={TALL} art={arts().tall} className="hero-art-tall" />
        </>
      )}
    </div>
  );
}
