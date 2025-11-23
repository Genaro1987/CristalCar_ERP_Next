-- Ajuste para consolidar a tela de Jornada no código definitivo
-- Atualiza a referência de ajuda para o código correto
UPDATE CORE_AJUDA_TELA
   SET ID_TELA = (
     SELECT ID_TELA
       FROM CORE_TELA
      WHERE CODIGO_TELA = 'CAD004_RH_JORNADA'
   )
 WHERE ID_TELA = (
   SELECT ID_TELA
     FROM CORE_TELA
    WHERE CODIGO_TELA = 'CAD005_RH_JORNADA'
 );

-- Remove o registro legado da tela de Jornada
DELETE FROM CORE_TELA
 WHERE CODIGO_TELA = 'CAD005_RH_JORNADA';
