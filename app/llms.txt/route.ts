import { SITE_DESCRIPTION, SITE_NAME, SITE_SLOGAN, SITE_TOPICS, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

// Résumé lisible par les assistants IA (convention llms.txt). Il reprend uniquement ce qui est
// déjà affiché sur le site.
export function GET() {
  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_SLOGAN}

${SITE_NAME} est une association française à but non lucratif (loi 1901), basée à Paris. Sujets : ${SITE_TOPICS.join(", ")}.

## Pages

- [Accueil](${SITE_URL}/): présentation, actions, engagement et contact
- [Déclaration d'accessibilité](${SITE_URL}/declaration-accessibilite): état de conformité du site
- [Mentions légales](${SITE_URL}/mentions-legales)
- [Politique de confidentialité](${SITE_URL}/confidentialite): aucun cookie, aucun service tiers
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
