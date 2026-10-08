# Acesso e operação do administrador global

## Acesso

O administrador global não tem uma tela de login nem uma senha separadas. Ele entra em `https://painel.cotani.com.br/sign-in` com uma conta do Supabase Auth.

Para abrir `/admin`, a conta precisa atender aos dois requisitos:

1. O UUID da conta deve estar em `PLATFORM_ADMIN_USER_IDS` nas variáveis Production da Vercel.
2. A conta deve ter MFA por aplicativo autenticador cadastrado e concluir o desafio MFA no login.

Se a senha foi esquecida, use **Esqueci minha senha** na tela de login. Se o e-mail não corresponder a uma conta Supabase, o proprietário deve convidar o endereço pelo Supabase Auth, adicionar o UUID retornado à allowlist e fazer um novo deploy. A pessoa cria a senha pelo link enviado por e-mail; não compartilhe senhas por chat.

Não remova UUIDs existentes de `PLATFORM_ADMIN_USER_IDS` ao adicionar outra pessoa. Preserve a lista atual e acrescente o novo UUID.

## Monitoramento no `/admin`

A visão geral reúne métricas das lojas, última execução das tarefas automáticas, falhas de notificações e eventos recentes do webhook Mercado Pago. O painel sinaliza rotinas sem registro ou além do intervalo esperado e mostra o horário da consulta no fuso de São Paulo.

Definição dos indicadores:

- **Lojas** conta cadastros não excluídos. **Operacionais** e **Suspensas** refletem o status cadastrado; não são uma verificação de disponibilidade em tempo real.
- **Clientes** conta todos os registros de clientes no banco.
- **Agendamentos criados** conta registros criados nos últimos 30 dias, pela data de criação.
- **Agendamentos próximos** conta agendamentos pendentes ou confirmados com início nos próximos 30 dias.

Use `/admin/operacoes` para consultar o histórico paginado de rotinas e webhooks e filtrar por tipo, resultado e período (7/30 dias ou todo o histórico retido). Use `/admin/notificacoes` para consultar notificações atualmente marcadas como falha, paginadas por última atualização e filtráveis pelo período. Os destinatários são parcialmente ocultados; esse painel não reenvia notificações.

Os eventos operacionais guardam somente resumo e erro técnico, sem payload de pagamento. A limpeza diária remove esses eventos após 30 dias. O histórico de ações administrativas fica em `/admin/auditoria` e possui retenção própria.

Uma rotina sem execução registrada significa que ainda não houve execução desde a ativação do monitoramento ou que o registro falhou. Verifique também os logs da Vercel e, para o envio de notificações, o histórico de execuções do `pg_cron` no Supabase.
