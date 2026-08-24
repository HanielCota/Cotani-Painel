import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsTabs } from "@/components/dashboard/settings-tabs";

const navigation = vi.hoisted(() => ({ search: "tab=services", replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("@/components/dashboard/services-settings", () => ({ ServicesSettings: () => <p>Conteúdo de serviços</p> }));
vi.mock("@/components/dashboard/professionals-settings", () => ({ ProfessionalsSettings: () => <p>Conteúdo de profissionais</p> }));
vi.mock("@/components/dashboard/business-hours-settings", () => ({ BusinessHoursSettings: () => <p>Conteúdo de horários</p> }));
vi.mock("@/components/dashboard/clinic-settings", () => ({ ClinicSettings: () => null }));

describe("SettingsTabs", () => {
  it("acompanha a aba informada pela URL mesmo quando o componente é preservado", () => {
    navigation.search = "tab=services";
    const { rerender } = render(
      <SettingsTabs defaultTab="services" maxAppointmentsPerDay={null} initialBusinessHours={[]} />,
    );
    expect(screen.getByText("Conteúdo de serviços")).toBeVisible();

    navigation.search = "tab=professionals";
    rerender(<SettingsTabs defaultTab="professionals" maxAppointmentsPerDay={null} initialBusinessHours={[]} />);

    expect(screen.getByText("Conteúdo de profissionais")).toBeVisible();
  });

  it("atualiza a URL ao selecionar horários", () => {
    navigation.search = "tab=services";
    navigation.replace.mockClear();
    render(<SettingsTabs defaultTab="services" maxAppointmentsPerDay={null} initialBusinessHours={[]} />);

    fireEvent.click(screen.getByRole("tab", { name: "Expediente" }));

    expect(navigation.replace).toHaveBeenCalledWith(
      "/dashboard/configuracoes?tab=business-hours",
      { scroll: false },
    );
  });
});
