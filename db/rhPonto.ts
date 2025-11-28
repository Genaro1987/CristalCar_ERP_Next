import type { Row } from "@libsql/client";

import { db } from "./client";
import { gerarIntervaloCompetencia } from "@/lib/rhPontoCalculo";

export type FlagSimNao = 'S' | 'N';

export interface PontoLancamento {
  ID_PONTO: number;
  ID_EMPRESA: number;
  ID_FUNCIONARIO: string;
  DATA_REFERENCIA: string;
  ENTRADA_MANHA: string | null;
  SAIDA_MANHA: string | null;
  ENTRADA_TARDE: string | null;
  SAIDA_TARDE: string | null;
  ENTRADA_EXTRA: string | null;
  SAIDA_EXTRA: string | null;
  STATUS_DIA: string | null;
  TIPO_OCORRENCIA: string | null;
  ID_MOTIVO_FALTA: number | null;
  OBS_FALTA: string | null;
  OBSERVACAO: string | null;
  E_FERIADO: FlagSimNao;
}

export function intervaloCompetencia(competencia?: string | null) {
  return gerarIntervaloCompetencia(competencia);
}

export async function listarLancamentosDePonto(
  empresaId: number,
  funcionarioId: string,
  competencia?: string
): Promise<PontoLancamento[]> {
  const intervalo = intervaloCompetencia(competencia);

  if (!intervalo) return [];

  const resultado = await db.execute({
    sql: `
      SELECT
        ID_PONTO,
        ID_EMPRESA,
        ID_FUNCIONARIO,
        DATA_REFERENCIA,
        ENTRADA_MANHA,
        SAIDA_MANHA,
        ENTRADA_TARDE,
        SAIDA_TARDE,
        ENTRADA_EXTRA,
        SAIDA_EXTRA,
        STATUS_DIA,
        TIPO_OCORRENCIA,
        ID_MOTIVO_FALTA,
        OBS_FALTA,
        OBSERVACAO,
        COALESCE(E_FERIADO, 'N') as E_FERIADO
      FROM RH_PONTO_LANCAMENTO
      WHERE ID_EMPRESA = ?
        AND ID_FUNCIONARIO = ?
        AND DATA_REFERENCIA BETWEEN ? AND ?
      ORDER BY DATA_REFERENCIA
    `,
    args: [empresaId, funcionarioId, intervalo.inicio, intervalo.fim],
  });

  const rows = (resultado.rows ?? []) as Row[];

  return rows.map((row) => ({
    ID_PONTO: Number(row.ID_PONTO),
    ID_EMPRESA: Number(row.ID_EMPRESA),
    ID_FUNCIONARIO: String(row.ID_FUNCIONARIO),
    DATA_REFERENCIA: String(row.DATA_REFERENCIA),
    ENTRADA_MANHA: (row.ENTRADA_MANHA as string | null | undefined) ?? null,
    SAIDA_MANHA: (row.SAIDA_MANHA as string | null | undefined) ?? null,
    ENTRADA_TARDE: (row.ENTRADA_TARDE as string | null | undefined) ?? null,
    SAIDA_TARDE: (row.SAIDA_TARDE as string | null | undefined) ?? null,
    ENTRADA_EXTRA: (row.ENTRADA_EXTRA as string | null | undefined) ?? null,
    SAIDA_EXTRA: (row.SAIDA_EXTRA as string | null | undefined) ?? null,
    STATUS_DIA: (row.STATUS_DIA as string | null | undefined) ?? null,
    TIPO_OCORRENCIA: (row.TIPO_OCORRENCIA as string | null | undefined) ?? null,
    ID_MOTIVO_FALTA: (row.ID_MOTIVO_FALTA as number | null | undefined) ?? null,
    OBS_FALTA: (row.OBS_FALTA as string | null | undefined) ?? null,
    OBSERVACAO: (row.OBSERVACAO as string | null | undefined) ?? null,
    E_FERIADO: (row.E_FERIADO as FlagSimNao | null | undefined) === 'S' ? 'S' : 'N',
  }));
}
