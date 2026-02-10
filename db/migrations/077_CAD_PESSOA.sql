-- Cadastro unificado de Clientes / Fornecedores / Ambos
CREATE TABLE IF NOT EXISTS CAD_PESSOA (
  CAD_PESSOA_ID INTEGER PRIMARY KEY AUTOINCREMENT,
  EMPRESA_ID INTEGER NOT NULL,
  CAD_PESSOA_TIPO TEXT NOT NULL DEFAULT 'AMBOS', -- CLIENTE, FORNECEDOR, AMBOS
  CAD_PESSOA_DOCUMENTO TEXT, -- CPF ou CNPJ
  CAD_PESSOA_NOME TEXT NOT NULL,
  CAD_PESSOA_ENDERECO TEXT,
  CAD_PESSOA_CIDADE TEXT,
  CAD_PESSOA_UF TEXT,
  CAD_PESSOA_CEP TEXT,
  CAD_PESSOA_TELEFONE TEXT,
  CAD_PESSOA_EMAIL TEXT,
  CAD_PESSOA_OBSERVACAO TEXT,
  CAD_PESSOA_ATIVO INTEGER NOT NULL DEFAULT 1,
  CAD_PESSOA_CRIADO_EM TEXT DEFAULT (datetime('now')),
  CAD_PESSOA_ATUALIZADO_EM TEXT DEFAULT (datetime('now'))
);

-- Registrar tela no CORE_TELA
INSERT OR IGNORE INTO CORE_TELA (CODIGO_TELA, NOME_TELA, MODULO, CAMINHO_ROTA, ATIVO)
VALUES ('CAD_PESSOA', 'CLIENTES E FORNECEDORES', 'CADASTROS', '/cadastros/pessoas', 1);

-- Conceder permissao a todos os perfis que possuem acesso a alguma tela de cadastro
INSERT OR IGNORE INTO SEG_PERFIL_TELA (ID_PERFIL, CODIGO_TELA)
SELECT DISTINCT pt.ID_PERFIL, 'CAD_PESSOA'
FROM SEG_PERFIL_TELA pt
WHERE pt.CODIGO_TELA LIKE 'CAD%';

-- Texto de ajuda
INSERT OR IGNORE INTO CORE_AJUDA (TELA, TITULO, CONTEUDO)
VALUES (
  'CAD_PESSOA',
  'Clientes e Fornecedores',
  'Cadastro unificado de clientes, fornecedores ou ambos. Informe CPF/CNPJ, nome, endereco e contato. O tipo (Cliente/Fornecedor/Ambos) define onde a pessoa aparece nos lancamentos: clientes em recebimentos, fornecedores em pagamentos, ambos nos dois.'
);

-- Adicionar coluna de referencia na tabela de lancamentos
ALTER TABLE FIN_LANCAMENTO ADD COLUMN FIN_LANCAMENTO_PESSOA_ID INTEGER;
