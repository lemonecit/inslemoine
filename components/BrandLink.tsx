"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Lien vers l'accueil. Déjà sur l'accueil, un simple <Link href="/"> ne remonte pas la page :
// on remonte nous-mêmes, puis on place le focus sur le titre principal pour que les personnes
// au clavier et les lecteurs d'écran repartent du haut de la page.
export default function BrandLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <Link
      className={className}
      href="/"
      prefetch={false}
      onClick={(event) => {
        if (pathname !== "/") return;
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "auto" });
        document.getElementById("titre-principal")?.focus({ preventScroll: true });
      }}
    >
      {children}
    </Link>
  );
}
