-- Registrar tela Relatorio de Caixa
INSERT OR IGNORE INTO CORE_TELA (CODIGO_TELA, NOME_TELA, MODULO, CAMINHO_ROTA, ATIVA)
VALUES ('FIN_REL_CAIXA', 'RELATORIO DE CAIXA', 'FINANCEIRO', '/financeiro/relatorio-caixa', 1);

-- Conceder permissao a todos os perfis que possuem acesso ao financeiro
INSERT OR IGNORE INTO SEG_PERFIL_TELA (ID_PERFIL, CODIGO_TELA)
SELECT DISTINCT pt.ID_PERFIL, 'FIN_REL_CAIXA'
FROM SEG_PERFIL_TELA pt
WHERE pt.CODIGO_TELA LIKE 'FIN%';

-- Texto de ajuda
INSERT OR IGNORE INTO CORE_AJUDA (TELA, TITULO, CONTEUDO)
VALUES (
  'FIN_REL_CAIXA',
  'Relatorio de Caixa',
  'Relatorio completo de movimentacao financeira com tres visoes: Agrupado (contas agrupadas por arvore do plano de contas com subtotais), Detalhado (lista completa de lancamentos com descricao, pessoa, placa e valor), Diario (resumo por dia com saldo acumulado). Utilize os filtros de data e busca para refinar os resultados.'
);
