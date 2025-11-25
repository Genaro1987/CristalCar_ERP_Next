-- 039_CORE_TELA_AJUDA_ATUALIZACOES.sql

-- Reclassifica CAD006_SEG_PERFIL para o grupo de Empresa/Cadastros
UPDATE CORE_TELA
SET MODULO = 'EMPRESA',
    DATA_ATUALIZACAO = datetime('now')
WHERE CODIGO_TELA = 'CAD006_SEG_PERFIL';

-- Atualiza o conteúdo da ajuda da tela de perfis
WITH TELA AS (
  SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'CAD006_SEG_PERFIL'
)
UPDATE CORE_AJUDA_TELA
SET OBJETIVO_TELA = 'Definir e manter os perfis de acesso do sistema.',
    QUANDO_UTILIZAR = 'Sempre que precisar criar um novo perfil ou ajustar as permissões de uma equipe.',
    DESCRICAO_PROCESSO = 'Permite configurar quais telas cada perfil pode acessar, consultar e editar.',
    PASSO_A_PASSO = '1) Abra o perfil desejado em "Editar ações".\n2) Marque ou desmarque as colunas Pode acessar, Pode consultar e Pode editar para cada tela.\n3) Salve para aplicar as permissões.',
    CAMPOS_OBRIGATORIOS = 'Nome do perfil, empresa vinculada e definição das permissões por tela.',
    CAMPOS_OPCIONAIS = 'Descrição do perfil e demais observações internas.',
    REFLEXOS_PROCESSO = 'Controla o acesso às telas do sistema de acordo com as permissões marcadas.',
    ERROS_COMUNS = 'Não salvar após marcar permissões; esquecer de marcar "Pode acessar" junto com "Consultar/Editar".',
    DATA_ATUALIZACAO = datetime('now')
WHERE ID_TELA IN (SELECT ID_TELA FROM TELA);

-- Atualiza o conteúdo da ajuda da tela LAN001_RH_PONTO
WITH TELA_PONTO AS (
  SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'LAN001_RH_PONTO'
)
UPDATE CORE_AJUDA_TELA
SET OBJETIVO_TELA = 'Lançar e ajustar o ponto diário do funcionário considerando jornada, intervalo, faltas e extras.',
    QUANDO_UTILIZAR = 'No fechamento mensal de ponto ou para ajustes de dias específicos.',
    DESCRICAO_PROCESSO = 'Grade mensal com dias, horários de entrada/saída, tempo trabalhado, horas extras e ações de falta ou aplicação de jornada.',
    PASSO_A_PASSO = '1) Selecione funcionário e competência e clique em "Carregar ponto".\n2) Aplique jornada nos dias úteis ou ajuste manualmente os horários.\n3) Utilize as ações de Falta, Aplicar jornada ou Limpar conforme necessário.\n4) Salve o ponto ao finalizar.',
    CAMPOS_OBRIGATORIOS = 'Funcionário, competência e horários ou marcação de falta para cada dia.',
    CAMPOS_OPCIONAIS = 'Observações de falta justificada e complementos de jornada.',
    REFLEXOS_PROCESSO = 'Base para cálculo de horas extras, banco de horas e relatórios de presença.',
    ERROS_COMUNS = 'Editar antes de carregar a competência; esquecer de salvar; horários conflitantes ou intervalos invertidos.',
    DATA_ATUALIZACAO = datetime('now')
WHERE ID_TELA IN (SELECT ID_TELA FROM TELA_PONTO);
