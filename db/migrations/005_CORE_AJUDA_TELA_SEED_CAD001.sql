INSERT OR REPLACE INTO CORE_AJUDA_TELA (
  ID_TELA,
  OBJETIVO_TELA,
  QUANDO_UTILIZAR,
  DESCRICAO_PROCESSO,
  PASSO_A_PASSO,
  CAMPOS_OBRIGATORIOS,
  CAMPOS_OPCIONAIS,
  REFLEXOS_PROCESSO,
  ERROS_COMUNS,
  ATIVA
)
SELECT
  T.ID_TELA,
  'Centralizar o cadastro e a governanca das empresas que operam no CristalCar ERP, garantindo identificacao juridica correta, status ATIVA/INATIVA e logotipo.',
  'Usar no onboarding de novas empresas, ajustes cadastrais e desativacao de empresas que nao devem aparecer na operacao do dia a dia.',
  'Tela que permite incluir e atualizar empresas, definir se estao ativas e associar logotipo. O CNPJ e unico na base para evitar duplicidade de empresas.',
  '1) Acessar a tela de cadastro de empresa; 2) Preencher NOME_FANTASIA, RAZAO_SOCIAL e CNPJ; 3) Opcionalmente preencher inscricoes, regime tributario e logotipo; 4) Confirmar ATIVA; 5) Salvar.',
  'Campos obrigatorios: NOME_FANTASIA, RAZAO_SOCIAL, CNPJ.',
  'Campos opcionais: INSCRICAO_ESTADUAL, INSCRICAO_MUNICIPAL, REGIME_TRIBUTARIO, LOGOTIPO_URL, ATIVA (pode ser ajustada depois).',
  'Empresas cadastradas alimentam a tela de selecao de empresa e servem de contexto multiempresa para os demais modulos. CNPJ unico evita inconsistencias em relatorios.',
  'Erros comuns: CNPJ duplicado, CNPJ digitado incorretamente, empresa marcada como inativa por engano ou sem logotipo (impacto apenas visual).',
  1
FROM CORE_TELA T
WHERE T.CODIGO_TELA = 'CAD001_CORE_EMPRESA';
