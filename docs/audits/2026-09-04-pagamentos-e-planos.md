# Auditoria de pagamentos e permissões por plano

Data: 04/09/2026. Código analisado: `dae07af`.

Este documento registra o diagnóstico anterior às correções. A implementação e seus limites estão em `2026-09-04-correcoes-pagamentos.md`.

## Conclusão e limites

O sistema ainda não deve ser considerado validado de ponta a ponta para cobrança e troca de planos. Foram encontrados defeitos de lógica e lacunas de autorização. Esta auditoria não alterou código de execução, assinaturas, pagamentos nem permissões reais. Os cenários abaixo são derivados dos caminhos do código; não significam que clientes já os exploraram em produção.

Escopo: checkout, SDK Mercado Pago, webhook, faturas, conciliação, expiração, cancelamento, catálogo, permissões de páginas/APIs/actions, profissionais, unidades e notificações pendentes. Foram executados os 282 testes existentes, em 67 arquivos: todos passaram. Isso não cobre as lacunas descritas: por exemplo, um teste de webhook espera explicitamente a ativação quando a assinatura é autorizada, sem comprovar pagamento.

Na verificação anterior desta mesma investigação, os quatro planos remotos responderam corretamente com as credenciais locais e as variáveis necessárias estavam presentes na Vercel. Isso não comprova igualdade dos valores dos segredos locais/remotos nem entrega real de webhook. As consultas de logs das últimas 24h não forneceram eventos de pagamento/checkout/conciliação. Não foi realizada compra real ou simulação externa nesta auditoria.

## Achados prioritários

### P1-01 — Autorização da assinatura é confundida com pagamento

- Evidência: `src/server/services/mercado-pago.ts:109` e `:172`; `src/app/api/webhooks/mercado-pago/route.ts:96`; `src/server/services/subscription-reconciliation.ts:33`.
- `authorized` vira ACTIVE e `hasPaidOnce=true`. Webhook e conciliação promovem plano pendente, limpam o checkout e concedem validade sem consultar uma cobrança aprovada.
- Cenário: cliente autoriza recorrência, mas a primeira cobrança ainda não foi concluída ou falha. O plano já pode estar liberado.
- Correção: separar autorização de recorrência e direito de acesso pago. Pagamento aprovado, verificado no provedor e associado à contratação correta, deve determinar período e plano efetivos.

### P1-02 — Validade pode ser prorrogada sem pagamento, inclusive ao cancelar

- Evidência: `src/server/services/mercado-pago.ts:122`; `src/server/actions/subscription.ts:56`; `src/server/services/subscription-reconciliation.ts:34`.
- Se a data fornecida está ausente ou vencida, `subscriptionPeriodEnd` cria um mês/ano a partir de agora. O cancelamento usa essa função mesmo quando ACTIVE está com data vencida e o cron ainda não corrigiu o status.
- Reprodução local com a função extraída do código: referência 04/09/2026 12:00 UTC e vencimento 01/09/2026 resultam em 04/10/2026 no mensal e 04/09/2027 no anual.
- A conciliação diária também pode manter avançando a validade quando o remoto continua autorizado e não fornece próxima data futura.
- Correção: cancelamento nunca aumenta validade; conciliação não fabrica período pago. Persistir períodos de cobranças comprovadas.

### P1-03 — Unidades extras sobrevivem ao downgrade

- Evidência: `src/app/api/subscription/checkout/route.ts:60`; `src/app/api/webhooks/mercado-pago/route.ts:115` e `:179`; `src/server/tenant.ts`; `src/server/actions/clinics.ts:88`.
- A criação de unidade exige Empresa, mas a utilização posterior resolve apenas o vínculo e o estado copiado da unidade. O checkout não verifica unidades vinculadas. Ao ativar plano inferior, o webhook copia ACTIVE e o novo plano para todas as unidades, sem bloquear a operação delas.
- Cenário: uma conta Empresa com filiais deixa o período vencer e contrata Essencial/Profissional. A existência de filiais não impede a contratação e elas podem continuar operando.
- Correção: validar elegibilidade do conjunto de unidades no downgrade e resolver o direito efetivo na unidade principal em cada operação. Preservar dados; não apagar filiais ou agendamentos.

### P1-04 — Limite de profissionais só é conferido antes do pagamento

- Evidência: `src/app/api/subscription/checkout/route.ts:60`; `src/server/actions/professionals.ts:66`, `:80`, `:254`; ativação no webhook e na conciliação.
- O checkout conta profissionais locais, mas a ativação não revalida. Criação/reativação usa o plano lido antes da transação; checkout e profissionais usam travas diferentes e o webhook não participa da mesma trava.
- Cenário condicional: tentativa de downgrade iniciada com poucos profissionais; antes da aprovação, o conjunto muda por operação concorrente iniciada sob o plano anterior. A ativação não reconcilia o excesso. Filiais também não entram na contagem da principal.
- Correção: validar limites sob a mesma coordenação transacional na efetivação do plano e nas alterações de recursos; definir quais profissionais permanecem ativos com escolha do usuário.

### P1-05 — Evento de assinatura antiga pode interferir na assinatura atual

- Evidência: `src/app/api/webhooks/mercado-pago/route.ts:80` e `:137`.
- A busca aceita assinatura OU `externalReference` da loja. Não exige que a assinatura recebida seja a tentativa vigente nem mantém versão da contratação. O histórico de eventos evita repetir o mesmo ID, mas não resolve eventos diferentes de contratos antigos.
- Cenário: assinatura antiga cancelada manda evento após nova assinatura. Se o plano remoto é igual ao atual, o evento pode cancelar/substituir o vínculo atual; se diverge, tende a gerar 500/repetições. Ausência de `planId` também pula a verificação.
- Correção: registro de contratação/tentativa com identidade imutável, vínculo estrito e tratamento de evento obsoleto sem alterar a assinatura corrente.

### P1-06 — Troca de seleção reutiliza chave de checkout incompatível

- Evidência: `src/app/api/subscription/checkout/route.ts:83`, `:103`, `:121`.
- A URL só é reutilizada para o mesmo plano/ciclo, mas a chave é reutilizada dentro de 30 minutos independentemente da seleção. A chamada remota ocorre fora da trava; requisições com seleções diferentes podem compartilhar a chave e gravar o mesmo registro de tentativa.
- Consequência depende da resposta de idempotência do provedor: erro por corpo diferente ou reaproveitamento de contratação anterior. A validação final pela chave não distingue essas seleções.
- Além disso, falha ao cancelar assinatura anterior só gera aviso e não impede nova contratação; pode haver duas recorrências remotas ainda utilizáveis. Não foi reproduzida cobrança dupla real.
- Correção: chave por contratação e conteúdo imutável; máquina de estados da tentativa; resolver cancelamento pendente antes de criar recorrência substituta.

### P1-07 — Reembolso/contestação não recalcula acesso; reconciliação não recupera faturas

- Evidência: `src/app/api/webhooks/mercado-pago/route.ts:158`, `:161`, `:195`; `src/server/services/subscription-reconciliation.ts:27`.
- Fatura não aprovada atualiza histórico, mas não recalcula o período pago. Outros tipos de evento são registrados e ignorados. O cron consulta apenas a assinatura, não as faturas/pagamentos: webhook perdido deixa histórico incompleto e não é recuperado pela conciliação atual.
- Cenário: pagamento antes aprovado é estornado/contestado e deixa de sustentar o acesso; não há política aplicada. Cobrança recusada também não impede a prorrogação indevida do P1-02.
- Correção: reconciliação de pagamentos e períodos, com política explícita para reembolso parcial/total, contestação e carência. Não revogar acesso arbitrariamente se outro pagamento válido ainda cobre o período.

### P1-08 — Recursos premium consultáveis após vencimento

- Evidência: `src/app/(dashboard)/layout.tsx:105`; `src/app/(dashboard)/dashboard/financeiro/page.tsx:28`; `src/app/(dashboard)/dashboard/relatorios/page.tsx:20`; `src/server/with-tenant.tsx:18`.
- Layout permite que quem já pagou uma vez entre no painel vencido; isso pode ser intencional para histórico. Porém Financeiro e Relatórios só verificam o nome do plano, não a vigência. Continuam calculando análises premium para plano antigo vencido.
- Ao trocar efetivamente PROFESSIONAL para ESSENTIAL no banco, essas duas páginas bloqueiam corretamente pelo plano novo. Portanto o defeito aqui é vigência, não persistência de todos os privilégios após qualquer downgrade.
- Correção: separar leitura de dados próprios da execução de recursos pagos; aplicar uma regra central de recurso + vigência + papel.

### P1-09 — Resumos financeiros estão acessíveis à recepção

- Evidência: `src/app/api/metrics/route.ts`; `src/server/services/metrics.ts`.
- A API permite ADMIN e RECEPTIONIST e devolve `estimatedRevenueToday`, `completedRevenueThisMonth` e `completedRevenuePreviousMonth`, sem condicionar plano nem remover campos por papel.
- Esconder Financeiro da sidebar não impede ler esses resumos pela API. É uma exposição de dados financeiros dentro da própria loja, não entre lojas.
- Correção: resposta filtrada por papel; confirmar se resumos gerais devem estar disponíveis no Essencial, sem confundir com o módulo financeiro completo.

### P2-10 — Notificações premium já agendadas continuam após downgrade

- Evidência: `src/server/services/notifications.ts`; `src/app/api/jobs/notifications/route.ts:121`.
- Canais são escolhidos no agendamento. O dispatcher envia a fila sem revalidar plano atual, assinatura, estado da loja ou elegibilidade do canal.
- Cenário: SMS agendado no Empresa permanece enviável depois da troca para plano sem SMS. Depende do provedor estar configurado; mesmo sem Twilio agora, a lacuna existe no código.
- Correção: revalidar antes do envio e definir política de lembretes de atendimentos já contratados, sem apagar histórico.

### P2-11 — Valores históricos dependem do catálogo de preços atual

- Evidência: `src/app/api/webhooks/mercado-pago/route.ts:139`; `prisma/schema.prisma:76` e `:140`.
- O webhook compara o valor recebido ao catálogo atual, usando o plano pendente/atual da loja. Não há registro imutável de preço/moeda/período contratado por assinatura antes da cobrança.
- Cenário: alteração legítima de preço ou chegada tardia de fatura de contrato anterior gera divergência e 500. A consulta de fatura também não retorna moeda para validação.
- Correção: snapshot contratual versionado, vinculado ao ID da assinatura; conferir valor/moeda ao contrato daquele pagamento, não à seleção atual.

### P2-12 — Datas de fim de mês e sinalização do cron

- Evidência: `src/server/services/mercado-pago.ts:126`; `src/server/services/subscription-reconciliation.ts:26`; `src/app/api/jobs/billing/reconcile-subscriptions/route.ts:11`.
- Reprodução da função atual: 31/01/2027 + um mês retorna 03/03/2027. O cálculo não limita ao último dia de fevereiro; ano bissexto também requer política explícita.
- O cron acumula falhas e retorna HTTP 200 mesmo se todas as assinaturas falharem. Sem inspeção do corpo/logs, a execução parece bem-sucedida. Consulta e processamento são de todas as assinaturas, sequencialmente; risco de duração cresce com a base, não comprovado como incidente atual.
- Correção: datas de período contratual confiáveis, cálculo calendário explícito, lotes paginados e sinalização/alerta para falhas parciais e totais.

## Proteções existentes que devem ser preservadas

- Checkout exclusivo de ADMIN, plano/ciclo validados no servidor e e-mail vindo da identidade autenticada.
- Nova contratação paga é bloqueada enquanto a assinatura paga está ativa. Não há troca imediata completa/pró-rata; isso é comportamento atual, não uma promessa implementada.
- Profissionais acima do limite impedem iniciar checkout inferior no caso sequencial normal; criação e reativação também verificam limite.
- Exportação CSV exige ADMIN, assinatura ativa e Empresa.
- Financeiro/Relatórios exigem ADMIN e consultam o plano atual no servidor.
- Webhook usa validador de assinatura e consulta o recurso remoto; eventos repetidos têm deduplicação e gravação transacional.
- Operações comuns e agenda pública verificam vigência, sem depender somente da execução do cron.
- Cancelamento de filial exige ADMIN da principal; a contratação pela filial ainda não tem resolução equivalente de cobrança.
- Tenant é memoizado por requisição, não um cache global de permissões. O problema principal não é um token antigo de login guardar o plano.

## Ordem proposta e critérios de aceite

1. Criar separação entre contrato, tentativa de checkout, cobrança e período de acesso. Corrigir P1-01/P1-02/P1-05/P1-07.
2. Resolver unidade pagadora, revalidar plano/limites na efetivação e tratar recursos excedentes sem exclusão. Corrigir P1-03/P1-04.
3. Corrigir concorrência e idempotência do checkout, preservando assinatura anterior em falhas controladas. Corrigir P1-06.
4. Centralizar permissões vigentes em páginas, APIs, ações e dispatcher. Corrigir P1-08/P1-09/P2-10.
5. Snapshot de preço e moeda, datas, reconciliação paginada e observabilidade. Corrigir P2-11/P2-12.

Matriz mínima de regressão a adicionar: autorização sem pagamento; primeira cobrança recusada; aprovação posterior; renovação falha; fatura duplicada; evento antigo após troca; estorno total/parcial; assinatura cancelada com saldo de período; cancelamento após vencimento; downgrade com profissionais e filiais; operação concorrente durante downgrade; duas abas com planos/ciclos diferentes; falha ao cancelar assinatura anterior; SMS em fila após downgrade; acesso direto às APIs por recepção; vigência no limite exato; janeiro com 31 dias; ano bissexto; webhook ausente recuperado pelo cron; falha parcial/total do cron.

Políticas que precisam ficar explícitas antes da implementação: acesso somente ao histórico após vencimento; instante efetivo do downgrade; seleção de profissionais/unidades preservados; destino de agendamentos futuros nas unidades bloqueadas; carência de uso (o código hoje bloqueia PAST_DUE, apesar de manter janela antes de INACTIVE); estorno parcial; atendimento dos contratos Empresa comerciais.

## Referências externas

- [Glossário Mercado Pago: assinatura é autorização para recorrência](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/resources/glossary).
- [Assinaturas, faturas e pagamentos: recursos distintos](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/overview).

Nenhum achado foi corrigido neste relatório. Próxima etapa: implementação autorizada com testes dos cenários acima; depois validar o fluxo externo nas contas de teste autorizadas, sem cobranças reais não aprovadas pelo usuário.
