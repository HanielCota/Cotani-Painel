# Arquitetura do Cotani Painel

## Visão geral

O sistema é um monólito modular em Next.js 16. A interface, as Server Actions, os Route Handlers e os jobs são publicados juntos na Vercel. Supabase fornece Auth e PostgreSQL; Prisma é a única camada de acesso às tabelas de negócio.

```text
Navegador
  ├─ Supabase Auth (cookie SSR)
  └─ Next.js
       ├─ Server Components / Server Actions
       ├─ Route Handlers / Webhooks / Cron
       ├─ tenant + RBAC
       └─ Prisma → Supabase PostgreSQL

Serviços externos: Mercado Pago, Resend, Meta WhatsApp e Twilio
```

## Autenticação

Há três clientes Supabase separados:

- `src/lib/supabase/client.ts`: browser, somente URL e chave publicável.
- `src/lib/supabase/server.ts`: servidor, lê e grava cookies da sessão SSR.
- `src/lib/supabase/admin.ts`: servidor, usa a secret key exclusivamente para operações administrativas, como convites.

`src/proxy.ts` chama a atualização de sessão antes das rotas. A proteção usa claims validadas pelo servidor e redireciona visitantes das áreas privadas. Isso melhora a navegação, mas não é a autoridade de segurança: ações e handlers revalidam usuário, membership e papel.

`src/server/auth.ts` obtém o usuário pela API Auth, sincroniza a identidade com `User.authUserId` e aceita convites pendentes do mesmo e-mail confirmado. Dados migrados podem manter identificadores antigos apenas em colunas `legacyExternal*`; eles não autenticam ninguém.

## Tenancy e autorização

O tenant é `Clinic`. Uma identidade acessa uma loja somente quando existe `Membership(clinicId, userId)`.

`src/server/tenant.ts` concentra as regras:

1. autentica a identidade Supabase;
2. resolve o usuário local;
3. lê o cookie HttpOnly da loja ativa;
4. valida a membership no banco;
5. escolhe a primeira loja acessível se o cookie estiver vazio ou obsoleto;
6. aplica `ClinicRole` quando a operação exige papel específico.

O cookie é apenas uma preferência de interface. Alterá-lo não cria permissão.

Papéis:

| Papel | Escopo |
| --- | --- |
| `ADMIN` | loja, equipe, catálogo, agenda, assinatura, financeiro e relatórios |
| `RECEPTIONIST` | clientes e operação de agenda |
| `PROVIDER` | identidade vinculável a um profissional |

A administração global usa uma allowlist separada de UUIDs Supabase em `PLATFORM_ADMIN_USER_IDS`; ser `ADMIN` de uma loja não concede acesso a `/admin`.

## Banco de dados

O runtime Prisma usa o Supavisor Transaction Pooler (`SUPABASE_DATABASE_URL`, porta 6543). Migrations usam o Session Pooler (`SUPABASE_DIRECT_URL`, porta 5432).

Principais agregados:

- Identidade: `User`, `Membership`, `ClinicInvitation`.
- Loja: `Clinic`, `BusinessHour`, `Service`, `Professional`, `ProfessionalService`.
- Operação: `Customer`, `Appointment`.
- Mensageria: `Notification`, `WebhookEvent`.
- Cobrança: campos de assinatura em `Clinic`, `PaymentHistory`.
- Segurança/controle: `RateLimit`, `AdminAuditLog`.

Todas as relações de negócio carregam `clinicId` direta ou indiretamente. Consultas e mutações recebem o tenant resolvido no servidor; IDs enviados pelo cliente nunca substituem esse contexto.

As tabelas do schema `public` têm RLS habilitado sem políticas para os papéis públicos. O navegador não consulta as tabelas diretamente. O backend Prisma usa a conexão PostgreSQL confiável e faz autorização na camada de aplicação.

## Limites e assinaturas

O catálogo interno define capacidades dos planos; o navegador não decide preço ou entitlement.

- Essencial: 1 profissional; agenda e confirmações.
- Profissional: até 3 profissionais; financeiro e relatórios.
- Empresa: capacidades avançadas e contratação comercial.

Checkout automático existe para Essencial e Profissional, mensal e anual. O servidor mapeia a combinação permitida ao respectivo `preapproval_plan` do Mercado Pago. O webhook valida assinatura, registra `WebhookEvent` para idempotência e atualiza status/pagamentos.

Estados de assinatura incluem `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED` e `INACTIVE`. A seleção pendente é persistida antes de sair para o checkout, permitindo reconciliar o retorno/webhook sem confiar em dados do cliente.

## Comunicação

`Notification` funciona como outbox persistente com chave de idempotência, tentativas, lock e próximo horário. Jobs autenticados por `CRON_SECRET` processam lembretes.

- E-mail operacional: Resend.
- WhatsApp: manual por padrão (`wa.me`); Meta Cloud API opcional.
- SMS: Twilio, reservado ao plano Empresa.
- E-mails de autenticação: SMTP configurado no Supabase Auth.

Webhooks têm validação própria e não dependem de sessão de usuário. Payloads externos são tratados como dados não confiáveis e a aplicação reconsulta/valida o estado necessário antes de alterar cobrança.

## Superfícies do Next.js

- Server Components: leituras iniciais e composição de páginas.
- Server Actions: mutações originadas pela interface autenticada.
- Route Handlers: consultas usadas por polling, downloads, callbacks, webhooks e jobs.
- Proxy: renovação de cookie e redirecionamento antecipado.

Toda mutação autenticada deve chamar `getTenantContext`, `requireRole` ou `getClinicForRoles`. Toda consulta deve filtrar pelo `clinicId` vindo desse contexto.

## Convites e troca de loja

Um administrador cria `ClinicInvitation` e solicita o convite pelo Supabase Admin API. Ao aceitar, o usuário define senha, a sessão é estabelecida e `ensureCurrentAppUser()` transforma o convite válido em `Membership`. Convites são normalizados por e-mail, expiram e podem ser revogados.

A troca de loja apenas grava a escolha quando a membership correspondente existe. Remover um membro não apaga a identidade global e não afeta memberships de outras lojas. O último administrador não pode ser removido ou rebaixado.

## Segurança operacional

- Chaves secretas nunca usam prefixo `NEXT_PUBLIC_`.
- URLs de retorno passam por validação contra open redirect.
- Webhooks validam assinatura e usam idempotência.
- Jobs exigem Bearer token.
- Cookies de seleção de loja são HttpOnly, SameSite=Lax e Secure em produção.
- Exclusões e mudanças administrativas relevantes geram auditoria.
- `.env.local` é ignorado pelo Git.

## Decisões registradas

| ID | Decisão |
| --- | --- |
| ADR-001 | Supabase Auth substitui o provedor anterior; PostgreSQL Supabase é a fonte de dados. |
| ADR-002 | Membership local é a autoridade de tenancy e papel. |
| ADR-003 | Prisma acessa o banco somente pelo backend; RLS bloqueia acesso público direto. |
| ADR-004 | Cookie de loja ativa é preferência, não autorização. |
| ADR-005 | Checkout resolve preços e IDs de plano somente no servidor. |
| ADR-006 | Webhooks e notificações são idempotentes e persistidos. |
| ADR-007 | Plano Empresa é comercial até existir fluxo automatizado específico. |

## Verificação

Mudanças estruturais devem passar por:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Fluxos de autenticação e pagamentos também precisam de testes reais no ambiente correspondente, pois dependem de configuração externa (redirect URLs, SMTP, OAuth, webhooks e credenciais).
