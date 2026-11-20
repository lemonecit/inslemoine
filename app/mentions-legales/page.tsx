import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import Todo from "@/components/Todo";

export const metadata: Metadata = {
  title: "Mentions légales",
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegales() {
  return (
    <LegalPage eyebrow="Informations légales" title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>
        Institut Lemoine Accessibilité, association régie par la loi du
        1<sup>er</sup> juillet 1901.
      </p>
      <ul>
        <li>
          Siège social : <Todo>adresse postale</Todo>, Paris, France
        </li>
        <li>
          Numéro RNA : <Todo>numéro d’enregistrement</Todo>
        </li>
        <li>
          Numéro SIREN : <Todo>si l’association en possède un</Todo>
        </li>
        <li>
          Directeur ou directrice de la publication : <Todo>nom et fonction</Todo>
        </li>
        <li>
          Contact : <Todo>adresse de courriel de l’association</Todo>
        </li>
      </ul>

      <h2>Hébergement</h2>
      <p>
        <Todo>
          nom, adresse et site web de l’hébergeur (par exemple Cloudflare, Inc.
          si le site est publié sur Cloudflare)
        </Todo>
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Sauf mention contraire, les textes et éléments graphiques de ce site
        appartiennent à l’Institut Lemoine Accessibilité. Les solutions
        open-source publiées par l’association sont soumises à la licence
        indiquée dans chacun de leurs dépôts. <Todo>licence applicable aux contenus du site</Todo>
      </p>

      <h2>Accessibilité</h2>
      <p>
        Ce site vise la conformité au niveau AA des WCAG 2.2. Le détail de
        l’état actuel figure dans la{" "}
        <Link href="/declaration-accessibilite">déclaration d’accessibilité</Link>.
        Si vous rencontrez un défaut d’accessibilité, signalez-le-nous à
        l’adresse de contact ci-dessus : nous vous répondrons et corrigerons le
        problème.
      </p>

      <h2>Responsabilité</h2>
      <p>
        L’association s’efforce de fournir des informations exactes et à jour,
        sans pouvoir garantir l’absence d’erreur. Elle n’est pas responsable
        du contenu des sites externes vers lesquels ce site pourrait renvoyer.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>
    </LegalPage>
  );
}
