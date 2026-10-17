import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function tsxFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "generated" ? [] : tsxFiles(filePath);
    return filePath.endsWith(".tsx") ? [filePath] : [];
  });
}

describe("Button em formulários", () => {
  // Analisa todos os .tsx do projeto; em máquina carregada passa do limite padrão.
  it("declara explicitamente submit ou button", () => {
    const violations: string[] = [];

    for (const filePath of tsxFiles(path.join(process.cwd(), "src"))) {
      const source = ts.createSourceFile(
        filePath,
        fs.readFileSync(filePath, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

      function visit(node: ts.Node, insideForm = false) {
        const jsx = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
        if (!jsx) {
          ts.forEachChild(node, (child) => visit(child, insideForm));
          return;
        }

        const tagName = jsx.tagName.getText(source);
        const nextInsideForm = insideForm || tagName === "form";
        if (nextInsideForm && tagName === "Button") {
          const hasExplicitType = jsx.attributes.properties.some(
            (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "type",
          );
          if (!hasExplicitType) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            violations.push(`${path.relative(process.cwd(), filePath)}:${line + 1}`);
          }
        }

        ts.forEachChild(node, (child) => visit(child, nextInsideForm));
      }

      visit(source);
    }

    expect(violations).toEqual([]);
  }, 30_000);
});
