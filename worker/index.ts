import { handleApi } from "./api";
import { authenticate } from "./auth";
import type { Env } from "./env";
import { notFound, withSecurityHeaders } from "./http";

// Workern körs bara för /admin/* och /api/* (assets.run_worker_first i wrangler.jsonc). Allt annat
// är den statiska webbplatsen och passerar aldrig här. Åtkomsten kontrolleras två gånger :
// Cloudflare Access vid kanten och här, så att även workers.dev-adressen är skyddad.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
    const isApi = pathname === "/api" || pathname.startsWith("/api/");

    if (!isAdmin && !isApi) return env.ASSETS.fetch(request);

    const auth = await authenticate(request, env);
    if (!auth.ok) {
      console.warn("Admin access denied:", auth.reason);
      // Samma svar som för en sida som inte finns : avslöjar inte att /admin finns.
      return notFound();
    }

    if (isApi) return handleApi(request, env, auth.email);

    if (pathname === "/admin" || pathname === "/admin/") {
      return withSecurityHeaders(Response.redirect(new URL("/admin/prototypes", request.url).toString(), 302));
    }
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
} satisfies ExportedHandler<Env>;
