# Plano de Contas (FIN_PLANO_CONTA)

## Importância da tela
Permite organizar receitas e despesas em uma estrutura hierárquica, baseando todos os lançamentos e relatórios financeiros do ERP.

## Funcionamento e processo
1. Configure os grupos pais e, em seguida, cadastre subcontas conforme a granularidade necessária.
2. Defina a natureza (RECEITA ou DESPESA) para direcionar o comportamento no DRE.
3. Utilize o campo "Visível no DRE" para controlar se a conta aparece no relatório.
4. Salve e mantenha a ordem com o campo de ordenação para facilitar a visualização em árvore.

## Campos obrigatórios e opcionais
- **Obrigatórios:** Nome, Código (único), Natureza, Ativo, Visível no DRE, Obriga Centro de Custo, Ordem.
- **Opcionais:** Conta pai (para hierarquia).

## Regras e validações
- Código deve ser único e seguir o padrão interno da empresa.
- Contas de natureza DESPESA podem exigir centro de custo quando "Obriga Centro de Custo" estiver marcado.
- A hierarquia suporta múltiplos níveis; os filtros de natureza e ativo ajudam na manutenção.
- Para o DRE, receitas somam e despesas diminuem o resultado, mas os valores são exibidos positivos.
