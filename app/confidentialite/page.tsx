import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import Todo from "@/components/Todo";
import { SERVICES } from "@/lib/consent";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  alternates: { canonical: "/confidentialite" },
};

export default function Confidentialite() {
  return (
    <LegalPage eyebrow="Vos données" title="Politique de confidentialité">
      <p className="lead">
        En bref : ce site ne dépose aucun cookie de suivi, n’utilise aucun outil
        de mesure d’audience et ne fait appel à aucun service tiers. À votre
        première visite, une fenêtre vous en informe ; vous la fermez avec
        « J’ai compris ».
      </p>

      <h2>Qui est responsable ?</h2>
      <p>
        Le responsable du traitement est l’Institut Lemoine Accessibilité,
        association loi 1901 dont les coordonnées figurent dans les{" "}
        <Link href="/mentions-legales" prefetch={false}>mentions légales</Link>. Pour toute
        question sur vos données : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Quelles données, pourquoi et combien de temps ?</h2>

      <h3>Vos réglages d’affichage</h3>
      <p>
        Lorsque vous utilisez le menu « Accessibilité » (taille du texte,
        contraste, espacement, police, animations, loupe), votre choix est
        mémorisé dans le stockage local de votre navigateur, sous le nom{" "}
        <code>ila-a11y</code>. Il ne contient que ces réglages. Il reste sur
        votre appareil, n’est jamais envoyé à nos serveurs et sert uniquement
        à afficher le site comme vous l’avez demandé. Il est effacé au bout de
        12 mois, ou dès que vous cliquez sur « Réinitialiser ».
      </p>

      <h3>Confirmation de lecture de l’information</h3>
      <p>
        Lorsque vous cliquez sur « J’ai compris » dans la fenêtre d’information
        de la première visite, ce choix est mémorisé dans le stockage local de
        votre navigateur, sous le nom <code>ila-consent</code>, avec la date du
        clic. Il évite de vous réafficher la fenêtre à chaque page. Il ne
        contient aucune donnée personnelle, reste sur votre appareil et est
        effacé au bout de 12 mois, après quoi la fenêtre s’affiche de nouveau.
        Ce stockage est strictement nécessaire au fonctionnement de la fenêtre :
        il ne demande pas de consentement.
      </p>

      <h3>Journaux techniques de l’hébergeur</h3>
      <p>
        Comme tout site web, le serveur qui délivre les pages (Cloudflare, Inc.,
        société américaine) enregistre
        automatiquement des informations techniques (adresse IP, date et
        heure, page demandée, type de navigateur) pour assurer la sécurité et
        le bon fonctionnement du service. Ce traitement repose sur
        l’intérêt légitime de l’association à maintenir un service sûr.
        Durée de conservation : <Todo>durée appliquée par l’hébergeur</Todo>.
        Lieu de traitement et garanties en cas de transfert hors Union
        européenne : <Todo>à vérifier auprès de l’hébergeur</Todo>.
      </p>

      <h3>Vos messages</h3>
      <p>
        Si vous nous écrivez par courriel, nous utilisons votre adresse et
        votre message uniquement pour vous répondre, et les conservons le
        temps nécessaire au traitement de votre demande.
      </p>

      <h3>Lecteur de documents</h3>
      <p>
        L’ouverture d’un PDF en lecture accessible se fait entièrement dans
        votre navigateur. Le contenu du document n’est transmis à personne.
      </p>

      <h3>Polices de caractères</h3>
      <p>
        Les polices sont hébergées avec le site : votre navigateur ne contacte
        aucun serveur de polices externe.
      </p>

      <h2>Cookies et traceurs</h2>
      <p>
        {SERVICES.length === 0
          ? "Ce site n’utilise aucun cookie ni traceur soumis au consentement. Si nous ajoutons un jour un service facultatif (par exemple une mesure d’audience), il ne sera activé qu’avec votre accord, vous pourrez le refuser aussi simplement que l’accepter, et vous pourrez revenir sur votre choix à tout moment depuis le pied de page."
          : "Les services facultatifs suivants ne sont activés qu’avec votre accord. Vous pouvez modifier vos choix à tout moment depuis le pied de page."}
      </p>
      {SERVICES.length > 0 && (
        <ul>
          {SERVICES.map((service) => (
            <li key={service.id}>
              <strong>{service.label}</strong> : {service.description}
            </li>
          ))}
        </ul>
      )}

      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l’accès à vos données, leur rectification, leur
        effacement, la limitation ou l’opposition à leur traitement, ainsi que
        leur portabilité, en écrivant à l’adresse indiquée plus haut. Si vous
        estimez que vos droits ne sont pas respectés, vous pouvez introduire
        une réclamation auprès de la CNIL :{" "}
        <a href="https://www.cnil.fr/fr/plaintes">www.cnil.fr/fr/plaintes</a>.
      </p>

      <h2>Mises à jour</h2>
      <p>Dernière mise à jour : novembre 2026.</p>
    </LegalPage>
  );
}
