@AGENTS.md

## Fluxo de trabalho com o Claude

- **Modo leve.** Neste projeto um chat só faz o código, os testes, o push e o PR (regra do Guilherme em `REGRAS-CHATS.md`, na máquina dele). Merge é sempre do Haniel.
- **Checagem antes de todo push.** Os mesmos passos da CI, na mesma ordem: `pnpm exec prisma validate`, `pnpm check` (lint, tipos, testes unitários e `test:deploy`) e `pnpm build`. Na máquina do Guilherme, o comando que grava a aprovação lida pelo hook de push é `node "C:/Users/Administrator/.claude/hooks/ci-run.cjs"`. O `pnpm test:e2e` fica fora dele e roda à mão antes de PR que mexe em tela ou fluxo.
- **Decisões.** Toda decisão de arquitetura ou de biblioteca vira uma linha em [`docs/DECISOES.md`](./docs/DECISOES.md), no mesmo PR que a aplica.
