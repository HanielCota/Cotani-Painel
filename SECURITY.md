# Política de segurança

## Como reportar uma vulnerabilidade

**Não abra issue pública.** Envie os detalhes para **contato@cotani.com.br**
com o assunto `[SEGURANÇA]`, incluindo:

- o que foi encontrado e onde (URL, rota ou arquivo);
- passos para reproduzir;
- impacto esperado (dados expostos, acesso indevido, cobrança etc.).

Respondemos em até 3 dias úteis e combinamos o prazo de correção conforme a
gravidade. Pedimos que a divulgação aguarde a correção.

## Escopo

- Painel: `painel.cotani.com.br` e este repositório.
- Fora do escopo: testes de carga/negação de serviço, engenharia social e
  ataques a contas de terceiros. Não acesse, altere nem apague dados que não
  sejam seus.

## Práticas do projeto

- Segredos ficam somente nas variáveis de ambiente da Vercel/Supabase; nunca
  no repositório (apenas `.env.example`, com valores fictícios).
- O CI bloqueia vulnerabilidades altas/críticas em dependências de produção
  (`pnpm audit --prod`) e o Dependabot propõe atualizações semanais.
- Mudanças em autenticação, cobrança, banco e infraestrutura passam por
  revisão do responsável (`.github/CODEOWNERS`).
