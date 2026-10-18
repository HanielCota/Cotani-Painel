# Auditoria de segurança - Cotani

Data: 03/10/2026. Escopo: código local do painel e da landing, testes automatizados e auditoria de dependências. Esta revisão é **parcial**: não houve teste de invasão em produção, compra, leitura de dados de terceiros nem inspeção completa das configurações externas de Supabase, Vercel e Mercado Pago. Não constitui certificação OWASP.

## Decisão executiva

**Não comprovado para aprovação sem ressalvas.** Foram confirmadas duas falhas de aplicação, corrigidas apenas no código local. O painel também tinha dependências com alertas conhecidos e foi atualizado localmente. As rotas legadas de captação foram removidas do código local após autorização do responsável. A landing ainda depende de `http-cache-semantics@4.2.0`, para o qual o aviso publicado não aponta uma versão corrigida. Nenhuma destas alterações foi publicada nesta auditoria.

O controle de pagamento analisado não libera acesso com assinatura apenas pendente: a conciliação verifica assinatura e fatura no Mercado Pago, valor, moeda e vínculo com a loja; somente um pagamento aprovado gera cobertura. Isso é análise de código e testes, não prova de uma compra aprovada nesta execução.

## Ativos e limites de confiança

Ativos: identidade Supabase, dados de clientes e agendamentos por loja, assinaturas e faturas, credenciais de provedores, trilha administrativa e endpoints de exportação. Atores: visitante, cliente que agenda, profissional, recepcionista, administrador de loja e administrador global. Fronteiras principais: navegador/landing -> API do painel -> PostgreSQL/Supabase; Mercado Pago -> webhook -> conciliação; jobs Vercel -> rotas com `CRON_SECRET`; administrador da unidade principal -> unidades secundárias.

| Recurso | Entrada e ator | Controle esperado | Observado nesta revisão | Validação |
| --- | --- | --- | --- | --- |
| Checkout público | Landing, visitante | Origem, validação, limites, estado pendente | CORS de origem exata, schema, limite no banco, chave de idempotência; assinatura pendente não ativa acesso | Código e testes existentes |
| Webhook Mercado Pago | Provedor | Assinatura e consulta remota antes de alterar acesso | Assinatura exigida fora de desenvolvimento; conciliação reconfirma contrato/fatura | Código e testes existentes |
| APIs privadas | Usuário autenticado | Sessão, papel e loja ativa | `getApiTenant` valida associação no banco; amostra de rotas consultadas usa `clinicId` | Código; sem teste entre duas contas reais |
| Administração global | Usuário allowlist | UUID autorizado e MFA AAL2 | Guarda nega por padrão e exige TOTP verificado/AAL2 | Código e testes existentes |
| Relatórios e exportações | Membro de loja | Acesso somente a unidades autorizadas | Falha confirmada e corrigida localmente | Revisão de fluxo e 4 novos testes |
| Callback de autenticação | Usuário autenticando | Destino interno | Falha confirmada e corrigida localmente | URL reproduzida localmente e teste de regressão |
| Cadastro/lead legado da landing | Visitante | Tamanho e volume limitados, retenção adequada | Corpo sem limite explícito e rate limit em memória; rotas sem uso encontrado na interface | Código; impacto em produção não validado |
| Infraestrutura/segredos | Operador | Segredos privados, RLS e políticas externas | `.env` rastreado apenas como exemplo; busca pontual não encontrou padrões de token em arquivos rastreados | Parcial; sem inspeção externa completa |

## Achados

### SEC-01 - Relatórios de unidades sem verificação de acesso à unidade principal

- Severidade: **alta**. Confiança: **confirmada por fluxo de código e testes locais**. Categoria: autorização horizontal entre unidades.
- Entrada: página `/dashboard/relatorios` e APIs `/api/reports/export` e `/api/reports/pdf`.
- Pré-condições: assinatura Empresa com unidade secundária e usuário com acesso a essa unidade, mas sem papel de administrador na unidade principal.
- Controle esperado: uma unidade só pode incluir nos relatórios outras unidades se o usuário tiver autorização gerencial na unidade principal.
- Comportamento observado: as três entradas exigiam papel `ADMIN` na loja selecionada, mas consultavam todas as lojas com o mesmo `billingOwnerId` sem verificar associação à unidade principal. Assim, o administrador de uma unidade secundária podia obter dados de unidades às quais não tinha acesso.
- Impacto: exposição de nomes de clientes, serviços, horários e indicadores de outras unidades da mesma assinatura.
- Causa: confusão entre compartilhar a cobrança e compartilhar autorização de dados.
- Correção local: `getAuthorizedReportClinicIds` limita a loja selecionada por padrão e só consolida unidades para `ADMIN` da unidade principal (inclusive quando ele está navegando a partir de uma unidade secundária). Página, CSV e PDF usam a mesma função.
- Revalidação: quatro testes cobrem administrador secundário sem acesso à principal, não administrador, administrador principal e administrador secundário que também administra a principal.
- Estado: **corrigido localmente, não publicado**. Risco residual: outras telas de agregação entre unidades devem ser revisadas se forem acrescentadas.

### SEC-02 - Redirecionamento externo no callback de autenticação

- Severidade: **média**. Confiança: **confirmada localmente**. Categoria: open redirect.
- Entrada: `/auth/callback?next=...` após autenticação Supabase bem-sucedida.
- Pré-condições: vítima abre um link preparado com `next` iniciando por barra seguida de contrabarra.
- Controle esperado: redirecionar apenas dentro do painel.
- Comportamento observado: a verificação antiga recusava `//`, mas aceitava `/\\` e o construtor `URL` interpretava esse valor como domínio externo.
- Impacto: phishing apoiado por um link legítimo de autenticação; não foi demonstrado vazamento automático de sessão.
- Correção local: rejeitar contrabarras e comparar a origem da URL resolvida com a origem do painel. Teste de regressão inclui `//`, barra/contrabarra e URL absoluta.
- Estado: **corrigido localmente, não publicado**. Risco residual: outros destinos de retorno devem continuar usando uma regra equivalente.

### SEC-03 - Dependências do painel com avisos de segurança

- Severidade: **alta para gestão de dependências; explorabilidade deste produto não demonstrada**. Confiança: **confirmada no lockfile e no aviso**.
- Antes: `next@16.3.5` e `fast-uri@3.1.6` apareciam em `pnpm audit --prod`, incluindo alerta crítico de `next/og ImageResponse` e avisos de `fast-uri`.
- Contexto: não foi encontrado uso de `next/og`/`ImageResponse` recebendo SVG controlado por visitante, condição específica descrita no [aviso do Next.js](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j). Isso reduz a probabilidade da exploração descrita, mas não justifica manter a versão vulnerável.
- Correção local: `next@16.3.6` e override `fast-uri@3.1.8`; `pnpm audit --prod` agora informa zero avisos conhecidos.
- Estado: **corrigido localmente, não publicado**. Risco residual: novos avisos podem surgir; reexecutar auditoria antes do deploy.

### SEC-04 - Dependência de cache na landing sem correção publicada

- Severidade do aviso: **alta**; severidade específica para a Cotani: **não validada**. Confiança: **confirmada como dependência**, não como exploração.
- `npm audit --omit=dev` ainda aponta `http-cache-semantics@4.2.0`, transitiva do Astro. O [aviso](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) descreve divulgação entre usuários em cache compartilhado via `max-stale` e, na data desta revisão, não apresenta versão corrigida.
- A landing serve majoritariamente conteúdo público, e não foi demonstrado cache compartilhado de respostas privadas. Não usar `npm audit fix --force`: a sugestão instala Astro 2, incompatível com a aplicação atual.
- Correção parcial local: o lockfile foi atualizado para versões não afetadas de `devalue` e `undici`; build e testes passaram. Ação pendente: acompanhar correção oficial, confirmar configuração efetiva de cache para rotas dinâmicas e manter respostas com dados privados fora de caches compartilhados.
- Estado: **pendente, não demonstrado como explorável na implantação atual**.

### SEC-05 - Rotas legadas de captação com limites frágeis

- Severidade: **média**. Confiança: **controle ausente confirmado no código; abuso real não validado**.
- Entradas: `/api/signup` e `/api/checkout/lead` na landing. Nenhuma chamada a elas foi encontrada na interface atual. O histórico Git mostra `/api/signup` usado pelos componentes antigos `Signup.astro` e `ExitIntent.astro`; `/api/checkout/lead` era chamado por `maybeCaptureLead()` no checkout antigo, removido da interface ao centralizar o pagamento no painel em 14/09/2026.
- Observado: `request.json()`/`request.text()` sem limite explícito de corpo; rate limit apenas em memória da instância e dependente de cabeçalho de IP. `/api/signup` grava e-mails em arquivo local, mecanismo não durável no ambiente serverless. O build incluiu `/api/signup` como rota estática, o que também exige verificar o comportamento real do POST antes de considerá-la funcional.
- Impacto possível: abuso de memória/volume, spam do webhook configurado e retenção inconsistente de dados pessoais.
- Correção local: após confirmação do responsável, foram removidas ambas as rotas, testes exclusivos, armazenamento local e auxiliares não utilizados. O arquivo local ignorado `data/signups.json` foi preservado para não apagar possíveis dados.
- A Vercel da landing lista somente `PUBLIC_PANEL_URL`; `SIGNUPS_WEBHOOK_URL` não está configurada. Ambas as URLs ainda respondem em produção por GET (200 e 405, respectivamente). A consulta de logs disponível não retornou registros nem para requisições gerais recentes, portanto não prova ausência de chamadas externas.
- Estado: **corrigido localmente, não publicado**. O build Astro não gera mais `/api/signup` nem `/api/checkout/lead`. Requisições externas antigas passarão a receber 404 após o deploy; a consulta de logs disponível não permitiu provar ausência absoluta de consumidores externos.

## Cobertura e limites

Base de organização: [OWASP ASVS 5.0.0](https://owasp.org/projects/asvs) e [OWASP WSTG 4.2](https://owasp.org/projects/web-security-testing-guide). Não foi feita verificação controle a controle nem certificação.

| Grupo | Estado | Limite |
| --- | --- | --- |
| Autenticação/sessão | Parcial | Callback, guarda de tenant e MFA inspecionados; sem duas sessões reais ou revogação ao vivo |
| Autorização/isolamento | Parcial | Falha de relatórios corrigida; não houve teste dinâmico completo entre tenants |
| Entradas/saídas | Parcial | Rotas críticas e busca por padrões perigosos; upload, XSS e CSRF não esgotados |
| Pagamentos/lógica | Parcial | Código, testes e pendência do checkout revisados; sem pagamento aprovado nesta auditoria |
| Segredos/dados | Parcial | Arquivos rastreados e amostras de logging; sem verificação integral de Vercel/Supabase |
| Dependências | Testado localmente | Painel sem alertas conhecidos após atualização; landing mantém aviso sem patch |
| Monitoramento/abuso | Parcial | Jobs com segredo, rate limits e eventos inspecionados; alertas reais não exercitados |

## Validação e próximo passo

- Painel: `pnpm check` passou (82 arquivos, 377 testes); `pnpm build` passou; `pnpm audit --prod` sem vulnerabilidades conhecidas.
- Landing: após a remoção das rotas legadas, `npm test` passou (34 testes), `npm run build` passou e `npx astro check` não apontou erros; `npm audit --omit=dev` mantém aviso da dependência de cache.
- Busca pontual de padrões de token/chave em arquivos rastreados: sem correspondências; não substitui scanner de segredos com histórico Git.
- Nenhum deploy, commit, alteração de credencial, transação financeira ou teste intrusivo externo foi realizado.
- Antes de publicar: revisar o diff local junto das alterações preexistentes, verificar cache dinâmico da landing e então publicar com autorização explícita. Após o deploy, confirmar que as duas rotas legadas respondem 404, testar relatório com duas identidades de teste e unidades diferentes e confirmar o callback em produção sem usar contas de terceiros.
