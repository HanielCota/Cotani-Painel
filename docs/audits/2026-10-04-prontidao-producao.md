# Prontidão de produção e operação - Cotani

Data: 04/10/2026. Escopo: `Cotani-Painel`, `Cotani-Landingpage`, respostas HTTP públicas e leitura das configurações da Vercel. Revisão orientada a risco, não certificação ou teste de carga. Nenhum deploy, migração, compra, e-mail, alteração de DNS ou mudança de configuração externa foi executado.

## Decisão

**NO-GO para uma nova publicação sem fechar os portões abaixo; prontidão da instalação atual não comprovada.** Os dois sites estão online, mas correções de segurança e a remoção de rotas legadas ainda existem apenas no checkout local. A recuperação de dados não foi comprovada, o estado das migrações não pôde ser consultado com a credencial local, e não foi demonstrado um alerta que avise o responsável quando checkout, webhook ou jobs falharem. Isso não significa que a operação atual esteja indisponível; significa que não há evidência suficiente para declarar a próxima versão pronta ou a operação recuperável.

Não há número confiável de usuários simultâneos, RTO (tempo máximo de recuperação), RPO (perda máxima tolerada de dados), responsável de plantão ou janela de mudança definidos nesta revisão. Esses valores dependem de decisão do proprietário, não devem ser inventados.

## Mapa de serviços e dependências

| Componente e ambiente | Configuração e segredos | Dependência / verificação | Health / responsável |
| --- | --- | --- | --- |
| Landing Astro na Vercel, `www.cotani.com.br`; domínio raiz redireciona para `www` | `PUBLIC_PANEL_URL` presente como nome na Vercel; valor não lido nesta revisão | GET da home e do checkout: 200 em 04/10; CI existe; valores externos do checkout não confirmados por pagamento | Sem health específico; responsável operacional a definir |
| Painel Next na Vercel, `painel.cotani.com.br` | Nomes de Supabase, Mercado Pago, Resend, admin e `CRON_SECRET` presentes em Production; **valores não lidos nem testados** | GET `/sign-in`: 200; `/admin` anônimo: 307 para login; CI existe | Admin mostra eventos de jobs e webhooks, mas não substitui alerta independente; responsável a definir |
| PostgreSQL/Supabase e Auth | URLs de banco e chaves no painel; RLS e migrações no repositório | `prisma migrate status` retornou `permission denied for table _prisma_migrations`; estado real e restore não comprovados | Sem health externo ou política de recuperação demonstrada; proprietário do Supabase |
| Mercado Pago | Token, segredo de webhook e IDs de plano presentes como nomes; vínculo/valor não revalidados | Checkout e conciliação testados por unidade; aprovação + acesso não refeitos nesta auditoria | Eventos de webhook no admin, sem alerta externo demonstrado; proprietário da conta e operador |
| Resend e notificações | `RESEND_API_KEY` e `EMAIL_FROM` presentes como nomes | Fila e sender testados localmente; entrega real, `pg_cron` e filas de produção não verificados | Falhas visíveis no admin se persistidas; operador a definir |
| Jobs Vercel | `CRON_SECRET` presente como nome; três rotinas diárias no `vercel.json` | Rotas exigem segredo; histórico de execução real não lido | Logs Vercel e eventos do admin; alerta proativo não demonstrado |
| Cloudflare/DNS/CDN, Supabase Storage e serviços opcionais de mensagem | Fora da inspeção externa desta rodada | HTTPS respondeu; certificado, DNS completo, storage e modo de WhatsApp/SMS não auditados ao vivo | Responsáveis externos a confirmar |

O checkout da landing depende da API pública do painel; o painel depende de Supabase, Mercado Pago e, para e-mails, Resend. Um retorno HTTP 200 isolado não prova essas integrações.

## Evidência executada e limites

- Painel: `pnpm check` passou em 82 arquivos / 377 testes, `pnpm build` passou, `prisma validate` passou e `pnpm audit --prod` informou zero avisos conhecidos em 04/10. Landing: `npm test` passou em 7 arquivos / 34 testes e `npm run build` passou; `npm audit --omit=dev` informou um aviso alto. Isso valida o código local, não a infraestrutura publicada.
- GitHub Actions: ambos os projetos possuem CI com instalação travada por lockfile, testes e build. Painel usa Node 24/pnpm 11.22; landing usa Node 22/npm. Proteção de branch, execução remota mais recente e vínculo entre commit e deploy não foram verificados.
- Vercel: painel em deployment `dpl_3yJsHy7pNZQYmSgkyfnh3VrCQenC` (criado 03/10/2026 12:56 UTC), landing em `dpl_Gj9kzrc671pPo2ySsMQtBkT6AxGz` (29/09/2026 12:40 UTC), ambos `READY`. `READY` significa implantação concluída, não saúde das dependências. O código local contém alterações posteriores/não publicadas em ambos os repositórios.
- Smoke HTTP sem autenticação: `https://www.cotani.com.br/`, `/checkout` e `https://painel.cotani.com.br/sign-in` retornaram 200. `/admin` redirecionou ao login. As rotas legadas `/api/signup` e `/api/checkout/lead` responderam 200 e 405 por GET na landing publicada; já foram removidas **somente localmente**. Não foi feito POST para não criar registros nem mensagens.
- Banco: `pnpm exec prisma migrate status` conectou ao host Supabase, mas não teve permissão de ler `_prisma_migrations`. Não foi executado `migrate deploy`, dump ou restore.
- Sem ensaio de carga: nenhum número de capacidade pode ser atribuído. As requisições isoladas acima provam apenas disponibilidade momentânea, não latência típica, throughput ou estabilidade.

## Achados e portões

### PRD-01 - Correções locais ainda fora da versão publicada

- Componente/ambiente: painel e landing / produção. Prioridade: **P1**. Estado: **confirmado**.
- Falha/lacuna e evidência: a auditoria de segurança de 03/10 registrou correções locais para autorização de relatórios entre unidades, callback de autenticação e dependências do painel, além da remoção das rotas legadas da landing. Ambos os `git status` seguem com alterações não commitadas; as rotas legadas ainda respondem publicamente.
- Impacto e pré-condições: a exposição de relatórios exige papel numa unidade secundária sem autorização na principal; o callback exige link preparado. As rotas legadas podem receber solicitações externas. O release ainda não incorpora as correções.
- Ação, responsável/acesso, critério e revalidação: revisar diffs dos dois repositórios, separar alterações desejadas, concluir CI, publicar com autorização explícita e testar em produção os relatórios com duas identidades controladas, callback e respostas 404 nas rotas removidas. Responsável: equipe do código + proprietário da Vercel. Status: **pendente**. Risco residual: outras rotas não abrangidas pelos testes de autorização.

### PRD-02 - Recuperação de dados não demonstrada

- Componente/ambiente: Supabase/PostgreSQL / produção. Prioridade: **P1**. Estado: **não verificado**.
- Falha/lacuna e evidência: não foi apresentada política de backup, localização protegida, retenção ou restauração ensaiada. Não se deve pressupor backup automático, especialmente sem confirmar o plano. O comando de status de migração não pôde ler sua tabela.
- Impacto e pré-condições: falha humana, migração defeituosa ou exclusão/corrupção de dados pode exigir restauração. Risco de perda de clientes, agenda e histórico de cobrança.
- Ação, responsável/acesso, critério e revalidação: proprietário do Supabase confirma plano e política; obter backup utilizável com controle de acesso e testar restauração **em destino isolado**, comparando tabelas e amostra sem expor dados pessoais. Para plano gratuito, consultar estratégia de exportação externa antes de assumir recuperação. Não rodar dump com destino inseguro nem restore no banco ativo. Status: **pendente**. Risco residual: perda entre backups segundo RPO definido pelo proprietário.

### PRD-03 - Migrações e compatibilidade do release não comprovadas

- Componente/ambiente: Prisma/Supabase / produção. Prioridade: **P1**. Estado: **confirmada a falta de permissão; estado do esquema não verificado**.
- Falha/lacuna e evidência: `prisma migrate status` retornou `permission denied for table _prisma_migrations`. O repositório contém 40 arquivos na pasta de migrações; há migrações históricas que alteram tipos/colunas e uma que mescla clientes duplicados com `DELETE`, logo não se deve aplicar cegamente uma sequência desconhecida. Não foi identificado qual subconjunto, se algum, resta pendente em produção.
- Impacto e pré-condições: se houver migração pendente, código novo pode não iniciar ou uma mudança de esquema pode afetar dados/rollback.
- Ação, responsável/acesso, critério e revalidação: DBA/proprietário Supabase fornecer consulta de leitura adequada da tabela de migrações e esquema, comparar com o repositório, revisar somente as migrações **efetivamente pendentes** em cópia isolada/backup, confirmar compatibilidade código antigo/novo e janela de execução. Não conceder acesso amplo apenas para esta auditoria. Status: **pendente**. Risco residual: restauração de código não desfaz dados ou migrações.

### PRD-04 - Detecção e resposta a incidentes dependem de consulta manual

- Componente/ambiente: painel, Vercel, Supabase, provedores / produção. Prioridade: **P1**. Estado: **provável; integração externa não verificada**.
- Falha/lacuna e evidência: o admin guarda eventos de jobs/webhook e falhas de notificação; documento `docs/admin-operacao.md` orienta consultar Vercel e `pg_cron`. Não foi demonstrado alerta independente de falha/ausência de eventos, nem responsável que o receba. Não há rota de health dedicada nos endpoints do painel.
- Impacto e pré-condições: cron que não inicia, webhook que deixa de chegar ou indisponibilidade do banco podem passar despercebidos até reclamação de cliente; telemetria gravada no mesmo banco falha junto com ele.
- Ação, responsável/acesso, critério e revalidação: definir operador e canal de aviso, verificar se a Vercel/Supabase já oferecem monitoramento sem custo adicional, criar checagem externa mínima e critérios para jobs vencidos, falha no checkout e crescimento da fila; simular falha controlada em ambiente de teste e comprovar aviso. Não habilitar serviço pago sem confirmação. Status: **pendente**. Risco residual: monitoramento externo também pode falhar; revisar periodicamente.

### PRD-05 - Checkout remoto e jornada integrada ainda não reproduzidos nesta rodada

- Componente/ambiente: landing -> painel -> Mercado Pago -> Supabase Auth -> Resend / teste representativo. Prioridade: **P1**. Estado: **lacuna confirmada; defeito remoto plausível**.
- Falha/lacuna e evidência: auditoria de código de 03/10 encontrou `CREATING` que pode permanecer após rejeição remota definitiva, embora a validação prévia local tenha sido corrigida. Esta rodada não completou compra sandbox, webhook, criação de senha, acesso, agendamento e e-mail num banco isolado. Testes simulados não são prova do provedor.
- Impacto e pré-condições: erro 4xx remoto pode bloquear nova tentativa por até 24 h; uma falha intermediária pode deixar cadastro pendente. Não se afirma que ocorra em todo checkout.
- Ação, responsável/acesso, critério e revalidação: classificar rejeição comprovadamente definitiva sem descartar idempotência em timeout, cobrir com testes; em ambiente isolado usar credenciais de teste e comprador de teste para aprovar, recusar, repetir e conciliar uma assinatura, verificando acesso e e-mail. Sem pagamento real. Status: **pendente**. Risco residual: comportamento remoto muda; manter reconciliação/monitoramento.

### PRD-06 - Sem capacidade mensurada ou objetivos operacionais acordados

- Componente/ambiente: aplicação, banco e jobs / futuro crescimento. Prioridade: **P2**. Estado: **confirmado como lacuna de evidência**.
- Falha/lacuna e evidência: não houve ensaio representativo de concorrência, consulta lenta, limite de conexões ou duração dos jobs nesta revisão; `DATABASE_POOL_MAX` aparece configurado, mas o valor e a capacidade efetiva não foram inferidos. RTO/RPO, volume esperado, indisponibilidade aceitável e responsável não foram declarados.
- Impacto e pré-condições: degradação com aumento da base ou pico de tráfego pode surpreender; não é prova de incapacidade atual.
- Ação, responsável/acesso, critério e revalidação: proprietário informa metas e limites de custo; engenharia mede em ambiente de teste isolado com carga limitada e monitora Vercel/DB; reavalia índices/paginação/jobs com os resultados. Não fazer teste de carga em produção sem autorização e limite. Status: **pendente**. Risco residual: carga real pode diferir do teste.

### PRD-07 - Dependência transitiva da landing com aviso sem patch publicado

- Componente/ambiente: landing/Astro / local e próxima publicação. Prioridade: **P2**. Estado: **confirmado por `npm audit --omit=dev` em 04/10**.
- Falha/lacuna e evidência: `http-cache-semantics@4.2.0` foi apontado por `npm audit --omit=dev`; o aviso oficial ainda lista nenhuma versão corrigida. A aplicação serve predominantemente páginas públicas e a condição de vazamento via cache compartilhado não foi demonstrada. O `fixAvailable: true` do npm, por si só, não prova que exista atualização compatível.
- Impacto e pré-condições: cache compartilhado incorreto de resposta privada poderia expor dados; não tratar aviso genérico como exploração confirmada.
- Ação, responsável/acesso, critério e revalidação: antes do release, reexecutar auditoria, verificar políticas efetivas de cache das rotas dinâmicas e acompanhar correção upstream; não forçar downgrade incompatível do Astro. Status: **pendente**. Risco residual: novos avisos.

## Plano de release e recuperação - preparado, não ensaiado

1. Antes: escolher responsável e janela; congelar escopo dos dois diffs; garantir CI verde, build reproduzível, segredos apenas pelos nomes e valores conferidos pelo responsável, backup/restauração e estado das migrações comprovados; preparar IDs do deployment atual e checklist de comunicação.
2. Em ambiente isolado: testar migrações pendentes, fluxo sandbox completo e falhas de webhook/cron; decidir sequência de publicação pelo contrato API (painel compatível com landing anterior antes de mudar landing). Registrar versões exatas.
3. Com autorização específica: publicar painel primeiro, verificar login, `/admin`, relatórios por papel, checkout seguro, jobs e logs; publicar landing depois, verificar página, checkout e 404 das rotas legadas. Não usar compra real como smoke padrão.
4. Abortamento: erro 5xx, login inviável, dados de outra unidade visíveis, pagamento aprovado sem acesso, acesso sem pagamento aprovado, job/webhook sem confirmação ou falha de migração. Suspender nova divulgação e decidir reversão com o operador.
5. Rollback: Vercel permite voltar a deployment anterior, mas isso só restaura o código/configuração daquela implantação; **não desfaz migração nem alterações no banco ou no Mercado Pago**. Verificar compatibilidade com o esquema antes de executar. Rollback não foi ensaiado nesta rodada; a primeira simulação segura deve ocorrer em preview/projeto de teste, incluindo pós-verificação e conferência dos cron jobs.

## Checklist final

| Portão | Estado | Responsável e conclusão objetiva |
| --- | --- | --- |
| Testes locais e CI configurada | Aprovado localmente / CI remota não verificada | Engenharia: confirmar execução verde do commit exato a publicar |
| Build final dos dois projetos | Aprovado localmente | Engenharia: repetir no commit exato a publicar |
| Configuração de destino | Parcial | Operador Vercel: conferir **valores**, domínios e vínculos sem expor segredos |
| Migrações e compatibilidade | Pendente | Supabase/engenharia: lista real das aplicadas e ensaio das pendentes |
| Backup e restauração | Pendente | Proprietário Supabase: backup acessível e restore isolado comprovado |
| Health e alertas | Pendente | Operador: receber alerta de falha e ausência de jobs em teste controlado |
| Jornada sandbox integrada | Pendente | Engenharia + conta MP de teste: pagamento, webhook, acesso e e-mail demonstrados |
| Operador, RTO/RPO e suporte | Pendente | Proprietário: nome/canal e limites aceitos por escrito |
| Smoke público | Parcial | Engenharia: repetir após release, inclusive sob login controlado |
| Rollback | Descrito, não ensaiado | Operador Vercel + engenharia: ensaio isolado e compatibilidade de banco |

Fontes de método: [Google SRE - Production Readiness Review](https://sre.google/sre-book/evolving-sre-engagement-model/) e [Launch Coordination Checklist](https://sre.google/sre-book/launch-checklist/). Para limites do fornecedor, consultar [Supabase - Database Backups](https://supabase.com/docs/guides/platform/backups) e [Vercel - Instant Rollback](https://vercel.com/docs/instant-rollback). Estas fontes orientam o processo; os estados acima decorrem das verificações da Cotani.
