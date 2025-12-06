import { NextRequest, NextResponse } from "next/server";

import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface ReabrirPeriodoPayload {
  idFuncionario?: string;
  anoReferencia?: number;
  mesReferencia?: number;
  usuarioMaster?: string;
  senhaMaster?: string;
  motivoLiberacao?: string;
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const body = (await request.json().catch(() => null)) as ReabrirPeriodoPayload | null;

  const idFuncionario = body?.idFuncionario?.toString().trim();
  const anoReferencia = Number(body?.anoReferencia ?? 0);
  const mesReferencia = Number(body?.mesReferencia ?? 0);
  const usuarioMaster = body?.usuarioMaster?.toString().trim();
  const senhaMaster = body?.senhaMaster?.toString().trim();
  const motivoLiberacao = body?.motivoLiberacao?.toString().trim() || null;

  const mesValido = Number.isFinite(mesReferencia) && mesReferencia >= 1 && mesReferencia <= 12;

  if (!idFuncionario || !Number.isFinite(anoReferencia) || !mesValido) {
    return NextResponse.json(
      { success: false, error: "PARAMETROS_INVALIDOS" },
      { status: 400 }
    );
  }

  if (!usuarioMaster || !senhaMaster) {
    return NextResponse.json({ success: false, error: "CREDENCIAIS_INVALIDAS" }, { status: 401 });
  }

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

    const situacaoAtual = String(periodo.rows?.[0]?.SITUACAO_PERIODO ?? "");

    if (!periodo.rows?.length) {
      await db.execute("ROLLBACK");
      return NextResponse.json({ success: false, error: "PERIODO_NAO_ENCONTRADO" }, { status: 404 });
    }

    if (situacaoAtual !== "FECHADO") {
      await db.execute("ROLLBACK");
      return NextResponse.json({ success: false, error: "SITUACAO_INVALIDA" }, { status: 400 });
    }

    await db.execute({
      sql: `
        UPDATE RH_BANCO_HORAS_PERIODO
           SET SITUACAO_PERIODO = 'REABERTO',
               DATA_ULTIMA_ATUALIZACAO = datetime('now'),
               ID_USUARIO_ULTIMA_ATUALIZACAO = ?,
               UPDATED_AT = datetime('now')
         WHERE ID_EMPRESA = ?
           AND ID_FUNCIONARIO = ?
           AND ANO_REFERENCIA = ?
           AND MES_REFERENCIA = ?
      `,
      args: [usuarioMaster, empresaId, idFuncionario, anoReferencia, mesReferencia],
    });

    const motivoLimitado = motivoLiberacao ? motivoLiberacao.slice(0, 255) : null;

    const fechamentoExiste = await db.execute({
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

    if (fechamentoExiste.rows?.length) {
      await db.execute({
        sql: `
          UPDATE RH_BANCO_HORAS_FECHAMENTO
             SET DATA_LIBERACAO_EDICAO = datetime('now'),
                 ID_USUARIO_MASTER_LIBERACAO = ?,
                 MOTIVO_LIBERACAO = ?
           WHERE ID_EMPRESA = ?
             AND ID_FUNCIONARIO = ?
             AND ANO = ?
             AND MES = ?
        `,
        args: [usuarioMaster, motivoLimitado, empresaId, idFuncionario, anoReferencia, mesReferencia],
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
            DATA_FECHAMENTO,
            DATA_LIBERACAO_EDICAO,
            ID_USUARIO_MASTER_LIBERACAO,
            MOTIVO_LIBERACAO
          ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 'COMPENSAR_COM_HORAS_EXTRAS', 'N', NULL, NULL, NULL, datetime('now'), ?, ?)
        `,
        args: [
          empresaId,
          idFuncionario,
          anoReferencia,
          mesReferencia,
          `${anoReferencia}-${String(mesReferencia).padStart(2, "0")}`,
          usuarioMaster,
          motivoLimitado,
        ],
      });
    }

    await db.execute("COMMIT");

    return NextResponse.json({
      success: true,
      data: {
        situacaoPeriodo: "REABERTO",
        usuarioMaster,
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
