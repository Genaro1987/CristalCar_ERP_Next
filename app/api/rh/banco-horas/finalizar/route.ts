import { NextRequest, NextResponse } from "next/server";

import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface FinalizarMesPayload {
  idFuncionario: string;
  ano: number;
  mes: number;
  saldoAnteriorMinutos: number;
  horasExtras50Minutos: number;
  horasExtras100Minutos: number;
  horasDevidasMinutos: number;
  ajustesMinutos: number;
  saldoFinalMinutos: number;
  politicaFaltas: "COMPENSAR_COM_HORAS_EXTRAS" | "DESCONTAR_EM_FOLHA";
  zerouBanco: boolean;
  valorPagar?: number;
  valorDescontar?: number;
  usuarioFechamento?: string;
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const body = (await request.json().catch(() => null)) as FinalizarMesPayload | null;

  if (!body || !body.idFuncionario || !body.ano || !body.mes) {
    return NextResponse.json(
      { success: false, error: "DADOS_INVALIDOS" },
      { status: 400 }
    );
  }

  const competencia = `${body.ano}-${String(body.mes).padStart(2, "0")}`;

  try {
    // Verifica se já existe fechamento para este período
    const existente = await db.execute({
      sql: `
        SELECT ID_FECHAMENTO
        FROM RH_BANCO_HORAS_FECHAMENTO
        WHERE ID_EMPRESA = ? AND ID_FUNCIONARIO = ? AND ANO = ? AND MES = ?
      `,
      args: [empresaId, body.idFuncionario, body.ano, body.mes],
    });

    if (existente.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: "MES_JA_FECHADO" },
        { status: 400 }
      );
    }

    // Insere o fechamento
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      args: [
        empresaId,
        body.idFuncionario,
        body.ano,
        body.mes,
        competencia,
        body.saldoAnteriorMinutos || 0,
        body.horasExtras50Minutos || 0,
        body.horasExtras100Minutos || 0,
        body.horasDevidasMinutos || 0,
        body.ajustesMinutos || 0,
        body.saldoFinalMinutos || 0,
        body.politicaFaltas,
        body.zerouBanco ? 'S' : 'N',
        body.valorPagar || null,
        body.valorDescontar || null,
        body.usuarioFechamento || null,
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao finalizar mês:", error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}

// Endpoint para verificar se um mês está fechado
export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const { searchParams } = new URL(request.url);
  const idFuncionario = searchParams.get("idFuncionario");
  const ano = Number(searchParams.get("ano"));
  const mes = Number(searchParams.get("mes"));

  if (!idFuncionario || !ano || !mes) {
    return NextResponse.json(
      { success: false, error: "PARAMETROS_INVALIDOS" },
      { status: 400 }
    );
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT
          ID_FECHAMENTO,
          DATA_FECHAMENTO,
          USUARIO_FECHAMENTO,
          POLITICA_FALTAS,
          ZEROU_BANCO
        FROM RH_BANCO_HORAS_FECHAMENTO
        WHERE ID_EMPRESA = ? AND ID_FUNCIONARIO = ? AND ANO = ? AND MES = ?
      `,
      args: [empresaId, idFuncionario, ano, mes],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        fechado: false,
      });
    }

    return NextResponse.json({
      success: true,
      fechado: true,
      dados: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao verificar fechamento:", error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
