"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import BrainstormView, { EMPTY_BRAINSTORM, type BrainstormState } from "./BrainstormView";
import CallDetail from "./CallDetail";
import FundingView from "./FundingView";
import IdeaDetail from "./IdeaDetail";
import IdeasView from "./IdeasView";
import ImportView from "./ImportView";
import ProductsView from "./ProductsView";
import { useApi } from "./api";
import { Notice } from "./shared";

const TABS = [
  { hash: "ideer", label: "Idéer" },
  { hash: "brainstorma", label: "Brainstorma" },
  { hash: "finansiering", label: "Finansiering" },
  { hash: "produkter", label: "Produkter" },
  { hash: "importera", label: "Importera" },
] as const;

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
const getHash = () => window.location.hash.replace(/^#/, "");

export default function AdminApp() {
  const hash = useSyncExternalStore(subscribe, getHash, () => "");
  const [ideasKey, setIdeasKey] = useState(0);
  const [brainstorm, setBrainstorm] = useState<BrainstormState>(EMPTY_BRAINSTORM);
  const { data: status } = useApi<{ email: string; llm_configured: boolean }>("/api/status");
  const view = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  const ideaId = /^ide\/([\w-]{1,64})$/.exec(hash)?.[1];
  const callId = /^bidrag\/([\w-]{1,64})$/.exec(hash)?.[1];
  const tab = ideaId ? "ideer" : callId ? "finansiering" : (TABS.find((t) => t.hash === hash)?.hash ?? "ideer");

  // Vid byte av vy flyttas fokus till vyns rubrik så att skärmläsare och tangentbord följer med.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const heading = view.current?.querySelector<HTMLElement>("h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [hash]);

  const go = (target: string) => {
    window.location.hash = target;
  };

  return (
    <>
      <header className="admin-header">
        <div className="container admin-header-inner">
          <div>
            <p className="admin-kicker">Institut Lemoine Accessibilité · intern vy</p>
            <h1>Prototypanalys</h1>
          </div>
          <p className="admin-user">{status ? `Inloggad som ${status.email}` : ""}</p>
        </div>
        <div className="container">
          <nav aria-label="Adminnavigering">
            <ul className="admin-tabs">
              {TABS.map((t) => (
                <li key={t.hash}>
                  <a href={`#${t.hash}`} aria-current={tab === t.hash ? "page" : undefined}>
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="contenu-principal" className="container admin-main">
        {status && !status.llm_configured && (
          <Notice kind="error">
            AI-motorn är inte konfigurerad (LLM_PROVIDER, LLM_MODEL och hemligheten LLM_API_KEY). Du kan hantera produkter och idéer, men inte köra analyser.
          </Notice>
        )}
        <div ref={view}>
          {ideaId ? (
            <IdeaDetail id={ideaId} onBack={() => go("ideer")} onChanged={() => setIdeasKey((n) => n + 1)} />
          ) : callId ? (
            <CallDetail id={callId} onBack={() => go("finansiering")} onChanged={() => undefined} />
          ) : tab === "finansiering" ? (
            <FundingView onOpenCall={(id) => go(`bidrag/${id}`)} />
          ) : tab === "brainstorma" ? (
            <BrainstormView
              state={brainstorm}
              setState={setBrainstorm}
              onOpenIdea={(id) => {
                setIdeasKey((n) => n + 1);
                go(`ide/${id}`);
              }}
            />
          ) : tab === "produkter" ? (
            <ProductsView
              onOpenIdea={(id) => {
                setIdeasKey((n) => n + 1);
                go(`ide/${id}`);
              }}
            />
          ) : tab === "importera" ? (
            <ImportView onSaved={() => go("produkter")} />
          ) : (
            <IdeasView reloadKey={ideasKey} onOpen={(id) => go(`ide/${id}`)} />
          )}
        </div>
      </main>
    </>
  );
}
