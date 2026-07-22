import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingSteps } from "@/components/public/booking-steps";
import { render } from "@/test/utils";

const mockPush = vi.fn();
const mockRefetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/server/actions/public-booking", () => ({
  createPublicAppointment: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect?: (day: Date | undefined) => void }) => (
    <input
      type="date"
      data-testid="calendar-mock"
      onChange={(event) => {
        const value = event.target.valueAsDate;
        onSelect?.(value ?? undefined);
      }}
    />
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { createPublicAppointment } = await import("@/server/actions/public-booking");
const { useQuery } = await import("@tanstack/react-query");

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const services = [
  { id: "svc-1", name: "Corte", duration: 30, price: 50, imageUrl: null },
  { id: "svc-2", name: "Barba", duration: 20, price: 35, imageUrl: null },
];

const professionals = [
  { id: "prof-1", name: "Carlos", imageUrl: null, serviceIds: ["svc-1"] },
  { id: "prof-2", name: "Ana", imageUrl: null, serviceIds: ["svc-2"] },
];

function setup() {
  return render(
    <BookingSteps
      slug="barbearia-teste"
      clinicName="Barbearia Teste"
      services={services}
      professionals={professionals}
      minDate="2026-07-21"
    />,
  );
}

describe("BookingSteps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { slots: [], dates: [] },
      isFetching: false,
      refetch: mockRefetch,
    });
  });

  it("renderiza o indicador de progresso com três etapas", () => {
    setup();

    expect(screen.getByText("Serviço")).toBeInTheDocument();
    expect(screen.getByText("Data e hora")).toBeInTheDocument();
    expect(screen.getByText("Seus dados")).toBeInTheDocument();
  });

  it("seleciona serviço e profissional e avança para data/hora", async () => {
    setup();

    await userEvent.click(screen.getByText("Corte"));
    await userEvent.click(screen.getByText("Carlos"));
    await userEvent.click(screen.getByRole("button", { name: /continuar/i }));

    expect(screen.getByText("Escolha data e horário")).toBeInTheDocument();
  });

  it("exibe resumo do agendamento na etapa de dados", async () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        slots: [{ startTime: "2026-07-21T10:00:00", label: "10:00" }],
        dates: ["2026-07-21"],
      },
      isFetching: false,
      refetch: mockRefetch,
    });

    setup();

    await userEvent.click(screen.getByText("Barba"));
    await userEvent.click(screen.getByText("Ana"));
    await userEvent.click(screen.getByRole("button", { name: /continuar/i }));
    await userEvent.type(screen.getByTestId("calendar-mock"), "2026-07-21");

    await waitFor(() => {
      expect(screen.getByText("10:00")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("10:00"));
    await userEvent.click(screen.getByRole("button", { name: /continuar/i }));

    expect(screen.getByText("Resumo do agendamento")).toBeInTheDocument();
    expect(screen.getByText("Barbearia Teste")).toBeInTheDocument();
    expect(screen.getByText("Barba")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("10:00")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*35,00/)).toBeInTheDocument();
  });

  it("aplica máscara no campo WhatsApp", async () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        slots: [{ startTime: "2026-07-21T10:00:00", label: "10:00" }],
        dates: ["2026-07-21"],
      },
      isFetching: false,
      refetch: mockRefetch,
    });

    setup();

    await userEvent.click(screen.getByText("Barba"));
    await userEvent.click(screen.getByText("Ana"));
    await userEvent.click(screen.getByRole("button", { name: /continuar/i }));
    await userEvent.type(screen.getByTestId("calendar-mock"), "2026-07-21");

    await waitFor(() => {
      expect(screen.getByText("10:00")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("10:00"));
    await userEvent.click(screen.getByRole("button", { name: /continuar/i }));

    const phoneInput = screen.getByLabelText(/whatsapp/i) as HTMLInputElement;
    await userEvent.type(phoneInput, "11999999999");

    expect(phoneInput.value).toBe("(11) 99999-9999");
  });

  it("avança até a etapa de dados do cliente e submete o agendamento", async () => {
    (createPublicAppointment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: "success",
      message: "Agendamento confirmado.",
    });

    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        slots: [{ startTime: "2026-07-21T10:00:00", label: "10:00" }],
        dates: ["2026-07-21"],
      },
      isFetching: false,
      refetch: mockRefetch,
    });

    setup();

    await userEvent.click(screen.getByText("Barba"));
    await userEvent.click(screen.getByText("Ana"));
    await userEvent.click(screen.getByRole("button", { name: /continuar/i }));

    await userEvent.type(screen.getByTestId("calendar-mock"), "2026-07-21");

    await waitFor(() => {
      expect(screen.getByText("10:00")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("10:00"));
    await userEvent.click(screen.getByRole("button", { name: /continuar/i }));

    await userEvent.type(screen.getByLabelText(/nome completo/i), "João Silva");
    await userEvent.type(screen.getByLabelText(/whatsapp/i), "11999999999");

    await userEvent.click(screen.getByRole("button", { name: /confirmar agendamento/i }));

    await waitFor(() => {
      expect(createPublicAppointment).toHaveBeenCalled();
    });

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/barbearia-teste/sucesso"));
  });
});
