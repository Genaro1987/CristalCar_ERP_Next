INSERT OR IGNORE INTO CORE_TELA (
  ID_TELA,
  CODIGO_TELA,
  NOME_TELA,
  MODULO,
  CAMINHO_ROTA,
  ICONE,
  DESCRICAO_TELA,
  ATIVA,
  DATA_CADASTRO
) VALUES (
  1,
  'CORE010_SELECAO_EMPRESA',
  'SELECAO DE EMPRESA',
  'CORE',
  '/',
  'building',
  'Tela inicial para selecao de empresa e acesso ao sistema.',
  1,
  datetime('now')
);

INSERT OR IGNORE INTO CORE_TELA (
  ID_TELA,
  CODIGO_TELA,
  NOME_TELA,
  MODULO,
  CAMINHO_ROTA,
  ICONE,
  DESCRICAO_TELA,
  ATIVA,
  DATA_CADASTRO
) VALUES (
  2,
  'CAD001_CORE_EMPRESA',
  'CADASTRO DE EMPRESA',
  'CADASTROS',
  '/core/empresa/nova',
  'building-plus',
  'Formulario para cadastro de empresas (multiempresa).',
  1,
  datetime('now')
);
