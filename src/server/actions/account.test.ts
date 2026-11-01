import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { deleteOwnAccount } from "@/server/actions/account";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const deleteUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ auth: { admin: { deleteUser } } }) }));

vi.mock("@/server/auth", () => ({
  requireAuthenticatedUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
  ensureCurrentAppUser: vi.fn().mockResolvedValue({ appUser: { id: "user-1" } }),
}));

const findMany = vi.fn();
Object.assign(prismaMock.membership, { findMany });

function createTransaction(adminsInsideTransaction: number) {
  return {
    $executeRaw: vi.fn(),
    membership: {
      count: vi.fn().mockResolvedValue(adminsInsideTransaction),
      deleteMany: vi.fn(),
    },
    professional: { updateMany: vi.fn() },
    user: { delete: vi.fn() },
  };
}

function confirmationForm() {
  const formData = new FormData();
  formData.set("confirmation", "EXCLUIR MINHA CONTA");
  return formData;
}

describe("excluir a própria conta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([{ id: "membership-1", clinicId: "clinic-1", role: "ADMIN" }]);
    prismaMock.membership.count.mockResolvedValue(2);
    deleteUser.mockResolvedValue({ error: null });
  });

  it("não exclui quando outro administrador sai antes da transação terminar", async () => {
    const transaction = createTransaction(1);
    prismaMock.$transaction.mockImplementationOnce(async (callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
    );

    const result = await deleteOwnAccount({ status: "success", message: "" }, confirmationForm());

    expect(result).toEqual({
      status: "error",
      message: "Transfira a administração dos seus negócios antes de excluir a conta.",
    });
    expect(transaction.user.delete).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("exclui os dados e o acesso quando há outro administrador", async () => {
    const transaction = createTransaction(2);
    prismaMock.$transaction.mockImplementationOnce(async (callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
    );

    const result = await deleteOwnAccount({ status: "success", message: "" }, confirmationForm());

    expect(result).toEqual({ status: "success", message: "Conta excluída." });
    expect(transaction.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(deleteUser).toHaveBeenCalledWith("auth-user-1");
  });
});
