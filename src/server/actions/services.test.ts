import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import {
  createService,
  createServiceFromForm,
  toggleServiceActive,
  updateService,
  updateServiceFromForm,
} from "@/server/actions/services";

vi.mock("@/server/auth", () => ({ requireAuthenticatedUser: vi.fn().mockResolvedValue({ id: "user-1" }) }));
vi.mock("@/server/services/media-storage", () => ({
  persistPublicImage: vi.fn(async ({ value }: { value: string | null }) => value),
  removePublicImage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/services/action-rate-limit", () => ({ allowMediaUpload: vi.fn().mockResolvedValue(true) }));

vi.mock("@/server/tenant", () => ({
  getClinicForRoles: vi.fn(),
}));

const { getClinicForRoles } = await import("@/server/tenant");

const activeClinic = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Loja",
  slug: "loja",
  timeZone: "America/Sao_Paulo",
  subscriptionStatus: "ACTIVE",
  subscriptionExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
};

const validService = {
  name: "Serviço A",
  duration: 30,
  price: 50,
  imageUrl: null,
};

function createFormData(overrides: Record<string, string | null> = {}) {
  const formData = new FormData();
  formData.set("name", validService.name);
  formData.set("duration", String(validService.duration));
  formData.set("price", String(validService.price));
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === null) {
      formData.set(key, "");
    } else if (value !== undefined) {
      formData.set(key, value);
    }
  });
  return formData;
}

describe("createService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
  });

  it("retorna erro para dados inválidos", async () => {
    const result = await createService({ name: "", duration: 0, price: -1 });

    expect(result.status).toBe("error");
  });

  it("retorna erro quando não há loja", async () => {
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await createService(validService);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Selecione um negócio");
  });

  it("cria serviço com sucesso", async () => {
    prismaMock.service.create.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440001" });

    const result = await createServiceFromForm({ status: "success", message: "" }, createFormData());

    expect(result.status).toBe("success");
    expect(prismaMock.service.create).toHaveBeenCalledWith({
      data: {
        clinicId: activeClinic.id,
        name: validService.name,
        duration: validService.duration,
        price: validService.price,
        imageUrl: null,
      },
    });
  });

  it("aceita imagem em base64 válida", async () => {
    prismaMock.service.create.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440001" });
    const imageUrl = "data:image/png;base64,abc123";

    const result = await createServiceFromForm(
      { status: "success", message: "" },
      createFormData({ imageUrl }),
    );

    expect(result.status).toBe("success");
  });

  it("rejeita imagem com URL inválida", async () => {
    const result = await createServiceFromForm(
      { status: "success", message: "" },
      createFormData({ imageUrl: "ftp://invalid.com" }),
    );

    expect(result.status).toBe("error");
  });
});

describe("updateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
  });

  it("retorna erro para ID inválido", async () => {
    const result = await updateService({ ...validService, serviceId: "invalid" });

    expect(result.status).toBe("error");
  });

  it("retorna erro quando serviço não existe", async () => {
    prismaMock.service.findFirst.mockResolvedValueOnce(null);

    const result = await updateService({ ...validService, serviceId: "550e8400-e29b-41d4-a716-446655440001" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("Serviço não encontrado");
  });

  it("atualiza serviço com sucesso", async () => {
    prismaMock.service.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440001" });

    const formData = createFormData();
    formData.set("serviceId", "550e8400-e29b-41d4-a716-446655440001");

    const result = await updateServiceFromForm({ status: "success", message: "" }, formData);

    expect(result.status).toBe("success");
    expect(prismaMock.service.update).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440001" },
      data: expect.objectContaining({ name: validService.name }),
    });
  });
});

describe("toggleServiceActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
  });

  it("retorna erro para ID inválido", async () => {
    const result = await toggleServiceActive("invalid");

    expect(result.status).toBe("error");
  });

  it("desativa serviço sem agendamentos futuros", async () => {
    prismaMock.service.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440001", isActive: true });
    prismaMock.appointment.count.mockResolvedValueOnce(0);

    const result = await toggleServiceActive("550e8400-e29b-41d4-a716-446655440001");

    expect(result.status).toBe("success");
    expect(prismaMock.service.update).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440001" },
      data: { isActive: false },
    });
  });

  it("impede desativação quando há agendamentos futuros", async () => {
    prismaMock.service.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440001", isActive: true });
    prismaMock.appointment.count.mockResolvedValueOnce(3);

    const result = await toggleServiceActive("550e8400-e29b-41d4-a716-446655440001");

    expect(result.status).toBe("error");
    expect(prismaMock.service.update).not.toHaveBeenCalled();
  });

  it("reativa serviço", async () => {
    prismaMock.service.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440001", isActive: false });

    const result = await toggleServiceActive("550e8400-e29b-41d4-a716-446655440001");

    expect(result.status).toBe("success");
    expect(prismaMock.service.update).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440001" },
      data: { isActive: true },
    });
  });
});
