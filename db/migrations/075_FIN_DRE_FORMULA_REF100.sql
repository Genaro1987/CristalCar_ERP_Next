-- Add formula column for calculated DRE lines (tipo = 'Calculado')
-- Stores expressions like "1 - 2 - 3" referencing other DRE line codes
ALTER TABLE FIN_ESTRUTURA_DRE ADD COLUMN FIN_ESTRUTURA_DRE_FORMULA TEXT;

-- Flag to mark which line is the 100% reference for DRE percentage calculations
ALTER TABLE FIN_ESTRUTURA_DRE ADD COLUMN FIN_ESTRUTURA_DRE_REFERENCIA_100 INTEGER NOT NULL DEFAULT 0;
