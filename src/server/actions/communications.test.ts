import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireAuthenticatedUser: vi.fn(async () => ({ id: "user-1" })) }));
vi.mock("@/server/clinic-action", () => ({ requireClinicAction: vi.fn() }));

const { retryNotification } = await import("@/server/actions/communications");
const { requireClinicAction } = await import("@/server/clinic-action");

const notificationId = "550e8400-e29b-41d4-a716-446655440000";

function form(id = notificationId) {
  const formData = new FormData();
  formData.set("id", id);
  return formData;
}

describe("retryNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("com assinatura inativa, não recoloca a mensagem na fila", async () => {
    vi.mocked(requireClinicAction).mockResolvedValue({ ok: false, result: { status: "error", message: "Assinatura inativa." } });

    const result = await retryNotification({ status: "success", message: "" }, form());

    expect(result).toEqual({ status: "error", message: "Assinatura inativa." });
    expect(prismaMock.notification.updateMany).not.toHaveBeenCalled();
  });

  it("com assinatura ativa, recoloca a mensagem com falha na fila", async () => {
    vi.mocked(requireClinicAction).mockResolvedValue({ ok: true, clinic: { id: "clinic-1" } } as never);
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });

    const result = await retryNotification({ status: "success", message: "" }, form());

    expect(result.status).toBe("success");
    expect(prismaMock.notification.updateMany.mock.calls[0][0].where).toMatchObject({ id: notificationId, clinicId: "clinic-1", status: "FAILED" });
  });

  it("id inválido é recusado antes de consultar o negócio", async () => {
    const result = await retryNotification({ status: "success", message: "" }, form("x"));
    expect(result).toEqual({ status: "error", message: "Mensagem inválida." });
    expect(requireClinicAction).not.toHaveBeenCalled();
  });
});
