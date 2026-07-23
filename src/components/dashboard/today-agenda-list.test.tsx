import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TodayAgendaList, TodayAgendaListSkeleton } from "@/components/dashboard/today-agenda-list";
import { render } from "@/test/utils";

function createMockFetchResponse(data: unknown) {
  return {
    ok: true,
    redirected: false,
    headers: new Headers({ "content-type": "application/json" }),
    json: vi.fn().mockResolvedValue(data),
  };
}

describe("TodayAgendaList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza lista de atendimentos do dia", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createMockFetchResponse([
        {
          id: "app-1",
          customerName: "João Silva",
          serviceName: "Corte",
          startTime: "2026-07-21T14:00:00",
          status: "CONFIRMED",
        },
        {
          id: "app-2",
          customerName: "Pedro Souza",
          serviceName: "Barba",
          startTime: "2026-07-21T15:30:00",
          status: "PENDING",
        },
      ]),
    );

    render(<TodayAgendaList timeZone="America/Sao_Paulo" />);

    await waitFor(() => {
      expect(screen.getByText("João Silva")).toBeInTheDocument();
    });

    expect(screen.getByText("Corte")).toBeInTheDocument();
    expect(screen.getByText("Pedro Souza")).toBeInTheDocument();
    expect(screen.getByText("Barba")).toBeInTheDocument();
    expect(screen.getByText("14:00")).toBeInTheDocument();
    expect(screen.getByText("15:30")).toBeInTheDocument();
  });

  it("renderiza estado vazio quando não há atendimentos", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createMockFetchResponse([]));

    render(<TodayAgendaList timeZone="America/Sao_Paulo" />);

    await waitFor(() => {
      expect(screen.getByText("Nenhum atendimento hoje")).toBeInTheDocument();
    });
  });

  it("chama a API de atendimentos do dia", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createMockFetchResponse([]));

    render(<TodayAgendaList timeZone="America/Sao_Paulo" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/appointments/today", undefined);
    });
  });
});

describe("TodayAgendaListSkeleton", () => {
  it("renderiza o esqueleto de carregamento", () => {
    render(<TodayAgendaListSkeleton />);

    expect(document.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });
});
