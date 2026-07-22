import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TodayAgendaList, TodayAgendaListSkeleton } from "@/components/dashboard/today-agenda-list";
import { render } from "@/test/utils";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";

vi.mock("@/server/services/appointments", () => ({
  getTodayAppointments: vi.fn(),
}));

const { getTodayAppointments } = await import("@/server/services/appointments");

const mockClinic = {
  id: "clinic-1",
  name: "Barbearia Teste",
  timeZone: "America/Sao_Paulo",
} as ClinicModel;

describe("TodayAgendaList", () => {
  it("renderiza lista de atendimentos do dia", async () => {
    (getTodayAppointments as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "app-1",
        customerName: "João Silva",
        serviceName: "Corte",
        startTime: new Date("2026-07-21T14:00:00"),
        status: "CONFIRMED",
      },
      {
        id: "app-2",
        customerName: "Pedro Souza",
        serviceName: "Barba",
        startTime: new Date("2026-07-21T15:30:00"),
        status: "PENDING",
      },
    ]);

    render(await TodayAgendaList({ clinic: mockClinic }));

    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("Corte")).toBeInTheDocument();
    expect(screen.getByText("Pedro Souza")).toBeInTheDocument();
    expect(screen.getByText("Barba")).toBeInTheDocument();
    expect(screen.getByText("14:00")).toBeInTheDocument();
    expect(screen.getByText("15:30")).toBeInTheDocument();
  });

  it("renderiza estado vazio quando não há atendimentos", async () => {
    (getTodayAppointments as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    render(await TodayAgendaList({ clinic: mockClinic }));

    expect(screen.getByText("Nenhum atendimento hoje")).toBeInTheDocument();
  });
});

describe("TodayAgendaListSkeleton", () => {
  it("renderiza o esqueleto de carregamento", () => {
    render(<TodayAgendaListSkeleton />);

    expect(document.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });
});
