-- Adiciona helps para telas de Banco de Horas

-- Help para REL001_RH_BANCO_HORAS
INSERT OR IGNORE INTO CORE_AJUDA_TELA (CODIGO_TELA, SECAO, TITULO, CONTEUDO, ORDEM)
VALUES
  ('REL001_RH_BANCO_HORAS', 'GERAL', 'Visão Geral', 'Esta tela permite calcular e gerenciar o banco de horas dos funcionários. O sistema calcula automaticamente horas extras (50% e 100%), horas devidas, ajustes manuais e saldo do banco de horas.', 1),
  ('REL001_RH_BANCO_HORAS', 'FILTROS', 'Seleção de Funcionário e Período', 'Selecione o funcionário e a competência (mês/ano) que deseja calcular. Clique em "Calcular" para processar as informações.', 2),
  ('REL001_RH_BANCO_HORAS', 'RESUMO', 'Resumo do Mês', 'Visualize o saldo anterior, horas extras 50% e 100%, horas devidas, ajustes manuais e saldo final do banco de horas. Os valores são calculados automaticamente com base nos registros de ponto.', 3),
  ('REL001_RH_BANCO_HORAS', 'ACOES', 'Ações Finais', 'Defina a política de faltas (compensar com horas extras ou descontar em folha) e se deseja zerar o banco ao final do mês. Estas configurações afetam o cálculo final.', 4),
  ('REL001_RH_BANCO_HORAS', 'VALORES', 'Valores a Pagar/Descontar', 'Valores monetários calculados com base no salário do funcionário e nas horas a pagar (50% e 100%) ou descontar.', 5),
  ('REL001_RH_BANCO_HORAS', 'DETALHAMENTO', 'Detalhamento Diário', 'Tabela com breakdown diário mostrando jornada prevista, horas trabalhadas, diferença e classificação de cada dia (extras, devedor, falta, etc).', 6),
  ('REL001_RH_BANCO_HORAS', 'MOVIMENTOS', 'Movimentos do Banco', 'Histórico de movimentações no banco de horas incluindo ajustes manuais e fechamentos de períodos anteriores.', 7),
  ('REL001_RH_BANCO_HORAS', 'AJUSTES', 'Ajustes Manuais', 'Permite incluir ajustes manuais (crédito ou débito) no banco de horas. Informe a data, tipo, horas no formato HH:MM (ex: 02:30) e observação. O ajuste será considerado no próximo cálculo.', 8);

-- Help para CONS001_RH_BANCO_HORAS
INSERT OR IGNORE INTO CORE_AJUDA_TELA (CODIGO_TELA, SECAO, TITULO, CONTEUDO, ORDEM)
VALUES
  ('CONS001_RH_BANCO_HORAS', 'GERAL', 'Visão Geral', 'Esta tela permite consultar períodos já calculados e fechados de banco de horas. Use-a para visualizar histórico e exportar relatórios.', 1),
  ('CONS001_RH_BANCO_HORAS', 'FILTROS', 'Seleção de Funcionário e Período', 'Selecione o funcionário e a competência para consultar. Apenas períodos já calculados e fechados aparecerão nos resultados.', 2),
  ('CONS001_RH_BANCO_HORAS', 'EXPORTACAO', 'Exportar Arquivos', 'Clique em "Exportar Arquivos" para gerar relatórios em PDF e/ou Excel. Você pode selecionar um ou mais funcionários para exportação em lote.', 3),
  ('CONS001_RH_BANCO_HORAS', 'PDF', 'Exportação PDF', 'O PDF gerado contém layout corporativo com cabeçalho da empresa, detalhamento completo do período e campos para assinatura. Ideal para arquivo físico.', 4),
  ('CONS001_RH_BANCO_HORAS', 'EXCEL', 'Exportação Excel', 'O arquivo Excel contém 3 planilhas: Resumo (dados consolidados), Detalhamento (breakdown diário) e Valores (cálculos monetários). Formato adequado para envio à contabilidade.', 5);
