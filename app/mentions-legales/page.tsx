import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/site";

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
        <li>Numéro RNA : W751287217 (Préfecture de police de Paris)</li>
        <li>Siège social : 1 rue d’Enghien, 75010 Paris, France</li>
        <li>Directeur de la publication : Pierre Lemon, Président</li>
        <li>
          Contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </li>
      </ul>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par Cloudflare, Inc., 101 Townsend St, San
        Francisco, CA 94107, États-Unis. Téléphone : +1 (650) 319-8930. Site
        web :{" "}
        <a href="https://www.cloudflare.com" rel="noopener noreferrer">
          www.cloudflare.com
        </a>
        .
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Sauf mention contraire, les textes et éléments graphiques de ce site
        appartiennent à l’Institut Lemoine Accessibilité. Les solutions
        open-source publiées par l’association sont soumises à la licence
        indiquée dans chacun de leurs dépôts.
      </p>
      <p>
        Les contenus rédactionnels et pédagogiques de ce site sont mis à
        disposition selon les termes de la{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr"
          rel="license noopener noreferrer"
        >
          Licence Creative Commons Attribution - Partage dans les Mêmes
          Conditions 4.0 International (CC BY-SA 4.0)
        </a>
        , sauf mention contraire.
      </p>

      <h2>Accessibilité</h2>
      <p>
        Ce site vise la conformité au niveau AA des WCAG 2.2. Le détail de
        l’état actuel figure dans la{" "}
        <Link href="/declaration-accessibilite" prefetch={false}>déclaration d’accessibilité</Link>.
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
        <Link href="/confidentialite" prefetch={false}>politique de confidentialité</Link>.
      </p>
    </LegalPage>
  );
}
