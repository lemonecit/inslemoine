"use client";

import { useEffect } from "react";

// Se till att den fasta rubriken aldrig döljer fokuserat innehåll (WCAG 2.4.11)
// och att den släpps om den tar för stor del av skärmen (zoom, stor text, mobil).
const MAX_VIEWPORT_SHARE = 0.25;

export default function HeaderObserver() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".site-header");
    if (!header) return;
    const root = document.documentElement;

    const update = () => {
      const height = header.getBoundingClientRect().height;
      const tooTall = height > window.innerHeight * MAX_VIEWPORT_SHARE;
      if (tooTall) {
        root.setAttribute("data-header", "static");
        root.style.setProperty("--header-offset", "0px");
      } else {
        root.removeAttribute("data-header");
        root.style.setProperty("--header-offset", `${Math.ceil(height) + 16}px`);
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      root.removeAttribute("data-header");
      root.style.removeProperty("--header-offset");
    };
  }, []);

  return null;
}
