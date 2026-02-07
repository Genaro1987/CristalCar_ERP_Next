import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const { dreId, planoContaId } = await request.json();
  if (!dreId || !planoContaId) {
    return NextResponse.json({ success: false, error: "dreId e planoContaId sao obrigatorios" }, { status: 400 });
  }

  try {
    // Check if already linked
    const existe = await db.execute({
      sql: "SELECT 1 FROM FIN_ESTRUTURA_DRE_CONTA WHERE FIN_ESTRUTURA_DRE_ID = ? AND FIN_PLANO_CONTA_ID = ?",
      args: [dreId, planoContaId],
    });

    if (existe.rows.length > 0) {
      return NextResponse.json({ success: false, error: "Conta ja vinculada a esta linha" }, { status: 400 });
    }

    await db.execute({
      sql: "INSERT INTO FIN_ESTRUTURA_DRE_CONTA (FIN_ESTRUTURA_DRE_ID, FIN_PLANO_CONTA_ID) VALUES (?, ?)",
      args: [dreId, planoContaId],
    });

    return NextResponse.json({ success: true, message: "Conta vinculada" }, { status: 201 });
  } catch (error) {
    console.error("Erro ao vincular conta:", error);
    return NextResponse.json({ success: false, error: "Erro ao vincular conta" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const { dreId, planoContaId } = await request.json();
  if (!dreId || !planoContaId) {
    return NextResponse.json({ success: false, error: "dreId e planoContaId sao obrigatorios" }, { status: 400 });
  }

  try {
    await db.execute({
      sql: "DELETE FROM FIN_ESTRUTURA_DRE_CONTA WHERE FIN_ESTRUTURA_DRE_ID = ? AND FIN_PLANO_CONTA_ID = ?",
      args: [dreId, planoContaId],
    });

    return NextResponse.json({ success: true, message: "Conta desvinculada" });
  } catch (error) {
    console.error("Erro ao desvincular conta:", error);
    return NextResponse.json({ success: false, error: "Erro ao desvincular conta" }, { status: 500 });
  }
}
