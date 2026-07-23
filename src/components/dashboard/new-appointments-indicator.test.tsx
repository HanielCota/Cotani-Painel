import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NewAppointmentsIndicator } from "@/components/dashboard/new-appointments-indicator";
import { render } from "@/test/utils";

function createMockFetchResponse(data: unknown) {
  return {
    ok: true,
    redirected: false,
    headers: new Headers({ "content-type": "application/json" }),
    json: vi.fn().mockResolvedValue(data),
  };
}

describe("NewAppointmentsIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("não renderiza quando não há novos agendamentos", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockFetchResponse([]));

    render(<NewAppointmentsIndicator />);

    await waitFor(() => {
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  it("renderiza badge quando novos agendamentos chegam", async () => {
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

    render(<NewAppointmentsIndicator />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    act(() => {
      vi.advanceTimersByTime(31_000);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /1 agendamento/i })).toBeInTheDocument();
    });
  });

  it("dispensa o badge ao clicar", async () => {
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

    render(<NewAppointmentsIndicator />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    act(() => {
      vi.advanceTimersByTime(31_000);
    });

    const badge = await screen.findByRole("button", { name: /1 agendamento/i });
    fireEvent.click(badge);

    await waitFor(() => {
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
