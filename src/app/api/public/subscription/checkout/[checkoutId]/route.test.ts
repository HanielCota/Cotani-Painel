import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => vi.fn());
vi.mock("@/server/services/landing-checkout", () => ({ getLandingCheckoutStatus: status }));
const { GET } = await import("./route");

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function request(origin = "https://cotani.com.br") {
  return new NextRequest(`https://painel.cotani.com.br/api/public/subscription/checkout/${id}`, { headers: { origin } });
}

function requestWithoutOrigin() {
  return new NextRequest(`https://painel.cotani.com.br/api/public/subscription/checkout/${id}`);
}

describe("status público do checkout", () => {
  beforeEach(() => {
    status.mockReset();
  });

  it("retorna somente o estado necessário pela página de retorno", async () => {
    status.mockResolvedValueOnce("approved");
    const response = await GET(request(), { params: Promise.resolve({ checkoutId: id }) });
    expect(await response.json()).toEqual({ status: "approved" });
  });

  it("não expõe checkouts inexistentes", async () => {
    status.mockResolvedValueOnce(null);
    expect((await GET(request(), { params: Promise.resolve({ checkoutId: id }) })).status).toBe(404);
  });

  it("recusa consultas sem a origem da landing", async () => {
    expect((await GET(requestWithoutOrigin(), { params: Promise.resolve({ checkoutId: id }) })).status).toBe(403);
    expect(status).not.toHaveBeenCalled();
  });
});
