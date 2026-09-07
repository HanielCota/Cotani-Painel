# Padrão de iconografia

O painel usa **Lucide** como única biblioteca funcional de ícones. As únicas exceções são a marca oficial do Google no login e SVGs que representam dados, como micrográficos.

## Vocabulário de ações

| Ação | Ícone padrão | Regra |
| --- | --- | --- |
| Criar/adicionar | `PlusIcon` | Não usar para expandir conteúdo. |
| Editar | `PencilIcon` | Usar com texto ou nome acessível. |
| Excluir definitivamente | `Trash2Icon` | Sempre com confirmação. |
| Fechar | `XIcon` | Apenas fechar/dispensar; não representa exclusão. |
| Voltar/avançar | `ArrowLeftIcon` / `ArrowRightIcon` | Navegação entre etapas ou páginas. |
| Expandir/recolher | `ChevronDownIcon` / `ChevronUpIcon` | Conteúdo no mesmo contexto. |
| Copiar | `CopyIcon` | Dar retorno visual após copiar. |
| Link externo | `ExternalLinkIcon` | Destino fora do fluxo atual. |
| Sair | `LogOutIcon` | Ação de encerrar sessão. |

## Tamanho e acessibilidade

- Ícones dentro de botões usam o tamanho herdado pelo componente `Button`.
- Ícones informativos usam normalmente `size-4` ou `size-5`; ilustrações de estado vazio podem ser maiores.
- Ícones decorativos recebem `aria-hidden="true"` ou ficam dentro de um controle com texto acessível.
- Todo botão composto apenas por ícone precisa de `aria-label` explícito e área clicável mínima definida pelo `Button`.
- Tooltips complementam ações compactas, mas não substituem texto em ações destrutivas ou pouco óbvias.
