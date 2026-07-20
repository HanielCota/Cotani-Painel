import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import {
  createService,
  createServiceFromForm,
  toggleServiceActive,
  updateService,
  updateServiceFromForm,
} from "@/server/actions/services";

vi.mock("@clerk/nextjs/server", () => {
  const protect = vi.fn();
  return {
    auth: Object.assign(vi.fn(() => ({ protect })), { protect }),
  };
});

vi.mock("@/server/tenant", () => ({
  requireActiveClinic: vi.fn(),
}));

const { auth } = await import("@clerk/nextjs/server");
const { requireActiveClinic } = await import("@/server/tenant");

const activeClinic = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Barbearia",
  slug: "barbearia",
  timeZone: "America/Sao_Paulo",
  subscriptionStatus: "ACTIVE",
};

const validService = {
  name: "Corte",
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
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1", orgId: "org-1" });
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
  });

  it("retorna erro para dados inválidos", async () => {
    const result = await createService({ name: "", duration: 0, price: -1 });

    expect(result.status).toBe("error");
  });

  it("retorna erro quando não há barbearia", async () => {
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await createService(validService);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Selecione uma barbearia");
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
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1", orgId: "org-1" });
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
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
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1", orgId: "org-1" });
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
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
