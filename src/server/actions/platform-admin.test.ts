import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
  clinic: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  clinicSlugAlias: { findFirst: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  membership: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
  professional: { updateMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/server/platform-admin", () => ({ requirePlatformAdmin: vi.fn(async () => ({ userId: "admin-1" })) }));
vi.mock("@/server/services/admin-audit", () => ({ writeAdminAuditLog: vi.fn() }));
// redirect() do Next interrompe a action; aqui ele lança com o destino.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const { updateClinicAsPlatformAdmin, updateMembershipRoleAsPlatformAdmin } = await import("@/server/actions/platform-admin");

const CLINIC_ID = "550e8400-e29b-41d4-a716-446655440020";
const MEMBERSHIP_ID = "550e8400-e29b-41d4-a716-446655440021";

function clinic(slug: string) {
  return {
    id: CLINIC_ID, name: "Loja", slug, timeZone: "America/Sao_Paulo", maxAppointmentsPerDay: null,
    operationalStatus: "ACTIVE", suspensionReason: null, suspendedAt: null, deletedAt: null,
  };
}

function clinicForm(slug: string) {
  const data = new FormData();
  data.set("clinicId", CLINIC_ID);
  data.set("name", "Loja");
  data.set("slug", slug);
  data.set("timeZone", "America/Sao_Paulo");
  return data;
}

async function redirectOf(action: Promise<void>) {
  const error = await action.catch((caught: Error) => caught);
  return decodeURIComponent(String((error as Error).message)).replaceAll("+", " ");
}

describe("troca de slug pelo admin da plataforma", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
    prismaMock.clinic.findUniqueOrThrow.mockResolvedValue(clinic("loja-antiga"));
    prismaMock.clinic.update.mockImplementation(async ({ data }: { data: { slug: string } }) => clinic(data.slug));
    prismaMock.clinic.findFirst.mockResolvedValue(null);
    prismaMock.clinicSlugAlias.findFirst.mockResolvedValue(null);
  });

  it("recusa um slug que é endereço antigo de outra loja", async () => {
    prismaMock.clinicSlugAlias.findFirst.mockResolvedValue({ id: "alias-de-outra-loja" });

    const destination = await redirectOf(updateClinicAsPlatformAdmin(clinicForm("loja-nova")));

    expect(destination).toContain("status=error");
    expect(prismaMock.clinic.update).not.toHaveBeenCalled();
  });

  it("mantém o endereço antigo funcionando como alias", async () => {
    await redirectOf(updateClinicAsPlatformAdmin(clinicForm("loja-nova")));

    expect(prismaMock.clinicSlugAlias.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "loja-antiga" },
      create: { slug: "loja-antiga", clinicId: CLINIC_ID },
    }));
  });
});

describe("papel alterado pelo admin da plataforma", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
  });

  it("desvincula o profissional de quem deixa de ser PROVIDER", async () => {
    prismaMock.membership.findFirst.mockResolvedValueOnce({
      id: MEMBERSHIP_ID, clinicId: CLINIC_ID, role: "PROVIDER", user: { authUserId: "user-1" }, clinic: clinic("loja"),
    });
    const data = new FormData();
    data.set("clinicId", CLINIC_ID);
    data.set("membershipId", MEMBERSHIP_ID);
    data.set("role", "RECEPTIONIST");
    data.set("reason", "Mudou de função na loja");

    await redirectOf(updateMembershipRoleAsPlatformAdmin(data));

    expect(prismaMock.professional.updateMany).toHaveBeenCalledWith({ where: { membershipId: MEMBERSHIP_ID }, data: { membershipId: null } });
  });
});
