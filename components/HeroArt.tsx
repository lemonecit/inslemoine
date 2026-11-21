// Décor du hero : un faisceau de lignes fines qui se resserre puis s'ouvre.
// Purement décoratif (aria-hidden), généré par calcul : aucune image, aucun texte dans l'image.
const COUNT = 9;

const PATHS = Array.from({ length: COUNT }, (_, i) => {
  const k = i - (COUNT - 1) / 2;
  const [x0, y0] = [-20, 632 + i * 8];
  const [px, py] = [600 + k * 1.4, 350 + k * 1.6];
  const [ex, ey] = [1220, 28 + i * 9];
  const [dx, dy] = [150, -125];
  const f = (n: number) => n.toFixed(1);
  return (
    `M${f(x0)} ${f(y0)} C${f(x0 + 380)} ${f(y0 + 8)} ${f(px - dx)} ${f(py - dy)} ${f(px)} ${f(py)} ` +
    `C${f(px + dx)} ${f(py + dy)} ${f(ex - 380)} ${f(ey + 30)} ${f(ex)} ${f(ey)}`
  );
});

export default function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <svg viewBox="0 0 1200 700" preserveAspectRatio="none" focusable="false">
        {PATHS.map((d, i) => (
          <path key={i} d={d} style={{ opacity: 0.35 + (i / (COUNT - 1)) * 0.45 }} />
        ))}
      </svg>
      <span className="hero-dot hero-dot-a" />
      <span className="hero-dot hero-dot-b" />
    </div>
  );
}
