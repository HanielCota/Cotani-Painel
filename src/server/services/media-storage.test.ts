import { beforeEach, describe, expect, it, vi } from "vitest";

const remove = vi.fn();
const from = vi.fn(() => ({ remove }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from } }),
}));

import { persistPublicImage, removePublicImage } from "@/server/services/media-storage";

describe("isolamento de imagens por loja", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  });

  it("rejeita o reaproveitamento de uma imagem pertencente a outra loja", async () => {
    const value = "https://project.supabase.co/storage/v1/object/public/public-assets/clinic-b/services/image.png";

    await expect(persistPublicImage({ clinicId: "clinic-a", kind: "services", value })).rejects.toThrow("não pertence");
  });

  it("não remove uma imagem fora do espaço da loja", async () => {
    const url = "https://project.supabase.co/storage/v1/object/public/public-assets/clinic-b/services/image.png";

    await removePublicImage({ url, clinicId: "clinic-a", kind: "services" });

    expect(from).not.toHaveBeenCalled();
  });

  it("não aceita segmentos de travessia ao remover uma imagem", async () => {
    const url = "https://project.supabase.co/storage/v1/object/public/public-assets/clinic-a/services/../professionals/550e8400-e29b-41d4-a716-446655440000.png";

    await removePublicImage({ url, clinicId: "clinic-a", kind: "services" });

    expect(from).not.toHaveBeenCalled();
  });
});
