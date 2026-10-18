import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import {
  createCustomer,
  createCustomerFromForm,
  deleteCustomer,
  updateCustomer,
  updateCustomerFromForm,
} from "@/server/actions/customers";

vi.mock("@/server/auth", () => ({ requireAuthenticatedUser: vi.fn().mockResolvedValue({ id: "user-1" }) }));

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

const validCustomer = {
  name: "João Silva",
  phone: "5511999999999",
  email: "joao@example.com",
};

function createFormData(overrides: Record<string, string | null> = {}) {
  const formData = new FormData();
  formData.set("name", validCustomer.name);
  formData.set("phone", validCustomer.phone);
  formData.set("email", validCustomer.email);
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === null) {
      formData.set(key, "");
    } else if (value !== undefined) {
      formData.set(key, value);
    }
  });
  return formData;
}

describe("createCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
  });

  it("retorna erro para dados inválidos", async () => {
    const result = await createCustomer({ name: "", phone: "123" });

    expect(result.status).toBe("error");
  });

  it("retorna erro quando não há loja", async () => {
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await createCustomer(validCustomer);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Selecione um negócio");
  });

  it("cria cliente com sucesso", async () => {
    prismaMock.customer.create.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440003" });

    const result = await createCustomerFromForm(
      { status: "success", message: "" },
      createFormData(),
    );

    expect(result.status).toBe("success");
    expect(prismaMock.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: activeClinic.id,
        name: validCustomer.name,
        phone: validCustomer.phone,
        email: validCustomer.email,
      }),
    });
  });

  it("aceita cliente sem email", async () => {
    prismaMock.customer.create.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440003" });

    const result = await createCustomerFromForm(
      { status: "success", message: "" },
      createFormData({ email: null }),
    );

    expect(result.status).toBe("success");
    expect(prismaMock.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: undefined }),
    });
  });
});

describe("updateCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
  });

  it("retorna erro para ID inválido", async () => {
    const result = await updateCustomer({ ...validCustomer, customerId: "invalid" });

    expect(result.status).toBe("error");
  });

  it("retorna erro quando cliente não existe", async () => {
    prismaMock.customer.findFirst.mockResolvedValueOnce(null);

    const result = await updateCustomer({
      ...validCustomer,
      customerId: "550e8400-e29b-41d4-a716-446655440003",
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("Cliente não encontrado");
  });

  it("atualiza cliente com sucesso", async () => {
    prismaMock.customer.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440003" });

    const formData = createFormData();
    formData.set("customerId", "550e8400-e29b-41d4-a716-446655440003");

    const result = await updateCustomerFromForm({ status: "success", message: "" }, formData);

    expect(result.status).toBe("success");
    expect(prismaMock.customer.update).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440003" },
      data: expect.objectContaining({ name: validCustomer.name }),
    });
  });
});

describe("deleteCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
  });

  it("retorna erro para ID inválido", async () => {
    const result = await deleteCustomer("invalid");

    expect(result.status).toBe("error");
  });

  it("impede remoção quando há atendimentos", async () => {
    prismaMock.customer.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440003" });
    prismaMock.appointment.count.mockResolvedValueOnce(5);

    const result = await deleteCustomer("550e8400-e29b-41d4-a716-446655440003");

    expect(result.status).toBe("error");
    expect(result.message).toContain("atendimentos");
    expect(prismaMock.customer.delete).not.toHaveBeenCalled();
  });

  it("remove cliente sem atendimentos", async () => {
    prismaMock.customer.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440003" });
    prismaMock.appointment.count.mockResolvedValueOnce(0);

    const result = await deleteCustomer("550e8400-e29b-41d4-a716-446655440003");

    expect(result.status).toBe("success");
    expect(prismaMock.customer.delete).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440003" },
    });
  });
});
