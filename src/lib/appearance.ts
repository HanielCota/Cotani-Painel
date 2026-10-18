/**
 * Preferências visuais do painel, guardadas no navegador (como o modo
 * claro/escuro do next-themes). Os tokens de cada opção ficam em globals.css:
 * - tema de fundo -> `:root[data-surface=...]` (padrão "neutro", sem atributo);
 * - cor de destaque -> `:root[data-accent=...]` (padrão "verde", sem atributo).
 * "auto" no destaque segue o tema de fundo.
 */
export const SURFACES = [
  { value: "neutro", label: "Neutro", swatch: "oklch(0.93 0.003 265)", accent: "neutro" },
  { value: "verde", label: "Verde", swatch: "oklch(0.9 0.04 170)", accent: "verde" },
  { value: "azul", label: "Azul", swatch: "oklch(0.9 0.04 255)", accent: "azul" },
  { value: "violeta", label: "Violeta", swatch: "oklch(0.9 0.04 290)", accent: "violeta" },
  { value: "rosa", label: "Rosa", swatch: "oklch(0.9 0.04 350)", accent: "rosa" },
  { value: "ambar", label: "Âmbar", swatch: "oklch(0.92 0.045 75)", accent: "laranja" },
  { value: "grafite", label: "Grafite", swatch: "oklch(0.75 0.01 60)", accent: "neutro" },
] as const;

export const ACCENTS = [
  { value: "verde", label: "Verde", swatch: "oklch(0.55 0.1 168)" },
  { value: "auto", label: "Automática", swatch: null },
  { value: "neutro", label: "Neutro", swatch: "oklch(0.3 0.006 265)" },
  { value: "azul", label: "Azul", swatch: "oklch(0.55 0.2 262)" },
  { value: "violeta", label: "Violeta", swatch: "oklch(0.55 0.2 293)" },
  { value: "rosa", label: "Rosa", swatch: "oklch(0.58 0.2 355)" },
  { value: "laranja", label: "Laranja", swatch: "oklch(0.62 0.17 45)" },
] as const;

export type Surface = (typeof SURFACES)[number]["value"];
export type AccentChoice = (typeof ACCENTS)[number]["value"];

export const DEFAULT_SURFACE: Surface = "neutro";
export const DEFAULT_ACCENT: AccentChoice = "verde";
export const SURFACE_STORAGE_KEY = "cotani-surface";
export const ACCENT_STORAGE_KEY = "cotani-accent";

export function isSurface(value: unknown): value is Surface {
  return SURFACES.some((surface) => surface.value === value);
}

export function isAccentChoice(value: unknown): value is AccentChoice {
  return ACCENTS.some((accent) => accent.value === value);
}

/** Cor de destaque efetiva: "auto" vira a cor que combina com o tema de fundo. */
export function resolveAccent(accent: AccentChoice, surface: Surface) {
  return accent === "auto" ? SURFACES.find((item) => item.value === surface)!.accent : accent;
}

/** Aplica as escolhas no <html> (atributo ausente = padrão). */
export function applyAppearance(surface: Surface, accent: AccentChoice, root: HTMLElement = document.documentElement) {
  const resolved = resolveAccent(accent, surface);
  if (surface === DEFAULT_SURFACE) delete root.dataset.surface;
  else root.dataset.surface = surface;
  if (resolved === DEFAULT_ACCENT) delete root.dataset.accent;
  else root.dataset.accent = resolved;
}

export function readStoredAppearance(): { surface: Surface; accent: AccentChoice } {
  try {
    const surface = localStorage.getItem(SURFACE_STORAGE_KEY);
    const accent = localStorage.getItem(ACCENT_STORAGE_KEY);
    return { surface: isSurface(surface) ? surface : DEFAULT_SURFACE, accent: isAccentChoice(accent) ? accent : DEFAULT_ACCENT };
  } catch {
    return { surface: DEFAULT_SURFACE, accent: DEFAULT_ACCENT };
  }
}

export function storeAppearance(surface: Surface, accent: AccentChoice) {
  try {
    localStorage.setItem(SURFACE_STORAGE_KEY, surface);
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // Armazenamento bloqueado: vale só para esta página.
  }
}

/**
 * Aplica as escolhas salvas antes da primeira pintura (injetado no <head>),
 * evitando piscar as cores padrão. Precisa ser autocontido.
 */
export const APPEARANCE_BOOT_SCRIPT = `try{var d=document.documentElement,s=localStorage.getItem(${JSON.stringify(SURFACE_STORAGE_KEY)}),a=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)}),S=${JSON.stringify(Object.fromEntries(SURFACES.map((item) => [item.value, item.accent])))},A=${JSON.stringify(ACCENTS.map((item) => item.value))};if(!S[s])s=${JSON.stringify(DEFAULT_SURFACE)};if(A.indexOf(a)<0)a=${JSON.stringify(DEFAULT_ACCENT)};if(a==="auto")a=S[s];if(s!==${JSON.stringify(DEFAULT_SURFACE)})d.dataset.surface=s;if(a!==${JSON.stringify(DEFAULT_ACCENT)})d.dataset.accent=a}catch(e){}`;
