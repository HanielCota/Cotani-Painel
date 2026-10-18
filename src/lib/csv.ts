/**
 * Escapa uma célula CSV. Valores iniciados por `= + - @` recebem apóstrofo
 * para que Excel/Sheets não os executem como fórmula (CSV injection) - os
 * nomes de clientes chegam do agendamento público, portanto não são confiáveis.
 */
export function escapeCsvCell(value: unknown): string {
  let normalized = String(value ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(normalized)) normalized = `'${normalized}`;
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function toCsvRow(values: readonly unknown[], separator = ","): string {
  return values.map(escapeCsvCell).join(separator);
}

/** Divide uma linha CSV respeitando aspas e aspas escapadas (`""`). */
export function parseCsvLine(line: string, separator = ","): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === separator && !quoted) {
      values.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }
  values.push(value.trim());
  return values;
}
