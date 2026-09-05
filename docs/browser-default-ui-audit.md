# Auditoria de aparência nativa do navegador

Data: 5 de setembro de 2026

## Resultado

Os controles visíveis foram consolidados no Design System existente. O antigo `NativeSelect`, que apenas escondia a seta do navegador mas mantinha o popup nativo, foi removido. Os 20 selects ativos agora usam a primitive compartilhada baseada em Base UI.

| Componente | Quantidade | Nativo | Design System | Inconsistente após correção | Ação |
| --- | ---: | ---: | ---: | ---: | --- |
| Select | 20 | 0 | 20 | 0 | Consolidado em `ui/select` |
| Checkbox | 5 pontos de uso | 0 visível | 5 | 0 | Consolidado em `ui/checkbox` |
| Radio | 1 grupo dinâmico | 1 oculto | visual customizado | 0 | Mantido como input sem aparência visível |
| File input | 4 | 4 ocultos | 4 gatilhos visuais | 0 | Input preservado apenas para seleção do arquivo |
| Date/time | 14 | 14 | campo via `ui/input` | 0 acidental | Mantido intencionalmente; tema comunicado com `color-scheme` |
| Number | 7 | 7 | campo via `ui/input` | 0 | Spinners visuais removidos por CSS |
| Textarea | componente compartilhado | 0 direto nas features | todos | 0 | Mantido |
| Button | 9 ocorrências HTML diretas | 9 semânticos | todos estilizados | 0 | Mantidos por semântica |
| Details/summary | 1 par | 1 | visual customizado | 0 | Mantido por acessibilidade |
| Dialog HTML | 0 | 0 | Base UI | 0 | Mantido |
| Range, color e search nativos | 0 | 0 | — | 0 | Sem ação |

## Browser Default UI Leaks

| Vazamento encontrado | Classificação inicial | Correção | Situação |
| --- | --- | --- | --- |
| Popup de 16 selects renderizado pelo navegador/SO | C — substituir | Migração para `ui/select` baseado em Base UI | APROVADO |
| Checkbox visível em perfil, unidades e profissionais | C — substituir | Migração para `ui/checkbox` | APROVADO |
| Botão “Escolher arquivo” em profissional e importação CSV | C — substituir visualmente | Input ficou oculto e botão/estado passaram ao Design System | APROVADO |
| Spinners de inputs numéricos | B — CSS | Aparência removida mantendo teclado e validação nativos | APROVADO |
| Autofill com possibilidade de fundo claro em dark mode | B — CSS | Cores de fundo, texto e cursor vinculadas aos tokens | APROVADO |
| Scrollbar destoante | B — CSS | Cor, espessura e hover integrados aos tokens | APROVADO |
| Ícone fechado de date/time inconsistente | B — CSS | Opacidade, hover, cursor e `color-scheme` ajustados | APROVADO |

## Selects migrados

| Tela | Arquivo | Quantidade | Implementação anterior | Dropdown aberto controlável antes? | Resultado |
| --- | --- | ---: | --- | --- | --- |
| Seu negócio | `business-profile-form.tsx` | 1 | `NativeSelect`/`<select>` | Não | Base UI Select |
| Editar atendimento | `edit-appointment-dialog.tsx` | 3 | `NativeSelect`/`<select>` | Não | Base UI Select |
| Financeiro | `finance-entries-manager.tsx` | 2 | `NativeSelect`/`<select>` | Não | Base UI Select |
| Comunicações | `message-center.tsx` | 5 | `NativeSelect`/`<select>` | Não | Base UI Select |
| Equipe | `team-settings.tsx` | 4 | `NativeSelect`/`<select>` | Não | Base UI Select |
| Administração de loja | `admin/lojas/[clinicId]/page.tsx` | 1 | `<select>` direto | Não | Base UI Select |

Existe um Select compartilhado no projeto: sim, `src/components/ui/select.tsx`, baseado em `@base-ui/react`. Ele controla popup, foco, teclado, seleção, portal e fechamento por Escape. Nenhuma terceira implementação foi criada.

Durante o teste real surgiu uma falha adicional: instâncias sem a propriedade `items` exibiam o valor técnico no gatilho fechado. Todas as instâncias foram revisadas e receberam o mapa entre valor e rótulo.

## Componentes aparentemente estilizados, mas ainda nativos

### Antes da correção: `NativeSelect`

- Estado fechado: borda, cor e seta pareciam seguir o tema.
- Estado aberto: popup e highlight eram fornecidos pelo navegador/SO e não eram controláveis de forma confiável.
- Resultado inicial: PARCIAL.
- Recomendação executada: migração para o Select compartilhado e remoção do wrapper nativo.
- Resultado atual: APROVADO.

### Date, time e datetime-local

- Estado fechado: segue o `Input` compartilhado.
- Picker aberto: continua fornecido pelo navegador/SO.
- Classificação: A — manter nativo, de forma intencional.
- Justificativa: o picker nativo oferece teclado, localização e experiência móvel superiores. `color-scheme` informa o tema ao navegador e evita o popup claro no modo escuro em browsers compatíveis.
- Resultado: APROVADO como exceção documentada, não como vazamento acidental.

### Radio de horários públicos

- O input nativo é visualmente oculto (`sr-only`) e preserva semântica/formulário.
- Toda a aparência visível, incluindo seleção e foco, é fornecida pelo card do Design System.
- Classificação: A — manter nativo oculto.
- Resultado: APROVADO.

### File inputs

- Os quatro inputs permanecem nativos e ocultos para manter o seletor de arquivos do sistema.
- Nome, gatilho, estados e instruções visíveis são renderizados pelo produto.
- Classificação: A no comportamento e C na aparência.
- Resultado: APROVADO.

## Componentes que podem permanecer nativos

- `date`, `time` e `datetime-local`: integração móvel, localização, teclado e acessibilidade.
- `input[type=file]` oculto: acesso seguro ao seletor do sistema; nenhum botão default fica visível.
- `input[type=radio]` oculto nos horários: semântica nativa com visual integralmente customizado.
- `button`: elemento semântico mantido, mas todas as ocorrências visíveis têm estados definidos.
- `details/summary`: disclosure acessível, com marcador nativo oculto e estados visuais definidos.

## Estados testados

O Select compartilhado foi executado em Chromium e validado em 1280×800 e 390×844:

- fechado com rótulo humano;
- hover e focus-visible;
- aberto em dark mode;
- aberto em light mode;
- opção selecionada;
- ArrowDown e Enter;
- Escape;
- disabled;
- popup com três opções e sem menu nativo do SO.

Também foram validados visualmente checkbox, date e number no mesmo harness temporário. O harness não faz parte da aplicação publicada.

## Prioridades

- P0: nenhuma pendência encontrada.
- P1: selects nativos e file inputs visíveis — corrigidos.
- P2: checkboxes, spinners, autofill e scrollbars — corrigidos.
- P3: manter acompanhamento entre browsers dos pickers nativos de data/hora, por serem a exceção intencional.

## Critério final

Não restam `<select>` nativos em uso nem controles visíveis usando aparência acidental de user-agent. As únicas superfícies nativas mantidas são deliberadas, documentadas e preservam vantagens reais de acessibilidade ou integração com o sistema.
