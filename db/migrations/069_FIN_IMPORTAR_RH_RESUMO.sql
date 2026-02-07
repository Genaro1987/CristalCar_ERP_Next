-- Register Import and RH Resumo screens in CORE_TELA
INSERT OR IGNORE INTO CORE_TELA (CODIGO_TELA, NOME_TELA, MODULO, CAMINHO_ROTA, ATIVA, DATA_CADASTRO)
VALUES ('FIN_IMPORTAR', 'Importação de Dados', 'FINANCEIRO', '/financeiro/importar', 1, datetime('now'));

INSERT OR IGNORE INTO CORE_TELA (CODIGO_TELA, NOME_TELA, MODULO, CAMINHO_ROTA, ATIVA, DATA_CADASTRO)
VALUES ('RH_RESUMO', 'Resumo de Funcionários', 'RH', '/rh/resumo', 1, datetime('now'));
