# Checklist de Deploy — Cotani

Este documento lista tudo o que precisa ser feito para colocar o Cotani em produção.

## 1. Código e qualidade (já concluído)

- [x] Build de produção passa (`npm run build`)
- [x] Testes unitários passam (`npm test` — 240 testes)
- [x] Testes E2E passam (`npx playwright test` — 6 testes)
- [x] Rota `/seed` removida
- [x] Páginas placeholder removidas (`/dashboard/automacoes`, `/dashboard/ai`)
- [x] Histórico de pagamentos implementado

## 2. Banco de dados

- [ ] Criar banco PostgreSQL de produção (Neon, Supabase, RDS, etc.)
- [ ] Aplicar migrations: `npx prisma migrate deploy`
- [ ] Confirmar que a tabela `WebhookEvent` existe (idempotência dos webhooks)
- [ ] Confirmar que a tabela `PaymentHistory` existe

## 3. Variáveis de ambiente

Copie `.env.example` para `.env` (ou configure no painel da Vercel) e preencha:

### Clerk (produção)
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — chave `pk_live_...`
- [ ] `CLERK_SECRET_KEY` — chave `sk_live_...`
- [ ] `CLERK_WEBHOOK_SIGNING_SECRET` — signing secret do webhook de produção

### Banco
- [ ] `DATABASE_URL` — connection string pooled com `sslmode=require`

### Cron
- [ ] `CRON_SECRET` — segredo forte para autorizar os jobs (`openssl rand -hex 32`)

### WhatsApp
- [ ] `WHATSAPP_SENDER_MODE` — `manual` (padrão) ou `api`

### URLs públicas
- [ ] `NEXT_PUBLIC_APP_URL` — ex.: `https://painel.cotani.com`
- [ ] `NEXT_PUBLIC_CLERK_SIGN_IN_URL` — `/sign-in`
- [ ] `NEXT_PUBLIC_CHECKOUT_URL` — URL da landing/checkout real

### Mercado Pago (produção)
- [ ] `MERCADO_PAGO_ACCESS_TOKEN` — access token de produção
- [ ] `MERCADO_PAGO_WEBHOOK_SECRET` — **obrigatório** em produção
- [ ] `MERCADO_PAGO_MONTHLY_PLAN_ID` — ID do plano mensal
- [ ] `MERCADO_PAGO_ANNUAL_PLAN_ID` — ID do plano anual

### Validação rápida
Execute: `node scripts/check-env.mjs`

## 4. Clerk Dashboard

- [ ] Mudar instância para **Production**
- [ ] Adicionar domínio de produção em **Allowed Origins**
- [ ] Configurar **Redirect URLs**:
  - `https://SEU-DOMINIO/sign-in`
  - `https://SEU-DOMINIO/dashboard`
- [ ] Criar webhook em **Webhooks**:
  - Endpoint: `https://SEU-DOMINIO/api/webhooks/clerk`
  - Eventos: `organization.created`, `organization.updated`, `organization.deleted`, `organizationMembership.created`, `organizationMembership.updated`, `organizationMembership.deleted`, `user.created`, `user.updated`, `user.deleted`
- [ ] Copiar signing secret para `CLERK_WEBHOOK_SIGNING_SECRET`
- [ ] Confirmar que **Organizations** está habilitado
- [ ] Confirmar que **Sign-up with email** está desativado (invite-only)

## 5. Mercado Pago

- [ ] Criar conta de vendedor ou usar a existente
- [ ] Criar planos de assinatura (PreApproval Plan):
  - Mensal: R$ 97,00
  - Anual: R$ 970,00
- [ ] Configurar webhook:
  - URL: `https://SEU-DOMINIO/api/webhooks/mercado-pago`
  - Evento: `subscription_preapproval`
- [ ] Copiar access token e webhook secret para as variáveis de ambiente
- [ ] Testar em modo sandbox antes de ir para produção

## 6. Vercel / Hosting

- [ ] Importar repositório
- [ ] Configurar todas as variáveis de ambiente
- [ ] Confirmar que `vercel.json` está na raiz (crons já configurados):
  - `/api/jobs/notifications` — a cada minuto
  - `/api/jobs/billing/expire-subscriptions` — diariamente às 6h
- [ ] Deploy em staging primeiro

## 7. Validação em staging

- [ ] Login com conta de teste funciona
- [ ] Dashboard carrega sem erros
- [ ] Link público `/{slug}` abre o quiz de agendamento
- [ ] Agendamento cria notificação na página Comunicações
- [ ] Webhook do Clerk cria/atualiza barbearia no banco
- [ ] Webhook do Mercado Pago atualiza status da assinatura
- [ ] Job de expiração de assinatura roda sem erro
- [ ] Cancelamento de agendamento pelo cliente funciona
- [ ] Cancelamento de assinatura pelo barbeiro funciona

## 8. Produção

- [ ] Apontar domínio final para a Vercel
- [ ] Repetir validação de staging em produção
- [ ] Monitorar logs nas primeiras 24h
- [ ] Configurar backup do banco de dados

## 9. Integração com o dev de pagamentos

O outro dev precisa saber que:

- O webhook `/api/webhooks/mercado-pago` já está pronto e idempotente.
- O checkout é iniciado por `POST /api/subscription/checkout` com `{ plan: "MONTHLY" | "ANNUAL" }`.
- O histórico de pagamentos é gravado automaticamente quando a assinatura vira `ACTIVE`.
- Para testar, basta criar uma assinatura de teste no Mercado Pago e observar o webhook.
