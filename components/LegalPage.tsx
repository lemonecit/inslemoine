import Link from "next/link";
import type { ReactNode } from "react";
import AccessibilityMenu from "@/components/AccessibilityMenu";
import HeaderObserver from "@/components/HeaderObserver";
import SiteFooter from "@/components/SiteFooter";

export default function LegalPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <HeaderObserver />
      <header className="site-header">
        <div className="container header-bar">
          <Link className="brand" href="/" prefetch={false}>
            Institut Lemoine <span className="brand-accent">Accessibilité</span>
          </Link>
          <div className="header-tools">
            <AccessibilityMenu />
          </div>
        </div>
      </header>
      <main id="contenu-principal" className="section">
        <div className="container">
          <p className="back">
            <Link href="/" prefetch={false}>
              <span aria-hidden="true">← </span>Retour à l&rsquo;accueil
            </Link>
          </p>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="legal-title">{title}</h1>
          <div className="legal">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
