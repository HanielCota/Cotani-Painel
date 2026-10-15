# Auditoria de repositório, DevOps e cadeia de suprimentos - Cotani Painel

Data: 07/10/2026. Escopo: repositório `HanielCota/Cotani-Painel` (checkout local em `main`). Somente diagnóstico: **nenhuma configuração, dependência, workflow ou secret foi alterada** nesta auditoria. Versões consultadas no registro npm e em `nodejs.org` nesta data; vulnerabilidades via `pnpm audit` (pnpm 11.22.0, a versão travada no projeto).

**Limitação importante:** o repositório é privado e a CLI `gh` não está instalada nesta máquina. Por isso **nenhuma configuração administrativa do GitHub** (proteção de branch, rulesets, secret scanning, Dependabot alerts, permissões padrão do token, ambientes) pôde ser lida. Esses itens aparecem como "Não foi possível verificar".

## A. Resumo executivo

O projeto tem base técnica sólida para o porte: TypeScript `strict`, ESLint com regras de promessas, 406 testes unitários (87 arquivos), CI que roda lint, tipos, testes e build, cabeçalhos de segurança e CSP com nonce, RLS no banco e documentação de arquitetura e operação.

Riscos principais:
1. **Next.js 16.3.6 tem avisos de segurança publicados** (1 alto: SSRF no Image Optimization; 4 moderados; 1 baixo), corrigidos em 16.3.8. O `sharp` está **fixado por override em uma versão vulnerável** (0.35.4; a correção é a 0.35.5). Em 04/10 o `pnpm audit --prod` estava zerado; os avisos são novos.
2. **Não há automação de dependências nem varredura de segurança no repositório**: sem Dependabot, CodeQL ou etapa de `audit`/dependency review no CI. O item 1 só apareceu porque foi consultado manualmente.
3. **O CI roda com permissões padrão do `GITHUB_TOKEN`**, actions fixadas por tag (não por SHA), sem `concurrency`, e sem E2E.
4. Faltam arquivos de governança mínimos para um repositório com dados de clientes e pagamentos: `CODEOWNERS`, `SECURITY.md` e template de PR.

Oportunidades: as correções são pequenas (patch do Next, ajuste de override e um punhado de arquivos em `.github/`) e não exigem mudar a arquitetura, que é adequada (monólito modular Next.js + Prisma + Supabase na Vercel).

## B. Diagnóstico técnico

| Área | Verificado |
| --- | --- |
| Tipo | Projeto independente, não é monorepo. `pnpm-workspace.yaml` existe só para `allowBuilds` e `overrides`. |
| Runtime | Node `>=24 <25` (`package.json` `engines`); CI usa Node 24; local 24.21.0. Node 24 "Krypton" é LTS até 30/04/2028 (manutenção a partir de 20/10/2026). |
| Gerenciador | pnpm 11.22.0 (`packageManager`), `pnpm-lock.yaml`, `--frozen-lockfile` no CI. |
| Framework | Next.js 16.3.6 (App Router, React Compiler, Server Actions, `proxy.ts`), React 19.2.8. |
| Dados | Prisma 7.10 + `@prisma/adapter-pg`, PostgreSQL Supabase (pooler 6543 em runtime, 5432 para migrações), 40+ migrações. |
| Integrações | Supabase Auth/SSR, Mercado Pago SDK 3.5.1, Resend (HTTP), Meta WhatsApp e Twilio opcionais, Vercel Analytics. |
| UI | Tailwind 4.3, Base UI 1.7, shadcn 4.19 (CLI e `shadcn/tailwind.css`), Recharts 3, lucide-react. |
| Qualidade | ESLint 9 (`eslint-config-next` + type-aware), `tsc --noEmit`, Vitest 4 (jsdom) com 406 testes, Playwright 1.62 (1 spec de smoke público). |
| Deploy | Vercel (projeto vinculado em `.vercel/`), 3 crons em `vercel.json`, `prebuild` valida variáveis (`scripts/check-env.mjs`). Sem Docker e sem IaC. |
| CI | `.github/workflows/ci.yml`: um job em PR e push na `main` com `prisma validate`, `pnpm check` e `pnpm build`. |
| Docs | `README.md`, `DEPLOY.md`, `docs/ARCHITECTURE.md`, `docs/admin-operacao.md` e auditorias em `docs/audits/`. |

Validações executadas nesta data (checkout local, incluindo as alterações não commitadas): ESLint sem erros, `tsc` sem erros, Vitest 87/87 arquivos e 406/406 testes, `next build` concluído.

## C. Problemas identificados

### SEC-01 - Next.js com vulnerabilidades publicadas
- **Categoria:** dependências / segurança. **Severidade:** alta.
- **Onde:** `package.json` (`next: 16.3.6`, `eslint-config-next: 16.3.5`).
- **Evidência:** `pnpm audit --prod` em 07/10:
  - GHSA-cjq9-62q9-8jv4 (alta, SSRF no Image Optimization);
  - GHSA-3w37-wq28-93x7, GHSA-4jqv-mc3x-m676, GHSA-f87g-xv8r-7p7x, GHSA-mcj8-r9mp-w47p (moderadas);
  - GHSA-39w2-rjm5-chcv (baixa).
  - Todas corrigidas em `>=16.3.8`, que foi publicada em 30/09/2026.
- **Impacto:**
  - O painel usa `next/image` (sem `remotePatterns` em `next.config.ts`, o que reduz a superfície do SSRF).
  - Os dois avisos de cache poisoning citam aplicações *self-hosted*. Na Vercel o risco tende a ser menor, mas isso não foi confirmado.
- **Solução:** atualizar `next` e `eslint-config-next` para 16.3.8 (patch na mesma linha). A 16.4.0 saiu em 06/10/2026; avaliar depois, com mais tempo de mercado.
- **Referência:** https://github.com/advisories/GHSA-cjq9-62q9-8jv4

### SEC-02 - Override fixa o `sharp` em versão vulnerável
- **Categoria:** cadeia de suprimentos. **Severidade:** alta.
- **Onde:** `pnpm-workspace.yaml` (`overrides.sharp: 0.35.4`).
- **Evidência:** GHSA-wq5f-xc86-pv6w (librsvg, CVE-2026-96889) afeta `<0.35.5`. A 0.35.5 já está no registro.
- **Impacto:** o override foi criado para corrigir um aviso antigo e agora *impede* o patch. Overrides com versão exata envelhecem sem aviso.
- **Solução:** mudar para `0.35.5` (ou `>=0.35.5 <0.36`). Revisar periodicamente os demais overrides (`postcss`, `browserslist`, `fast-uri`, `mysql2`, `deepmerge-ts`, `brace-expansion`) e remover os que a árvore já não precisa.

### SEC-03 - Sem automação de atualização e varredura de vulnerabilidades
- **Categoria:** segurança / automação. **Severidade:** alta.
- **Onde:** não existem `.github/dependabot.yml`, workflow do CodeQL nem etapa de `pnpm audit` ou dependency review no `ci.yml`.
- **Evidência:** os avisos de SEC-01 e SEC-02 surgiram entre 04/10 e 07/10 e não geraram nenhum sinal no repositório.
- **Solução:**
  - `dependabot.yml` com ecossistemas `npm` (agrupando minor/patch) e `github-actions`, cadência semanal.
  - Workflow do CodeQL para `javascript-typescript`.
  - `actions/dependency-review-action` em PRs.
  - `pnpm audit --prod --audit-level high` no CI. O audit de devDependencies deve ser informativo, porque hoje tem 1 aviso crítico e 13 altos vindos de `shadcn`, `jsdom`/`undici` e `eslint`.
- **Referências:** https://docs.github.com/code-security/dependabot e https://docs.github.com/code-security/code-scanning

### SEC-04 - CI com permissões padrão e actions sem pin
- **Categoria:** GitHub Actions. **Severidade:** média.
- **Onde:** `.github/workflows/ci.yml`.
- **Evidência:**
  - Não há bloco `permissions:`. O token herda o padrão do repositório, que não pôde ser verificado.
  - `actions/checkout@v4`, `pnpm/action-setup@v4` e `actions/setup-node@v4` estão fixados por tag móvel.
  - Não há `concurrency`.
- **Impacto:** escopo de token maior que o necessário e risco de supply chain se uma tag for reapontada. Execuções redundantes em pushes seguidos.
- **Solução:**
  - `permissions: contents: read` no topo.
  - Fixar as actions por SHA completo, com comentário da versão, e deixar o Dependabot (`github-actions`) atualizar.
  - `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.
- **Referência:** https://docs.github.com/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions

### QA-01 - E2E não roda no CI
- **Categoria:** testes. **Severidade:** média.
- **Onde:** `e2e/smoke.spec.ts` e `playwright.config.ts`. Nenhuma etapa no CI.
- **Evidência:** o smoke só roda manualmente. O último relato de execução é de 03/10.
- **Solução:** job separado que roda `pnpm build && pnpm start` com variáveis fictícias (as mesmas do job atual) e `pnpm test:e2e` só nas rotas públicas.
  - Hoje o `webServer` usa `pnpm dev`; para o CI convém um comando baseado em `next start`.
  - Garantir que nenhuma variável aponte para Supabase, Mercado Pago ou Resend reais. O incidente de 03/10 mostra o risco.

### QA-02 - Sem verificação de drift entre schema e migrações
- **Categoria:** banco / CI. **Severidade:** média.
- **Onde:** `prisma/`. O CI só roda `prisma validate`.
- **Evidência:** a prontidão de 04/10 não conseguiu ler `_prisma_migrations` em produção. Nada no CI garante que `schema.prisma` e `migrations/` estejam coerentes.
- **Solução:** no CI, um serviço `postgres` efêmero com `prisma migrate deploy` seguido de `prisma migrate diff --from-migrations ... --to-schema-datamodel ... --exit-code`. Custo baixo, sem acesso a produção.

### GOV-01 - Governança mínima ausente
- **Categoria:** organização. **Severidade:** média.
- **Onde:** raiz e `.github/`.
- **Evidência:** não existem `CODEOWNERS`, `SECURITY.md`, `.github/pull_request_template.md`, templates de issue nem `LICENSE`.
- **Solução:**
  - `CODEOWNERS` cobrindo `prisma/`, `src/server/`, `src/app/api/`, `.github/` e `vercel.json`, para exigir revisão onde há dinheiro e dados.
  - `SECURITY.md` com canal privado de reporte.
  - Template de PR com checklist (migração? variável nova? impacto em pagamentos?).
  - Para um produto proprietário privado, um `LICENSE` "All rights reserved" ou a declaração explícita no README basta. Não há necessidade de `CODE_OF_CONDUCT`.

### OPS-01 - Monitoramento e health check
- **Categoria:** observabilidade. **Severidade:** média (já registrada como PRD-04 em 04/10, ainda pendente).
- **Onde:** `src/app/api/`.
- **Evidência:** não há rota de health. O logger (`src/lib/logger.ts`) emite JSON no console, sem destino nem alerta. Jobs e webhooks só aparecem no `/admin`.
- **Solução:**
  - `GET /api/health` leve, com consulta `SELECT 1` com timeout e sem dados.
  - Monitor externo gratuito ou da própria Vercel, com alerta para o responsável.
  - Alerta de "job sem execução há X horas".
  - Não adicionar APM pago sem decisão do proprietário.

### HYG-01 - Higiene do repositório
- **Categoria:** manutenção. **Severidade:** baixa.
- **Evidências:**
  - `output/pdf/cotani-produto-e-estagio-atual.pdf` aparece como não rastreado e não está no `.gitignore` (risco de commit acidental). Também não estão ignorados `tmp/` e `.tmp-vercel-landing-inspect/`.
  - `tsconfig.json` declara `"types"` duas vezes; o segundo sobrescreve o primeiro.
  - `@types/node ^26.4.0` com runtime Node 24: os tipos podem expor APIs que não existem no runtime.
  - Não há formatador automático. A landing já tem `format:check`; o painel não tem nenhum.
- **Solução:**
  - Ignorar `/output/`, `/tmp/` e `/.tmp-*`.
  - Remover a chave duplicada.
  - Fixar `@types/node` em `^24`.
  - Opcional: Prettier somente com `--check` em arquivos alterados, para não gerar um diff gigante.

### HYG-02 - Muitas alterações locais fora de commit
- **Categoria:** processo. **Severidade:** média.
- **Evidência:** `git status` mostra cerca de 80 arquivos modificados e dezenas de arquivos novos. Entre eles estão as correções de segurança de 03/10 (escopo de relatórios e callback de auth), já citadas como "somente locais" em PRD-01, e o trabalho desta sessão.
- **Impacto:** correções de segurança não chegam a produção, e um diff grande dificulta a revisão.
- **Solução:** separar em PRs temáticos:
  1. Segurança/auth (03/10).
  2. Bugs de lógica.
  3. Design system/UI.
  4. Dependências (SEC-01/02).

## D. Atualizações recomendadas

Versões "recomendadas" verificadas no registro npm em 07/10/2026. Major com breaking changes fica explicitamente adiado.

| Tecnologia | Versão atual | Versão recomendada | Compatibilidade | Ação |
|---|---|---|---|---|
| next / eslint-config-next | 16.3.6 / 16.3.5 | 16.3.8 | Patch na mesma linha | **Atualizar já (SEC-01)** |
| sharp (override) | 0.35.4 | 0.35.5 | Patch | **Ajustar override (SEC-02)** |
| react / react-dom | 19.2.8 | 19.2.x (manter) | 19.3.0 é minor nova | Avaliar junto com Next 16.4 |
| @supabase/supabase-js | 2.112.4 | 2.117.3 | Minor, mesma major | Atualizar com testes de auth |
| @supabase/ssr | 0.12.5 | 0.12.7 | Patch | Atualizar |
| zod | 4.4.3 | 4.6.5 | Minor | Atualizar |
| @tanstack/react-query | 5.102.6 | 5.104.1 | Minor | Atualizar |
| mercadopago | 3.5.1 | 3.6.1 | Minor | Atualizar com testes de checkout/webhook |
| @base-ui/react | 1.7.0 | 1.8.0 | Minor | Atualizar e revisar visualmente |
| lucide-react | 1.34.0 | 1.52.0 | Minor | Atualizar |
| pg | 8.23.0 | 8.23.1 | Patch | Atualizar |
| @playwright/test | 1.62.1 | 1.64.0 | Minor | Atualizar |
| shadcn (dev) | 4.19.0 | 4.21.4 | Minor | Atualizar; reduz avisos transitivos de dev |
| jsdom / happy-dom (dev) | 30.0.1 / 20.11.8 | 30.1.2 / 20.14.5 | Minor | Atualizar; `undici` vulnerável vem do jsdom |
| @types/node | 26.4.0 | ^24 (alinhar ao runtime) | Tipos | Fixar na major do runtime |
| Prisma | 7.10.0 | 7.10.0 (manter) | 8.0.0 ainda é RC | **Não atualizar** |
| TypeScript | 5.9.3 | 5.9.3 (manter) | 7.0.2 é a nova implementação nativa | Adiar; exige avaliação de compatibilidade de ferramentas |
| ESLint | 9.39.5 | 9.x (manter) | 10.x é major | Adiar até `eslint-config-next` declarar suporte |
| Vitest / coverage | 4.1.11 | 4.x (manter) | 5.0.3 é major | Adiar; migração planejada |
| pnpm | 11.22.0 | 11.x (manter) | 12.10.1 é major | Adiar |
| Node.js | 24 (LTS) | 24 (manter) | Node 26 vira LTS em 28/10/2026 | Reavaliar após o LTS; o suporte do 24 vai até 2028 |
| Tailwind, Recharts, sonner, next-themes, date-fns, pdf-lib | — | já na última | — | Nenhuma |

## E. Configurações do GitHub

| Configuração | Estado |
| --- | --- |
| Workflow de CI (lint, tipos, testes, build) | Configurada |
| Cache de dependências no CI | Configurada (`setup-node` com `cache: pnpm`) |
| Lockfile congelado no CI | Configurada |
| Permissões mínimas do `GITHUB_TOKEN` no workflow | Ausente |
| Pinning de actions por SHA | Ausente |
| Controle de concorrência | Ausente |
| E2E no CI | Ausente |
| Dependency review / audit no CI | Ausente |
| Dependabot (`dependabot.yml`) | Ausente |
| CodeQL / code scanning | Ausente (arquivo); estado na interface não verificável |
| CODEOWNERS | Ausente |
| SECURITY.md | Ausente |
| Templates de PR/issue | Ausente |
| LICENSE | Ausente (adequado declarar proprietário) |
| CD | Não aplicável no repositório; deploy via integração Vercel Git (não verificada aqui) |
| Docker / IaC | Não aplicável (Vercel gerenciada) |
| Branch protection / rulesets na `main` | Não foi possível verificar |
| PR review obrigatório | Não foi possível verificar |
| Secret scanning / push protection | Não foi possível verificar |
| Dependabot alerts / security updates | Não foi possível verificar |
| Permissão padrão do token (Settings → Actions) | Não foi possível verificar |
| Ambientes protegidos | Não foi possível verificar |
| Secrets do repositório | Não foi possível verificar (o CI usa apenas valores fictícios inline, o que é correto) |

Varredura local: nenhum padrão de chave real foi encontrado nos arquivos rastreados. Apenas `.env.example` está versionado.

## F. Plano de implementação

**P0 - Crítico**

| Ação | Esforço | Impacto | Risco | Conclusão |
| --- | --- | --- | --- | --- |
| Next 16.3.8 + eslint-config-next 16.3.8 | Baixo | Alto | Baixo (patch) | `pnpm audit --prod` sem avisos do Next; `check` + `build` + smoke verdes |
| Override do `sharp` para 0.35.5 | Baixo | Alto | Baixo | Audit sem GHSA-wq5f; imagens renderizam |
| Commitar e publicar as correções de segurança locais de 03/10 (PR próprio) | Médio | Alto | Médio | PR revisado, CI verde, verificação em produção conforme PRD-01 |
| Ativar no GitHub: secret scanning, push protection, Dependabot alerts (requer admin) | Baixo | Alto | Nenhum | Telas de Security mostram tudo ativo |

**P1 - Alta prioridade**

| Ação | Esforço | Impacto | Risco | Conclusão |
| --- | --- | --- | --- | --- |
| `ci.yml`: `permissions`, `concurrency`, actions por SHA | Baixo | Médio | Baixo | Workflow verde com token só leitura |
| `dependabot.yml` (npm agrupado + github-actions) | Baixo | Alto | Baixo | Primeiro PR do Dependabot aberto e verde |
| CodeQL + dependency review + `pnpm audit --prod --audit-level high` | Baixo | Alto | Baixo (falsos positivos ajustáveis) | Checks obrigatórios no PR |
| Ruleset na `main`: PR obrigatório, CI obrigatório, sem force-push (requer admin) | Baixo | Alto | Baixo | Push direto bloqueado |
| CODEOWNERS + SECURITY.md + template de PR | Baixo | Médio | Nenhum | Arquivos presentes; revisão automática em áreas críticas |
| Job de E2E público no CI com servidor de produção local e variáveis fictícias | Médio | Médio | Médio (flakiness) | Smoke desktop/mobile verde em PR |
| Health check + monitor externo + alerta de job atrasado (PRD-04) | Médio | Alto | Baixo | Alerta recebido numa falha simulada em ambiente de teste |

**P2 - Modernização**

| Ação | Esforço | Impacto | Risco | Conclusão |
| --- | --- | --- | --- | --- |
| Minors da tabela D (supabase, zod, react-query, mercadopago, base-ui, lucide, playwright, shadcn, jsdom) em PRs agrupados | Médio | Médio | Médio (auth e pagamento) | CI verde + teste manual de login/checkout sandbox |
| Verificação de drift de migrações com Postgres efêmero no CI | Médio | Médio | Baixo | `migrate diff --exit-code` passando |
| `@types/node` em ^24; corrigir `types` duplicado no tsconfig | Baixo | Baixo | Baixo | `typecheck` verde |
| Continuar a extração SRP já iniciada (ver `docs/audits` e a revisão desta sessão): `clinics.ts` em units/team, regras de expediente centralizadas, dispatcher fora da rota | Alto | Médio | Médio | Testes existentes verdes; ações finas |

**P3 - Otimizações**

| Ação | Esforço | Impacto | Risco | Conclusão |
| --- | --- | --- | --- | --- |
| `.gitignore`: `/output/`, `/tmp/`, `/.tmp-*` | Baixo | Baixo | Nenhum | `git status` limpo desses diretórios |
| Prettier `--check` só nos arquivos alterados (ou adiar) | Baixo | Baixo | Baixo | CI verifica formato sem reformatação global |
| Release notes via GitHub Releases ou changelog curto por deploy | Baixo | Baixo | Nenhum | Cada deploy de produção ligado a uma tag/nota |
| Reavaliar Node 26 após LTS (28/10/2026), Next 16.4, TypeScript 7, ESLint 10, Vitest 5, pnpm 12 | Médio | Médio | Médio | Decisão registrada por tecnologia |

## G. Checklist final

- [ ] Atualizar `next` e `eslint-config-next` para 16.3.8
- [ ] Override `sharp` para 0.35.5 e revisar os demais overrides
- [ ] Separar e publicar as alterações locais (segurança 03/10, lógica, UI) em PRs
- [ ] (Admin) Ativar secret scanning, push protection, Dependabot alerts e security updates
- [ ] (Admin) Ruleset na `main`: PR + CI obrigatórios, sem force-push e sem deleção
- [ ] (Admin) Settings → Actions: permissão padrão do token "read"
- [ ] `ci.yml`: `permissions: contents: read`, `concurrency`, actions por SHA
- [ ] `.github/dependabot.yml` (npm + github-actions)
- [ ] Workflow CodeQL + dependency review + audit de produção
- [ ] `CODEOWNERS`, `SECURITY.md`, `pull_request_template.md`, declaração de licença
- [ ] Job E2E público no CI, isolado de serviços reais
- [ ] Verificação de drift de migrações no CI
- [ ] `/api/health` + monitor externo + alerta de job atrasado
- [ ] `@types/node` ^24 e `types` duplicado no `tsconfig.json`
- [ ] `.gitignore` para `output/`, `tmp/`, `.tmp-*`
- [ ] Atualizações minor da tabela D, em lotes com teste de auth e checkout sandbox
- [ ] Reavaliar majors adiadas depois do LTS do Node 26

## Situação em 08/10/2026

Correções enviadas como PRs atômicos (o repositório pertence a `HanielCota`; a conta que executou tem push, sem admin).

| Item | Situação | PR |
| --- | --- | --- |
| SEC-01 Next 16.3.8 | Corrigido | #5 |
| SEC-02 override do `sharp` + demais overrides com faixa | Corrigido (prod 8 → 0 avisos; dev 36 → 1, `braces` sem patch publicado) | #5 |
| SEC-03 Dependabot e audit no CI | Corrigido. CodeQL e dependency review **não** adicionados: exigem GitHub Advanced Security em repositório privado (code scanning desativado) | #4 |
| SEC-04 `permissions`, `concurrency`, actions por SHA (Node 24) | Corrigido | #4 |
| QA-01 E2E no CI | Corrigido (build de produção + banco efêmero; 14/14) | #4 |
| QA-02 drift de migrações | Corrigido. **Achado:** `public.rls_auto_enable()` existe só em produção; o bootstrap do CI a recria | #4 |
| GOV-01 CODEOWNERS, SECURITY.md, CONTRIBUTING, templates, LICENSE | Corrigido | este PR |
| HYG-01 `.gitignore`, `types` duplicado no tsconfig, `@types/node` ^24 | Corrigido | este PR / #5 |
| **Novo:** CI do `main` vermelho desde 18/09 (teste dependente de fuso) | Corrigido (testes em UTC) | #4 |
| **Novo:** recuperação de senha sem 2FA e com sessão aberta | Corrigido | #3 |

Pendências que dependem do dono do repositório (admin) ou dos serviços:
- Ruleset na `main`: PR obrigatório, checks `validate`/`audit`/`database`/`e2e` exigidos, revisão de code owner, sem force-push.
- Secret scanning e push protection; GitHub Advanced Security, se desejar CodeQL.
- Dar acesso à conta `GuiSatierf` no projeto da Vercel: hoje o check "Vercel" falha nos PRs dela ("Git author must have access to the project").
- Supabase: template de recuperação com `token_hash` (ver #3), backup/restauração e monitoramento externo (PRD-02/04 da auditoria de 04/10).

## Atualização em 15/10/2026

- O conteúdo do #5 (SEC-01 e SEC-02) foi incorporado ao #4 por fast-forward; o #5 fica vazio depois do merge do #4. O #30 (Dependabot, só o Next) foi fechado como superado.
- O #3 passou a usar uma regra única de redirecionamento seguro no callback, no formulário de login e na página de 2FA, fechando o redirecionamento aberto (P-1 da auditoria de 03/10).
- O GitHub Actions do repositório não inicia jobs desde 08/10 ("recent account payments have failed or your spending limit needs to be increased"). Enquanto a cobrança não for resolvida, nenhum PR tem CI no GitHub. Em 15/10 o CI completo foi reproduzido localmente (ambiente de CI, banco efêmero `supabase/postgres`): todos os PRs abertos, mesclados ao #4, passam em lint, tipos, testes e build; #3, #5 a #10, #28 e #29 também em migrações do zero, drift e E2E.
- Nova pendência do dono: regularizar a cobrança do GitHub Actions.
