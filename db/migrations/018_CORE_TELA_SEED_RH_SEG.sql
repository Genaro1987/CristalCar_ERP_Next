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
) VALUES
  (
    4,
    'CAD004_RH_FUNCIONARIO',
    'CADASTRO DE FUNCIONARIO',
    'RH',
    '/rh/funcionario',
    'id-badge-2',
    'CADASTRO E MANUTENCAO DE FUNCIONARIOS POR EMPRESA',
    1,
    datetime('now')
  ),
  (
    5,
    'CAD005_RH_JORNADA',
    'CADASTRO DE JORNADA',
    'RH',
    '/rh/jornada',
    'clock-hour-4',
    'CADASTRO DE JORNADAS DE TRABALHO',
    1,
    datetime('now')
  ),
  (
    6,
    'CAD006_SEG_PERFIL',
    'CADASTRO DE PERFIL DE ACESSO',
    'SEGURANCA',
    '/seg/perfil',
    'shield-lock',
    'DEFINICAO DE PERFIS DE ACESSO E TELAS PERMITIDAS',
    1,
    datetime('now')
  );
