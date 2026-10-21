import { describe, expect, it } from "vitest";

import { getErrorMetadata } from "@/lib/error-metadata";

describe("getErrorMetadata", () => {
  it("devolve nome e código, nunca a mensagem", () => {
    const error = Object.assign(new TypeError("dados de maria@example.com"), { code: "P2002" });

    const metadata = getErrorMetadata(error);

    expect(metadata).toEqual({ errorName: "TypeError", errorCode: "P2002" });
  });

  it("procura o código na causa do erro", () => {
    const cause = Object.assign(new Error("interno"), { code: "40001" });

    expect(getErrorMetadata(new Error("envolvente", { cause }))).toEqual({ errorName: "Error", errorCode: "40001" });
  });

  it("termina mesmo com uma cadeia de causas circular", () => {
    const first = new Error("primeiro");
    const second = new Error("segundo", { cause: first });
    Object.assign(first, { cause: second });

    expect(getErrorMetadata(first)).toEqual({ errorName: "Error" });
  });

  it("valor que não é erro vira UnknownError sem código", () => {
    expect(getErrorMetadata("texto solto")).toEqual({ errorName: "UnknownError" });
  });
});
