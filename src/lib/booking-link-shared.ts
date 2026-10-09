import { ignoreFailure } from "@/lib/ignore-failure";
/**
 * Passo "Divulgar link de agendamento" do checklist inicial. Marcado ao copiar
 * o link em qualquer lugar do painel. A marcação vale na hora neste navegador e
 * fica salva no negócio (Clinic.bookingLinkSharedAt) para os outros aparelhos.
 */
import { markBookingLinkSharedOnServer } from "@/server/actions/onboarding";

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
  // Falha de rede não impede a marcação local.
  void ignoreFailure(markBookingLinkSharedOnServer());
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Armazenamento bloqueado: vale só até recarregar.
  }
  listeners.forEach((listener) => listener());
}
