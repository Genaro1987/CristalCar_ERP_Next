-- Registrar tela Relatorio de Caixa
INSERT OR IGNORE INTO CORE_TELA (CODIGO_TELA, NOME_TELA, MODULO, CAMINHO_ROTA, ATIVA)
VALUES ('FIN_REL_CAIXA', 'RELATORIO DE CAIXA', 'FINANCEIRO', '/financeiro/relatorio-caixa', 1);

-- Conceder permissao a todos os perfis que possuem acesso ao financeiro
INSERT OR IGNORE INTO SEG_PERFIL_TELA (ID_PERFIL, ID_TELA, PODE_ACESSAR, PODE_CONSULTAR, PODE_EDITAR)
SELECT DISTINCT SPT.ID_PERFIL,
       NEW_TELA.ID_TELA,
       1, 1, 1
FROM SEG_PERFIL_TELA SPT
JOIN CORE_TELA CT ON CT.ID_TELA = SPT.ID_TELA
JOIN CORE_TELA NEW_TELA ON NEW_TELA.CODIGO_TELA = 'FIN_REL_CAIXA'
WHERE CT.MODULO = 'FINANCEIRO'
  AND SPT.PODE_ACESSAR = 1;

-- Texto de ajuda
INSERT OR IGNORE INTO CORE_AJUDA_TELA (ID_TELA, OBJETIVO_TELA, ATIVA)
SELECT T.ID_TELA,
  'Relatorio completo de movimentacao financeira com tres visoes: Agrupado (contas agrupadas por arvore do plano de contas com subtotais), Detalhado (lista completa de lancamentos com descricao, pessoa, placa e valor), Diario (resumo por dia com saldo acumulado). Utilize os filtros de data e busca para refinar os resultados.',
  1
FROM CORE_TELA T
WHERE T.CODIGO_TELA = 'FIN_REL_CAIXA';
