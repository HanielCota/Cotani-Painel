import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
const getPublicUrl = vi.fn();
const remove = vi.fn();
const from = vi.fn(() => ({ upload, getPublicUrl, remove }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from } }),
}));

const { persistPublicImage } = await import("@/server/services/media-storage");

function dataUrl(mimeType: string, bytes: number[]) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

describe("persistPublicImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upload.mockResolvedValue({ error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.supabase.co/public/image.jpg" } });
  });

  it.each([
    ["image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
  ])("aceita assinatura real de %s", async (mimeType, bytes) => {
    await expect(persistPublicImage({
      clinicId: "11111111-1111-4111-8111-111111111111",
      kind: "services",
      value: dataUrl(mimeType, bytes),
    })).resolves.toContain("https://");

    expect(upload).toHaveBeenCalledOnce();
  });

  it("rejeita arquivo que apenas declara ser imagem", async () => {
    await expect(persistPublicImage({
      clinicId: "11111111-1111-4111-8111-111111111111",
      kind: "services",
      value: dataUrl("image/jpeg", Array.from(Buffer.from("conteudo nao confiavel"))),
    })).rejects.toThrow("não corresponde a uma imagem válida");

    expect(upload).not.toHaveBeenCalled();
  });
});
