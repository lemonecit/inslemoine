"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  FIRST_VISIT_NOTICE,
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
import {
  getServerSnapshot as getPrefsServerSnapshot,
  getSnapshot as getPrefsSnapshot,
  parsePrefs,
  setPref,
  subscribe as subscribePrefs,
} from "@/lib/a11y-prefs";

// Pages à lire avant de décider : la bannière n'y est pas affichée.
const INFO_PAGES = ["/confidentialite", "/mentions-legales", "/declaration-accessibilite"];

const SIZES = [
  { value: "default", label: "Standard" },
  { value: "large", label: "Grand" },
  { value: "xlarge", label: "Très grand" },
];
const CONTRASTS = [
  { value: "default", label: "Standard" },
  { value: "high", label: "Noir sur blanc" },
  { value: "dark", label: "Jaune sur noir" },
];

function next<T extends { value: string }>(list: T[], current: string): T {
  const index = list.findIndex((item) => item.value === current);
  return list[(index + 1) % list.length];
}

export default function ConsentBanner() {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const consent = parseConsent(raw);
  const serverRender = raw === getServerSnapshot();
  const prefs = parsePrefs(
    useSyncExternalStore(subscribePrefs, getPrefsSnapshot, getPrefsServerSnapshot),
  );
  const notice = SERVICES.length === 0;
  const enabled = SERVICES.length > 0 || FIRST_VISIT_NOTICE;

  const [reopened, setReopened] = useState(false);
  const [details, setDetails] = useState(false);
  const [draft, setDraft] = useState<Choices>({});
  const [status, setStatus] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<Element | null>(null);

  // Pages à lire avant de décider : la bannière automatique n'y est pas affichée,
  // mais un clic explicite sur « Gérer mes choix » l'ouvre toujours.
  const visible =
    enabled &&
    !serverRender &&
    ((!consent.decided && !INFO_PAGES.includes(pathname) && !pathname.startsWith("/admin")) || reopened);

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
      {notice ? (
        <>
          <h2 id="consent-title">Votre vie privée</h2>
          <p id="consent-text">
            Ce site ne dépose aucun cookie de suivi et ne fait appel à aucun
            service de mesure d’audience ni de publicité. Il mémorise
            seulement, sur votre appareil, vos réglages d’affichage si vous en
            choisissez.
          </p>
          <p>
            <Link href="/confidentialite" prefetch={false}>
              Lire la politique de confidentialité
            </Link>
          </p>

          <fieldset className="consent-aids">
            <legend>Pour mieux lire cette fenêtre</legend>
            <button
              type="button"
              className="a11y-button"
              onClick={() => {
                const target = next(SIZES, prefs.textSize);
                setPref("textSize", target.value);
                setStatus(`Taille du texte : ${target.label}`);
              }}
            >
              Taille du texte :{" "}
              {SIZES.find((item) => item.value === prefs.textSize)?.label}
            </button>
            <button
              type="button"
              className="a11y-button"
              onClick={() => {
                const target = next(CONTRASTS, prefs.contrast);
                setPref("contrast", target.value);
                setStatus(`Contraste : ${target.label}`);
              }}
            >
              Contraste :{" "}
              {CONTRASTS.find((item) => item.value === prefs.contrast)?.label}
            </button>
            <p role="status" className="visually-hidden">
              {status}
            </p>
          </fieldset>

          <div className="consent-actions consent-actions-single">
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setAll(true);
                finish();
              }}
            >
              J’ai compris
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 id="consent-title">Vos choix sur les cookies</h2>
          <p id="consent-text">
            Ce site propose des services facultatifs. Ils ne sont activés
            qu’avec votre accord, que vous pouvez modifier à tout moment. Vos
            réglages d’affichage d’accessibilité restent sur votre appareil et
            ne demandent pas de consentement.
          </p>
          <p>
            <Link href="/confidentialite" prefetch={false}>
              Lire la politique de confidentialité
            </Link>
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
                    Object.fromEntries(
                      SERVICES.map((s) => [s.id, draft[s.id] ?? false]),
                    ),
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
        </>
      )}
    </dialog>
  );
}
