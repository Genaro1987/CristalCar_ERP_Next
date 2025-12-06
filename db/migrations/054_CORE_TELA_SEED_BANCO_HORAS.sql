-- Adiciona telas de Banco de Horas
INSERT OR IGNORE INTO CORE_TELA (CODIGO_TELA, NOME_TELA, CAMINHO_ROTA, MODULO, GRUPO)
VALUES
  ('REL001_RH_BANCO_HORAS', 'Banco de Horas', '/rh/banco-horas', 'RH', 'RH'),
  ('CONS001_RH_BANCO_HORAS', 'Consulta Banco de Horas', '/rh/banco-horas/consulta', 'RH', 'RH');
