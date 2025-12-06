import type { Row } from "@libsql/client";

import { db } from "./client";

export interface PeriodoBancoHoras {
  ANO_REFERENCIA: number;
  MES_REFERENCIA: number;
  SITUACAO_PERIODO: string;
}

interface PeriodoFiltro {
  situacoes?: string[];
}

function mapearPeriodo(row: Row): PeriodoBancoHoras {
  return {
    ANO_REFERENCIA: Number(row.ANO_REFERENCIA),
    MES_REFERENCIA: Number(row.MES_REFERENCIA),
    SITUACAO_PERIODO: String(row.SITUACAO_PERIODO),
  };
}

export async function listarPeriodosPorFuncionarioAno(
  idEmpresa: number,
  idFuncionario: string,
  anoReferencia: number,
  filtro?: PeriodoFiltro
): Promise<PeriodoBancoHoras[]> {
  const args: (string | number)[] = [idEmpresa, idFuncionario, anoReferencia];
  const where: string[] = [
    "ID_EMPRESA = ?",
    "ID_FUNCIONARIO = ?",
    "ANO_REFERENCIA = ?",
  ];

  if (filtro?.situacoes && filtro.situacoes.length > 0) {
    const placeholders = filtro.situacoes.map(() => "?").join(",");
    where.push(`SITUACAO_PERIODO IN (${placeholders})`);
    args.push(...filtro.situacoes);
  } else {
    where.push("SITUACAO_PERIODO != 'NAO_INICIADO'");
  }

  const resultado = await db.execute({
    sql: `
      SELECT ANO_REFERENCIA, MES_REFERENCIA, SITUACAO_PERIODO
        FROM RH_BANCO_HORAS_PERIODO
       WHERE ${where.join(" AND ")}
       ORDER BY MES_REFERENCIA
    `,
    args,
  });

  return (resultado.rows ?? []).map(mapearPeriodo);
}
