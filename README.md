# Cotani

Painel web para organizar a operação de barbearias: clientes, serviços e atendimentos em uma agenda protegida por organização.

Cada barbearia corresponde a uma organização do Clerk. O painel usa a organização ativa para isolar dados e ações, permitindo que uma mesma conta trabalhe com mais de uma barbearia.

> [!NOTE]
> O produto está pronto para produção. A agenda, visão geral, clientes, relatórios, financeiro, comunicações, configurações e assinatura estão disponíveis.

## O que já está disponível

- Autenticação, cadastro e troca de organização com Clerk.
- Sincronização das organizações do Clerk com barbearias locais por webhook.
- Visão geral com KPIs, agenda de hoje, próximos agendamentos e ações rápidas.
- Listagem de próximos atendimentos com polling a cada 30 segundos (TanStack Query + `GET /api/appointments`) e feedback por toasts em erros de agendamento.
- Gestão de clientes em tabela interativa: busca com debounce, paginação no servidor (`GET /api/customers`), edição e remoção com proteção de histórico.
- Relatórios com KPIs do mês, evolução mensal, top serviços e top profissionais.
- Financeiro com receita, ticket médio, gráficos de desempenho, métodos de pagamento e calendário de vendas.
- Gestão de serviços, profissionais e expediente por dia da semana.
- Criação, confirmação, conclusão, cancelamento, marcação de falta e reagendamento de atendimentos.
- Proteção transacional contra conflito do cliente e do profissional (ou do serviço sem profissional), limite diário e horários fora do expediente, com exclusion constraints no banco.
- Fila de notificações: confirmação e lembretes (24h e 2h) criados na mesma transação do agendamento e processados por cron. Envio manual via link `wa.me` (modo `WHATSAPP_SENDER_MODE=manual`) ou automático por API (modo `api`).
- Assinatura via Mercado Pago com checkout, webhook, renovação automática, cancelamento e histórico de pagamentos.
- Datas e horários tratados no fuso configurado para cada barbearia (padrão: `America/Sao_Paulo`).
- Estados de carregamento, erro e página não encontrada.
- Administração da plataforma em `/admin`, protegida por allowlist de Clerk user IDs, com gestão de lojas, suspensão,
exclusão reversível, membros e trilha de auditoria.

## Tecnologias

| Camada | Ferramentas |
| --- | --- |
| Aplicação | Next.js 16, React 19 e TypeScript |
| Interface | Tailwind CSS 4, shadcn/ui, Base UI e Lucide |
| Autenticação e multi-tenancy | Clerk Organizations |
| Dados | PostgreSQL, Prisma 7 e `@prisma/adapter-pg` |
| Estado no cliente | TanStack Query |
| Validação | Zod |

## Requisitos

- Node.js 24.
- pnpm 11.22.
- Uma instância PostgreSQL acessível.
- Uma aplicação Clerk com Organizations habilitado.

## Começo rápido

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/HanielCota/Cotani-Painel.git
cd Cotani-Painel
pnpm install
```

Crie o arquivo de ambiente a partir do exemplo:

```bash
cp .env.example .env.local
```

No PowerShell, o equivalente é:

```powershell
Copy-Item .env.example .env.local
```

Preencha as variáveis em `.env.local`:

```dotenv
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=

# Administração da plataforma (Clerk user IDs separados por vírgula)
PLATFORM_ADMIN_CLERK_USER_IDS=user_SEU_ID

# PostgreSQL
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/cotani?schema=public"

# Fila de notificações (Vercel Cron)
CRON_SECRET=
```

> [!IMPORTANT]
> Não envie `.env.local` ao Git. O arquivo já é ignorado; mantenha somente `.env.example` como referência sem segredos.

Aplique as migrações e inicie o ambiente de desenvolvimento:

```bash
pnpm prisma migrate dev
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000). A rota inicial redireciona para o painel após a autenticação.

## Configuração do Clerk

1. Crie uma aplicação no [Clerk](https://clerk.com/) e habilite **Organizations**.
2. Copie a chave publicável e a chave secreta para `.env.local`.
3. Configure um webhook apontando para `https://SEU-DOMINIO/api/webhooks/clerk`.
4. Assine os eventos `organization.created`, `organization.updated`, `organization.deleted`, `organizationMembership.created`, `organizationMembership.updated`, `organizationMembership.deleted`, `user.created`, `user.updated` e `user.deleted`.
5. Copie o segredo de assinatura do webhook para `CLERK_WEBHOOK_SIGNING_SECRET`.

O webhook cria ou atualiza a barbearia local quando uma organização é criada ou alterada. Sem essa sincronização, a organização ativa não terá dados no painel.

> [!IMPORTANT]
> Em produção, use o modo **Production** do Clerk e configure as URLs de redirect, allowed origins e webhooks com o domínio final.

> [!TIP]
> Para desenvolvimento local, exponha a aplicação por um túnel HTTPS antes de registrar o endpoint de webhook no Clerk.

## Fluxo da Agenda

1. Entre na conta e crie ou selecione uma organização (barbearia).
2. Cadastre pelo menos um cliente e um serviço na página **Agenda**.
3. Crie um atendimento em data e horário futuros.
4. Use as ações do atendimento para confirmar, reagendar, concluir, cancelar ou registrar falta.

Os agendamentos são associados à barbearia ativa. A criação e o reagendamento validam expediente, pausa, limite diário e intervalos sobrepostos. O preço é congelado no momento da reserva; a receita considera apenas atendimentos concluídos.

## Agendamento público (self-service)

Cada barbearia tem uma página pública de agendamento em `/{slug}` (o slug é único por barbearia). O fluxo não exige login:

1. O cliente escolhe o serviço e o profissional.
2. O cliente escolhe a data e um dos horários disponíveis.
3. O cliente informa nome, WhatsApp e e-mail.
4. O envio chama a Server Action `createPublicAppointment`, que faz upsert do cliente pelo telefone e usa o mesmo núcleo transacional do agendamento interno (verificação de conflito, exclusion constraint e fila de notificações).

Os horários são calculados a partir do expediente configurado pela barbearia (abertura, fechamento e pausa para almoço) e da duração do serviço selecionado.

## Estrutura do projeto

```text
src/
├── app/                    # Rotas App Router, API e layouts
├── components/
│   ├── dashboard/          # Componentes e formulários do painel
│   ├── public/             # Formulário de agendamento público
│   └── ui/                 # Primitivos de interface
├── generated/prisma/       # Cliente Prisma gerado
├── lib/                    # Prisma, datas/fusos e utilitários
├── server/
│   ├── actions/            # Server Actions de clientes, serviços e agenda
│   ├── services/           # Regra de negócio e integrações (ex.: envio de mensagens)
│   └── tenant.ts           # Resolução da barbearia ativa
└── proxy.ts                # Middleware do Clerk
prisma/
├── migrations/             # Histórico de migrações
└── schema.prisma           # Modelo de dados
```

## Modelo de dados

| Entidade | Responsabilidade |
| --- | --- |
| `Clinic` | Barbearia sincronizada a uma organização do Clerk, com fuso horário e assinatura. |
| `User` e `Membership` | Usuários locais e seus vínculos com barbearias. |
| `Customer` | Clientes da barbearia. O telefone é único por barbearia. |
| `Service` | Serviços com duração, preço, imagem e status ativo. |
| `Professional` | Profissionais vinculados a serviços específicos. |
| `BusinessHour` | Expediente da barbearia por dia da semana. |
| `Appointment` | Atendimento com cliente, serviço, profissional, intervalo e status. |
| `Notification` | Base para lembretes por WhatsApp, e-mail ou SMS. |
| `PaymentHistory` | Histórico de pagamentos da assinatura. |

## API

### `GET /api/appointments`

Retorna até 50 atendimentos futuros pendentes ou confirmados da barbearia ativa.

| Resposta | Significado |
| --- | --- |
| `200` | Lista de atendimentos da organização ativa. |
| `400` | Nenhuma barbearia/organização foi selecionada. |
| `404` | A organização ativa ainda não foi sincronizada como barbearia. |

A rota exige uma sessão Clerk válida; ela nunca retorna dados de outra barbearia.

### `GET /api/customers`

Lista paginada dos clientes da barbearia ativa.

| Parâmetro | Descrição |
| --- | --- |
| `search` | Filtra por nome, e-mail ou telefone (case-insensitive). |
| `page` | Página (padrão `1`). |
| `pageSize` | Itens por página (padrão `10`, máximo `50`). |

Resposta `200`: `{ items, total, page, pageSize }`. Erros: `400` (sem barbearia selecionada ou parâmetros inválidos), `404` (barbearia não sincronizada).

### `GET /api/metrics`

KPIs da barbearia ativa: totais de agendamentos, confirmados hoje, no-shows no mês, clientes e serviços, clientes ativos no mês, taxa de confirmação e taxa de falta. As taxas consideram os atendimentos do mês (no fuso da barbearia), exceto cancelados.

Resposta `200`: objeto `DashboardMetrics`. Erros: `400` (sem barbearia selecionada), `404` (barbearia não sincronizada).

### `GET/POST /api/jobs/notifications`

Processa um lote de até 25 notificações pendentes da fila (confirmações e lembretes de agendamento), com claim atômico via `SELECT ... FOR UPDATE SKIP LOCKED`, envio pelo `MessageSender` do canal e retries com backoff exponencial.

| Resposta | Significado |
| --- | --- |
| `200` | Lote processado; corpo JSON com contadores (`claimed`, `sent`, `retried`, `failed`). |
| `401` | Header `Authorization: Bearer ${CRON_SECRET}` ausente ou inválido. |
| `500` | `CRON_SECRET` não configurado. |

O Vercel Cron (`vercel.json`) dispara essa rota a cada minuto e envia o header de autorização automaticamente. No modo `manual` (padrão), as mensagens aparecem na página **Comunicações** para envio manual via WhatsApp Web/App.

### `GET/POST /api/jobs/billing/expire-subscriptions`

Move assinaturas vencidas para carência (`PAST_DUE`) e só as desativa após o período configurado em `SUBSCRIPTION_GRACE_PERIOD_DAYS`.

| Resposta | Significado |
| --- | --- |
| `200` | Contador de assinaturas expiradas. |
| `401` | Header `Authorization: Bearer ${CRON_SECRET}` ausente ou inválido. |
| `500` | `CRON_SECRET` não configurado. |

### `GET/POST /api/jobs/maintenance`

Executa diariamente a retenção operacional: remove janelas antigas de rate limit e webhooks antigos e anonimiza destinatário/conteúdo de notificações encerradas com mais de 90 dias.

## Produção

1. Configure todas as variáveis de `.env.example`; se `WHATSAPP_SENDER_MODE=api`, informe também as credenciais da Meta Cloud API.
2. Aplique as migrações com `pnpm exec prisma migrate deploy` no banco correto antes de promover a nova versão.
3. No Mercado Pago, assine `subscription_preapproval` e `subscription_authorized_payment` no endpoint `/api/webhooks/mercado-pago`.
4. Execute `pnpm check` e `pnpm build`. A mesma validação roda em `.github/workflows/ci.yml`.

### Administração da plataforma

A rota `/admin` é separada dos papéis das lojas. Ter papel `ADMIN` em uma organização do Clerk não concede acesso à
administração global. Informe em `PLATFORM_ADMIN_CLERK_USER_IDS` apenas o Clerk user ID do responsável pela plataforma
(ou uma lista separada por vírgulas). Encontre esse ID em **Clerk Dashboard → Users → usuário → User ID**.

Configure a variável tanto no `.env.local` para desenvolvimento quanto nas variáveis de ambiente da Vercel para
produção. Como as instâncias Development e Production do Clerk possuem usuários distintos, use em cada ambiente o ID
da respectiva instância. A configuração ausente ou um ID diferente bloqueiam o acesso por padrão e a rota responde como
não encontrada.

O administrador da plataforma pode editar dados básicos da loja, suspender/reativar, excluir/restaurar sem apagar os
dados e gerenciar papéis de membros. Toda mutação sensível exige justificativa e gera um evento em `AdminAuditLog`. A
aplicação impede a remoção ou o rebaixamento do último administrador de uma loja.

As páginas e APIs operacionais exigem papel `ADMIN` ou `RECEPTIONIST`; assinatura, financeiro, relatórios e configurações exigem `ADMIN`. O papel `PROVIDER` permanece bloqueado dessas áreas até existir uma visão de agenda individual vinculada ao profissional.

### `GET /api/public/{slug}/availability`

Lista os horários livres de um serviço em uma data. Rota pública, sem autenticação, com rate limit por IP e escopo resolvido pelo slug da barbearia.

| Parâmetro | Descrição |
| --- | --- |
| `serviceId` | UUID de um serviço ativo da barbearia. |
| `date` | Data no formato `YYYY-MM-DD` (fuso da barbearia). |
| `professionalId` | UUID opcional do profissional. |

Resposta `200`: `{ slots: [{ startTime, label }] }`, com `startTime` em ISO 8601 e `label` no formato `HH:mm`. Erros: `400` (parâmetros inválidos), `404` (barbearia, serviço ou profissional não encontrado), `429` (rate limit).

### `GET /api/public/{slug}/available-dates`

Lista os dias do mês que possuem ao menos um horário livre para um serviço/profissional.

| Parâmetro | Descrição |
| --- | --- |
| `serviceId` | UUID de um serviço ativo da barbearia. |
| `yearMonth` | Mês no formato `YYYY-MM`. |
| `professionalId` | UUID opcional do profissional. |

Resposta `200`: `{ dates: string[] }` com datas no formato `YYYY-MM-DD`.

## Scripts

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Inicia o Next.js em modo de desenvolvimento. |
| `pnpm build` | Gera o build de produção. |
| `pnpm start` | Executa o build de produção. |
| `pnpm lint` | Executa o ESLint. |
| `pnpm prisma generate` | Regenera o cliente Prisma em `src/generated/prisma`. |
| `pnpm prisma migrate dev` | Cria/aplica migrações no banco de desenvolvimento. |

## Verificação antes do deploy

```bash
pnpm lint
pnpm test
pnpm build
npx playwright test
```

## Deploy em produção

1. **Banco de dados**: aplique todas as migrations (`pnpm prisma migrate deploy`).
2. **Variáveis de ambiente**: configure todas as variáveis do `.env.example` com valores de produção.
3. **Clerk**: use o modo Production, configure o domínio final, allowed origins, redirect URLs e o webhook `/api/webhooks/clerk`.
4. **Mercado Pago**: configure o webhook `/api/webhooks/mercado-pago` com `MERCADO_PAGO_WEBHOOK_SECRET` obrigatório.
5. **Cron**: garanta que `CRON_SECRET` esteja configurado para os jobs `/api/jobs/notifications` e `/api/jobs/billing/expire-subscriptions`.
6. **HTTPS**: a aplicação deve ser servida por HTTPS para autenticação e webhooks.

> [!IMPORTANT]
> Não exponha `.env.local` nem chaves de desenvolvimento. Em produção, use apenas chaves `pk_live_` / `sk_live_` e access tokens de produção do Mercado Pago.
