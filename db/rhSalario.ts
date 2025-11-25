import { db } from "./client";

export type RegistroSalario = {
  ID_SALARIO: number;
  ID_FUNCIONARIO: string;
  DATA_INICIO_VIGENCIA: string;
  DATA_FIM_VIGENCIA: string | null;
  TIPO_SALARIO: string;
  VALOR: number;
  OBSERVACAO: string | null;
};

export async function getSalarioAtual(
  idFuncionario: string
): Promise<RegistroSalario | null> {
  const resultado = await db.execute({
    sql: `
      SELECT ID_SALARIO, ID_FUNCIONARIO, DATA_INICIO_VIGENCIA, DATA_FIM_VIGENCIA,
             TIPO_SALARIO, VALOR, OBSERVACAO
      FROM RH_FUNCIONARIO_SALARIO
      WHERE ID_FUNCIONARIO = ? AND DATA_FIM_VIGENCIA IS NULL
      ORDER BY DATA_INICIO_VIGENCIA DESC
      LIMIT 1
    `,
    args: [idFuncionario],
  });

  return (resultado.rows?.[0] as RegistroSalario | undefined) ?? null;
}

export async function listarHistoricoSalarios(
  idFuncionario: string
): Promise<RegistroSalario[]> {
  const resultado = await db.execute({
    sql: `
      SELECT ID_SALARIO, ID_FUNCIONARIO, DATA_INICIO_VIGENCIA, DATA_FIM_VIGENCIA,
             TIPO_SALARIO, VALOR, OBSERVACAO
      FROM RH_FUNCIONARIO_SALARIO
      WHERE ID_FUNCIONARIO = ?
      ORDER BY DATA_INICIO_VIGENCIA DESC
    `,
    args: [idFuncionario],
  });

  return (resultado.rows as RegistroSalario[]) ?? [];
}

export async function atualizarSalario(
  idFuncionario: string,
  novoValor: number,
  observacao?: string | null
): Promise<void> {
  const agora = new Date().toISOString().slice(0, 10);

  await db.execute({
    sql: `
      UPDATE RH_FUNCIONARIO_SALARIO
         SET DATA_FIM_VIGENCIA = ?,
             UPDATED_AT = datetime('now')
       WHERE ID_FUNCIONARIO = ?
         AND DATA_FIM_VIGENCIA IS NULL
    `,
    args: [agora, idFuncionario],
  });

  await db.execute({
    sql: `
      INSERT INTO RH_FUNCIONARIO_SALARIO (
        ID_FUNCIONARIO,
        DATA_INICIO_VIGENCIA,
        DATA_FIM_VIGENCIA,
        TIPO_SALARIO,
        VALOR,
        OBSERVACAO,
        CREATED_AT,
        UPDATED_AT
      ) VALUES (?, ?, NULL, 'MENSAL', ?, ?, datetime('now'), datetime('now'))
    `,
    args: [idFuncionario, agora, novoValor, observacao ?? null],
  });
}
