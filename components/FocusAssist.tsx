"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getServerSnapshot,
  getSnapshot,
  parsePrefs,
  subscribe,
} from "@/lib/a11y-prefs";
import { FALC } from "@/lib/falc";

type Shown = {
  el: HTMLElement;
  caption: string;
  text: string;
  position: "top" | "bottom";
};

type Content = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  falc?: string[];
};

function describe(el: HTMLElement): { caption: string; text: string } {
  if (el instanceof HTMLInputElement && el.type === "radio") {
    const group =
      el.closest("fieldset")?.querySelector("legend")?.textContent?.trim() ?? "";
    const label = el.labels?.[0]?.textContent?.trim() ?? el.value;
    return { caption: group, text: el.checked ? `${label} ✓` : label };
  }
  const text = (el.getAttribute("aria-label") ?? el.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (el instanceof HTMLAnchorElement) return { caption: "Lien", text };
  if (el instanceof HTMLButtonElement) return { caption: "Bouton", text };
  return { caption: "", text: text.slice(0, 140) };
}

function overlaps(a: DOMRect, b: DOMRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export default function FocusAssist() {
  const enabled =
    parsePrefs(useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot))
      .magnifier === "on";

  const [shown, setShown] = useState<Shown | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [size, setSize] = useState(1);
  const [easy, setEasy] = useState(false);
  const [status, setStatus] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Loupe : agrandit l'élément atteint au clavier.
  useEffect(() => {
    if (!enabled) return;

    const show = (el: HTMLElement) => {
      if (el.closest("dialog") || !el.matches(":focus-visible")) {
        setShown(null);
        return;
      }
      const { caption, text } = describe(el);
      if (!text) {
        setShown(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const inUpperHalf = rect.top + rect.height / 2 < window.innerHeight / 2;
      setShown({ el, caption, text, position: inUpperHalf ? "bottom" : "top" });
    };

    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) show(event.target);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!event.relatedTarget) setShown(null);
    };
    const onChange = (event: Event) => {
      if (
        event.target instanceof HTMLElement &&
        event.target === document.activeElement
      ) {
        show(event.target);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShown(null);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("change", onChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKeyDown);
      setShown(null);
    };
  }, [enabled]);

  // La loupe ne doit jamais recouvrir l'élément qui a le focus (WCAG 2.4.11).
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!shown || !box) return;
    box.dataset.position = shown.position;
    const hidesFocus = () =>
      overlaps(box.getBoundingClientRect(), shown.el.getBoundingClientRect());
    if (!hidesFocus()) return;
    box.dataset.position = shown.position === "top" ? "bottom" : "top";
    if (!hidesFocus()) return;
    shown.el.scrollIntoView({ block: "center", behavior: "instant" });
    const rect = shown.el.getBoundingClientRect();
    box.dataset.position =
      rect.top + rect.height / 2 < window.innerHeight / 2 ? "bottom" : "top";
  }, [shown]);

  // Mode lecture : s'ouvre uniquement sur action volontaire (Entrée / clic).
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLElement>("[data-read-section]");
      const section = document.getElementById(button?.dataset.readSection ?? "");
      if (!button || !section) return;
      triggerRef.current = button;
      setEasy(false);
      setStatus("");
      setContent({
        eyebrow: section.querySelector(".eyebrow")?.textContent?.trim() ?? "",
        title: section.querySelector("h2")?.textContent?.trim() ?? "",
        paragraphs: [...section.querySelectorAll(".prose")]
          .map((node) => node.textContent?.trim() ?? "")
          .filter(Boolean),
        falc: FALC[section.id],
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (content && dialog && !dialog.open) dialog.showModal();
  }, [content]);

  const changeSize = (next: number) => {
    const value = Math.min(3, Math.max(1, next));
    setSize(value);
    setStatus(`Taille du texte : ${value} sur 3`);
  };

  return (
    <>
      {enabled && shown && (
        <div
          ref={boxRef}
          className="magnifier"
          data-position={shown.position}
          aria-hidden="true"
        >
          <div key={`${shown.caption}|${shown.text}`} className="magnifier-inner">
            {shown.caption && <p className="magnifier-caption">{shown.caption}</p>}
            <p className="magnifier-text">{shown.text}</p>
          </div>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="reader"
        aria-labelledby="reader-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dialogRef.current?.close();
          }
        }}
        onClose={() => {
          setContent(null);
          triggerRef.current?.focus();
        }}
      >
        {content && (
          <>
            <div className="reader-bar">
              <button
                type="button"
                className="a11y-button"
                onClick={() => dialogRef.current?.close()}
              >
                Fermer
              </button>
              <button
                type="button"
                className="a11y-button"
                onClick={() => changeSize(size - 1)}
              >
                Texte plus petit
              </button>
              <button
                type="button"
                className="a11y-button"
                onClick={() => changeSize(size + 1)}
              >
                Texte plus grand
              </button>
              {content.falc && (
                <button
                  type="button"
                  className="a11y-button"
                  aria-pressed={easy}
                  onClick={() => {
                    setEasy(!easy);
                    setStatus(
                      easy ? "Texte standard affiché" : "Texte facile à lire affiché",
                    );
                  }}
                >
                  Texte facile à lire
                </button>
              )}
              <p role="status" className="visually-hidden">
                {status}
              </p>
            </div>
            <article className="reader-body" data-size={size} data-easy={easy}>
              {content.eyebrow && <p className="eyebrow">{content.eyebrow}</p>}
              <h2 id="reader-title">{content.title}</h2>
              {(easy && content.falc ? content.falc : content.paragraphs).map(
                (paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ),
              )}
            </article>
          </>
        )}
      </dialog>
    </>
  );
}
