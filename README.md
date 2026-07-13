# Cotani

Painel web para organizar a operação de clínicas: clientes, serviços e atendimentos em uma agenda protegida por organização.

Cada clínica corresponde a uma organização do Clerk. O painel usa a organização ativa para isolar dados e ações, permitindo que uma mesma conta trabalhe com mais de uma clínica.

> [!NOTE]
> O produto está em evolução. A agenda e o painel de visão geral estão disponíveis; as demais áreas do produto exibem um estado de “Disponível em breve”.

## O que já está disponível

- Autenticação, cadastro e troca de organização com Clerk.
- Sincronização das organizações do Clerk com clínicas locais por webhook.
- Visão geral com totais de clientes, serviços, agendamentos, confirmações e faltas.
- Cadastro inicial de clientes e serviços diretamente pela Agenda.
- Criação, confirmação, conclusão, cancelamento, marcação de falta e reagendamento de atendimentos.
- Proteção contra conflito de horário para o mesmo cliente ou serviço.
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
4. Assine os eventos `organization.created`, `organization.updated` e `organization.deleted`.
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

## Estrutura do projeto

```text
src/
├── app/                    # Rotas App Router, API e layouts
├── components/
│   ├── dashboard/          # Componentes e formulários do painel
│   └── ui/                 # Primitivos de interface
├── generated/prisma/       # Cliente Prisma gerado
├── lib/                    # Prisma, datas/fusos e utilitários
├── server/
│   ├── actions/            # Server Actions de clientes, serviços e agenda
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
