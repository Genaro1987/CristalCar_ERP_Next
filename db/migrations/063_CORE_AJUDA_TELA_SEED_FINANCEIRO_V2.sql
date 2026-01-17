-- ===================================================================
-- AJUDA PARA TELAS FINANCEIRAS COM CÓDIGOS FIN_*
-- ===================================================================

-- ===================================================================
-- INSTRUÇÕES DE AJUDA PARA PLANO DE CONTAS
-- ===================================================================
INSERT OR REPLACE INTO CORE_AJUDA_TELA (
  ID_AJUDA,
  ID_TELA,
  OBJETIVO_TELA,
  QUANDO_UTILIZAR,
  DESCRICAO_PROCESSO,
  PASSO_A_PASSO,
  CAMPOS_OBRIGATORIOS,
  CAMPOS_OPCIONAIS,
  REFLEXOS_PROCESSO,
  ERROS_COMUNS,
  ATIVA,
  DATA_CADASTRO
)
VALUES (
  COALESCE(
    (SELECT ID_AJUDA FROM CORE_AJUDA_TELA WHERE ID_TELA = (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_PLANO_CONTA')),
    (SELECT COALESCE(MAX(ID_AJUDA), 0) + 1 FROM CORE_AJUDA_TELA)
  ),
  (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_PLANO_CONTA'),
  'Estruturar e organizar o plano de contas financeiro da empresa, classificando receitas e despesas de forma hierárquica.',
  'Utilize esta tela no início da implantação do sistema ou quando precisar criar/editar contas contábeis. É a base para todos os lançamentos financeiros.',
  'O plano de contas é organizado hierarquicamente, permitindo criar contas pai e contas filhas. Cada conta possui código único, natureza (RECEITA ou DESPESA) e pode estar ativa ou inativa.',
  '1. Clique em "Novo" para criar uma conta
2. Preencha o código (ex: 3.1, 4.2.1)
3. Informe o nome da conta
4. Selecione a natureza (RECEITA ou DESPESA)
5. Defina se a conta será visível no DRE
6. Configure se obriga informar centro de custo
7. Salve a conta',
  '- Nome da conta
- Código único
- Natureza (RECEITA ou DESPESA)',
  '- Conta pai (para contas filhas)
- Descrição/observações
- Ordem de exibição
- Visibilidade no DRE
- Obrigatoriedade de centro de custo',
  'Contas criadas serão utilizadas em lançamentos financeiros e aparecerão nos relatórios. Contas inativas não aparecem para novos lançamentos.',
  '- Duplicar códigos de contas
- Criar contas sem definir natureza correta
- Inativar contas que possuem lançamentos vinculados',
  1,
  datetime('now')
);

-- ===================================================================
-- INSTRUÇÕES DE AJUDA PARA CENTRO DE CUSTO
-- ===================================================================
INSERT OR REPLACE INTO CORE_AJUDA_TELA (
  ID_AJUDA,
  ID_TELA,
  OBJETIVO_TELA,
  QUANDO_UTILIZAR,
  DESCRICAO_PROCESSO,
  PASSO_A_PASSO,
  CAMPOS_OBRIGATORIOS,
  CAMPOS_OPCIONAIS,
  REFLEXOS_PROCESSO,
  ERROS_COMUNS,
  ATIVA,
  DATA_CADASTRO
)
VALUES (
  COALESCE(
    (SELECT ID_AJUDA FROM CORE_AJUDA_TELA WHERE ID_TELA = (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_CENTRO_CUSTO')),
    (SELECT COALESCE(MAX(ID_AJUDA), 0) + 1 FROM CORE_AJUDA_TELA)
  ),
  (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_CENTRO_CUSTO'),
  'Criar e gerenciar centros de custo para permitir a análise de despesas e receitas por departamento, projeto ou área da empresa.',
  'Use quando precisar organizar custos por áreas (Administrativo, Vendas, Produção, etc.) ou quando o plano de contas exigir centro de custo obrigatório.',
  'Centros de custo são organizados hierarquicamente. Podem representar departamentos, projetos, filiais ou qualquer divisão relevante para análise gerencial.',
  '1. Clique em "Novo"
2. Preencha o código do centro de custo (ex: 01, 01.01)
3. Informe o nome
4. Adicione descrição (opcional)
5. Selecione o status (Ativo/Inativo)
6. Para criar subcentros, clique em "Novo filho" no centro pai
7. Salve',
  '- Nome do centro de custo
- Código único',
  '- Centro de custo pai
- Descrição
- Ordem de exibição',
  'Centros de custo ativos ficam disponíveis para seleção em lançamentos financeiros e permitem análises gerenciais segmentadas.',
  '- Não definir hierarquia clara
- Criar muitos níveis desnecessários
- Duplicar códigos',
  1,
  datetime('now')
);

-- ===================================================================
-- INSTRUÇÕES DE AJUDA PARA ESTRUTURA DO DRE
-- ===================================================================
INSERT OR REPLACE INTO CORE_AJUDA_TELA (
  ID_AJUDA,
  ID_TELA,
  OBJETIVO_TELA,
  QUANDO_UTILIZAR,
  DESCRICAO_PROCESSO,
  PASSO_A_PASSO,
  CAMPOS_OBRIGATORIOS,
  CAMPOS_OPCIONAIS,
  REFLEXOS_PROCESSO,
  ERROS_COMUNS,
  ATIVA,
  DATA_CADASTRO
)
VALUES (
  COALESCE(
    (SELECT ID_AJUDA FROM CORE_AJUDA_TELA WHERE ID_TELA = (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_ESTRUTURA_DRE')),
    (SELECT COALESCE(MAX(ID_AJUDA), 0) + 1 FROM CORE_AJUDA_TELA)
  ),
  (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_ESTRUTURA_DRE'),
  'Definir a estrutura do Demonstrativo de Resultado do Exercício (DRE) e vincular contas do plano de contas às linhas do relatório.',
  'Configure antes de gerar relatórios DRE. Defina a estrutura uma vez e mantenha atualizada conforme necessário.',
  'O DRE é estruturado em linhas hierárquicas (Receita Bruta, Deduções, Lucro Líquido, etc.). Cada linha pode ter contas do plano de contas vinculadas.',
  '1. Clique em "Novo" para criar linha do DRE
2. Preencha código e nome da linha
3. Selecione a natureza (RECEITA/DESPESA/OUTROS)
4. Defina o tipo (Fixo/Variável/Calculado)
5. Adicione descrição das regras de cálculo
6. Salve a linha
7. Clique em "Vincular contas" para associar contas do plano de contas
8. Selecione as contas relevantes
9. Confirme o vínculo',
  '- Nome da linha
- Código
- Natureza',
  '- Linha pai
- Tipo
- Descrição
- Ordem',
  'Linhas do DRE e seus vínculos definem como o relatório DRE será apresentado. Alterações refletem imediatamente no relatório.',
  '- Vincular contas de natureza errada à linha
- Não definir hierarquia clara
- Deixar linhas importantes sem contas vinculadas',
  1,
  datetime('now')
);

-- ===================================================================
-- INSTRUÇÕES DE AJUDA PARA RELATÓRIO DRE
-- ===================================================================
INSERT OR REPLACE INTO CORE_AJUDA_TELA (
  ID_AJUDA,
  ID_TELA,
  OBJETIVO_TELA,
  QUANDO_UTILIZAR,
  DESCRICAO_PROCESSO,
  PASSO_A_PASSO,
  CAMPOS_OBRIGATORIOS,
  CAMPOS_OPCIONAIS,
  REFLEXOS_PROCESSO,
  ERROS_COMUNS,
  ATIVA,
  DATA_CADASTRO
)
VALUES (
  COALESCE(
    (SELECT ID_AJUDA FROM CORE_AJUDA_TELA WHERE ID_TELA = (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_DRE')),
    (SELECT COALESCE(MAX(ID_AJUDA), 0) + 1 FROM CORE_AJUDA_TELA)
  ),
  (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_DRE'),
  'Visualizar e analisar o Demonstrativo de Resultado do Exercício (DRE) com dados consolidados de receitas, despesas e resultados.',
  'Use mensalmente ou quando precisar analisar a performance financeira da empresa em um período específico.',
  'O relatório DRE consolida todos os lançamentos financeiros conforme a estrutura configurada, apresentando receitas, custos, despesas e resultado final.',
  '1. Selecione o período (mês/ano)
2. Escolha a empresa (se multiempresa)
3. Clique em "Gerar DRE"
4. Analise as linhas do relatório
5. Exporte para PDF/Excel se necessário
6. Use filtros para análises específicas',
  '- Período (mês/ano)',
  '- Empresa
- Filtros por centro de custo',
  'O relatório é gerado com base nos lançamentos confirmados do período. Não altera dados, apenas apresenta informações consolidadas.',
  '- Gerar relatório sem lançamentos no período
- Não verificar se a estrutura DRE está configurada
- Comparar períodos sem considerar sazonalidade',
  1,
  datetime('now')
);

-- ===================================================================
-- INSTRUÇÕES DE AJUDA PARA LANÇAMENTOS FINANCEIROS
-- ===================================================================
INSERT OR REPLACE INTO CORE_AJUDA_TELA (
  ID_AJUDA,
  ID_TELA,
  OBJETIVO_TELA,
  QUANDO_UTILIZAR,
  DESCRICAO_PROCESSO,
  PASSO_A_PASSO,
  CAMPOS_OBRIGATORIOS,
  CAMPOS_OPCIONAIS,
  REFLEXOS_PROCESSO,
  ERROS_COMUNS,
  ATIVA,
  DATA_CADASTRO
)
VALUES (
  COALESCE(
    (SELECT ID_AJUDA FROM CORE_AJUDA_TELA WHERE ID_TELA = (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_LANCAMENTOS')),
    (SELECT COALESCE(MAX(ID_AJUDA), 0) + 1 FROM CORE_AJUDA_TELA)
  ),
  (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_LANCAMENTOS'),
  'Registrar todas as movimentações financeiras da empresa (entradas e saídas), vinculando-as ao plano de contas e centros de custo.',
  'Use diariamente para registrar pagamentos, recebimentos e demais movimentações financeiras.',
  'Cada lançamento representa uma entrada ou saída de dinheiro, classificada em uma conta contábil e opcionalmente em um centro de custo.',
  '1. Clique em "Novo lançamento"
2. Informe a data do lançamento
3. Selecione o tipo (Entrada ou Saída)
4. Digite o histórico (descrição)
5. Escolha a conta do plano de contas
6. Selecione o centro de custo (se obrigatório)
7. Informe o valor
8. Defina o status (Confirmado/Pendente)
9. Adicione número de documento (opcional)
10. Salve o lançamento',
  '- Data
- Histórico
- Conta do plano de contas
- Valor
- Tipo (Entrada/Saída)',
  '- Centro de custo
- Número do documento
- Forma de pagamento
- Status',
  'Lançamentos confirmados são computados no DRE, dashboard e demais relatórios financeiros. Lançamentos pendentes aparecem apenas como previsão.',
  '- Lançar em conta errada
- Esquecer de informar centro de custo quando obrigatório
- Inverter valor de entrada/saída
- Duplicar lançamentos
- Não informar histórico claro',
  1,
  datetime('now')
);

-- ===================================================================
-- INSTRUÇÕES DE AJUDA PARA DASHBOARD FINANCEIRO
-- ===================================================================
INSERT OR REPLACE INTO CORE_AJUDA_TELA (
  ID_AJUDA,
  ID_TELA,
  OBJETIVO_TELA,
  QUANDO_UTILIZAR,
  DESCRICAO_PROCESSO,
  PASSO_A_PASSO,
  CAMPOS_OBRIGATORIOS,
  CAMPOS_OPCIONAIS,
  REFLEXOS_PROCESSO,
  ERROS_COMUNS,
  ATIVA,
  DATA_CADASTRO
)
VALUES (
  COALESCE(
    (SELECT ID_AJUDA FROM CORE_AJUDA_TELA WHERE ID_TELA = (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_DASHBOARD')),
    (SELECT COALESCE(MAX(ID_AJUDA), 0) + 1 FROM CORE_AJUDA_TELA)
  ),
  (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_DASHBOARD'),
  'Visualizar indicadores financeiros consolidados, incluindo saldo, entradas, saídas, margem e fluxo projetado.',
  'Use diariamente para acompanhar a saúde financeira da empresa e tomar decisões gerenciais rápidas.',
  'O dashboard apresenta resumo financeiro consolidado por empresa e período, calculando automaticamente indicadores como margem, burn rate e fluxo projetado.',
  '1. Acesse o dashboard financeiro
2. Selecione o período desejado (mês/ano)
3. Visualize os cards de resumo (saldo, entradas, saídas)
4. Analise os indicadores (margem, burn rate, fluxo)
5. Consulte alertas de contas a pagar/receber
6. Use a tabela comparativa para análise multiempresa
7. Exporte o resumo se necessário',
  'Nenhum (apenas visualização)',
  '- Período
- Filtros adicionais',
  'Dashboard é apenas visualização, não altera dados. Indicadores são calculados em tempo real com base nos lançamentos confirmados.',
  '- Analisar período sem lançamentos
- Comparar períodos muito diferentes
- Não considerar sazonalidade do negócio',
  1,
  datetime('now')
);

-- ===================================================================
-- INSTRUÇÕES DE AJUDA PARA OBJETIVOS FINANCEIROS
-- ===================================================================
INSERT OR REPLACE INTO CORE_AJUDA_TELA (
  ID_AJUDA,
  ID_TELA,
  OBJETIVO_TELA,
  QUANDO_UTILIZAR,
  DESCRICAO_PROCESSO,
  PASSO_A_PASSO,
  CAMPOS_OBRIGATORIOS,
  CAMPOS_OPCIONAIS,
  REFLEXOS_PROCESSO,
  ERROS_COMUNS,
  ATIVA,
  DATA_CADASTRO
)
VALUES (
  COALESCE(
    (SELECT ID_AJUDA FROM CORE_AJUDA_TELA WHERE ID_TELA = (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_OBJETIVOS')),
    (SELECT COALESCE(MAX(ID_AJUDA), 0) + 1 FROM CORE_AJUDA_TELA)
  ),
  (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_OBJETIVOS'),
  'Definir metas financeiras por período, com responsáveis e acompanhamento da evolução.',
  'Use ao planejar metas mensais, trimestrais ou anuais para orientar o desempenho financeiro da empresa.',
  'Cada objetivo registra o título, período, meta e responsável. Pode ser ativado/inativado e recebe observações para contextualizar a meta.',
  '1. Clique em "Novo objetivo"
2. Informe o título da meta
3. Selecione o período (Mensal/Trimestral/Anual)
4. Defina o valor da meta
5. Informe o responsável (opcional)
6. Adicione observações (opcional)
7. Salve o objetivo',
  '- Título
- Período
- Meta',
  '- Responsável
- Observações',
  'Objetivos servem de referência para acompanhamento de performance e podem gerar metas semanais derivadas.',
  '- Definir metas sem período claro
- Não revisar objetivos inativos
- Informar valores fora da realidade do negócio',
  1,
  datetime('now')
);

-- ===================================================================
-- INSTRUÇÕES DE AJUDA PARA OBJETIVOS SEMANAIS
-- ===================================================================
INSERT OR REPLACE INTO CORE_AJUDA_TELA (
  ID_AJUDA,
  ID_TELA,
  OBJETIVO_TELA,
  QUANDO_UTILIZAR,
  DESCRICAO_PROCESSO,
  PASSO_A_PASSO,
  CAMPOS_OBRIGATORIOS,
  CAMPOS_OPCIONAIS,
  REFLEXOS_PROCESSO,
  ERROS_COMUNS,
  ATIVA,
  DATA_CADASTRO
)
VALUES (
  COALESCE(
    (SELECT ID_AJUDA FROM CORE_AJUDA_TELA WHERE ID_TELA = (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_OBJETIVOS_SEMANAIS')),
    (SELECT COALESCE(MAX(ID_AJUDA), 0) + 1 FROM CORE_AJUDA_TELA)
  ),
  (SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'FIN_OBJETIVOS_SEMANAIS'),
  'Desdobrar objetivos financeiros em metas semanais para acompanhamento mais próximo do resultado.',
  'Use quando precisar detalhar um objetivo em metas por semana e acompanhar o status (pendente, em andamento, concluído).',
  'Cada objetivo semanal pertence a um objetivo principal e registra a semana, a meta semanal e o status de execução.',
  '1. Selecione o objetivo principal
2. Clique em "Nova meta semanal"
3. Informe a semana/competência
4. Defina o valor da meta semanal
5. Informe responsável (opcional)
6. Atualize o status conforme evolução
7. Salve a meta',
  '- Objetivo principal
- Semana/competência
- Meta semanal',
  '- Responsável
- Observações
- Status',
  'Metas semanais ajudam a monitorar o avanço do objetivo principal e facilitam ajustes ao longo do período.',
  '- Criar metas sem vínculo a objetivo principal
- Não atualizar o status semanal
- Valores semanais inconsistentes com a meta global',
  1,
  datetime('now')
);
