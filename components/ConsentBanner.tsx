"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  OPEN_EVENT,
  SERVICES,
  getServerSnapshot,
  getSnapshot,
  parseConsent,
  saveChoices,
  setAll,
  subscribe,
  type Choices,
} from "@/lib/consent";

// Pages à lire avant de décider : la bannière n'y est pas affichée.
const INFO_PAGES = ["/confidentialite", "/mentions-legales"];

export default function ConsentBanner() {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const consent = parseConsent(raw);
  const serverRender = raw === getServerSnapshot();

  const [reopened, setReopened] = useState(false);
  const [details, setDetails] = useState(false);
  const [draft, setDraft] = useState<Choices>({});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<Element | null>(null);

  // Pages à lire avant de décider : la bannière automatique n'y est pas affichée,
  // mais un clic explicite sur « Gérer mes choix » l'ouvre toujours.
  const visible =
    SERVICES.length > 0 &&
    !serverRender &&
    ((!consent.decided && !INFO_PAGES.includes(pathname)) || reopened);

  useEffect(() => {
    if (SERVICES.length === 0) return;
    const onOpen = () => {
      openerRef.current = document.activeElement;
      setDraft(parseConsent(getSnapshot()).choices);
      setDetails(true);
      setReopened(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (visible && dialog && !dialog.open) dialog.showModal();
  }, [visible]);

  // Fokus tillbaka först när dialogen är borta (bakgrunden är inaktiv så länge den är modal).
  useEffect(() => {
    const opener = openerRef.current;
    if (!visible && opener instanceof HTMLElement) {
      opener.focus();
      openerRef.current = null;
    }
  }, [visible]);

  if (!visible) return null;

  const finish = () => {
    setReopened(false);
    setDetails(false);
  };

  const cancel = () => {
    // Échap = ne rien accepter ; si on rouvre depuis le pied de page, on ferme sans rien changer.
    if (!consent.decided) setAll(false);
    finish();
  };

  return (
    <dialog
      ref={dialogRef}
      className="consent"
      aria-labelledby="consent-title"
      aria-describedby="consent-text"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <h2 id="consent-title">Vos choix sur les cookies</h2>
      <p id="consent-text">
        Ce site propose des services facultatifs. Ils ne sont activés qu’avec
        votre accord, que vous pouvez modifier à tout moment. Vos réglages
        d’affichage d’accessibilité restent sur votre appareil et ne demandent
        pas de consentement.
      </p>
      <p>
        <Link href="/confidentialite" prefetch={false}>Lire la politique de confidentialité</Link>
      </p>

      {details && (
        <fieldset id="consent-details" className="consent-services">
          <legend>Services facultatifs</legend>
          {SERVICES.map((service) => (
            <label key={service.id} className="consent-service">
              <input
                type="checkbox"
                checked={draft[service.id] ?? false}
                onChange={(event) =>
                  setDraft({ ...draft, [service.id]: event.target.checked })
                }
              />
              <span>
                <strong>{service.label}</strong>
                <span className="consent-hint">{service.description}</span>
              </span>
            </label>
          ))}
          <button
            type="button"
            className="a11y-button"
            onClick={() => {
              saveChoices(
                Object.fromEntries(SERVICES.map((s) => [s.id, draft[s.id] ?? false])),
              );
              finish();
            }}
          >
            Enregistrer mes choix
          </button>
        </fieldset>
      )}

      <div className="consent-actions">
        <button
          type="button"
          className="a11y-button"
          onClick={() => {
            setAll(false);
            finish();
          }}
        >
          Non merci
        </button>
        <button
          type="button"
          className="a11y-button"
          aria-expanded={details}
          aria-controls="consent-details"
          onClick={() => {
            if (!details) setDraft(consent.choices);
            setDetails(!details);
          }}
        >
          Je choisis
        </button>
        <button
          type="button"
          className="a11y-button"
          onClick={() => {
            setAll(true);
            finish();
          }}
        >
          OK pour moi
        </button>
      </div>
    </dialog>
  );
}
