import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "@/components/dashboard/notification-bell";
import { SidebarProvider } from "@/components/ui/sidebar";
import { resetSeenNotificationsForTests } from "@/hooks/use-new-appointments";
import { render } from "@/test/utils";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
  },
}));

const { toast } = await import("sonner");

function createMockFetchResponse(data: unknown) {
  return {
    ok: true,
    redirected: false,
    headers: new Headers({ "content-type": "application/json" }),
    json: vi.fn().mockResolvedValue(data),
  };
}

const appointment = (id: string, customerName: string) => ({ id, customerName, serviceName: "Serviço A", startTime: "2026-07-22T14:00:00", status: "CONFIRMED" });

function renderBell() {
  return render(<SidebarProvider><NotificationBell /></SidebarProvider>);
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    localStorage.clear();
    resetSeenNotificationsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("mostra o contador de não lidas e abre a agenda pelo item", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockFetchResponse([appointment("app-1", "João Silva"), appointment("app-2", "Maria")]));

    renderBell();

    const trigger = await screen.findByLabelText("Notificações, 2 não lidas");
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByText("João Silva"));

    expect(routerPush).toHaveBeenCalledWith("/dashboard/agenda");
    expect(await screen.findByLabelText("Notificações, 1 não lida")).toBeInTheDocument();
  });

  it("marcar todas como lidas zera o contador e persiste", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockFetchResponse([appointment("app-1", "João Silva")]));

    const { unmount } = renderBell();
    fireEvent.click(await screen.findByLabelText("Notificações, 1 não lida"));
    fireEvent.click(await screen.findByRole("button", { name: /marcar todas como lidas/i }));

    expect(await screen.findByRole("button", { name: "Notificações" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("cotani-notifications-seen") ?? "[]")).toEqual(["app-1"]);

    unmount();
    resetSeenNotificationsForTests();
    renderBell();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Notificações" })).toBeInTheDocument();
  });

  it("exibe toast quando novos agendamentos chegam", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(createMockFetchResponse([]));
    fetchMock.mockResolvedValueOnce(createMockFetchResponse([appointment("app-1", "João Silva")]));

    renderBell();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    vi.advanceTimersByTime(31_000);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("1 novo agendamento recebido"),
        expect.anything(),
      );
    });
  });
});
