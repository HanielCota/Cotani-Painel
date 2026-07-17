# Arquitetura e Planejamento Técnico — Cotani Painel

> **Status:** Proposta para validação. Este documento não contém código de produção — apenas design, decisões e riscos.
> **Escopo:** auditoria de stack, padrão de backend (Server Actions vs REST), multi-tenancy, webhooks do Mercado Pago e filas de mensagens em ambiente serverless.

---

## 1. Auditoria de stack

### 1.1 Dependências mapeadas (`package.json`)

| Camada | Dependência | Versão | Observação |
| --- | --- | --- | --- |
| Framework | `next` | 16.2.10 | App Router; `proxy.ts` substitui `middleware.ts` nesta versão |
| UI | `react` / `react-dom` | 19.2.7 | React Compiler ativado em `next.config.ts` |
| Auth / tenancy | `@clerk/nextjs` | 7.5.x | Sessão, Organizations e webhooks (`verifyWebhook`) |
| ORM | `prisma` / `@prisma/client` | 7.8.x | Novo gerador `prisma-client`, saída em `src/generated/prisma` |
| Driver DB | `@prisma/adapter-pg` + `pg` | 7.8.x / 8.22 | Driver adapter sobre `pg` — permite `SET LOCAL`, RLS e SQL cru |
| Validação | `zod` | 4.4.x | `safeParse` em todas as Server Actions |
| Estado cliente | `@tanstack/react-query` | 5.101.x | Consome `GET /api/appointments` (polling/leitura) |
| UI kit | `shadcn`, `@base-ui/react`, `tailwindcss` 4, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` | — | shadcn v4 sobre Base UI |
| Datas | `date-fns` | 4.4.x | Presente, mas fusos são tratados por lib própria baseada em `Intl` (`src/lib/timezone.ts`) — coerente, `date-fns` cobre apenas formatação |

**Dependências ausentes para as features planejadas** (a adicionar nas respectivas fases): SDK/API do Mercado Pago, provedor de e-mail (Resend/SES) e provedor de WhatsApp. A fase 1 da fila (seção 5) **não exige nenhuma dependência nova**.

### 1.2 Configurações

- `next.config.ts`: apenas `reactCompiler: true`. Sem `images`, `headers` ou configuração de runtime — nada a corrigir agora.
- `prisma.config.ts`: carrega `.env.local` via `node:process` e aponta `DATABASE_URL`. Padrão Prisma 7 correto.
- `src/proxy.ts`: `clerkMiddleware()` com matcher padrão cobrindo `/(api|trpc)(.*)` — webhooks passam pelo middleware do Clerk, o que é compatível desde que a verificação de assinatura continue sendo feita no handler (é o caso).
- `src/lib/prisma.ts`: singleton com cache em `globalThis` para dev — correto para serverless, evita esgotar conexões em hot-reload. Em produção na Vercel, avaliar `DATABASE_URL` via pooler (PgBouncer/Neon/Supabase) conforme o provedor de banco escolhido.

### 1.3 Achados da auditoria (ordem de criticidade)

1. **`User` e `Membership` são tabelas mortas.** O webhook do Clerk (`src/app/api/webhooks/clerk/route.ts`) sincroniza apenas `organization.created/updated/deleted`. Nada no código escreve em `User` ou `Membership` — ou seja, roles (`ClinicRole`) nunca são populados nem checados. Qualquer autorização por papel depende de corrigir isso (seção 3).
2. **Autorização inexistente além de "estar autenticado".** `requireActiveClinic()` (`src/server/tenant.ts`) resolve a barbearia pela org ativa, mas não valida que o usuário é membro dela com papel adequado. Hoje o Clerk garante a associação org↔usuário, mas o banco local não sabe disso — risco se o painel expuser ações administrativas (billing, exclusão de dados).
3. **Race condition em agendamento (retificado — trava já existia).** A auditoria apontou o check-then-insert de `createAppointment` como condição de corrida; porém a migration `20260712150000_appointment_integrity` já continha as exclusion constraints `Appointment_customer_no_overlap` e `Appointment_service_no_overlap` (`btree_gist` + `tsrange` `[)`, ignorando apenas `CANCELED`) — a garantia de banco sempre esteve presente. A lacuna real era o tratamento do erro: violações (SQLSTATE `23P01`, entregues como `DriverAdapterError` pelo driver adapter do Prisma 7) viravam mensagem genérica. **Resolvido:** as actions de criação e reagendamento detectam `23P01` na cadeia de `cause` e retornam "Horário indisponível. Por favor, escolha outro.".
4. **Sem testes e sem CI.** Não há setup de testes (`vitest`, `playwright`) nem pipeline. Antes de introduzir billing e filas — onde bugs custam dinheiro e mensagens duplicadas — o mínimo é teste de integração das actions críticas e dos handlers de webhook.
5. **Sem rate limiting nos route handlers.** Os webhooks são protegidos por assinatura (adequado), mas `GET /api/appointments` e futuros endpoints públicos não têm proteção contra abuso.
6. **`shadcn` em `dependencies` de runtime.** O pacote `shadcn` é a CLI; deveria ser `devDependency` (ou removido após a geração dos componentes). Sem impacto funcional, mas infla o bundle de instalação.
7. **Observação sobre `AGENTS.md`:** o arquivo instrui a consultar `node_modules/next/dist/docs/`, que **não existe nesta instalação**. Antes de implementar (sobretudo `after()`, `proxy.ts` e convenções do Next 16), instalar/consultar os docs oficiais da versão 16.2.x.

### 1.4 Pontos fortes a preservar

- Disciplina de tenant: toda query em actions e no endpoint REST filtra por `clinicId` resolvido no servidor — nunca por ID vindo do cliente.
- Validação de entrada com Zod em `input: unknown` nas actions, com contrato de retorno único (`ActionResult`).
- Índices compostos corretos para o padrão de acesso multi-tenant (`@@index([clinicId, startTime])`, `@@unique([clinicId, phone])` etc.).
- O modelo `Notification` já existe com `status`, `scheduledFor`, `providerRef` e índice `(status, scheduledFor)` — é a fundação natural da fila (seção 5).
- Tratamento de fuso por barbearia centralizado em `src/lib/timezone.ts`.

---

## 2. Padrão arquitetural: Server Actions vs Route Handlers

### 2.1 Matriz de decisão

| Critério | Server Action (`src/server/actions`) | Route Handler (`src/app/api`) |
| --- | --- | --- |
| Quem chama | A própria UI (formulários, botões, `useActionState`) | Sistemas externos (webhooks), polling client-side, futuros apps mobile |
| Autenticação | Sessão Clerk do usuário (`auth.protect()`) | Assinatura HMAC (webhooks) ou sessão (leituras da UI) |
| Semântica HTTP | Não expõe verbos/status padronizados | Verbos, status codes, headers, idempotency keys |
| Revalidação de cache | `revalidatePath` direto | Não se aplica (ou via `revalidatePath` no handler) |
| Progressive enhancement | Sim (formulários sem JS) | Não |

**Regra de ouro:** se o chamador não é o navegador rodando nossa aplicação com sessão Clerk, é Route Handler. Se é mutação partindo da nossa UI autenticada, é Server Action. Leituras consumidas por TanStack Query (polling) permanecem em Route Handlers — é o padrão já estabelecido por `GET /api/appointments` e deve ser mantido.

### 2.2 Estrutura proposta

Hoje as actions concentram validação + regra de negócio + persistência. Com billing e filas, a mesma regra será invocada por actions *e* por jobs/webhooks — extrair uma camada de serviços:

```text
src/server/
├── tenant.ts           # Contexto de tenant (memoizado por request) — evoluir, seção 3
├── actions/            # Server Actions "finas": auth → zod → service → revalidate → ActionResult
├── services/           # Regra de negócio pura: scheduling, billing, notifications
│                       # (sem "use server", sem dependência de request — testáveis)
└── jobs/               # Handlers de processamento de fila, invocados pelos endpoints de cron
```

As actions atuais não precisam ser reescritas de imediato; a extração acontece de forma incremental, começando pelas regras compartilhadas (criação de notificação no agendamento, mudança de status que dispara mensagem).

---

## 3. Multi-tenancy: design de isolamento por profissional

> Nota de vocabulário: hoje o tenant é a **barbearia** (Organization do Clerk). "Dados isolados por profissional" é implementado como isolamento por barbearia, com papéis internos (`PROVIDER`, `RECEPTIONIST`, `ADMIN`). Se o produto evoluir para "um profissional = um tenant" independente de barbearia, a mudança é de granularidade do tenant, não de modelo — as regras abaixo valem igual.

### 3.1 Modelo escolhido: shared-schema com discriminador `clinicId`

Decisão: **manter o modelo atual** (uma tabela por entidade, coluna `clinicId` em todas as linhas de negócio, isolamento por filtro obrigatório + chaves/índices compostos).

Justificativa: schema separado ou banco por tenant multiplicam custo operacional (migrations N vezes, pools por tenant) sem ganho proporcional para o estágio atual do produto. O risco clássico do shared-schema — esquecer o `where clinicId` — é mitigado pelas regras abaixo e, na fase 2, por RLS.

### 3.2 Regras de isolamento (fase 1 — camada de aplicação)

1. **Contexto de tenant por request, fail-closed.** Evoluir `requireActiveClinic()` para um `getTenantContext()` memoizado por request (React `cache()`), que retorna `{ clinic, membership, role }` e **lança** quando não há barbearia ativa — em vez de retornar `null` e depender de cada chamador checar. O memo elimina a query duplicada que hoje ocorre quando uma action chama `auth.protect()` + `requireActiveClinic()` e a página já resolveu a barbearia.
2. **Nenhum ID de tenant vindo do cliente.** `clinicId` sempre vem do contexto resolvido no servidor — regra já seguida, formalizada como item de code review.
3. **Consultas sempre escopadas.** Convenção: toda query Prisma em `src/server/**` sobre tabelas tenant-scoped inclui `clinicId: ctx.clinic.id` no `where`. Um helper de review (ou, futuramente, Prisma extension que injeta o filtro) reduz o risco de omissão.
4. **Escrita em lote com escopo.** `updateMany`/`deleteMany` sempre com `clinicId` no filtro; `update`/`delete` por `id` precedidos de `findFirst({ where: { id, clinicId } })` — padrão já usado em `updateAppointmentStatus`, generalizar.

### 3.3 Sincronização de membros e papéis (corrige o achado 1)

Assinar no Clerk, além dos eventos de organização:

- `organizationMembership.created` → upsert `User` (por `clerkUserId`) + create `Membership` com role mapeada (`org:admin` → `ADMIN`, demais → `PROVIDER` ou conforme custom role).
- `organizationMembership.updated` → atualizar `role`.
- `organizationMembership.deleted` → remover `Membership` (não o `User`, que pode pertencer a outras barbearias).
- `user.created/updated/deleted` → manter `User` sincronizado (e-mail, nome).

Com `Membership` populada, introduzir `requireRole(ctx, ['ADMIN'])` para ações sensíveis: billing, exclusão de clientes, configurações da barbearia e gestão de integrações.

### 3.4 Fase 2 — defesa em profundidade com RLS (PostgreSQL)

Quando o time crescer ou o blast radius de um `where` esquecido for inaceitável:

- Políticas de Row-Level Security por tabela tenant-scoped, usando a GUC `app.tenant_id`.
- Como o driver é `@prisma/adapter-pg` sobre `pg`, cada operação tenant-scoped roda em transação com `SET LOCAL app.tenant_id = '<clinic uuid>'` antes das queries.
- Custo: complexidade de debugging e migrations de políticas. Por isso é fase 2, não pré-requisito das features deste documento.

### 3.5 Dívida técnica registrada

- ~~Constraint de não-sobreposição de horários~~ **Encerrado:** as exclusion constraints já existiam desde `20260712150000_appointment_integrity`; o tratamento amigável da violação `23P01` foi implementado nas actions de agenda.

---

## 4. Mercado Pago: billing e webhooks seguros

### 4.1 Premissas de design

- **O webhook não é fonte de verdade.** Ele é um sinal de que algo mudou; o handler busca o estado atual do pagamento na API do Mercado Pago e reconcilia o banco local. Isso elimina problemas de entrega fora de ordem e payloads desatualizados.
- **Resposta rápida obrigatória.** O MP espera `200/201` em poucos segundos; processamento pesado acontece após a resposta (`after()` do Next 16 — confirmar API na versão 16.2.x antes de implementar) ou via fila.
- **Idempotência por evento.** O MP reenvia notificações; o processamento deve ser no-op em reenvios.

### 4.2 Modelagem de dados (proposta)

```prisma
// Assinatura da barbearia (1:1 com Clinic)
model Subscription {
  id                 String   @id @default(uuid())
  clinicId           String   @unique
  clinic             Clinic   @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  status             SubscriptionStatus  // ACTIVE, PAST_DUE, CANCELED, TRIALING
  mpPreapprovalId    String?  @unique    // id da assinatura no MP
  currentPeriodEndsAt DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  payments           Payment[]
}

model Payment {
  id             String    @id @default(uuid())
  clinicId       String
  subscriptionId String?
  mpPaymentId    String    @unique        // chave de idempotência de negócio
  status         String                    // approved, rejected, pending, refunded...
  amount         Decimal   @db.Decimal(10, 2)
  paidAt         DateTime?
  rawPayload     Json?                     // auditoria (definir retenção — LGPD)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  clinic         Clinic    @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  subscription   Subscription? @relation(fields: [subscriptionId], references: [id])

  @@index([clinicId, createdAt])
}

// Idempotência genérica de webhooks (serve MP hoje, qualquer provedor amanhã)
model WebhookEvent {
  id           String    @id @default(uuid())
  provider     String                       // "mercadopago"
  eventId      String                       // data.id da notificação
  topic        String                       // "payment", "subscription_preapproval"
  processedAt  DateTime?
  createdAt    DateTime  @default(now())

  @@unique([provider, eventId])
}
```

Nota: os modelos acima são **rascunho de design para validação**, não DDL final — nomes de enums e campos serão fechados na fase de implementação.

### 4.3 Segurança do endpoint `POST /api/webhooks/mercadopago`

1. **Validação de assinatura** (header `x-signature` + `x-request-id`): recomputar HMAC-SHA256 do manifest `id:{data.id};request-id:{x-request-id};ts:{ts};` com `MERCADOPAGO_WEBHOOK_SECRET` e comparar com `v1` usando comparação em tempo constante. Rejeitar com `400` se inválida.
2. **Janela anti-replay:** rejeitar eventos com `ts` fora de uma tolerância (ex.: 5 minutos).
3. **Filtro de topic:** processar `subscription_preapproval` (ciclo de vida da assinatura) e `payment` (cobranças geradas pela assinatura); demais topics → `200` imediato sem processar.
4. **Idempotência:** insert de `WebhookEvent(provider, eventId)` com unique; conflito = reenvio → `200` sem reprocessar.
5. **Processamento pós-resposta:** após o `200`, buscar o pagamento atual na API do MP, aplicar transição de estado em `Payment`/`Subscription` dentro de transação, e enfileirar notificações de dunning quando aplicável (seção 5).
6. **Sem dependência de sessão Clerk:** o matcher do `proxy.ts` já cobre `/api/*`; o handler se protege pela assinatura, não por `auth()`.

### 4.4 Reconciliação (defesa contra webhook perdido)

Job diário (Vercel Cron) que varre `Subscription` em estados não-terminais há mais de X horas e consulta o status atual no MP, corrigindo divergências. Webhooks são o caminho rápido; a reconciliação é a garantia.

### 4.5 Variáveis de ambiente novas

```dotenv
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
```

Adicionar também `CRON_SECRET=` (seção 5) ao `.env.example` — sem valores reais, seguindo a convenção do projeto.

### 4.6 Decisões registradas e pontos em aberto

- **Decidido — modelo de cobrança: assinatura recorrente (Preapproval).** `Subscription.mpPreapprovalId` é a âncora da integração; `Payment` registra cada cobrança gerada pela assinatura. O webhook de topic `subscription_preapproval` mantém o ciclo de vida da assinatura sincronizado com o estado local.
- Em aberto — política de dunning: quantas tentativas e grace period em `PAST_DUE` (o bloqueio de acesso em si está fechado na seção 4.7).

### 4.7 Fluxo de inadimplência e churn (regras de arquitetura)

**Status desta seção: planejado — nenhuma linha implementada ainda.** Regras que a fase de billing deve seguir.

**1. Transição de estado (fonte de verdade = banco).** O handler do webhook do MP atualiza `Subscription.status` (modelo da seção 4.2) seguindo as premissas da seção 4.1: o webhook é sinal, a API do MP confirma o estado atual, e `WebhookEvent` garante idempotência. Ciclo de vida:

```text
ACTIVE ──cobrança recusada/expirada──▶ PAST_DUE ──fim do grace period──▶ SUSPENDED
   ▲                                                                        │
   └────────────── pagamento confirmado na API do MP ◀──────────────────────┘
SUSPENDED ──cancelamento definitivo (churn)──▶ CANCELED (terminal)
```

**2. Revogação no Clerk: `public_metadata` da Organization; membership preservada.**

- O backend grava o status de cobrança no `public_metadata` da Organization via Backend API do Clerk. `public_metadata` é gravável **somente** pelo backend (o cliente não consegue alterá-lo) e legível no client — e pode ser propagado ao session token via template de claims no painel do Clerk, permitindo leitura no middleware sem query ao banco.
- A `Membership` **não é removida** em `PAST_DUE`/`SUSPENDED`. Removê-la dispararia `organizationMembership.deleted`, cujo handler atual apaga a `Membership` local (`deleteMembership` em `src/app/api/webhooks/clerk/route.ts`) — destruindo o vínculo e exigindo re-provisionamento completo na regularização. Remoção de membership só em churn definitivo (`CANCELED`) ou offboarding explícito.
- Alternativas rejeitadas: `private_metadata` (não chega ao session token — exigiria query ao banco em toda navegação) e suspensão por remoção de membership (destrutiva, quebra o caminho de reativação).

**3. Enforcement em duas camadas (defesa em profundidade).**

- **Camada de UX — `proxy.ts`:** o guard atual (`pathname.startsWith("/dashboard")` → `auth.protect()`) será estendido para ler o status da assinatura (claim de org metadata) e redirecionar para `/billing` quando diferente de `ACTIVE`. A rota `/billing` e todas as rotas públicas ficam **fora** do guard — obrigatório para não criar loop de redirect.
- **Camada autoritativa — `getTenantContext()` fail-closed:** o middleware sozinho **não** é garantia de segurança (a doc do Clerk v7 depreca `createRouteMatcher` justamente porque path matching pode divergir do roteamento do Next e deixar recursos expostos). O `getTenantContext()` passará a resolver também o status da assinatura e lançar um erro dedicado (ex.: `SubscriptionSuspendedError`) quando ≠ `ACTIVE`; o layout do grupo `(dashboard)` converte esse erro em redirect para `/billing`. Server Actions e Route Handlers seguem protegidos mesmo que o matcher do middleware deixe algo passar.
- Semântica do bloqueio: acesso de **leitura** ao `/dashboard` bloqueado em `SUSPENDED` (default fechado). Se `PAST_DUE` dentro do grace period bloqueia ou apenas exibe banner de cobrança é decisão de produto (ver pontos em aberto).

**4. Rota `/billing`.** Nova rota autenticada (exige sessão, **não** exige assinatura ativa) com o status da cobrança e o fluxo de regularização/atualização de pagamento no MP. É o único destino de redirect para tenant inadimplente.

**5. Escopo do bloqueio e agenda pública.** O bloqueio vale para a área autenticada. Recomendação registrada: em `SUSPENDED`, suspender também o agendamento público `/{slug}` — `createPublicAppointment` validaria o status da barbearia e a página exibiria aviso de indisponibilidade —, pois uma barbearia inadimplente não deve captar novos horários. Decisão final de produto pendente.

**6. Reativação.** Pagamento regularizado confirmado na API do MP → webhook → `Subscription.status = ACTIVE` + atualização do metadata da org → acesso restaurado automaticamente, sem re-provisionamento (membership intacta). A reconciliação diária da seção 4.4 cobre o caso de webhook perdido.

**7. Pontos em aberto.** Tamanho do grace period; se `PAST_DUE` bloqueia ou só avisa; cadência do dunning (reusar o `NotificationKind.BILLING_DUNNING` já previsto na seção 5.3); retenção de dados pós-churn definitivo.

---

## 5. Filas de envio de mensagens (WhatsApp/E-mail) em serverless

### 5.1 Restrições do ambiente (Vercel + Next.js)

- Funções são efêmeras: **não há worker persistente nem timer em processo**. `setInterval`/consumidor de fila em memória morre com a invocação.
- Duração máxima por invocação é limitada (ordem de minutos, conforme plano/configuração) — lotes devem ter deadline interno.
- Vercel Cron tem granularidade mínima de 1 minuto e dispara uma requisição HTTP para um endpoint do próprio app.
- Conclusão: o estado da fila **deve viver fora do processo** — no banco ou em um serviço de fila gerenciado.

### 5.2 Opções comparadas

| | A. Cron + fila no banco | B. Upstash QStash | C. Inngest / Trigger.dev |
| --- | --- | --- | --- |
| Novas dependências | Nenhuma | SDK + conta Upstash | SDK + conta do serviço |
| Agendamento por mensagem | Via `scheduledFor` + poll (precisão ~1 min) | Nativo (delay por mensagem) | Nativo (steps com sleep) |
| Retries | Implementados por nós (backoff no banco) | Nativos com backoff | Nativos com backoff |
| Observabilidade | Queries no banco / logs | Dashboard Upstash | Dashboard rico (traces por workflow) |
| Custo em volume baixo | Zero adicional | Baixo | Baixo/médio |
| Complexidade operacional | Baixa (já temos Postgres) | Baixa | Média (mais um serviço crítico) |
| Workflows multi-etapa | Manual | Limitado | Excelente |

Opção D (SQS + worker externo em container) foi descartada: contradiz a escolha de deploy serverless e adiciona infraestrutura para um volume que não justifica.

### 5.3 Recomendação: fase 1 = outbox no banco + cron (Opção A)

O modelo `Notification` atual já é 80% do necessário. Evolução proposta:

```prisma
model Notification {
  // ... campos atuais (channel, status, scheduledFor, sentAt, content, providerRef, clinicId, appointmentId)
  kind           NotificationKind   // CONFIRMATION, REMINDER_24H, REMINDER_2H, BILLING_DUNNING...
  recipient      String             // telefone (E.164) ou e-mail resolvido no momento do enfileiramento
  idempotencyKey String   @unique   // ex: `${appointmentId}:REMINDER_24H`
  attempts       Int      @default(0)
  maxAttempts    Int      @default(5)
  nextAttemptAt  DateTime           // inicialmente igual a scheduledFor
  lockedAt       DateTime?
  error          String?

  @@index([status, scheduledFor])
  @@index([status, nextAttemptAt])
}
```

**Mecânica:**

1. **Outbox transacional.** Ao criar/reagendar/cancelar um atendimento, as notificações correspondentes são criadas/canceladas **na mesma transação Prisma** do agendamento. Não existe "agendamento criado sem lembrete enfileirado" nem envio para atendimento que sofreu rollback.
2. **Dispatcher via cron.** Vercel Cron (a cada minuto) chama `POST /api/jobs/notifications/dispatch`, protegido por `Authorization: Bearer ${CRON_SECRET}` (a Vercel injeta esse header automaticamente em crons). O handler:
   - Faz *claim* atômico de um lote (ex.: 25 itens) de mensagens `PENDING` com `scheduledFor <= now()` e `nextAttemptAt <= now()`, usando `SELECT ... FOR UPDATE SKIP LOCKED` (via `$queryRaw` — o `pg` do adapter permite) ou um `updateMany` de claim com timestamp de lock.
   - Envia cada mensagem via o sender do canal, com timeout curto por envio.
   - Sucesso → `SENT` + `sentAt` + `providerRef` (id do provedor). Falha → `attempts++`, `nextAttemptAt = now + backoff(attempts)`, `error` resumido; ao atingir `maxAttempts` → `FAILED` (visível para alerta/intervenção).
   - Deadline interno (ex.: parar de pegar itens novos aos ~80% do tempo máximo da função) — o resto fica para a próxima execução.
3. **Idempotência ponta a ponta.** `idempotencyKey` único impede duplicação lógica; o `SKIP LOCKED` impede duplo processamento entre execuções sobrepostas do cron; `providerRef` permite reconciliar com o provedor.
4. **Senders por canal atrás de interface.** `MessageSender` por canal, resolvido em ponto único (`src/server/services/messaging/message-sender.ts`). Estratégia definida: MVP com `ConsoleMessageSender` (mock que apenas loga — já criado) → Evolution API como primeiro provedor real de WhatsApp (menor atrito inicial) → Meta Cloud API como caminho definitivo de compliance. E-mail via Resend/SES quando sair do mock. O dispatcher e a fila não mudam em nenhuma dessas trocas.
5. **Cancelamento (implementado).** Cancelar, concluir, registrar falta ou remarcar um atendimento **remove** as `Notification` `PENDING` do atendimento na mesma transação — delete em vez de `CANCELED`, para liberar a `idempotencyKey` única e permitir o reenfileiramento dos lembretes no reagendamento. Linhas com lock fresco (em processamento pelo dispatcher) são preservadas.

### 5.4 Critérios de migração para a fase 2 (QStash ou Inngest)

Migrar quando **qualquer** um destes gatilhos ocorrer:

- Precisão de agendamento abaixo de 1 minuto se tornar requisito de produto.
- Volume tal que o poll minuto a minuto mantenha backlog persistente (saturação do lote por várias execuções seguidas).
- Necessidade de workflows multi-etapa (ex.: lembrete → aguardar resposta do cliente → confirmar ou escalar para recepção) — território natural do Inngest.

A migração é barata porque o banco continua sendo o registro de estado (outbox): só o gatilho de entrega muda (cron-poll → push por mensagem).

### 5.5 Conformidade e operação

- **LGPD:** `content` e `recipient` contêm dados pessoais; definir retenção (ex.: expurgo de `content` e `rawPayload` após N dias de `SENT`).
- **Alertas:** notificações em `FAILED` e backlog (`PENDING` vencidos) devem aparecer em métrica no painel ou alerta externo.
- **Horários respeitam o fuso da barbearia:** `scheduledFor` é sempre UTC calculado a partir de `Clinic.timeZone` — reutilizar `src/lib/timezone.ts`.

---

## 6. ADRs resumidas

| # | Decisão | Alternativas rejeitadas | Motivo |
| --- | --- | --- | --- |
| ADR-001 | Multi-tenancy shared-schema com `clinicId` + contexto de tenant fail-closed; RLS em fase 2 | Schema por tenant; banco por tenant | Custo/complexidade operacional desproporcionais ao estágio |
| ADR-002 | Server Actions para mutações da UI autenticada; Route Handlers para webhooks, integrações e leituras por polling; regra de negócio em `src/server/services` | REST para tudo; actions para tudo | Cada padrão tem semântica inadequada para o caso oposto |
| ADR-003 | Webhook do MP validado por HMAC, idempotente por `eventId`, com API do MP como fonte de verdade e reconciliação diária | Confiar no payload do webhook | Entrega fora de ordem, reenvios e payloads defasados |
| ADR-004 | Fila fase 1: outbox no Postgres + Vercel Cron + `SKIP LOCKED`; fase 2: QStash/Inngest por gatilhos objetivos | Fila gerenciada desde o dia 1 | Zero dependências novas; modelo `Notification` já existe; migração barata |
| ADR-005 | Cobrança SaaS por assinatura recorrente (Preapproval) do Mercado Pago | Checkout pontual (Checkout Pro/Brick) por período | SaaS mensal por barbearia exige recorrência automática |
| ADR-006 | Envio de mensagens atrás da interface `MessageSender` com mock de console no MVP; Evolution API → Meta Cloud API na evolução | Integração direta com um provedor desde o início | Troca de provedor sem tocar fila/dispatcher; MVP sem bloqueio de compliance |
| ADR-007 | Inadimplência: status no `public_metadata` da org no Clerk + enforcement em duas camadas (`proxy.ts` como UX, `getTenantContext()` fail-closed como autoridade); membership preservada até churn definitivo (seção 4.7) | Remoção de membership; `private_metadata`; guard apenas no middleware | Remoção de membership é destrutiva e quebra a reativação; metadata privada não chega ao session token; middleware sozinho não é garantia (deprecação do `createRouteMatcher`) |

---

## 7. Riscos e próximos passos

### Riscos principais

- **Race de agendamento (achado 3) — encerrado:** as exclusion constraints `Appointment_customer_no_overlap`/`Appointment_service_no_overlap` já existiam desde `20260712150000_appointment_integrity`; a aplicação agora trata a violação `23P01` com mensagem amigável.
- **Custos/limites do plano Vercel:** confirmar limite de duração de função e disponibilidade de cron no plano contratado antes de implementar o dispatcher.
- **Provedor de WhatsApp (decisão registrada):** MVP opera com `ConsoleMessageSender` (mock que loga no console). Para produção, Evolution API primeiro (menor atrito) e Meta Cloud API como caminho definitivo de compliance. Risco remanescente: prazo e custo de aprovação de templates na Meta — não bloqueia o MVP.
- **Docs do Next 16 ausentes localmente (achado 7):** validar APIs de `after()`, cron e `proxy` contra a documentação oficial da 16.2.x antes de codar.

### Ordem de implementação sugerida (após validação deste documento)

1. **Fundação de tenant:** `getTenantContext()` memoizado + sincronização de `User`/`Membership` no webhook do Clerk + `requireRole` (corrige achados 1 e 2).
2. **Billing:** modelos `Subscription`/`Payment`/`WebhookEvent`, endpoint do MP com assinatura e idempotência, reconciliação diária, enforcement de inadimplência (seção 4.7) e rota `/billing`.
3. **Fila fase 1:** evolução do modelo `Notification`, outbox nas actions de agenda, dispatcher via cron, senders de e-mail e WhatsApp.
4. **Dívidas:** exclusion constraint de horários, testes de integração dos fluxos de webhook e agenda, rate limiting.
