# Estrutura do DRE (FIN_ESTRUTURA_DRE)

## Importância da tela
Define a hierarquia do Demonstrativo de Resultados, vinculando linhas do DRE às contas contábeis de cada empresa.

## Funcionamento (MVP) e processo esperado
1. Criar linhas com natureza (RECEITA, DESPESA ou CALCULADO) e tipo de gasto quando aplicável.
2. Garantir que pais e filhos compartilhem o mesmo **ID_EMPRESA** para evitar consolidação incorreta.
3. Associar contas via FIN_ESTRUTURA_DRE_CONTA respeitando o mesmo ID_EMPRESA.

## Campos obrigatórios e opcionais
- **Obrigatórios:** ID_EMPRESA, nome da linha, natureza, ordem, indicador de ativo.
- **Opcionais:** Tipo de gasto (fixo/variável), vínculo com linha pai.

## Observações de evolução (roadmap curto)
- Habilitar edição/bloqueio de linhas usadas em lançamentos para preservar integridade.
- Disponibilizar prévias do DRE recalculadas por empresa conforme ajustes de estrutura.
- Integrar validações de coerência diretamente no backend.
