import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

// GET: listar feriados da empresa
export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  try {
    const resultado = await db.execute({
      sql: `
        SELECT RH_FERIADO_ID, FERIADO_DIA, FERIADO_MES, FERIADO_DESCRICAO, FERIADO_ATIVO
        FROM RH_FERIADO
        WHERE ID_EMPRESA = ?
        ORDER BY FERIADO_MES, FERIADO_DIA
      `,
      args: [empresaId],
    });

    return NextResponse.json({ success: true, data: resultado.rows ?? [] });
  } catch (error) {
    console.error("Erro ao buscar feriados:", error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}

// POST: criar feriado
export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const body = await request.json();
  const { dia, mes, descricao } = body;

  if (!dia || !mes || dia < 1 || dia > 31 || mes < 1 || mes > 12) {
    return NextResponse.json(
      { success: false, error: "Dia e mês inválidos" },
      { status: 400 }
    );
  }

  try {
    await db.execute({
      sql: `
        INSERT INTO RH_FERIADO (ID_EMPRESA, FERIADO_DIA, FERIADO_MES, FERIADO_DESCRICAO)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (ID_EMPRESA, FERIADO_DIA, FERIADO_MES) DO UPDATE SET
          FERIADO_DESCRICAO = excluded.FERIADO_DESCRICAO,
          FERIADO_ATIVO = 1
      `,
      args: [empresaId, dia, mes, descricao ?? ""],
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar feriado:", error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}

// DELETE: excluir feriado
export async function DELETE(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json(
      { success: false, error: "ID do feriado é obrigatório" },
      { status: 400 }
    );
  }

  try {
    await db.execute({
      sql: `DELETE FROM RH_FERIADO WHERE RH_FERIADO_ID = ? AND ID_EMPRESA = ?`,
      args: [id, empresaId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir feriado:", error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
