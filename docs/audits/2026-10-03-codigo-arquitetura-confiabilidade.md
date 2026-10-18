# Auditoria de código, arquitetura e confiabilidade - Cotani

Data: 2026-10-03. Escopo: `Cotani-Painel` e `Cotani-Landingpage`, conforme `03-auditoria-codigo.txt`. Esta é uma revisão **orientada a risco**, não uma leitura linha por linha de todos os arquivos. Nenhum deploy, cobrança ou envio de mensagem real foi executado. As alterações anteriores, ainda não commitadas na landing, foram preservadas.

## Decisão e cobertura real

**Qualidade técnica não comprovada para aprovação irrestrita.** Os testes locais e builds passam, e há controles importantes de tenant, transação e webhook; porém não foi executada nesta rodada uma jornada integrada de pagamento, acesso, agendamento e notificação com isolamento de banco. Persistem uma falha operacional possível no checkout remoto e dois endpoints auxiliares da landing com contratos frágeis.

Foram lidos em profundidade os serviços de checkout da landing, criação da assinatura Mercado Pago, conciliação/webhook, entrada do agendamento público, núcleo de validação de horários, outbox/dispatcher de notificações, sender de e-mail e endpoints auxiliares de leads. Foram inspecionados contratos de autenticação/tenant, ações de agenda e administração global, configuração de teste e arquitetura. Não houve leitura exaustiva dos módulos de finanças, relatórios, CRM, mídia, todos os componentes de UI, migrações SQL e dependências transitivas. Essa limitação impede afirmar ausência de defeitos fora dos caminhos examinados.

## Mapa de arquitetura, contratos e risco

| Fluxo crítico e camadas | Invariante | Falha possível | Evidência/teste existente | Lacuna |
| --- | --- | --- | --- | --- |
| Landing Astro -> API pública Next -> Prisma -> Mercado Pago -> retorno | Uma tentativa não deve bloquear a pessoa por erro de configuração; uma repetição ambígua não deve criar duas assinaturas | Contrato `CREATING` órfão; resposta remota aceita e gravação local falha | `landing-checkout.test.ts`, testes de rota e E2E da landing com API interceptada | Sem teste integrado com provedor sandbox e banco isolado; rejeição remota definitiva não classificada |
| Webhook MP -> assinatura/fatura consultada no provedor -> transação -> histórico/acesso | Apenas pagamento verificado libera a loja; evento repetido não duplica histórico | Entrega antes do vínculo local, retry e erro parcial | `billing-settlement.test.ts`, `mercado-pago/route.test.ts` | Não reexecutado com eventos reais nesta rodada |
| Supabase Auth -> `User`/`Membership` -> tenant/papel -> ações e rotas | Cookie de loja não concede acesso; IDs do cliente não cruzam tenant | Falta de guarda numa ação pouco usada | `auth.test.ts`, `tenant.test.ts`, inspeção das entradas principais | Sem E2E autenticado por cada papel nesta rodada |
| Agendamento público -> validação -> transação/constraints -> outbox | Horários não se sobrepõem; erro não confirma reserva inexistente | Corrida, fuso, cliente sem e-mail ou retry | `scheduling.test.ts`, `public-booking.test.ts`; exclusion constraint identificada | Sem jornada navegador + banco isolado/concorrência real nesta rodada |
| Cron -> lote com lock -> Resend/Meta/Twilio -> estado da notificação | Falha deve gerar retry limitado; e-mail repetido não deve duplicar em retry breve | Provedor aceita envio e atualização local falha | `jobs/notifications/route.test.ts`; novo teste do sender | Entrega real e recuperação após 24 h não verificadas |
| Landing `/api/signup` e `/api/checkout/lead` -> arquivo local/webhook opcional | Resposta de sucesso deve corresponder a dado durável ou entrega verificada | Falha de escrita e resposta `delivered` incorreta | Testes locais de API passam | Não há consumidor encontrado em `src`; comportamento publicado não testado |

Fontes de verdade: preço/entitlements em `src/config/subscription-plans.ts` no painel; identidade no Supabase Auth; autorização em `Membership`; dados de negócio no PostgreSQL via Prisma; estado financeiro no Mercado Pago confirmado por consulta de assinatura/fatura e persistido em `BillingContract`/`PaymentHistory`. A landing mantém valores de preço próprios em `src/data/pricing.ts`, uma duplicação já tratada parcialmente na auditoria de produto, mas ainda suscetível a divergência futura.

## Achados

### C3-01 - Configuração inválida criava tentativa provisória - P1, bug confirmado, corrigido localmente

- Arquivos/linhas: `src/server/services/landing-checkout.ts:27-28,105`, `src/server/services/mercado-pago.ts:52-66`.
- Fluxo, contrato e pré-condição: checkout público com `LANDING_PAGE_URL` HTTP/local ou credencial/plano ausente; nenhuma loja/contrato deve ser persistida quando a falha é detectável antes da chamada externa.
- Observado/evidência: na auditoria de design, uma chamada local criou `Clinic` e `BillingContract` em `CREATING` antes de o Mercado Pago rejeitar o retorno HTTP. Os dois registros exatos foram removidos com autorização do usuário. O código anterior também só conferia token e plano após criar os registros.
- Causa/impacto: validação de configuração após a primeira transação; um erro local podia deixar tentativa bloqueante por até 24 horas e dados fictícios ou abandonados no banco.
- Correção/alternativa/risco: preflight de token, plano e URL HTTPS antes da transação. Foi preferido ao apagamento automático, que seria perigoso se o provedor tivesse criado uma assinatura apesar de resposta ambígua. Risco da mudança baixo; ambiente local com URL HTTP agora falha antes de gravar, exigindo URL HTTPS válida para testar checkout remoto.
- Revalidação/risco residual: testes novos verificam rejeição de HTTP e ausência de gravação quando a configuração falha; testes do serviço passaram. Uma rejeição **remota** definitiva ainda pode deixar `CREATING`; ver C3-02.

### C3-02 - Rejeição remota ainda pode deixar checkout `CREATING` - P1, risco plausível, pendente

- Arquivos/linhas: `src/server/services/landing-checkout.ts:105-130`, `src/server/services/mercado-pago.ts:126-151`, `src/server/services/maintenance.ts:15-60`.
- Fluxo, contrato e pré-condição: MP rejeita a criação depois do preflight, por exemplo regra de conta, formato não previsto ou erro 4xx. Uma pessoa deve poder corrigir e tentar novamente sem criar cobrança duplicada.
- Observado/evidência: o serviço persiste contrato antes da chamada; exceção remota sai sem atualizar o estado. A busca do checkout reaproveita `CREATING` por 24 horas e a manutenção só anonimiza após pelo menos 7 dias. O caso exato pós-preflight não foi reproduzido com a API remota nesta rodada.
- Causa/impacto: erros remotos definitivos e ambíguos recebem o mesmo tratamento. Apagar ou recriar sem classificação poderia duplicar assinatura recorrente, então não foi feito.
- Correção sugerida/alternativas/risco: classificar a resposta do SDK, marcar falha somente quando a rejeição provar que nada foi criado, manter a mesma chave idempotente para timeout/resultado ambíguo e expor recuperação ao usuário. Exige contrato com MP e teste sandbox. Risco de mudança alto; estado pendente, sem teste de revalidação ainda.

### C3-03 - E-mail da fila sem chave de idempotência no Resend - P2, risco plausível, mitigado localmente

- Arquivos/linhas: `src/server/services/messaging/message-sender.ts:64-72`, `src/app/api/jobs/notifications/route.ts:127-170`.
- Fluxo, contrato e pré-condição: provedor aceita o e-mail, mas a atualização de `Notification` falha ou o processo encerra. Retry deve evitar segundo envio.
- Observado/evidência: a fila já tinha `idempotencyKey`, mas o sender não a enviava ao Resend; portanto o retry podia ser uma nova requisição. Não foi disparado e-mail real nesta auditoria.
- Causa/impacto: contrato de idempotência terminava antes do provedor; risco de e-mail duplicado e consumo extra.
- Correção/alternativa/risco: enviado o header oficial `Idempotency-Key` com a chave da notificação, mantendo payload e provedor. Teste novo verifica o header e a resposta; risco baixo. A janela de deduplicação do Resend é de 24 horas, logo retries posteriores ainda exigem observabilidade/reconciliação; envio real não verificado. Referência: [Resend - Idempotency Keys](https://resend.com/changelog/idempotency-keys).

### C3-04 - Endpoint auxiliar de inscrição grava em arquivo local - P2, risco plausível, pendente

- Arquivos/linhas: landing `src/pages/api/signup.ts:88-90`, `src/lib/signups.ts:4,23-25,32-39`.
- Fluxo, contrato e pré-condição: POST de inscrição deve armazenar e-mail de forma durável. Teste local grava `./data/signups.json` e retorna sucesso.
- Observado/evidência: armazenamento é um arquivo relativo ao processo e webhook é opcional/fire-and-forget. Não foi encontrado chamador desse endpoint em `src` da landing, mas a rota pública existe. O teste local não representa filesystem/replicação de funções em produção. Referência: [Vercel - diferenças do filesystem local e Functions](https://vercel.com/guides/why-does-my-serverless-function-work-locally-but-not-when-deployed).
- Causa/impacto: persistência local acoplada à rota; pode falhar ou não ser durável entre instâncias, e o usuário externo pode receber erro ou perder o lead.
- Correção sugerida/alternativas/risco: confirmar se a rota ainda é usada; se for, migrar para armazenamento durável autorizado com unicidade e teste de integração; se não for, descontinuar explicitamente. Alteração não feita para não eliminar leads/clientes externos desconhecidos nem criar custo de serviço novo. Risco de mudança médio; pendente. Revalidação: POST real em ambiente isolado + reinício/nova instância.

### C3-05 - `delivered` afirma entrega sem aguardar webhook - P2, bug de contrato confirmado por leitura, pendente

- Arquivos/linhas: landing `src/pages/api/checkout/lead.ts:21-34,78-81`.
- Fluxo, contrato e pré-condição: com `SIGNUPS_WEBHOOK_URL` configurada, se a chamada falha, `delivered` deve refletir que não houve confirmação de entrega.
- Observado/evidência: a rota calcula `delivered = Boolean(URL)` e inicia `fetch` sem `await`; erro é absorvido. O teste existente cobre apenas URL ausente. Não foi encontrado chamador em `src`, mas o endpoint público pode ter consumidor externo.
- Causa/impacto: configuração confundida com entrega; monitoramento/suporte podem considerar um lead recebido quando o destino falhou.
- Correção sugerida/alternativas/risco: definir se esse evento é obrigatório ou best-effort. Se obrigatório, aguardar resposta com timeout e retornar sucesso só após aceitação; se best-effort, renomear o campo para `forwardingAttempted` e emitir log/métrica de falha. Alteração não feita porque muda contrato público; risco médio. Teste faltante: webhook configurado que responde 500 ou timeout.

### C3-06 - IDs de plano remoto exigidos mesmo no checkout hospedado novo - P2, dívida técnica demonstrável, pendente

- Arquivos/linhas: painel `src/server/services/mercado-pago.ts:29-47,126-139`, `scripts/check-env.mjs`, `src/server/services/billing-settlement.ts:22-32`.
- Fluxo, contrato e pré-condição: novo checkout hospedado usa valor, ciclo e referência local; `buildHostedSubscriptionBody` não envia `preapproval_plan_id`.
- Observado/evidência: `getPlanConfig` exige `MERCADO_PAGO_*_PLAN_ID` e o prebuild também, embora o corpo novo não use o ID. A conciliação de contratos legados ainda precisa dele.
- Causa/impacto: configuração de fluxo legado compartilhada com novo fluxo; falta de ID legado pode bloquear venda nova. Não removido porque contratos legados podem depender dele. Alternativa: separar configuração de plano/preço do requisito legado; risco médio e exige teste de compatibilidade. Estado pendente; revalidar com contratos novos e legados em testes isolados.

### C3-07 - E2E do painel reutilizava servidor existente - P2, risco de teste, corrigido localmente

- Arquivo/linha: `playwright.config.ts:21`.
- Fluxo, contrato e pré-condição: executar smoke local sem apontar acidentalmente para um servidor aberto com configuração diferente.
- Observado/evidência: `reuseExistingServer: true` permitia essa reutilização; o incidente anterior da landing demonstrou o risco da mesma classe, não uma falha reproduzida especificamente no smoke do painel.
- Correção/alternativa/risco: `false`, sem alterar ambiente de produção. Se a porta estiver ocupada, a suíte agora falha explicitamente; risco baixo. Revalidação: smoke local executado nesta auditoria (resultado registrado abaixo).

### C3-08 - Documento de arquitetura divergia do checkout e do SMS atuais - P3, dívida de documentação, corrigida localmente

- Arquivo: `docs/ARCHITECTURE.md`, seções Limites e assinaturas / Comunicação.
- Observado/evidência: descrevia uso obrigatório de plano remoto no checkout novo e SMS reservado ao Empresa, mas o corpo hospedado não usa esse ID e `sms` é `false` em todos os planos.
- Impacto/correção/risco: induzia manutenção e oferta incorretas; texto ajustado ao código atual, sem mudança de comportamento. Risco baixo. Revalidação: comparação com `buildHostedSubscriptionBody` e `SUBSCRIPTION_PLANS`.

## Verificações e limites

- Painel: `pnpm lint` passou; `pnpm typecheck` passou; a suíte completa após as correções passou com 81 arquivos e 372 testes. O teste direcionado de URL pública passou após o último ajuste de validação. `pnpm build` foi repetido na versão final e passou. Smoke E2E 14/14 passou com um servidor próprio, incluindo desktop e mobile, apenas rotas públicas/sem login. Surgiu aviso do React sobre `<script>` na renderização de páginas 404; não foi localizado impacto funcional, mas merece inspeção em revisão posterior.
- Landing: 53/53 testes unitários passaram; `astro check` reportou 0 erros, 0 warnings e 2 hints de imports no checkout; build passou; Playwright 20/20 passou com destino `.test` e API de pagamento interceptada. Isso **não** prova fluxo financeiro real.
- Nenhum lint formal existe nos scripts da landing; o `format:check` global já encontrava formatação pré-existente em muitos arquivos na auditoria anterior e não foi usado como critério de bug.
- Não foram feitas mutações de banco nesta auditoria de código. Builds e testes usaram configuração local; nenhum deploy, e-mail, mensagem, transação ou cobrança foram acionados.

## Backlog por risco/custo-benefício

1. P1: distinguir rejeição remota definitiva de timeout ambíguo no checkout sem perder idempotência; teste sandbox com banco isolado.
2. P1: jornada integrada em ambiente de teste para pagamento -> webhook -> acesso e agendamento -> notificação; conferir persistência e recuperação de falhas.
3. P2: decidir o destino dos endpoints auxiliares de leads; corrigir durabilidade e semântica de `delivered`, ou descontinuar se não houver uso.
4. P2: separar configuração de planos legados do checkout hospedado novo; adicionar teste contratual entre preços da landing e do painel.
5. P2: automatizar smoke autenticado por papel, concorrência de agendamento e caso de sessão expirada sem atingir dados de produção.
6. P3: revisar módulos não cobertos por esta amostra, inclusive financeiro, relatórios, mídia, migrações e dependências transitivas.

Critério metodológico: [Google - What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html) para distinguir funcionalidade/complexidade de preferência de estilo; [Playwright - Best Practices](https://playwright.dev/docs/best-practices) para isolamento, comportamento observável e testes que detectem regressão. Aprovação de qualidade dependerá dos portões ainda abertos, não apenas de testes verdes.
