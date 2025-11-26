-- 047_CORE_TELA_CLEANUP_PONTO_v2.sql

-- 1) Descobre o ID da tela LAN001_RH_PONTO
-- 2) Descobre (se ainda existir) o ID da tela CAD007_RH_PONTO
-- 3) Reaponta SEG_PERFIL_TELA para usar sempre a LAN001
-- 4) Remove o registro legado de CAD007_RH_PONTO
-- 5) Ajusta o módulo da CAD006_SEG_PERFIL para EMPRESA

-- Reaponta permissões de qualquer ID_TELA antigo (CAD007) para LAN001
UPDATE SEG_PERFIL_TELA
SET ID_TELA = (
  SELECT ID_TELA
  FROM CORE_TELA
  WHERE CODIGO_TELA = 'LAN001_RH_PONTO'
)
WHERE ID_TELA IN (
  SELECT ID_TELA
  FROM CORE_TELA
  WHERE CODIGO_TELA = 'CAD007_RH_PONTO'
);

-- Deleta a ajuda vinculada à tela antiga CAD007_RH_PONTO, se ainda existir
DELETE FROM CORE_AJUDA_TELA
WHERE CODIGO_TELA = 'CAD007_RH_PONTO';

-- Remove o registro da tela CAD007_RH_PONTO em CORE_TELA, se ainda existir
DELETE FROM CORE_TELA
WHERE CODIGO_TELA = 'CAD007_RH_PONTO';

-- Garante que a tela CAD006_SEG_PERFIL esteja no módulo EMPRESA
UPDATE CORE_TELA
SET MODULO = 'EMPRESA'
WHERE CODIGO_TELA = 'CAD006_SEG_PERFIL';
