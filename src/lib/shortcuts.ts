/**
 * Atalhos de teclado do painel. "N" abre um novo atendimento: na agenda, o
 * diálogo escuta NEW_APPOINTMENT_EVENT; fora dela, o atalho leva para
 * /dashboard/agenda?novo=1, que abre o diálogo ao carregar.
 */
export const NEW_APPOINTMENT_EVENT = "cotani:new-appointment";
export const NEW_APPOINTMENT_PARAM = "novo";

/** Pede para abrir o diálogo de novo atendimento. Retorna true se alguém na página atendeu. */
export function requestNewAppointment(): boolean {
  const event = new CustomEvent(NEW_APPOINTMENT_EVENT, { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

/** O usuário está digitando (campo, área de texto, editor): atalhos de uma tecla não valem. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.getAttribute("role") === "combobox";
}

export function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** Remove acentos e caixa para comparar textos digitados. */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
