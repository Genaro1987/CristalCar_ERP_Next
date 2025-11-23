-- Ajusta códigos de tela para manter a sequência correta de cadastros.
-- A tabela CORE_AJUDA_TELA referencia CORE_TELA via ID_TELA, então não há coluna de código a ser atualizada.
-- Mesmo assim, mantemos a associação com os IDs existentes.

WITH jornada_antiga AS (
  SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'CAD005_RH_JORNADA'
), funcionario_antigo AS (
  SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = 'CAD004_RH_FUNCIONARIO'
)
UPDATE CORE_TELA
   SET CODIGO_TELA = 'CAD004_RH_JORNADA'
 WHERE ID_TELA IN (SELECT ID_TELA FROM jornada_antiga);

UPDATE CORE_TELA
   SET CODIGO_TELA = 'CAD005_RH_FUNCIONARIO'
 WHERE ID_TELA IN (SELECT ID_TELA FROM funcionario_antigo);

-- Mantém as ajudas vinculadas ao mesmo ID_TELA da jornada, garantindo que a associação continue válida
-- após o rename de código.
UPDATE CORE_AJUDA_TELA
   SET ID_TELA = (SELECT ID_TELA FROM jornada_antiga)
 WHERE ID_TELA IN (SELECT ID_TELA FROM jornada_antiga);
