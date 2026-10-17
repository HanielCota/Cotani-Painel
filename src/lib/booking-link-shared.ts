/**
 * Passo "Divulgar link de agendamento" do checklist inicial. Marcado ao copiar
 * o link em qualquer lugar do painel; fica no navegador (sem coluna no banco).
 */
const STORAGE_KEY = "cotani:onboarding:link-shared";
const listeners = new Set<() => void>();

export function subscribeBookingLinkShared(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function readBookingLinkShared(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markBookingLinkShared() {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Armazenamento bloqueado: vale só até recarregar.
  }
  listeners.forEach((listener) => listener());
}
