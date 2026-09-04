# Correções da auditoria de pagamentos — 04/09/2026

## Regras aprovadas

- Bloquear downgrade enquanto existirem profissionais ou unidades excedentes. Não apagar dados ou cancelar agendamentos automaticamente.
- Após vencimento, bloquear análises premium. Preservar consulta básica e gestão da assinatura.
- Estorno total remove somente a cobertura vinculada ao pagamento estornado; outro pagamento válido mantém o acesso.

## Implementação

- Autorização recorrente não ativa plano, não marca pagamento e não inventa validade.
- Faturas são verificadas pela API de pagamentos: assinatura, referência, moeda, valor e aprovação.
- `BillingContract` preserva plano, ciclo, valor, moeda, plano remoto e chave de tentativa. Tabela protegida por RLS e sem acesso via papéis públicos.
- `PaymentHistory` registra fatura e fim do período pago. Reentregas não estendem a validade. O calendário limita corretamente aniversários no fim do mês e em anos bissextos.
- Liquidação compartilhada entre webhook e conciliação. Atualizações serializadas por loja. Notificações de contratos antigos não substituem o contrato atual.
- Checkout não cria nova autorização se o cancelamento anterior falhar. Tentativas ambíguas mantêm chave e plano; tentativas antigas exigem conciliação manual antes de nova autorização.
- Limites conferidos no checkout e novamente ao ativar o plano. Criação/reativação de profissionais respeita também o plano pendente sob o mesmo bloqueio transacional.
- Filiais não contratam assinatura independente; criar filial exige administração do titular. Unidades sem direito Empresa não ficam ativas só porque conservaram um status antigo.
- Cancelamento preserva a validade já registrada e relê o estado após a resposta remota, evitando sobrescrever um pagamento concorrente.
- Eventos de atualização de pagamento também conciliam estornos. Conciliação periódica consulta faturas, usa paginação com cursor persistido e rodízio, e sinaliza falhas com HTTP 503.
- Financeiro/relatórios exigem plano e vigência. API de métricas não entrega valores financeiros a recepcionistas nem a planos sem financeiro/vencidos.
- Dispatcher revalida vigência, situação da loja e direito de SMS antes do envio.
- Página pública passou a carregar a data de vencimento; antes, a consulta a omitia, bloqueando erroneamente assinaturas pagas.

## Operação e limites

- Validação: 319 testes em 70 arquivos aprovados com dois processos de teste; lint e TypeScript aprovados. Duas falhas de timeout na rodada de maior paralelismo não se repetiram na rodada completa com menor concorrência.

- A consulta somente leitura ao banco configurado encontrou zero pagamentos e zero assinaturas vinculadas ao Mercado Pago. Não houve cobrança, estorno ou cancelamento real durante estes testes.
- Migração exclusivamente aditiva, compatível com o código anterior. Não preenche nem modifica assinaturas existentes. Contratos legados, quando existirem, são adotados somente por vínculo exato e validação remota; divergências exigem revisão manual.
- A conciliação diária é uma recuperação de falhas, não substitui webhooks. Habilitar notificações de assinaturas, cobranças autorizadas e pagamentos no Mercado Pago permite detectar mudanças prontamente. Cursor/rodízio limita o trabalho por execução; acompanhar `failed` e `remainingInBatch` conforme o volume crescer.
- Uma tentativa de checkout sem confirmação por mais de 24 horas exige suporte: conferir o provedor antes de liberar outra chave. Não limpar o estado às cegas, pois pode existir autorização remota.
- Recursos excedentes devem ser ajustados antes da troca. Se a assinatura já venceu ou existirem agendamentos futuros que impeçam a desativação, tratar o ajuste com suporte; não remover registros automaticamente.
- Testes automatizados usam serviços externos simulados. Build e testes não comprovam entrega de webhook ou aprovação de cartão real. A primeira compra controlada ainda deve ser acompanhada no Mercado Pago, no histórico local e nos logs.
