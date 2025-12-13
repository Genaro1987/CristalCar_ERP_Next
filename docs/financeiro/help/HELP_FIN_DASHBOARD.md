# Dashboard Financeiro (FIN_DASHBOARD)

## Importância da tela
Centraliza indicadores críticos do financeiro, permitindo visão rápida de fluxo de caixa, alertas e metas por empresa.

## Funcionamento (MVP) e processo esperado
1. Respeitar a empresa selecionada antes de montar cada card.
2. Consultar saldos consolidados de lançamentos e objetivos filtrando por **ID_EMPRESA**.
3. Exibir alertas de contas a pagar/receber e status do DRE conforme dados disponíveis.

## Campos obrigatórios e opcionais
- **Obrigatórios:** ID_EMPRESA (contexto), período padrão do dashboard.
- **Opcionais:** Filtros por centro de custo ou natureza de conta, quando liberados.

## Observações de evolução (roadmap curto)
- Conectar widgets aos endpoints financeiros e de objetivos.
- Ajustar cores/ícones alinhados ao padrão laranja + cinza.
- Disponibilizar drill-down para lançamentos diretamente a partir dos cards.
