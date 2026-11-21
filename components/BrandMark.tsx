// Petit logo du site : la figure de l'icône d'accessibilité dans un carré arrondi.
// Décoratif : le nom du site est déjà écrit en toutes lettres à côté.
export default function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="14" className="brand-mark-bg" />
      <g
        className="brand-mark-figure"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="32" cy="15" r="5" className="brand-mark-dot" />
        <path d="M14 26l18 4 18-4" />
        <path d="M32 30v13" />
        <path d="M23 56l9-13 9 13" />
      </g>
    </svg>
  );
}
