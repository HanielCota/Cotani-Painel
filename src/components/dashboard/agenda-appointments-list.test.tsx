import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgendaAppointmentsList } from "@/components/dashboard/agenda-appointments-list";
import { render } from "@/test/utils";

function createMockFetchResponse(data: unknown) {
  return {
    ok: true,
    redirected: false,
    headers: new Headers({ "content-type": "application/json" }),
    json: vi.fn().mockResolvedValue(data),
  };
}

const mockAppointments = [
  {
    id: "app-1",
    customerName: "João Silva",
    serviceName: "Serviço A",
    professionalName: null,
    startTime: "2026-07-22T14:00:00",
    endTime: "2026-07-22T14:30:00",
    status: "PENDING",
    notes: null,
  },
  {
    id: "app-2",
    customerName: "Pedro Souza",
    serviceName: "Serviço B",
    professionalName: "Carlos",
    startTime: "2026-07-23T15:30:00",
    endTime: "2026-07-23T15:45:00",
    status: "CONFIRMED",
    notes: null,
  },
  {
    id: "app-3",
    customerName: "Maria Santos",
    serviceName: "Serviço combinado",
    professionalName: null,
    startTime: "2026-07-24T10:00:00",
    endTime: "2026-07-24T10:45:00",
    status: "COMPLETED",
    notes: null,
  },
];

function paginated(items: typeof mockAppointments) {
  return { items, total: items.length, page: 1, pageSize: 15 };
}

describe("AgendaAppointmentsList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    window.history.replaceState(null, "", "/dashboard/agenda");
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/dashboard/agenda");
    vi.unstubAllGlobals();
  });

  it("renderiza todos os atendimentos por padrão", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createMockFetchResponse(paginated(mockAppointments)));

    render(<AgendaAppointmentsList timeZone="America/Sao_Paulo" minStartTime="2026-07-22T08:00" canSchedule />);

    await waitFor(() => {
      expect(screen.getByText("João Silva")).toBeInTheDocument();
    });

    expect(screen.getByText("Pedro Souza")).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
  });

  it("filtra atendimentos por status", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: string) => {
      if (input.startsWith("/api/professionals")) return Promise.resolve(createMockFetchResponse([]));
      const items = input.includes("status=CONFIRMED") ? mockAppointments.filter((item) => item.status === "CONFIRMED") : mockAppointments;
      return Promise.resolve(createMockFetchResponse(paginated(items)));
    });

    render(<AgendaAppointmentsList timeZone="America/Sao_Paulo" minStartTime="2026-07-22T08:00" canSchedule />);

    await waitFor(() => {
      expect(screen.getByText("João Silva")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /confirmados/i }));

    await waitFor(() => {
      expect(screen.queryByText("João Silva")).not.toBeInTheDocument();
      expect(screen.getByText("Pedro Souza")).toBeInTheDocument();
      expect(screen.queryByText("Maria Santos")).not.toBeInTheDocument();
    });
  });

  it("renderiza estado vazio quando o filtro não retorna resultados", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: string) => {
      if (input.startsWith("/api/professionals")) return Promise.resolve(createMockFetchResponse([]));
      const items = input.includes("status=CANCELED") ? [] : mockAppointments;
      return Promise.resolve(createMockFetchResponse(paginated(items)));
    });

    render(<AgendaAppointmentsList timeZone="America/Sao_Paulo" minStartTime="2026-07-22T08:00" canSchedule />);

    await waitFor(() => {
      expect(screen.getByText("João Silva")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /cancelados/i }));

    await waitFor(() => {
      expect(screen.queryByText("João Silva")).not.toBeInTheDocument();
      expect(screen.getByText("Nenhum atendimento neste filtro")).toBeInTheDocument();
    });
  });

  it("renderiza estado vazio quando não há atendimentos", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createMockFetchResponse(paginated([])));

    render(<AgendaAppointmentsList timeZone="America/Sao_Paulo" minStartTime="2026-07-22T08:00" canSchedule />);

    await waitFor(() => {
      expect(screen.getByText("Nenhum atendimento futuro")).toBeInTheDocument();
    });
  });
});
