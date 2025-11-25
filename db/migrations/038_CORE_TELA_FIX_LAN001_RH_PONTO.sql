-- 038_CORE_TELA_FIX_LAN001_RH_PONTO.sql
-- Ajusta a tela de ponto para usar apenas LAN001_RH_PONTO, sem duplicidades
-- e alinha a tabela de ajuda correspondente.

BEGIN TRANSACTION;

-- 1) Se EXISTIREM os dois códigos (CAD007_RH_PONTO e LAN001_RH_PONTO),
--    manter o LAN001 e remover o CAD007.
DELETE FROM CORE_TELA
WHERE CODIGO_TELA = 'CAD007_RH_PONTO'
  AND EXISTS (
    SELECT 1
    FROM CORE_TELA
    WHERE CODIGO_TELA = 'LAN001_RH_PONTO'
  );

-- 2) Se só existir CAD007_RH_PONTO (e ainda não existir LAN001_RH_PONTO),
--    renomear o código da tela para LAN001_RH_PONTO.
UPDATE CORE_TELA
SET CODIGO_TELA = 'LAN001_RH_PONTO'
WHERE CODIGO_TELA = 'CAD007_RH_PONTO';

-- 3) Garante que a central de ajuda está alinhada com o código LAN001_RH_PONTO.
UPDATE CORE_AJUDA_TELA
SET CODIGO_TELA = 'LAN001_RH_PONTO'
WHERE CODIGO_TELA IN ('CAD007_RH_PONTO', 'LAN001_RH_PONTO');

COMMIT;
