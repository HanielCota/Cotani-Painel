<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Regras de código do Cotani

Valem para todo código novo ou alterado em `src/`.

- **Nunca usar `else`.** Trate o caso especial primeiro e retorne; o caminho principal fica sem aninhamento. Para escolher entre dois valores, use ternário ou um objeto de mapeamento.
- **Código assíncrono sempre com `async`/`await`.** Nada de `.then()`/`.catch()` encadeados. Toda função que faz I/O (banco, rede, arquivos, Supabase, Mercado Pago) é `async`. Componentes de cliente, hooks e funções puras continuam síncronos: o React não aceita componente de cliente `async`, e uma função pura `async` devolveria uma promessa no lugar do valor.
- **Retorno antecipado.** Valide entradas, permissões e estados inválidos no topo da função e saia logo.
- **Sempre checar nulos.** Nada de asserção não nula (`valor!`); confira `null`/`undefined` antes de usar e trate o caso ausente. Para buscas no banco, trate o "não encontrado" explicitamente.
- **Espaçamento e indentação.** 2 espaços, aspas duplas e ponto e vírgula (exceto em `src/components/ui`, que segue o estilo do shadcn). Uma instrução por linha; nada de funções inteiras numa linha só. Linha em branco entre blocos lógicos (guardas, consultas, retorno). Ao terminar, revise o arquivo inteiro que você tocou.
