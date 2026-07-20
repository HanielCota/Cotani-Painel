import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import {
  createProfessional,
  createProfessionalFromForm,
  toggleProfessionalActive,
  updateProfessional,
  updateProfessionalFromForm,
} from "@/server/actions/professionals";

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

const validProfessional = {
  name: "João",
  imageUrl: null,
  serviceIds: ["550e8400-e29b-41d4-a716-446655440001"],
};

function createFormData(overrides: Record<string, string | null> = {}) {
  const formData = new FormData();
  formData.set("name", validProfessional.name);
  formData.append("serviceIds", validProfessional.serviceIds[0]);
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === null) {
      formData.set(key, "");
    } else if (value !== undefined) {
      formData.set(key, value);
    }
  });
  return formData;
}

describe("createProfessional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1", orgId: "org-1" });
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
  });

  it("retorna erro para dados inválidos", async () => {
    const result = await createProfessional({ name: "", serviceIds: [] });

    expect(result.status).toBe("error");
  });

  it("retorna erro quando não há barbearia", async () => {
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await createProfessional(validProfessional);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Selecione uma barbearia");
  });

  it("retorna erro quando serviço selecionado é inválido", async () => {
    prismaMock.service.findMany.mockResolvedValueOnce([]);

    const result = await createProfessionalFromForm(
      { status: "success", message: "" },
      createFormData(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("inválidos");
  });

  it("cria profissional com sucesso", async () => {
    prismaMock.service.findMany.mockResolvedValueOnce([{ id: validProfessional.serviceIds[0] }]);
    prismaMock.professional.create.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002" });

    const result = await createProfessionalFromForm(
      { status: "success", message: "" },
      createFormData(),
    );

    expect(result.status).toBe("success");
    expect(prismaMock.professional.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: activeClinic.id,
        name: validProfessional.name,
        services: {
          create: [{ serviceId: validProfessional.serviceIds[0] }],
        },
      }),
    });
  });
});

describe("updateProfessional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1", orgId: "org-1" });
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
    prismaMock.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prismaMock);
      }
      return Promise.all(callback as Array<Promise<unknown>>);
    });
  });

  it("retorna erro para ID inválido", async () => {
    const result = await updateProfessional({ ...validProfessional, professionalId: "invalid" });

    expect(result.status).toBe("error");
  });

  it("retorna erro quando profissional não existe", async () => {
    prismaMock.professional.findFirst.mockResolvedValueOnce(null);

    const result = await updateProfessional({
      ...validProfessional,
      professionalId: "550e8400-e29b-41d4-a716-446655440002",
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("Profissional não encontrado");
  });

  it("atualiza profissional com sucesso", async () => {
    prismaMock.professional.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002" });
    prismaMock.service.findMany.mockResolvedValueOnce([{ id: validProfessional.serviceIds[0] }]);

    const formData = createFormData();
    formData.set("professionalId", "550e8400-e29b-41d4-a716-446655440002");

    const result = await updateProfessionalFromForm({ status: "success", message: "" }, formData);

    expect(result.status).toBe("success");
    expect(prismaMock.professionalService.deleteMany).toHaveBeenCalledWith({
      where: { professionalId: "550e8400-e29b-41d4-a716-446655440002" },
    });
    expect(prismaMock.professional.update).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440002" },
      data: expect.objectContaining({ name: validProfessional.name }),
    });
  });
});

describe("toggleProfessionalActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1", orgId: "org-1" });
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
  });

  it("retorna erro para ID inválido", async () => {
    const result = await toggleProfessionalActive("invalid");

    expect(result.status).toBe("error");
  });

  it("desativa profissional sem agendamentos futuros", async () => {
    prismaMock.professional.findFirst.mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440002",
      isActive: true,
    });
    prismaMock.appointment.count.mockResolvedValueOnce(0);

    const result = await toggleProfessionalActive("550e8400-e29b-41d4-a716-446655440002");

    expect(result.status).toBe("success");
    expect(prismaMock.professional.update).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440002" },
      data: { isActive: false },
    });
  });

  it("impede desativação quando há agendamentos futuros", async () => {
    prismaMock.professional.findFirst.mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440002",
      isActive: true,
    });
    prismaMock.appointment.count.mockResolvedValueOnce(2);

    const result = await toggleProfessionalActive("550e8400-e29b-41d4-a716-446655440002");

    expect(result.status).toBe("error");
    expect(prismaMock.professional.update).not.toHaveBeenCalled();
  });
});
