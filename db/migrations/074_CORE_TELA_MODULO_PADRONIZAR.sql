-- Migration 074: Force standardize MODULO values
-- Fix screens showing as "RH" instead of "RECURSOS HUMANOS"
-- HeaderBar auto-registration was overwriting correct values

UPDATE CORE_TELA SET MODULO = 'RECURSOS HUMANOS'
WHERE MODULO = 'RH';

UPDATE CORE_TELA SET MODULO = 'CADASTROS'
WHERE MODULO IN ('CORE', 'EMPRESA', 'SEGURANCA');
