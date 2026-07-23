import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  UpcomingAppointmentsList,
  UpcomingAppointmentsListSkeleton,
} from "@/components/dashboard/upcoming-appointments-list";
import { render } from "@/test/utils";

function createMockFetchResponse(data: unknown) {
  return {
    ok: true,
    redirected: false,
    headers: new Headers({ "content-type": "application/json" }),
    json: vi.fn().mockResolvedValue(data),
  };
}

describe("UpcomingAppointmentsList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza lista de agendamentos próximos", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createMockFetchResponse([
        {
          id: "app-1",
          customerName: "João Silva",
          serviceName: "Corte",
          startTime: "2026-07-22T14:00:00",
          status: "CONFIRMED",
        },
        {
          id: "app-2",
          customerName: "Pedro Souza",
          serviceName: "Barba",
          startTime: "2026-07-23T15:30:00",
          status: "PENDING",
        },
      ]),
    );

    render(<UpcomingAppointmentsList timeZone="America/Sao_Paulo" />);

    await waitFor(() => {
      expect(screen.getByText("João Silva")).toBeInTheDocument();
    });

    expect(screen.getByText("Pedro Souza")).toBeInTheDocument();
  });

  it("renderiza estado vazio quando não há agendamentos próximos", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createMockFetchResponse([]));

    render(<UpcomingAppointmentsList timeZone="America/Sao_Paulo" />);

    await waitFor(() => {
      expect(screen.getByText("Sem agendamentos próximos")).toBeInTheDocument();
    });
  });

  it("chama a API com o limite informado", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createMockFetchResponse([]));

    render(<UpcomingAppointmentsList timeZone="America/Sao_Paulo" limit={5} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/appointments/upcoming?limit=5", undefined);
    });
  });
});

describe("UpcomingAppointmentsListSkeleton", () => {
  it("renderiza o esqueleto de carregamento", () => {
    render(<UpcomingAppointmentsListSkeleton />);

    expect(document.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });
});
