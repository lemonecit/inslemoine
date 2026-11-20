import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Site entièrement statique : le dossier `out/` se déploie tel quel (Cloudflare, Vercel, etc.).
  output: "export",
};

export default nextConfig;
