/**
 * Cor de destaque do painel (preferência do navegador, como o modo claro/escuro).
 * Os tokens de cada cor ficam em globals.css, em `:root[data-accent=...]`.
 * "neutro" é o padrão e não usa atributo.
 */
export const ACCENTS = [
  { value: "neutro", label: "Neutro", swatch: "oklch(0.3 0.006 265)" },
  { value: "azul", label: "Azul", swatch: "oklch(0.55 0.2 262)" },
  { value: "verde", label: "Verde", swatch: "oklch(0.55 0.11 168)" },
  { value: "violeta", label: "Violeta", swatch: "oklch(0.55 0.2 293)" },
  { value: "rosa", label: "Rosa", swatch: "oklch(0.58 0.2 355)" },
  { value: "laranja", label: "Laranja", swatch: "oklch(0.62 0.17 45)" },
] as const;

export type Accent = (typeof ACCENTS)[number]["value"];

export const DEFAULT_ACCENT: Accent = "neutro";
export const ACCENT_STORAGE_KEY = "cotani-accent";

export function isAccent(value: unknown): value is Accent {
  return ACCENTS.some((accent) => accent.value === value);
}

/** Aplica a cor antes da primeira pintura (injetado no <head>), evitando piscar a cor padrão. */
export const ACCENT_BOOT_SCRIPT = `try{var a=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});if(a&&a!=="neutro"&&${JSON.stringify(ACCENTS.map((accent) => accent.value))}.indexOf(a)>-1)document.documentElement.dataset.accent=a}catch(e){}`;

export function applyAccent(accent: Accent) {
  if (accent === DEFAULT_ACCENT) delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // Armazenamento bloqueado: vale só para esta página.
  }
}
