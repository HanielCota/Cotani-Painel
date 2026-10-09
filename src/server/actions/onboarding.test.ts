import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";

vi.mock("@/server/clinic-action", () => ({ requireClinicAction: vi.fn() }));

const { markBookingLinkSharedOnServer } = await import("@/server/actions/onboarding");
const { requireClinicAction } = await import("@/server/clinic-action");

describe("markBookingLinkSharedOnServer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("grava só a primeira vez, no negócio ativo", async () => {
    vi.mocked(requireClinicAction).mockResolvedValue({ ok: true, clinic: { id: "clinic-1" } } as never);
    prismaMock.clinic.updateMany = vi.fn().mockResolvedValue({ count: 1 });

    await markBookingLinkSharedOnServer();

    expect(prismaMock.clinic.updateMany).toHaveBeenCalledWith({
      where: { id: "clinic-1", bookingLinkSharedAt: null },
      data: { bookingLinkSharedAt: expect.any(Date) },
    });
  });

  it("sem acesso ao negócio, não grava", async () => {
    vi.mocked(requireClinicAction).mockResolvedValue({ ok: false, result: { status: "error", message: "Selecione um negócio." } });
    prismaMock.clinic.updateMany = vi.fn();

    expect(await markBookingLinkSharedOnServer()).toEqual({ status: "error", message: "Selecione um negócio." });
    expect(prismaMock.clinic.updateMany).not.toHaveBeenCalled();
  });
});
