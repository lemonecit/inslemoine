"use client";

import { SERVICES, openPreferences } from "@/lib/consent";

export default function ConsentManageButton() {
  if (SERVICES.length === 0) return null;
  return (
    <li>
      <button type="button" className="link-button" onClick={openPreferences}>
        Gérer mes choix sur les cookies
      </button>
    </li>
  );
}
