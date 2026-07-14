# Cotani

Painel web para organizar a operação de clínicas: clientes, serviços e atendimentos em uma agenda protegida por organização.

Cada clínica corresponde a uma organização do Clerk. O painel usa a organização ativa para isolar dados e ações, permitindo que uma mesma conta trabalhe com mais de uma clínica.

> [!NOTE]
> O produto está em evolução. A agenda, a visão geral, clientes e relatórios estão disponíveis; as demais áreas do produto exibem um estado de “Disponível em breve”.

## O que já está disponível

- Autenticação, cadastro e troca de organização com Clerk.
- Sincronização das organizações do Clerk com clínicas locais por webhook.
- Visão geral com totais de clientes, serviços, agendamentos, confirmações e faltas, e **Agenda de hoje** atualizada automaticamente.
- Listagem de próximos atendimentos com polling a cada 30 segundos (TanStack Query + `GET /api/appointments`) e feedback por toasts em erros de agendamento.
- Gestão de clientes em tabela interativa: busca com debounce, paginação no servidor (`GET /api/customers`), edição e remoção com proteção de histórico.
- Relatórios com KPIs do mês: taxa de confirmação, taxa de falta e clientes ativos (`GET /api/metrics`).
- Cadastro inicial de clientes e serviços diretamente pela Agenda.
- Criação, confirmação, conclusão, cancelamento, marcação de falta e reagendamento de atendimentos.
- Proteção contra conflito de horário para o mesmo cliente ou serviço, garantida por exclusion constraints no banco e com mensagem amigável em caso de choque de horários.
- Fila de notificações: confirmação e lembretes (24h e 2h) criados na mesma transação do agendamento e processados por cron (envio simulado no console nesta fase).
- Datas e horários tratados no fuso configurado para cada clínica (padrão: `America/Sao_Paulo`).
- Estados de carregamento, erro e página não encontrada.

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

- Node.js 20 ou superior.
- pnpm 9 ou superior.
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

O webhook cria ou atualiza a clínica local quando uma organização é criada ou alterada. Sem essa sincronização, a organização ativa não terá dados no painel.

> [!TIP]
> Para desenvolvimento local, exponha a aplicação por um túnel HTTPS antes de registrar o endpoint de webhook no Clerk.

## Fluxo da Agenda

1. Entre na conta e crie ou selecione uma organização (clínica).
2. Cadastre pelo menos um cliente e um serviço na página **Agenda**.
3. Crie um atendimento em data e horário futuros.
4. Use as ações do atendimento para confirmar, reagendar, concluir, cancelar ou registrar falta.

Os agendamentos são associados à clínica ativa. A criação e o reagendamento verificam intervalos sobrepostos para evitar que o mesmo cliente ou serviço seja marcado no mesmo horário.

## Agendamento público (self-service)

Cada clínica tem uma página pública de agendamento em `/{slug}` (o slug é único por clínica). O fluxo não exige login:

1. O cliente escolhe o serviço, a data e um dos horários disponíveis.
2. Os horários vêm de `GET /api/public/{slug}/availability`, que desconta os atendimentos já marcados.
3. O envio chama a Server Action `createPublicAppointment`, que faz upsert do cliente pelo telefone e usa o mesmo núcleo transacional do agendamento interno (verificação de conflito, exclusion constraint e fila de notificações).

O horário comercial ainda é fixo no MVP (08h às 18h, em passos de 30 minutos, no fuso da clínica); a modelagem de expediente por clínica fica para uma fase futura.

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
│   └── tenant.ts           # Resolução da clínica ativa
└── proxy.ts                # Middleware do Clerk
prisma/
├── migrations/             # Histórico de migrações
└── schema.prisma           # Modelo de dados
```

## Modelo de dados

| Entidade | Responsabilidade |
| --- | --- |
| `Clinic` | Clínica sincronizada a uma organização do Clerk e seu fuso horário. |
| `User` e `Membership` | Usuários locais e seus vínculos com clínicas. |
| `Customer` | Pacientes/clientes da clínica. O telefone é único por clínica. |
| `Service` | Serviços com duração, preço e status ativo. |
| `Appointment` | Atendimento com cliente, serviço, intervalo e status. |
| `Notification` | Base para lembretes por WhatsApp, e-mail ou SMS. |

## API

### `GET /api/appointments`

Retorna até 50 atendimentos futuros pendentes ou confirmados da clínica ativa.

| Resposta | Significado |
| --- | --- |
| `200` | Lista de atendimentos da organização ativa. |
| `400` | Nenhuma clínica/organização foi selecionada. |
| `404` | A organização ativa ainda não foi sincronizada como clínica. |

A rota exige uma sessão Clerk válida; ela nunca retorna dados de outra clínica.

### `GET /api/customers`

Lista paginada dos clientes da clínica ativa.

| Parâmetro | Descrição |
| --- | --- |
| `search` | Filtra por nome, e-mail ou telefone (case-insensitive). |
| `page` | Página (padrão `1`). |
| `pageSize` | Itens por página (padrão `10`, máximo `50`). |

Resposta `200`: `{ items, total, page, pageSize }`. Erros: `400` (sem clínica selecionada ou parâmetros inválidos), `404` (clínica não sincronizada).

### `GET /api/metrics`

KPIs da clínica ativa: totais de agendamentos, confirmados hoje, no-shows no mês, clientes e serviços, clientes ativos no mês, taxa de confirmação e taxa de falta. As taxas consideram os atendimentos do mês (no fuso da clínica), exceto cancelados.

Resposta `200`: objeto `DashboardMetrics`. Erros: `400` (sem clínica selecionada), `404` (clínica não sincronizada).

### `GET/POST /api/jobs/notifications`

Processa um lote de até 25 notificações pendentes da fila (confirmações e lembretes de agendamento), com claim atômico via `SELECT ... FOR UPDATE SKIP LOCKED`, envio pelo `MessageSender` do canal e retries com backoff exponencial.

| Resposta | Significado |
| --- | --- |
| `200` | Lote processado; corpo JSON com contadores (`claimed`, `sent`, `retried`, `failed`). |
| `401` | Header `Authorization: Bearer ${CRON_SECRET}` ausente ou inválido. |
| `500` | `CRON_SECRET` não configurado. |

O Vercel Cron (`vercel.json`) dispara essa rota a cada minuto e envia o header de autorização automaticamente. Nesta fase o `MessageSender` é um mock que apenas registra a mensagem no console.

### `GET /api/public/{slug}/availability`

Lista os horários livres de um serviço em uma data. Rota pública, sem autenticação, com o escopo resolvido pelo slug da clínica.

| Parâmetro | Descrição |
| --- | --- |
| `serviceId` | UUID de um serviço ativo da clínica. |
| `date` | Data no formato `YYYY-MM-DD` (fuso da clínica). |

Resposta `200`: `{ slots: [{ startTime, label }] }`, com `startTime` em ISO 8601 e `label` no formato `HH:mm`. Erros: `400` (parâmetros inválidos), `404` (clínica ou serviço não encontrado).

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
pnpm build
```

Em produção, configure as mesmas variáveis de ambiente, use um banco PostgreSQL persistente e cadastre o endpoint público do webhook do Clerk. A aplicação deve ser servida por HTTPS para que autenticação e webhooks funcionem adequadamente.
