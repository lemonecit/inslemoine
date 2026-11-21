// Logo : les lettres « I » et « L » (Institut Lemoine) écrites en braille, comme le passage du
// dessin d'accueil. Décoratif : le nom du site est déjà écrit en toutes lettres à côté.
// Une cellule braille a deux colonnes : points 1-2-3 à gauche, 4-5-6 à droite.
const CELLS = [
  { x: [15, 26], raised: [2, 4] }, // I = points 2 et 4
  { x: [38, 49], raised: [1, 2, 3] }, // L = points 1, 2 et 3
];
const ROWS = [17, 32, 47];

const DOTS = CELLS.flatMap(({ x, raised }) =>
  [1, 2, 3, 4, 5, 6].map((n) => ({
    cx: x[n <= 3 ? 0 : 1],
    cy: ROWS[(n - 1) % 3],
    raised: raised.includes(n),
  })),
);

export default function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="14" className="brand-mark-bg" />
      {DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.raised ? 5.5 : 2.2}
          className={d.raised ? "brand-mark-dot" : "brand-mark-flat"}
        />
      ))}
    </svg>
  );
}
