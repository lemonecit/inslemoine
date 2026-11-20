import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import Todo from "@/components/Todo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Déclaration d’accessibilité",
  alternates: { canonical: "/declaration-accessibilite" },
};

export default function DeclarationAccessibilite() {
  return (
    <LegalPage eyebrow="Accessibilité" title="Déclaration d’accessibilité">
      <p className="lead">
        L’{SITE_NAME} s’engage à rendre ce site accessible, conformément à
        l’article 47 de la loi n° 2005-102 du 11 février 2005. Cette
        déclaration s’applique au site, à toutes ses pages.
      </p>

      <h2>État de conformité</h2>
      <p>
        <strong>
          La conformité de ce site au référentiel RGAA (version 4) n’a pas
          encore été évaluée par un audit complet.
        </strong>{" "}
        Le site a été conçu pour viser le niveau AA des WCAG 2.2, et le niveau
        AAA lorsque c’est possible. Nous publierons ici le résultat de
        l’audit dès qu’il sera réalisé : <Todo>état de conformité, taux de critères respectés et date de l’audit</Todo>.
      </p>

      <h2>Résultats des tests</h2>
      <p>Les vérifications réalisées à ce jour sont les suivantes.</p>
      <ul>
        <li>
          Tests automatiques (axe-core et Lighthouse), novembre 2026 : aucune
          erreur détectée, score d’accessibilité de 100 sur 100. Ces outils ne
          vérifient qu’une partie des critères.
        </li>
        <li>
          Tests manuels au clavier : toutes les pages se parcourent avec la
          seule touche Tab, avec un indicateur de focus visible et un lien
          d’évitement vers le contenu principal.
        </li>
        <li>
          Contrastes : les combinaisons de couleurs respectent le niveau AAA
          (rapport d’au moins 7:1), y compris dans les thèmes à contraste
          renforcé.
        </li>
        <li>
          Tests avec lecteurs d’écran (NVDA, JAWS, VoiceOver) :{" "}
          <Todo>à réaliser, avec la date et les versions testées</Todo>.
        </li>
      </ul>

      <h2>Contenus non accessibles</h2>
      <ul>
        <li>
          Les documents PDF originaux proposés en téléchargement ne sont pas
          tous accessibles. Une version lisible est disponible dans le lecteur
          du site, mais elle repose sur l’extraction du texte : les tableaux,
          les formules, les mises en page en colonnes et les images ne sont pas
          reconstitués.
        </li>
        <li>
          Les documents PDF scannés (images sans texte) ne peuvent pas être
          lus dans le lecteur du site.
        </li>
        <li>
          Les versions « facile à lire » des textes n’ont pas encore été
          relues par des personnes concernées.
        </li>
      </ul>

      <h2>Aides à la lecture proposées sur le site</h2>
      <ul>
        <li>
          Menu « Accessibilité » : taille du texte, contraste renforcé (noir
          sur blanc ou jaune sur noir), espacement du texte, police de lecture
          facilitée, réduction des animations.
        </li>
        <li>
          Loupe au clavier : chaque élément atteint avec la touche Tab peut
          être affiché en très grand.
        </li>
        <li>
          Mode « Lire en grand » pour les textes, avec version facile à lire.
        </li>
        <li>
          Lecture des documents PDF en texte adapté, avec les mêmes réglages.
        </li>
      </ul>
      <p>
        Vos réglages sont enregistrés uniquement sur votre appareil (voir la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>).
      </p>

      <h2>Technologies utilisées</h2>
      <ul>
        <li>HTML5</li>
        <li>CSS</li>
        <li>JavaScript</li>
        <li>WAI-ARIA, uniquement lorsque le HTML natif ne suffit pas</li>
        <li>PDF (lecture avec la bibliothèque pdf.js)</li>
      </ul>

      <h2>Environnement de test</h2>
      <p>
        Les vérifications ont été faites avec des navigateurs basés sur
        Chromium (Chrome et Edge) sous Windows.{" "}
        <Todo>
          compléter avec les combinaisons de navigateurs et de lecteurs
          d’écran testées lors de l’audit
        </Todo>
      </p>

      <h2>Établissement de cette déclaration</h2>
      <p>
        Cette déclaration a été établie en novembre 2026. Elle sera mise à jour
        après chaque audit et à chaque évolution importante du site.
      </p>

      <h2>Retour d’information et contact</h2>
      <p>
        Si vous n’arrivez pas à accéder à un contenu ou à un service, ou si vous
        constatez un défaut d’accessibilité, écrivez-nous :{" "}
        <Todo>adresse de courriel de contact</Todo>. Nous vous répondrons sous{" "}
        <Todo>délai de réponse, par exemple 5 jours ouvrés</Todo>, et nous
        pourrons vous fournir le contenu sous une autre forme.
      </p>

      <h2>Voies de recours</h2>
      <p>
        Si vous constatez un défaut d’accessibilité vous empêchant d’accéder à
        un contenu ou à une fonctionnalité du site, que vous nous l’avez
        signalé et que vous n’obtenez pas de réponse satisfaisante, vous
        pouvez écrire un message au Défenseur des droits :
      </p>
      <ul>
        <li>
          en ligne :{" "}
          <a href="https://formulaire.defenseurdesdroits.fr">
            formulaire.defenseurdesdroits.fr
          </a>
        </li>
        <li>
          par courrier, sans affranchissement : Défenseur des droits, Libre
          réponse 71120, 75342 Paris CEDEX 07
        </li>
      </ul>
    </LegalPage>
  );
}
