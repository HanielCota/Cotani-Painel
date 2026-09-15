# Auditoria de segurança — checkout integrado

Data: 14/09/2026

Escopo: `Cotani-Painel`, `Cotani-Landingpage`, configurações visíveis do
Supabase e rotas públicas dos domínios Cotani. Os testes foram controlados, sem
pagamento, sem carga agressiva e sem tentativa de acessar dados de terceiros.

## Resultado executivo

Não foi encontrada uma forma de liberar assinatura sem confirmação do Mercado
Pago, atravessar o isolamento entre empresas ou acessar as APIs privadas sem
sessão. As vulnerabilidades conhecidas nas dependências foram corrigidas e o
checkout legado da landing foi removido.

As correções foram publicadas nos domínios oficiais e passaram pela validação
pós-deploy descrita ao final deste relatório.

## Achados corrigidos

### Alto — dependências vulneráveis

- Landing: Astro, Sharp, js-yaml e SVGO tinham avisos de severidade alta ou
  crítica. As versões foram atualizadas e `npm audit --omit=dev` passou sem
  vulnerabilidades conhecidas.
- Painel: a versão transitiva do Sharp estava vulnerável. O override foi movido
  para `pnpm-workspace.yaml`, atualizado para 0.35.4, e `pnpm audit --prod`
  passou sem vulnerabilidades conhecidas.

### Alto — cobrança legada exposta na landing

A produção ainda respondia em rotas antigas de pagamento, preferência, status,
lembrete e webhook. Esse código usava persistência local e não fazia parte do
fluxo centralizado. As rotas, controladores, serviços, magic link legado e
dependências privadas foram removidos da landing.

### Médio — API pública aceitava requisição sem Origin

O checkout e a consulta de status agora exigem uma origem explicitamente
autorizada. Isso reduz abuso acidental e requisições diretas simples. Não
substitui proteção contra bots, pois um cliente automatizado pode falsificar o
header.

### Baixo — telefone aceitava texto arbitrário

O schema agora aceita somente caracteres de telefone e exige de 10 a 13
dígitos.

### Baixo — redirecionamento confiava integralmente na URL do provedor

O painel e a landing agora aceitam o destino do checkout somente quando ele usa
HTTPS e pertence a um domínio oficial do Mercado Pago. Sufixos maliciosos e
esquemas executáveis são rejeitados.

### Alto — CSP da landing bloquearia o painel e mantinha hosts legados

O `connect-src` foi ajustado para autorizar somente a própria landing e
`https://painel.cotani.com.br`. SDK, API, imagens e frames do Mercado Pago foram
retirados da landing porque o checkout agora é hospedado fora dela.

## Controles validados

- APIs privadas e jobs retornam 401 sem autenticação.
- CORS rejeita origem maliciosa, origem `null` e ausência de origem.
- Corpo acima de 16 KiB retorna 413; JSON inválido retorna 400.
- IDs inválidos não chegam ao banco; UUID inexistente retorna 404.
- Criação de checkout tem limites por IP e por e-mail.
- Assinatura do webhook é validada e o estado é confirmado diretamente com o
  Mercado Pago antes da ativação.
- Idempotência impede duplicar assinatura em repetição ou timeout ambíguo.
- Consultas sensíveis aplicam `clinicId`; o cookie de empresa ativa é
  reconfirmado contra a associação do usuário.
- Administração exige allowlist por UUID e MFA TOTP em nível AAL2.
- Supabase tem RLS e grants públicos revogados nas tabelas de aplicação.
- Redirects de autenticação usam lista exata, sem curingas.
- Arquivos `.env` estão ignorados nos dois repositórios e não foram encontrados
  tokens reais nos arquivos rastreados pela busca automatizada.

## Riscos residuais

### Médio — ausência de proteção dedicada contra bots

O rate limit reduz volume, mas não impede automação distribuída. Antes de uma
campanha pública de grande alcance, integrar Cloudflare Turnstile ou mecanismo
equivalente no checkout e no cadastro.

### Médio — retenção de tentativas abandonadas

Nome, e-mail, telefone e empresa são persistidos antes do redirecionamento. Uma
rotina futura deve anonimizar ou excluir tentativas nunca pagas após um prazo
definido, preservando somente o necessário para auditoria financeira.

### Médio — proteção contra senhas vazadas desativada no Supabase

Ativar a opção de senhas comprometidas quando o plano do Supabase permitir.
CAPTCHA do Supabase também está desativado.

### Baixo — sessões sem tempo máximo global

O access token expira em uma hora e refresh-token replay protection está ativa,
mas o projeto não força encerramento por tempo total ou inatividade. Essa
política depende do plano do Supabase.

### Baixo — CSP permite `unsafe-inline`

Não foi demonstrado XSS e os usos de `innerHTML` revisados recebem conteúdo
estático, mas a política perde parte da defesa em profundidade. Migrar scripts e
estilos para nonce/hash em uma etapa separada.

## Evidências de validação

- Painel: lint, TypeScript e 349 testes aprovados; build de produção aprovado.
- Landing: checagem Astro sem erros, testes unitários aprovados, 15 testes de
  navegador aprovados e build de produção aprovado.
- Auditoria de dependências de produção: zero vulnerabilidades conhecidas nos
  dois projetos.
- Pós-deploy: `painel.cotani.com.br` e `cotani.com.br` servindo as versões
  novas; CORS, autenticação, CSP e remoção das rotas legadas confirmados nos
  domínios oficiais.
