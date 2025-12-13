# Relatório DRE (FIN_DRE)

## Importância da tela
Apresenta o desempenho financeiro consolidado por empresa, usando a estrutura configurada e aplicando regras de sinal.

## Funcionamento (MVP) e processo esperado
1. Selecionar período e empresa antes de calcular o relatório.
2. Somar lançamentos vinculados às linhas de FIN_ESTRUTURA_DRE_CONTA filtrando por **EMPRESA_ID**.
3. Exibir valores absolutos, mantendo a regra de que receitas somam e despesas reduzem o resultado.

## Campos obrigatórios e opcionais
- **Obrigatórios:** EMPRESA_ID, período inicial e final.
- **Opcionais:** Filtros por centro de custo, natureza de conta ou agrupamentos adicionais.

## Observações de evolução (roadmap curto)
- Ajustar consultas para garantir que conta e centro de custo pertençam à mesma empresa do lançamento.
- Permitir exportação em PDF/Excel mantendo sinalização positiva.
- Incluir cenários e comparações com metas de FIN_OBJETIVOS.
