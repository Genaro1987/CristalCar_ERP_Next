# Relatório DRE (FIN_DRE)

## Importância da tela
Apresenta o desempenho financeiro consolidado, aplicando regras de sinal que mantêm a leitura gerencial positiva.

## Funcionamento e processo
1. Selecione o período de análise.
2. O sistema busca lançamentos das contas vinculadas em FIN_ESTRUTURA_DRE_CONTA.
3. Cada linha do DRE soma os lançamentos associados respeitando a natureza (RECEITA ou DESPESA) e exibe o valor absoluto.
4. Linhas do tipo CALCULADO trazem o resultado dos filhos, mantendo o impacto correto no total.

## Campos obrigatórios e opcionais
- **Obrigatórios:** Período inicial e final (ou competência, conforme convenção do projeto).
- **Opcionais:** Filtros adicionais por centro de custo ou empresa, quando disponíveis.

## Regras e validações
- Todos os valores são exibidos como positivos para facilitar a leitura.
- Receitas aumentam o resultado; despesas reduzem o resultado, mesmo que a exibição use valor absoluto.
- Se uma conta exigir centro de custo, o lançamento deve possuir FIN_CENTRO_CUSTO_ID preenchido; caso contrário, o lançamento é inválido.
