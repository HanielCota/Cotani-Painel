import { z } from "zod";
import { parseCsvLine } from "@/lib/csv";
import { normalizeWhatsAppPhone } from "@/lib/phone";

export const CUSTOMER_IMPORT_MAX_ROWS = 5000;

export interface ImportedCustomerRow {
  name: string;
  phone: string;
  /** `null` quando a coluna não existe ou está vazia: não sobrescreve o e-mail atual. */
  email: string | null;
}

export type CustomerCsvParseResult =
  | { ok: true; rows: ImportedCustomerRow[]; ignored: number }
  | { ok: false; message: string };

const emailSchema = z.email();

/** Interpreta o CSV de importação (colunas nome, telefone e email opcional). */
export function parseCustomerCsv(text: string): CustomerCsvParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2 || lines.length > CUSTOMER_IMPORT_MAX_ROWS + 1) {
    return { ok: false, message: "O arquivo deve ter cabeçalho e até 5.000 clientes." };
  }
  // Aceita "," (padrão) e ";" (Excel em pt-BR).
  const separator = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const headers = parseCsvLine(lines[0], separator).map((header) => header.toLowerCase());
  const nameIndex = headers.indexOf("nome");
  const phoneIndex = headers.indexOf("telefone");
  const emailIndex = headers.indexOf("email");
  if (nameIndex < 0 || phoneIndex < 0) return { ok: false, message: "Use as colunas nome, telefone e email." };

  const byPhone = new Map<string, ImportedCustomerRow>();
  let ignored = 0;
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line, separator);
    const name = values[nameIndex]?.trim().slice(0, 120);
    const phone = normalizeWhatsAppPhone(values[phoneIndex] ?? "");
    const email = emailIndex >= 0 ? values[emailIndex]?.trim().toLowerCase() || null : null;
    if (!name || name.length < 2 || !phone || (email && !emailSchema.safeParse(email).success)) {
      ignored += 1;
      continue;
    }
    // Telefone repetido no arquivo: a última linha prevalece.
    byPhone.set(phone, { name, phone, email });
  }
  return { ok: true, rows: [...byPhone.values()], ignored };
}
