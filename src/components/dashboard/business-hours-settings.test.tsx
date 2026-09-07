import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BusinessHoursSettings } from "@/components/dashboard/business-hours-settings";
import type { BusinessHourItem } from "@/types";

vi.mock("@/server/actions/business-hours", () => ({
  saveBusinessHoursFromForm: vi.fn(),
  saveProfessionalAvailabilityFromForm: vi.fn(),
}));

function makeHours(): BusinessHourItem[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    id: String(dayOfWeek),
    dayOfWeek,
    isOpen: true,
    openTime: "08:00",
    closeTime: dayOfWeek === 6 ? "12:00" : "18:00",
    breakStart: "12:00",
    breakEnd: dayOfWeek === 6 ? "12:00" : "13:00",
  }));
}

describe("BusinessHoursSettings", () => {
  it("trata um intervalo antigo de duração zero como expediente sem intervalo", () => {
    render(<BusinessHoursSettings businessHours={makeHours()} />);

    expect(screen.getByRole("checkbox", { name: "Sem intervalo em Sábado" })).toBeChecked();
    expect(screen.getAllByLabelText("Início do intervalo")[6]).toBeDisabled();
    expect(screen.getAllByLabelText("Fim do intervalo")[6]).toBeDisabled();
  });

  it("permite remover o intervalo de um dia", () => {
    render(<BusinessHoursSettings businessHours={makeHours()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Sem intervalo em Segunda-feira" }));

    expect(screen.getByRole("checkbox", { name: "Sem intervalo em Segunda-feira" })).toBeChecked();
    expect(screen.getAllByLabelText("Início do intervalo")[1]).toBeDisabled();
    expect(screen.getAllByLabelText("Fim do intervalo")[1]).toBeDisabled();
  });
});
