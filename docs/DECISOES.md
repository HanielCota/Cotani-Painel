# Decisões do Cotani Painel

Registro curto das escolhas de arquitetura e de biblioteca: data, o que foi decidido, por quê e o que foi descartado. As regras internas do sistema (tenancy, RLS, idempotência, plano Empresa) estão nos ADRs de [`ARCHITECTURE.md`](./ARCHITECTURE.md#decisões-registradas) e não se repetem aqui.

As entradas abaixo foram reconstruídas em 18/10/2026 a partir do código e do histórico do Git. A data é a do commit que introduziu a escolha. Quando o motivo não estava registrado, a entrada diz isso em vez de supor.

| Data | Decisão | Por quê | Descartado |
| --- | --- | --- | --- |
| 13/07/2026 | **Next.js (App Router)** como monólito modular: telas, Server Actions, Route Handlers e jobs no mesmo deploy. | Uma base só para o painel, a página pública de agendamento e os jobs, com autorização resolvida no servidor (`ARCHITECTURE.md`, "Visão geral"). | Não registrado. |
| 13/07/2026 | **Prisma** como única camada de acesso às tabelas de negócio, com o cliente gerado em `src/generated/prisma` e o adaptador `@prisma/adapter-pg`. | Tipagem do schema e migrações versionadas; o navegador nunca consulta as tabelas (ADR-003). | Consultar as tabelas de negócio pelo cliente Supabase no navegador. |
| 13/07/2026 | **Vercel** para hospedagem e para os jobs diários de cobrança e manutenção (`vercel.json`, `crons`). | Deploy do próprio Next.js e jobs protegidos por `CRON_SECRET`. | Não registrado. |
| 18/07/2026 | **Mercado Pago** (SDK `mercadopago`) para as assinaturas. | Não registrado no commit. | Não registrado. |
| 28/08/2026 | **Supabase** para autenticação e PostgreSQL (ADR-001). | Uma plataforma só para identidade e banco; a autorização continua no `Membership` local (ADR-002). | **Clerk**, o provedor anterior: a sincronização de membros e assinaturas com ele foi removida, e os registros de DNS dele foram apagados depois de validar o Supabase em produção (`DEPLOY.md`). |
| 04/09/2026 | Envio das notificações agendado pelo **pg_cron do Supabase** a cada 5 minutos, chamando `/api/jobs/notifications` (migração `20260904224500`). | Não registrado no commit. Os lembretes de 24 h e 2 h precisam de execução em minutos, e os jobs da Vercel do projeto são diários. | **Vercel Cron** para as notificações, usado desde 13/07/2026. |
| 08/09/2026 | Checkout como **assinatura hospedada do Mercado Pago**, com plano e preço resolvidos no servidor (ADR-005). | Não registrado no commit ("restaura checkout hospedado"). | Vincular a compra a um `preapproval_plan` remoto (`ARCHITECTURE.md`, "Limites e assinaturas"). |

## Como registrar uma decisão nova

Uma linha por decisão, no fim da tabela, no mesmo PR que a aplica: data, o que foi decidido, por quê e o que foi descartado. Erros que custaram caro (bug em produção, dado perdido, retrabalho grande) entram numa seção "Postmortems" logo abaixo, com o que aconteceu, a causa e o que impede de repetir.
