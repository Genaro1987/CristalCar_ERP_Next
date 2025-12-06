-- Adiciona telas de Banco de Horas
INSERT OR IGNORE INTO CORE_TELA (CODIGO_TELA, NOME_TELA, CAMINHO_ROTA, MODULO, DESCRICAO_TELA)
VALUES
  ('REL001_RH_BANCO_HORAS', 'Banco de Horas', '/rh/banco-horas', 'RH', 'Tela para cálculo e gestão do banco de horas dos funcionários. Permite calcular saldos mensais, definir política de faltas, incluir ajustes manuais e visualizar detalhamento diário de ponto.'),
  ('CONS001_RH_BANCO_HORAS', 'Consulta Banco de Horas', '/rh/banco-horas/consulta', 'RH', 'Consulta de períodos fechados de banco de horas. Permite visualizar histórico de cálculos e exportar relatórios em PDF e Excel para envio à contabilidade.');
