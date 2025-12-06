import { NextRequest, NextResponse } from "next/server";

import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface FecharPeriodoPayload {
  idFuncionario?: string;
  anoReferencia?: number;
  mesReferencia?: number;
  saldoAnteriorMinutos?: number;
  horasExtras50Minutos?: number;
  horasExtras100Minutos?: number;
  horasDevidasMinutos?: number;
  ajustesMinutos?: number;
  saldoFinalBancoMinutos?: number;
  saldoFinalParaPagarMinutos?: number;
  valorHora?: number;
  zerouBanco?: boolean;
  usuarioFechamento?: string | null;
}

function numeroOuZero(valor?: number | null) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const body = (await request.json().catch(() => null)) as FecharPeriodoPayload | null;

  const idFuncionario = body?.idFuncionario?.toString().trim();
  const anoReferencia = Number(body?.anoReferencia ?? 0);
  const mesReferencia = Number(body?.mesReferencia ?? 0);
  const mesValido = Number.isFinite(mesReferencia) && mesReferencia >= 1 && mesReferencia <= 12;

  if (!idFuncionario || !Number.isFinite(anoReferencia) || !mesValido) {
    return NextResponse.json(
      { success: false, error: "PARAMETROS_INVALIDOS" },
      { status: 400 }
    );
  }

  const competencia = `${anoReferencia}-${String(mesReferencia).padStart(2, "0")}`;
  const usuarioFechamento =
    body?.usuarioFechamento?.toString().trim() ||
    request.headers.get("x-usuario-id") ||
    request.headers.get("x-usuario") ||
    null;

  const saldoAnteriorMinutos = numeroOuZero(body?.saldoAnteriorMinutos);
  const horasExtras50Minutos = numeroOuZero(body?.horasExtras50Minutos);
  const horasExtras100Minutos = numeroOuZero(body?.horasExtras100Minutos);
  const horasDevidasMinutos = numeroOuZero(body?.horasDevidasMinutos);
  const ajustesMinutos = numeroOuZero(body?.ajustesMinutos);
  const saldoFinalBancoMinutos = numeroOuZero(body?.saldoFinalBancoMinutos);
  const saldoFinalParaPagarMinutos = numeroOuZero(body?.saldoFinalParaPagarMinutos);
  const valorHora = Number(body?.valorHora ?? 0);
  const saldoFechadoValor =
    Number.isFinite(valorHora) && valorHora !== 0
      ? (saldoFinalParaPagarMinutos / 60) * valorHora
      : null;
  const valorPagar = saldoFechadoValor && saldoFechadoValor > 0 ? saldoFechadoValor : null;
  const valorDescontar = saldoFechadoValor && saldoFechadoValor < 0 ? Math.abs(saldoFechadoValor) : null;
  const zerouBanco = body?.zerouBanco === true || body?.zerouBanco === "S";

  try {
    await db.execute("BEGIN");

    const periodo = await db.execute({
      sql: `
        SELECT ID, SITUACAO_PERIODO
          FROM RH_BANCO_HORAS_PERIODO
         WHERE ID_EMPRESA = ?
           AND ID_FUNCIONARIO = ?
           AND ANO_REFERENCIA = ?
           AND MES_REFERENCIA = ?
      `,
      args: [empresaId, idFuncionario, anoReferencia, mesReferencia],
    });

    if (periodo.rows?.length) {
      await db.execute({
        sql: `
          UPDATE RH_BANCO_HORAS_PERIODO
             SET SITUACAO_PERIODO = 'FECHADO',
                 DATA_ULTIMA_ATUALIZACAO = datetime('now'),
                 ID_USUARIO_ULTIMA_ATUALIZACAO = ?,
                 UPDATED_AT = datetime('now')
           WHERE ID_EMPRESA = ?
             AND ID_FUNCIONARIO = ?
             AND ANO_REFERENCIA = ?
             AND MES_REFERENCIA = ?
        `,
        args: [usuarioFechamento, empresaId, idFuncionario, anoReferencia, mesReferencia],
      });
    } else {
      await db.execute({
        sql: `
          INSERT INTO RH_BANCO_HORAS_PERIODO (
            ID_EMPRESA,
            ID_FUNCIONARIO,
            ANO_REFERENCIA,
            MES_REFERENCIA,
            SITUACAO_PERIODO,
            DATA_ULTIMA_ATUALIZACAO,
            ID_USUARIO_ULTIMA_ATUALIZACAO
          ) VALUES (?, ?, ?, ?, 'FECHADO', datetime('now'), ?)
        `,
        args: [empresaId, idFuncionario, anoReferencia, mesReferencia, usuarioFechamento],
      });
    }

    const fechamentoExistente = await db.execute({
      sql: `
        SELECT ID_FECHAMENTO
          FROM RH_BANCO_HORAS_FECHAMENTO
         WHERE ID_EMPRESA = ?
           AND ID_FUNCIONARIO = ?
           AND ANO = ?
           AND MES = ?
      `,
      args: [empresaId, idFuncionario, anoReferencia, mesReferencia],
    });

    if (fechamentoExistente.rows?.length) {
      await db.execute({
        sql: `
          UPDATE RH_BANCO_HORAS_FECHAMENTO
             SET SALDO_ANTERIOR_MINUTOS = ?,
                 HORAS_EXTRAS_50_MINUTOS = ?,
                 HORAS_EXTRAS_100_MINUTOS = ?,
                 HORAS_DEVIDAS_MINUTOS = ?,
                 AJUSTES_MINUTOS = ?,
                 SALDO_FINAL_MINUTOS = ?,
                 POLITICA_FALTAS = COALESCE(POLITICA_FALTAS, 'COMPENSAR_COM_HORAS_EXTRAS'),
                 ZEROU_BANCO = ?,
                 VALOR_PAGAR = ?,
                 VALOR_DESCONTAR = ?,
                 USUARIO_FECHAMENTO = ?,
                 DATA_FECHAMENTO = datetime('now'),
                 DATA_LIBERACAO_EDICAO = NULL,
                 ID_USUARIO_MASTER_LIBERACAO = NULL,
                 MOTIVO_LIBERACAO = NULL
           WHERE ID_EMPRESA = ?
             AND ID_FUNCIONARIO = ?
             AND ANO = ?
             AND MES = ?
        `,
        args: [
          saldoAnteriorMinutos,
          horasExtras50Minutos,
          horasExtras100Minutos,
          horasDevidasMinutos,
          ajustesMinutos,
          saldoFinalBancoMinutos,
          zerouBanco ? "S" : "N",
          valorPagar,
          valorDescontar,
          usuarioFechamento,
          empresaId,
          idFuncionario,
          anoReferencia,
          mesReferencia,
        ],
      });
    } else {
      await db.execute({
        sql: `
          INSERT INTO RH_BANCO_HORAS_FECHAMENTO (
            ID_EMPRESA,
            ID_FUNCIONARIO,
            ANO,
            MES,
            COMPETENCIA,
            SALDO_ANTERIOR_MINUTOS,
            HORAS_EXTRAS_50_MINUTOS,
            HORAS_EXTRAS_100_MINUTOS,
            HORAS_DEVIDAS_MINUTOS,
            AJUSTES_MINUTOS,
            SALDO_FINAL_MINUTOS,
            POLITICA_FALTAS,
            ZEROU_BANCO,
            VALOR_PAGAR,
            VALOR_DESCONTAR,
            USUARIO_FECHAMENTO,
            DATA_FECHAMENTO
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPENSAR_COM_HORAS_EXTRAS', ?, ?, ?, datetime('now'))
        `,
        args: [
          empresaId,
          idFuncionario,
          anoReferencia,
          mesReferencia,
          competencia,
          saldoAnteriorMinutos,
          horasExtras50Minutos,
          horasExtras100Minutos,
          horasDevidasMinutos,
          ajustesMinutos,
          saldoFinalBancoMinutos,
          zerouBanco ? "S" : "N",
          valorPagar,
          valorDescontar,
          usuarioFechamento,
        ],
      });
    }

    await db.execute("COMMIT");
    return NextResponse.json({
      success: true,
      data: {
        situacaoPeriodo: "FECHADO",
        usuarioFechamento,
        competencia,
      },
    });
  } catch (error) {
    console.error(error);
    await db.execute("ROLLBACK");
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
