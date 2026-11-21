import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main id="contenu-principal" className="section">
      <div className="container">
        <p className="eyebrow">Erreur 404</p>
        <h1>Page introuvable</h1>
        <p className="prose lead">
          La page que vous cherchez n&rsquo;existe pas ou a été déplacée.
        </p>
        <p>
          <Link className="button button-primary" href="/" prefetch={false}>
            Retour à l&rsquo;accueil
          </Link>
        </p>
      </div>
    </main>
  );
}
