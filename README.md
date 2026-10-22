# Cotani Painel

Painel SaaS multiempresa para lojas gerenciarem agenda, clientes, profissionais, serviços, horários, comunicação, financeiro, relatórios e assinatura.

## Stack

- Next.js 16, React 19 e TypeScript
- Supabase Auth para e-mail/senha, recuperação de senha, convites e Google OAuth
- PostgreSQL do Supabase com Prisma 7 e Supavisor
- Mercado Pago Assinaturas para os planos Essencial e Profissional
- Resend para e-mail transacional
- WhatsApp manual por padrão; Meta Cloud API é opcional
- Vercel para aplicação e jobs agendados

## Isolamento e permissões

Cada loja é um `Clinic`. A identidade autenticada do Supabase é ligada a um `User`, e o acesso a cada loja depende de uma `Membership` válida no banco:

- `ADMIN`: configura a loja, equipe, assinatura e todos os recursos operacionais.
- `RECEPTIONIST`: agenda, clientes e operação diária.
- `PROVIDER`: vínculo com profissional; sem permissão administrativa.

A loja ativa fica em cookie HttpOnly, mas o cookie não concede acesso: toda operação protegida revalida sessão, membership, papel e `clinicId` no servidor. As tabelas públicas do Supabase têm RLS habilitado e não expõem políticas ao cliente; o acesso de dados da aplicação ocorre pelo Prisma no backend.

## Planos

- Essencial: R$ 34,90/mês ou ciclo anual configurado no Mercado Pago; 1 profissional.
- Profissional: R$ 49,99/mês ou ciclo anual; até 3 profissionais, financeiro e relatórios.
- Empresa: contratação comercial, profissionais/unidades ilimitados e SMS; a API é ativada conforme o escopo definido no onboarding. Não usa checkout automático no momento.
- Novas lojas recebem 7 dias de teste no Essencial.

Os IDs de planos do Mercado Pago são criados com `pnpm mercado-pago:plans` e copiados para as variáveis de ambiente. O backend não confia no preço enviado pelo navegador: produto, ciclo e ID permitido são resolvidos no servidor.

## Desenvolvimento local

Requisitos: Node 24, pnpm 11, projeto Supabase e credenciais do Mercado Pago/Resend conforme o recurso que será testado.

```bash
pnpm install
copy .env.example .env.local
pnpm prisma migrate deploy
pnpm dev
```

Preencha `.env.local` sem aspas extras ou espaços após os valores. A aplicação usa:

- `SUPABASE_DATABASE_URL`: pooler de transações, porta 6543, para o runtime.
- `SUPABASE_DIRECT_URL`: pooler de sessão, porta 5432, para Prisma/migrations.
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: cliente web.
- `SUPABASE_SECRET_KEY`: operações administrativas de convite; nunca é pública.

Veja todas as variáveis em [`.env.example`](./.env.example) e o roteiro de produção em [`DEPLOY.md`](./DEPLOY.md).

## Supabase Auth

No painel do Supabase:

1. Em **Authentication → URL Configuration**, use `http://localhost:3000` no desenvolvimento e cadastre também `http://localhost:3000/**` nas Redirect URLs.
2. Para produção, use `https://painel.cotani.com.br` como Site URL e permita `https://painel.cotani.com.br/**`.
3. Habilite o provedor Google, configure Client ID/Secret e registre no Google a callback exibida pelo Supabase (`https://SEU-PROJETO.supabase.co/auth/v1/callback`).
4. Configure SMTP próprio para e-mails reais de confirmação, recuperação e convite. O SMTP padrão do Supabase é limitado e serve apenas para avaliação.

As callbacks da aplicação terminam em `/auth/callback`. Convites administrativos definem a senha em `/update-password`.

O administrador global usa a mesma conta Supabase, com MFA obrigatório e UUID permitido em `PLATFORM_ADMIN_USER_IDS`. Veja o [guia de acesso e monitoramento](./docs/admin-operacao.md).

## Migração do banco anterior

As migrations já definem o catálogo e a autenticação Supabase. Para uma única cópia de dados do banco PostgreSQL anterior:

```bash
pnpm db:migrate-to-supabase
```

Nesse comando, `DATABASE_URL` é somente a origem antiga e `SUPABASE_DIRECT_URL` é o destino. O script recusa executar se as tabelas de negócio do destino já contiverem dados. Não use `DATABASE_URL` como conexão do runtime.

## Qualidade

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm check` executa lint, typecheck e testes unitários. O lint é o Oxlint (`.oxlintrc.json`), com as regras que dependem de tipos rodando pelo `oxlint-tsgolint`. O build também valida as variáveis obrigatórias.

## Estrutura principal

```text
prisma/                 schema e migrations
scripts/                validação de ambiente, planos e migração pontual
src/app/                páginas, Route Handlers e callbacks de autenticação
src/components/         interface e formulários
src/lib/supabase/       clientes browser, server, admin e atualização de sessão
src/server/auth.ts      identidade e sincronização do usuário local
src/server/tenant.ts    loja ativa, membership e RBAC
src/server/actions/     mutações autenticadas
src/server/services/    regras de agenda, cobrança, mensagens e relatórios
src/proxy.ts            renovação de sessão e proteção de rotas
```

Mais detalhes estão em [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
