# Estrutura do DRE (FIN_ESTRUTURA_DRE)

## Importância da tela
Modela a árvore do Demonstrativo de Resultado, conectando contas do plano e definindo agregações para receitas e despesas.

## Funcionamento e processo
1. Cadastre linhas do DRE em níveis hierárquicos, aplicando ordenação para o relatório.
2. Escolha a natureza: RECEITA (soma), DESPESA (deduz) ou CALCULADO (resultado dos filhos).
3. Se a linha for despesa, classifique como gasto FIXO ou VARIAVEL; demais naturezas usam NAO_APLICA.
4. Relacione contas do plano através da ligação com FIN_ESTRUTURA_DRE_CONTA.

## Campos obrigatórios e opcionais
- **Obrigatórios:** Nome, Ordem, Natureza, Tipo de Gasto, Ativo.
- **Opcionais:** Linha pai (para hierarquia).

## Regras e validações
- Natureza DESPESA aceita apenas tipos FIXO ou VARIAVEL; RECEITA e CALCULADO devem usar NAO_APLICA.
- Somatórios do DRE exibem valores sempre positivos, mas receitas aumentam o resultado e despesas o reduzem.
- Linhas calculadas dependem dos filhos; ao desativar um nó, avalie o impacto nos totais.
