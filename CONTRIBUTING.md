# Como contribuir

## Fluxo

1. Crie um branch a partir da `main` atualizada: `tipo/descricao-curta`
   (ex.: `fix/recuperacao-senha`, `feat/agenda-semanal`, `chore/deps`).
2. Faça PRs **pequenos e de um tema só**. Mudanças não relacionadas vão em PRs
   separados.
3. Nunca faça push direto na `main`.
4. O PR só entra com o CI verde e revisão do responsável pela área
   (`.github/CODEOWNERS`).

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em
português: `fix(auth): ...`, `feat(agenda): ...`, `chore(deps): ...`,
`ci: ...`, `docs: ...`, `refactor: ...`, `test: ...`.

## Antes de abrir o PR

```bash
pnpm check   # lint + tipos + testes
pnpm build
```

- Mudou o banco? Crie a migração com `pnpm prisma migrate dev` e **nunca edite
  uma migração já aplicada**. O CI recria o banco do zero e compara com o
  `schema.prisma`.
- Nova variável de ambiente? Atualize `.env.example`, `scripts/check-env.mjs`
  e os valores fictícios do CI.
- Testes rodam em UTC (como no CI). Monte datas sempre com fuso explícito.

## Ambiente local

O `.env.local` aponta para serviços reais. Para testes E2E e experimentos que
gravam dados, use um banco local (veja `scripts/ci/supabase-bootstrap.sql` e o
job `database` em `.github/workflows/ci.yml`).
