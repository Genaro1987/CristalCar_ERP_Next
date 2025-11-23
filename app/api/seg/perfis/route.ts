import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";

function obterEmpresaId(request: NextRequest): number | null {
  const headerId = request.headers.get("x-empresa-id");
  const queryId = request.nextUrl.searchParams.get("empresaId");
  const valor = headerId ?? queryId;

  if (!valor) return null;

  const parsed = Number(valor);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaId(request);

  if (!empresaId) {
    return NextResponse.json(
      { success: false, error: "EMPRESA_NAO_INFORMADA" },
      { status: 400 }
    );
  }

  try {
    const resultado = await db.execute({
      sql: `
        SELECT ID_PERFIL, ID_EMPRESA, NOME_PERFIL, DESCRICAO, ATIVO, CRIADO_EM, ATUALIZADO_EM
        FROM SEG_PERFIL
        WHERE ID_EMPRESA = ? AND ATIVO = 1
        ORDER BY ID_PERFIL
      `,
      args: [empresaId],
    });

    return NextResponse.json({ success: true, data: resultado.rows ?? [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
