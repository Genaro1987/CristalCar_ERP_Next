# Centro de Custo (FIN_CENTRO_CUSTO)

## Importância da tela
Organiza despesas e receitas por áreas, permitindo análises de performance por empresa e garantindo rastreabilidade dos lançamentos.

## Funcionamento (MVP) e processo esperado
1. Criar centros com hierarquia (pai/filho) sempre compartilhando o mesmo **ID_EMPRESA**.
2. Aplicar índice único (ID_EMPRESA, FIN_CENTRO_CUSTO_CODIGO) para evitar conflitos entre empresas.
3. Exibir filtros por status (ativo) e busca textual para facilitar seleção nos lançamentos.

## Campos obrigatórios e opcionais
- **Obrigatórios:** ID_EMPRESA, código, nome, indicador de ativo.
- **Opcionais:** Ordem de exibição, vínculo com centro de custo pai.

## Observações de evolução (roadmap curto)
- Integrar APIs de cadastro/edição respeitando validações de hierarquia por empresa.
- Disponibilizar árvore de seleção em lançamentos e relatórios.
- Incluir bloqueio de exclusão quando existirem lançamentos associados ao centro.
