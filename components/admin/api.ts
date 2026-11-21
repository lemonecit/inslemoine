"use client";

import { useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Svaret var inte JSON (t.ex. en felsida) : visas som ett generellt fel nedan.
  }
  if (!response.ok) {
    const body = data as { error?: string; details?: ApiError["details"] } | null;
    throw new ApiError(body?.error ?? `Fel ${response.status}`, response.status, body?.details);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.details?.map((d) => `${d.path ? `${d.path}: ` : ""}${d.message}`).join(" · ");
    return details ? `${error.message} ${details}` : error.message;
  }
  return error instanceof Error ? error.message : "Okänt fel.";
}

// Hämtar data och hämtar om när adressen eller reloadKey ändras. Gamla data visas medan nya hämtas.
export function useApi<T>(path: string, reloadKey = 0) {
  const [state, setState] = useState<{ path: string; key: number; data?: T; error?: string }>();

  useEffect(() => {
    let cancelled = false;
    api<T>(path)
      .then((data) => {
        if (!cancelled) setState({ path, key: reloadKey, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState((previous) => ({ path, key: reloadKey, data: previous?.data, error: errorMessage(error) }));
      });
    return () => {
      cancelled = true;
    };
  }, [path, reloadKey]);

  const settled = state?.path === path && state.key === reloadKey;
  return { data: state?.data, error: settled ? state?.error : undefined, loading: !settled };
}
