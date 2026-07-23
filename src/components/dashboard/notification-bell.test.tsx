import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "@/components/dashboard/notification-bell";
import { render } from "@/test/utils";

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

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renderiza o sino de notificações", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockFetchResponse([]));

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByLabelText(/notificações/i)).toBeInTheDocument();
    });
  });

  it("exibe toast quando novos agendamentos chegam", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(createMockFetchResponse([]));
    fetchMock.mockResolvedValueOnce(
      createMockFetchResponse([
        {
          id: "app-1",
          customerName: "João Silva",
          serviceName: "Corte",
          startTime: "2026-07-22T14:00:00",
          status: "CONFIRMED",
        },
      ]),
    );

    render(<NotificationBell />);

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
