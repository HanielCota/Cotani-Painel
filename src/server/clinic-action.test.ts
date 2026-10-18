import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/tenant", () => ({ getClinicForRoles: vi.fn() }));
vi.mock("@/server/subscription", () => ({ isSubscriptionActive: vi.fn(), SUBSCRIPTION_INACTIVE_MESSAGE: "Assinatura inativa." }));

const { requireClinicAction } = await import("@/server/clinic-action");
const { getClinicForRoles } = await import("@/server/tenant");
const { isSubscriptionActive } = await import("@/server/subscription");

describe("requireClinicAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem negócio acessível, devolve a mensagem informada", async () => {
    vi.mocked(getClinicForRoles).mockResolvedValue(null);
    expect(await requireClinicAction(["ADMIN"], "Selecione um negócio antes de salvar.")).toEqual({ ok: false, result: { status: "error", message: "Selecione um negócio antes de salvar." } });
    expect(getClinicForRoles).toHaveBeenCalledWith(["ADMIN"]);
  });

  it("assinatura inativa bloqueia", async () => {
    vi.mocked(getClinicForRoles).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(isSubscriptionActive).mockReturnValue(false);
    expect(await requireClinicAction(["ADMIN"])).toEqual({ ok: false, result: { status: "error", message: "Assinatura inativa." } });
  });

  it("libera com o negócio resolvido", async () => {
    vi.mocked(getClinicForRoles).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(isSubscriptionActive).mockReturnValue(true);
    expect(await requireClinicAction(["ADMIN", "RECEPTIONIST"])).toEqual({ ok: true, clinic: { id: "c-1" } });
  });
});
