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
    return (
      bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }

  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

function publicPrefix() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return base ? `${base}/storage/v1/object/public/${BUCKET}/` : "";
}

function objectPathFromPublicUrl(url: string): string | null {
  const prefix = publicPrefix();
  if (!prefix || !url.startsWith(prefix)) return null;

  try {
    return decodeURIComponent(url.slice(prefix.length));
  } catch {
    return null;
  }
}

type PublicImageKind = "services" | "professionals" | "clinics";

function isOwnedObjectPath(path: string, clinicId: string, kind: PublicImageKind): boolean {
  const prefix = `${clinicId}/${kind}/`;
  if (!path.startsWith(prefix)) return false;
  const fileName = path.slice(prefix.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(fileName);
}

/** Lê a imagem enviada (arquivo ou data URL). URLs já armazenadas não são reaproveitadas. */
async function readImageInput(
  value: string | File,
  clinicId: string,
  kind: PublicImageKind,
): Promise<{ mimeType: string; bytes: Buffer }> {
  if (value instanceof File) {
    return { mimeType: value.type, bytes: Buffer.from(await value.arrayBuffer()) };
  }

  const existingPath = objectPathFromPublicUrl(value);
  if (existingPath && !isOwnedObjectPath(existingPath, clinicId, kind)) {
    throw new Error("A imagem informada não pertence a este negócio.");
  }
  if (existingPath) throw new Error("Envie novamente o arquivo em vez de reutilizar outra imagem armazenada.");

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("Envie uma imagem JPG, PNG ou WebP válida.");

  return { mimeType: match[1], bytes: Buffer.from(match[2], "base64") };
}

export async function persistPublicImage(input: {
  clinicId: string;
  kind: PublicImageKind;
  value: string | File | null;
  currentUrl?: string | null;
}): Promise<string | null> {
  if (!input.value) return null;
  if (typeof input.value === "string" && input.value === input.currentUrl) return input.value;
  const { mimeType, bytes } = await readImageInput(input.value, input.clinicId, input.kind);

  if (!(mimeType in TYPES)) throw new Error("Envie uma imagem JPG, PNG ou WebP válida.");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error("A imagem deve ter no máximo 2 MB.");
  if (!hasExpectedSignature(mimeType, bytes))
    throw new Error("O conteúdo do arquivo não corresponde a uma imagem válida.");

  const path = `${input.clinicId}/${input.kind}/${randomUUID()}.${TYPES[mimeType]}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(`Não foi possível armazenar a imagem: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removePublicImage(input: {
  url: string | null | undefined;
  clinicId: string;
  kind: PublicImageKind;
}) {
  if (!input.url) return;
  const path = objectPathFromPublicUrl(input.url);
  if (!path || !isOwnedObjectPath(path, input.clinicId, input.kind)) return;
  await createAdminClient().storage.from(BUCKET).remove([path]);
}
