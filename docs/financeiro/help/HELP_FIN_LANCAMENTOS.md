# Lançamentos (FIN_LANCAMENTOS)

## Importância da tela
Controla o caixa diário e garante que cada movimentação financeira esteja vinculada à empresa correta e às contas/centros previstos.

## Funcionamento (MVP) e processo esperado
1. Selecionar a empresa antes de inserir ou listar lançamentos.
2. Aplicar filtro automático por **EMPRESA_ID** em todas as consultas e inserções.
3. Validar vínculos com FIN_PLANO_CONTA e FIN_CENTRO_CUSTO, impedindo misturar empresas diferentes.

## Campos obrigatórios e opcionais
- **Obrigatórios:** EMPRESA_ID, FIN_PLANO_CONTA_ID, data do lançamento, valor, histórico.
- **Opcionais:** FIN_CENTRO_CUSTO_ID (exceto quando o plano de contas exigir), número de documento, forma de pagamento.

## Observações de evolução (roadmap curto)
- Conectar a API para gravação/edição com validação de permissão por tela.
- Incluir anexos/comprovantes por lançamento.
- Disponibilizar conciliação e categorização automática.
