import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "public-assets";
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function hasExpectedSignature(mimeType: string, bytes: Buffer): boolean {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimeType === "image/webp") {
    return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }

  return false;
}

function publicPrefix() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return base ? `${base}/storage/v1/object/public/${BUCKET}/` : "";
}

export async function persistPublicImage(input: { clinicId: string; kind: "services" | "professionals"; value: string | null; currentUrl?: string | null }) {
  if (!input.value) return null;
  if (input.value === input.currentUrl) return input.value;
  const prefix = publicPrefix();
  if (prefix && input.value.startsWith(prefix)) return input.value;

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(input.value);
  if (!match) throw new Error("Envie uma imagem JPG, PNG ou WebP válida.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error("A imagem deve ter no máximo 2 MB.");
  if (!hasExpectedSignature(match[1], bytes)) throw new Error("O conteúdo do arquivo não corresponde a uma imagem válida.");

  const path = `${input.clinicId}/${input.kind}/${randomUUID()}.${TYPES[match[1]]}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: match[1], upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(`Não foi possível armazenar a imagem: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removePublicImage(url: string | null | undefined) {
  const prefix = publicPrefix();
  if (!url || !prefix || !url.startsWith(prefix)) return;
  await createAdminClient().storage.from(BUCKET).remove([decodeURIComponent(url.slice(prefix.length))]);
}
