import type { Row } from "@libsql/client";
import { db } from "./client";

export type MotivoFalta = {
  ID_MOTIVO: number;
  DESCRICAO: string;
  ATIVO: number;
  ORDEM_EXIBICAO: number;
};

export async function listarMotivosFaltaAtivos(): Promise<MotivoFalta[]> {
  const resultado = await db.execute({
    sql: `
      SELECT ID_MOTIVO, DESCRICAO, ATIVO, ORDEM_EXIBICAO
      FROM RH_FALTA_JUSTIFICATIVA_MOTIVO
      WHERE ATIVO = 1
      ORDER BY ORDEM_EXIBICAO
    `,
  });

  const rows = (resultado.rows ?? []) as Row[];

  return rows.map((row) => ({
    ID_MOTIVO: Number(row.ID_MOTIVO),
    DESCRICAO: String(row.DESCRICAO),
    ATIVO: Number(row.ATIVO ?? 0),
    ORDEM_EXIBICAO: Number(row.ORDEM_EXIBICAO ?? 0),
  }));
}
