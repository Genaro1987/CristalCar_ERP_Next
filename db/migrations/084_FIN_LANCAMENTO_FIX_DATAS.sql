-- ============================================================================
-- Migration 084: Corrige datas mal-formadas em FIN_LANCAMENTO
-- Problema: Datas importadas com horário ficaram como "2026 17:09-02-06"
--           quando o formato correto deveria ser "2026-02-06"
--           Origem: CSV com "06/02/2026 17:09" → split('/') gerou
--           partes[2]="2026 17:09" → resultado="2026 17:09-02-06"
-- ============================================================================

-- Pattern: "YYYY HH:MM-MM-DD" or "YYYY HH:MM:SS-MM-DD"
-- The year is first 4 chars, month-day are always the last 5 chars (-MM-DD)
-- Example: "2026 17:09-02-06" → "2026" + "-02-06" = "2026-02-06"
UPDATE FIN_LANCAMENTO
SET FIN_LANCAMENTO_DATA =
  SUBSTR(FIN_LANCAMENTO_DATA, 1, 4) ||
  SUBSTR(FIN_LANCAMENTO_DATA, -6, 6)
WHERE LENGTH(FIN_LANCAMENTO_DATA) > 10
  AND SUBSTR(FIN_LANCAMENTO_DATA, 5, 1) = ' '
  AND SUBSTR(FIN_LANCAMENTO_DATA, 1, 4) GLOB '[0-9][0-9][0-9][0-9]';

-- Also fix dates with standard ISO datetime "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
-- Just keep the first 10 chars (YYYY-MM-DD)
UPDATE FIN_LANCAMENTO
SET FIN_LANCAMENTO_DATA = SUBSTR(FIN_LANCAMENTO_DATA, 1, 10)
WHERE LENGTH(FIN_LANCAMENTO_DATA) > 10
  AND SUBSTR(FIN_LANCAMENTO_DATA, 5, 1) = '-'
  AND SUBSTR(FIN_LANCAMENTO_DATA, 8, 1) = '-';
