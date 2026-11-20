"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  getServerSnapshot,
  getSnapshot,
  parseConsent,
  subscribe,
} from "@/lib/consent";

// Ne rend ses enfants (script, iframe…) que si la personne a accepté ce service.
export default function ConsentGate({
  service,
  children,
}: {
  service: string;
  children: ReactNode;
}) {
  const consent = parseConsent(
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
  );
  return consent.choices[service] ? <>{children}</> : null;
}
