export function readUrlSearchParam(name: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return new URL(window.location.href).searchParams.get(name) ?? fallback;
}

export function replaceUrlSearchParams(values: Record<string, string | null | undefined>): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(values)) {
    if (!value) {
      url.searchParams.delete(name);
      continue;
    }

    url.searchParams.set(name, value);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
