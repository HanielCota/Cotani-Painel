# Checklist de produção

O deploy na Vercel deve ser feito somente depois que os itens abaixo estiverem concluídos.

## 1. Supabase Database

- Confirme que o projeto está na região desejada.
- Em **Connect**, copie a URI do pooler de transações (porta 6543) para `SUPABASE_DATABASE_URL` e acrescente `pgbouncer=true&uselibpqcompat=true&sslmode=require` aos parâmetros da URL.
- Copie a URI do pooler de sessão (porta 5432) para `SUPABASE_DIRECT_URL` e acrescente `uselibpqcompat=true&sslmode=require` aos parâmetros da URL.
- Substitua `[YOUR-PASSWORD]` pela senha do banco com URL encoding quando necessário.
- Aplique o schema: `pnpm prisma migrate deploy`.
- Confirme que todas as tabelas públicas estão com RLS habilitado. Não crie políticas públicas para as tabelas da aplicação.

O Prisma usa `SUPABASE_DATABASE_URL` no runtime e `SUPABASE_DIRECT_URL` para migrations. `DATABASE_URL`, quando presente localmente, é apenas a origem histórica do script de migração e não deve ser adicionada à Vercel.

## 2. Supabase Auth

Em **Authentication → URL Configuration**:

- Site URL: `https://painel.cotani.com.br`
- Redirect URL: `https://painel.cotani.com.br/**`

Em **Authentication → Providers → Google**:

- Habilite Google.
- Informe o Client ID e Client Secret do Google Cloud.
- No Google Cloud, autorize a callback fornecida pelo Supabase: `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
- Adicione `https://painel.cotani.com.br` às origens JavaScript autorizadas, se solicitado pelo Google.

Configure SMTP próprio em **Authentication → Emails/SMTP** para confirmação de cadastro, recuperação e convite. Personalize os templates e teste cada fluxo. A URL da aplicação para callback é `/auth/callback`; convites terminam em `/update-password`.

Em **Authentication → Security/Attack Protection**:

- mantenha confirmação de e-mail obrigatória e senha mínima de 8 caracteres;
- use OTP de 6 dígitos com expiração de 1 hora;
- habilite proteção contra senhas vazadas;
- habilite CAPTCHA em cadastro, login e recuperação antes de abrir inscrições públicas;
- defina tempo máximo e inatividade das sessões conforme a política comercial.

Depois que o primeiro administrador entrar, copie seu UUID em **Authentication → Users** para `PLATFORM_ADMIN_USER_IDS`. Use vírgulas para mais de um administrador global.

## 3. Mercado Pago

- Use o Access Token de produção da aplicação correta.
- Execute `pnpm mercado-pago:plans` com a URL final e o token de produção.
- Cadastre na Vercel os quatro IDs impressos pelo script: Essencial mensal/anual e Profissional mensal/anual.
- O plano Empresa permanece como contratação comercial, sem ID automático.
- Em **Webhooks**, use `https://painel.cotani.com.br/api/webhooks/mercado-pago`.
- Marque eventos de planos/assinaturas e pagamentos relacionados a assinaturas.
- Copie a assinatura secreta para `MERCADO_PAGO_WEBHOOK_SECRET`.
- Faça uma compra real controlada, valide ativação e depois valide cancelamento/atraso.

## 4. Resend e DNS

- Mantenha o domínio `cotani.com.br` como Verified.
- Configure `RESEND_API_KEY` e um remetente autorizado em `EMAIL_FROM`, por exemplo `Cotani <agendamentos@cotani.com.br>`.
- Envie um e-mail real e confira autenticação SPF/DKIM/DMARC nos cabeçalhos.

O Resend atende às mensagens operacionais da aplicação. Os e-mails de autenticação do Supabase usam o SMTP configurado no próprio Supabase; podem usar as credenciais SMTP do Resend, mas essa configuração é feita no painel do Supabase.

## 5. Variáveis na Vercel

Cadastre em **Project → Settings → Environment Variables**, no ambiente Production:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
SUPABASE_DATABASE_URL
SUPABASE_DIRECT_URL
DATABASE_POOL_MAX=3
PLATFORM_ADMIN_USER_IDS
CRON_SECRET
NEXT_PUBLIC_APP_URL=https://painel.cotani.com.br
MERCADO_PAGO_ACCESS_TOKEN
MERCADO_PAGO_WEBHOOK_SECRET
MERCADO_PAGO_ESSENTIAL_MONTHLY_PLAN_ID
MERCADO_PAGO_ESSENTIAL_ANNUAL_PLAN_ID
MERCADO_PAGO_PROFESSIONAL_MONTHLY_PLAN_ID
MERCADO_PAGO_PROFESSIONAL_ANNUAL_PLAN_ID
SUBSCRIPTION_GRACE_PERIOD_DAYS=3
RESEND_API_KEY
EMAIL_FROM
WHATSAPP_SENDER_MODE=manual
```

Não use valores de teste em Production. Não exponha `SUPABASE_SECRET_KEY`, strings do banco, Access Token do Mercado Pago ou segredos de webhook em variáveis `NEXT_PUBLIC_*`.

`CRON_SECRET` deve ser um segredo aleatório forte. A Vercel o envia como Bearer token aos jobs descritos em `vercel.json`.

As credenciais `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_SMS_FROM` são opcionais no lançamento e devem ser configuradas juntas antes de ativar SMS no plano Empresa. No modo manual de WhatsApp, não configure as variáveis `META_WHATSAPP_*`.

## 6. Validação antes do deploy

```bash
pnpm check
pnpm build
```

Confirme também:

- migrations aplicadas sem drift;
- `git status` contém somente mudanças esperadas;
- `.env.local` não está versionado;
- nenhum segredo aparece em logs, commits ou screenshots;
- DNS de `painel.cotani.com.br` aponta para a Vercel em modo DNS only, quando exigido pelo provedor.
- os cinco CNAMEs antigos de autenticação (`clerk`, `accounts`, `clkmail`, `clk._domainkey` e `clk2._domainkey` sob `painel`) foram removidos do DNS após validar o Supabase em produção.

## 7. Testes depois do deploy

1. Criar conta por e-mail, confirmar e fazer login.
2. Recuperar senha.
3. Entrar com Google.
4. Criar a primeira loja e alternar entre duas lojas.
5. Convidar membro, aceitar convite, definir senha e verificar papel.
6. Confirmar que um membro não acessa outra loja alterando URL/cookie.
7. Criar serviços, horários, clientes e agendamentos.
8. Confirmar o limite de profissionais de cada plano.
9. Completar checkout real do Mercado Pago e conferir webhook/idempotência.
10. Executar os jobs de notificações e cobrança com autenticação correta.
11. Enviar e receber e-mails de autenticação e e-mails operacionais.
12. Validar páginas `/admin` somente com UUID autorizado.

Se qualquer item falhar, corrija antes de divulgar a URL ou aceitar pagamentos de clientes.

## 8. Monitoramento

`GET /api/health` responde `200 {"status":"ok"}` quando a aplicação e o banco
estão de pé e `503 {"status":"degraded"}` quando o banco não responde em 3 s.
É público, não usa cache e não expõe detalhes (o erro vai para os logs).

Configure um monitor externo, fora da Vercel e do Supabase (assim ele avisa
mesmo quando os dois caem):

1. Crie um monitor HTTP para `https://painel.cotani.com.br/api/health`
   (UptimeRobot e Better Stack têm planos gratuitos), com intervalo de 5 min.
2. Condição de alerta: status diferente de 200 em 2 checagens seguidas.
3. Envie o alerta para o responsável pela operação (e-mail e celular).
4. Teste o alerta uma vez: aponte o monitor para uma URL inexistente e
   confirme que a notificação chega.

Jobs e webhooks continuam visíveis em `/admin`; o health check cobre a
indisponibilidade geral do painel e do banco.
