import Link from "next/link";
import BrandLink from "@/components/BrandLink";
import BrandMark from "@/components/BrandMark";
import ConsentManageButton from "@/components/ConsentManageButton";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <BrandLink className="brand footer-brand">
          <BrandMark />
          <span className="brand-text">
            <span>Institut Lemoine</span>
            <span>Accessibilité</span>
          </span>
        </BrandLink>
        <p>© Association loi 1901 — Paris.</p>
        <nav aria-label="Informations légales">
          <ul className="footer-links">
            <li>
              <Link href="/declaration-accessibilite" prefetch={false}>
                Déclaration d’accessibilité
              </Link>
            </li>
            <li>
              <Link href="/mentions-legales" prefetch={false}>Mentions légales</Link>
            </li>
            <li>
              <Link href="/confidentialite" prefetch={false}>Politique de confidentialité</Link>
            </li>
            <ConsentManageButton />
          </ul>
        </nav>
      </div>
    </footer>
  );
}
