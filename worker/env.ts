export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  // Cloudflare Access (Zero Trust). Saknas något av värdena nekas alla anrop till /admin och /api.
  ACCESS_TEAM_DOMAIN?: string; // t.ex. "foreningen.cloudflareaccess.com"
  ACCESS_AUD?: string; // « Application Audience (AUD) Tag » för Access-applikationen
  ADMIN_EMAILS?: string; // kommaseparerad lista med tillåtna adresser
  // Endast i lokal utveckling (.dev.vars) och endast mot localhost.
  ALLOW_LOCAL_DEV?: string;
  // AI-motor.
  LLM_PROVIDER?: string; // "anthropic" eller "openai" (OpenAI-kompatibelt API)
  LLM_API_KEY?: string; // hemlighet (wrangler secret put LLM_API_KEY)
  LLM_MODEL?: string;
  LLM_BASE_URL?: string;
}
