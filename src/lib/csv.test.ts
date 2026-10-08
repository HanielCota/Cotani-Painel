import { describe, expect, it } from "vitest";
import { escapeCsvCell, parseCsvLine, toCsvRow } from "./csv";

describe("csv", () => {
  it("neutraliza fórmulas e escapa aspas", () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(escapeCsvCell(null)).toBe('""');
    expect(toCsvRow(["a", 1, undefined], ";")).toBe('"a";"1";""');
  });

  it("lê campos com aspas, vírgulas e aspas escapadas", () => {
    expect(parseCsvLine('"Silva, Ana",11999999999,"a ""b"""')).toEqual(["Silva, Ana", "11999999999", 'a "b"']);
    expect(parseCsvLine("nome;telefone", ";")).toEqual(["nome", "telefone"]);
  });
});
