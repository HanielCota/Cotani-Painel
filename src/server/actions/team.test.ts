import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { removeClinicMember, updateClinicMemberRole } from "@/server/actions/team";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/server/tenant", () => ({
  getTenantContext: vi.fn(),
  requireRole: vi.fn(),
}));

const { getTenantContext, requireRole } = await import("@/server/tenant");

const clinic = { id: "550e8400-e29b-41d4-a716-446655440000" };
const actorMembership = { id: "550e8400-e29b-41d4-a716-446655440001", role: "ADMIN" };
const otherAdmin = { id: "550e8400-e29b-41d4-a716-446655440002", clinicId: clinic.id, role: "ADMIN" };

function createTransaction(adminCount: number) {
  return {
    $executeRaw: vi.fn(),
    membership: {
      findFirst: vi.fn().mockResolvedValue(otherAdmin),
      count: vi.fn().mockResolvedValue(adminCount),
      update: vi.fn(),
      delete: vi.fn(),
    },
    professional: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

function useTransaction(transaction: ReturnType<typeof createTransaction>) {
  prismaMock.$transaction.mockImplementationOnce(async (callback: (client: typeof transaction) => unknown) =>
    callback(transaction),
  );
}

function membershipForm(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

describe("equipe: último administrador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTenantContext).mockResolvedValue({} as never);
    vi.mocked(requireRole).mockReturnValue({ clinic, membership: actorMembership } as never);
    prismaMock.membership.findFirst.mockResolvedValue(otherAdmin);
  });

  it("não rebaixa o único administrador", async () => {
    const transaction = createTransaction(1);
    useTransaction(transaction);

    const result = await updateClinicMemberRole(membershipForm({ membershipId: otherAdmin.id, role: "RECEPTIONIST" }));

    expect(result).toEqual({ status: "error", message: "O negócio precisa manter pelo menos um administrador." });
    expect(transaction.membership.update).not.toHaveBeenCalled();
  });

  it("rebaixa um administrador quando há outro", async () => {
    const transaction = createTransaction(2);
    useTransaction(transaction);

    const result = await updateClinicMemberRole(membershipForm({ membershipId: otherAdmin.id, role: "RECEPTIONIST" }));

    expect(result.status).toBe("success");
    expect(transaction.membership.update).toHaveBeenCalledWith({
      where: { id: otherAdmin.id },
      data: { role: "RECEPTIONIST" },
    });
  });

  it("não remove o único administrador", async () => {
    const transaction = createTransaction(1);
    useTransaction(transaction);

    const result = await removeClinicMember(membershipForm({ membershipId: otherAdmin.id }));

    expect(result).toEqual({ status: "error", message: "Não é possível remover o último administrador." });
    expect(transaction.membership.delete).not.toHaveBeenCalled();
  });

  it("remove um administrador quando há outro", async () => {
    const transaction = createTransaction(2);
    useTransaction(transaction);

    const result = await removeClinicMember(membershipForm({ membershipId: otherAdmin.id }));

    expect(result.status).toBe("success");
    expect(transaction.membership.delete).toHaveBeenCalledWith({ where: { id: otherAdmin.id } });
  });
});
