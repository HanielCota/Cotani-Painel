import { describe, expect, it } from "vitest";
import { parseCustomerCsv } from "./customer-import";

describe("parseCustomerCsv", () => {
  it("sem coluna de e-mail não define e-mail (não apaga o existente)", () => {
    const result = parseCustomerCsv("nome,telefone\nAna,(11) 99999-0000");
    expect(result).toEqual({ ok: true, ignored: 0, rows: [{ name: "Ana", phone: "5511999990000", email: null }] });
  });

  it("aceita separador ; e ignora linhas inválidas", () => {
    const result = parseCustomerCsv("\uFEFFNome;Telefone;Email\nAna;11999990000;ana@example.com\nX;123;\nBia;11988887777;invalido");
    expect(result).toEqual({ ok: true, ignored: 2, rows: [{ name: "Ana", phone: "5511999990000", email: "ana@example.com" }] });
  });

  it("deduplica telefones repetidos no arquivo", () => {
    const result = parseCustomerCsv("nome,telefone\nAna,11999990000\nAna Souza,11999990000");
    expect(result.ok && result.rows).toEqual([{ name: "Ana Souza", phone: "5511999990000", email: null }]);
  });

  it("exige colunas obrigatórias", () => {
    expect(parseCustomerCsv("cliente,fone\nAna,1199999")).toEqual({ ok: false, message: "Use as colunas nome, telefone e email." });
  });
});
