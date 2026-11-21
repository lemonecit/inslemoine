import AccessibilityMenu from "@/components/AccessibilityMenu";
import BrandMark from "@/components/BrandMark";
import HeaderObserver from "@/components/HeaderObserver";
import HeroArt from "@/components/HeroArt";
import PdfReader from "@/components/PdfReader";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

export default function Home() {
  return (
    <>
      <HeaderObserver />
      <header className="site-header">
        <div className="container header-bar">
          <span className="brand">
            <BrandMark />
            <span className="brand-text">
              <span>Institut Lemoine</span>
              <span className="brand-accent">Accessibilité</span>
            </span>
          </span>
          <div className="header-tools">
            <SiteNav />
            <AccessibilityMenu />
          </div>
        </div>
      </header>

      <main id="contenu-principal">
        <section className="hero" aria-labelledby="titre-principal">
          <HeroArt />
          <div className="container hero-inner">
            <p className="hero-eyebrow">Association loi 1901 · Paris</p>
            <h1 id="titre-principal">Institut Lemoine Accessibilité</h1>
            <p className="hero-tagline">
              Pour un monde numérique sans barrières.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#contact">
                Nous contacter <span aria-hidden="true">→</span>
              </a>
              <a className="button button-outline" href="#nos-actions">
                Découvrir nos actions
              </a>
            </div>
          </div>
        </section>

        <section
          id="qui-sommes-nous"
          className="section"
          aria-labelledby="titre-qui-sommes-nous"
        >
          <div className="container">
            <p className="eyebrow">Notre mission</p>
            <h2 id="titre-qui-sommes-nous">Qui sommes-nous&nbsp;?</h2>
            <p className="prose lead">
              L&rsquo;Institut Lemoine Accessibilité est une association
              française dédiée à l&rsquo;inclusion numérique. Notre mission est
              claire&nbsp;: garantir que chaque personne, quelle que soit sa
              situation de handicap, puisse naviguer, apprendre et interagir
              sur le web avec la même aisance que n&rsquo;importe qui. Nous
              concevons des solutions open-source et accompagnons les
              organisations pour construire un internet véritablement universel
              et conforme aux normes WCAG.
            </p>
            <button
              type="button"
              className="a11y-button read-button"
              data-read-section="qui-sommes-nous"
            >
              Lire en grand
              <span className="visually-hidden"> : Qui sommes-nous&nbsp;?</span>
            </button>
          </div>
        </section>

        <section
          id="nos-actions"
          className="section section-alt"
          aria-labelledby="titre-nos-actions"
        >
          <div className="container">
            <p className="eyebrow">Ce que nous faisons</p>
            <h2 id="titre-nos-actions">Nos actions</h2>
            <ul className="cards">
              <li className="card">
                <span className="card-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.5" y2="16.5" />
                  </svg>
                </span>
                <h3>Audits d&rsquo;accessibilité</h3>
                <p>
                  Nous évaluons la conformité de vos sites et applications aux
                  référentiels WCAG&nbsp;2.2 et RGAA&nbsp;4, et vous remettons
                  un plan d&rsquo;action clair et priorisé.
                </p>
              </li>
              <li className="card">
                <span className="card-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="8 6 3 12 8 18" />
                    <polyline points="16 6 21 12 16 18" />
                  </svg>
                </span>
                <h3>Solutions open-source</h3>
                <p>
                  Nous développons et publions librement des outils et
                  composants accessibles, afin que chacun puisse construire des
                  interfaces inclusives sans repartir de zéro.
                </p>
              </li>
              <li className="card">
                <span className="card-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 9 12 4 2 9l10 5 10-5z" />
                    <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
                  </svg>
                </span>
                <h3>Formation et accompagnement</h3>
                <p>
                  Nous formons les équipes de conception et de développement
                  aux bonnes pratiques de l&rsquo;accessibilité numérique, du
                  design à la mise en production.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section
          id="documents"
          className="section"
          aria-labelledby="titre-documents"
        >
          <div className="container">
            <p className="eyebrow">Ressources</p>
            <h2 id="titre-documents">Documents à lire</h2>
            <p className="prose">
              Nos documents sont proposés en lecture accessible&nbsp;: le texte
              s&rsquo;adapte à la taille, aux couleurs et à l&rsquo;espacement
              que vous avez choisis. Vous pouvez aussi télécharger le PDF
              d&rsquo;origine.
            </p>
            <PdfReader
              src="/documents/cours-accessibilite.pdf"
              title="Introduction à l’accessibilité numérique"
              description="Cours de démonstration, 2 pages : pourquoi l’accessibilité, les principes WCAG, le clavier et les documents PDF."
            />
          </div>
        </section>

        <section
          id="engagement"
          className="section section-alt"
          aria-labelledby="titre-engagement"
        >
          <div className="container">
            <p className="eyebrow">L&rsquo;exemple avant tout</p>
            <h2 id="titre-engagement">Notre engagement</h2>
            <p className="prose">
              Ce site est conçu pour être un exemple de ce que nous défendons.
              Il vise la conformité au niveau&nbsp;AA des WCAG&nbsp;2.2 — et le
              niveau&nbsp;AAA partout où cela est possible&nbsp;: navigation
              complète au clavier, contrastes renforcés, structure sémantique
              rigoureuse et compatibilité avec les lecteurs d&rsquo;écran.
            </p>
            <p className="prose">
              Vous constatez un défaut d&rsquo;accessibilité sur ce site&nbsp;?
              Signalez-le-nous&nbsp;: nous nous engageons à le corriger
              rapidement.
            </p>
            <button
              type="button"
              className="a11y-button read-button"
              data-read-section="engagement"
            >
              Lire en grand
              <span className="visually-hidden"> : Notre engagement</span>
            </button>
          </div>
        </section>

        <section
          id="contact"
          className="section section-contact"
          aria-labelledby="titre-contact"
        >
          <div className="container">
            <p className="eyebrow eyebrow-on-dark">Parlons-en</p>
            <h2 id="titre-contact">Contact</h2>
            <p className="prose">
              Vous souhaitez travailler avec nous, soutenir notre mission ou
              simplement en savoir plus&nbsp;? Écrivez-nous, nous vous
              répondrons avec plaisir.
            </p>
            <p>
              <a
                className="button button-light"
                href="mailto:contact@lemoine-accessibilite.fr"
              >
                Nous écrire par courriel
              </a>
            </p>
            <address>
              Institut Lemoine Accessibilité — Association loi 1901 — Paris,
              France
            </address>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
