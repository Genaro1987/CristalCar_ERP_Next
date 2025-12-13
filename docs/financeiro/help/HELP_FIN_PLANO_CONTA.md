# Plano de Contas (FIN_PLANO_CONTA)

## Importância da tela
Define a estrutura contábil utilizada em lançamentos, no DRE e nas análises de fluxo de caixa, separando dados por empresa.

## Funcionamento (MVP) e processo esperado
1. Cadastrar contas com código, natureza e obrigatoriedade de centro de custo.
2. Garantir que cada conta tenha **EMPRESA_ID** e que pais/filhos compartilhem a mesma empresa.
3. Disponibilizar filtros por natureza, ativo e busca textual.

## Campos obrigatórios e opcionais
- **Obrigatórios:** EMPRESA_ID, código, nome, natureza, indicador de visibilidade no DRE, obrigatoriedade de centro de custo.
- **Opcionais:** Ordem de exibição, marcação de ativo/inativo, indicador de exibição em dashboards.

## Observações de evolução (roadmap curto)
- Sincronizar com APIs de cadastro, respeitando índice único (EMPRESA_ID, FIN_PLANO_CONTA_CODIGO).
- Validar obrigatoriedade de centro de custo no momento do lançamento financeiro.
- Habilitar importação/exportação de plano de contas por empresa.
