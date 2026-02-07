import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const empresaId = request.headers.get("x-empresa-id");
  const perfilId = request.nextUrl.searchParams.get("perfilId");

  if (!empresaId || !perfilId) {
    return NextResponse.json(
      { success: false, error: "PARAMETROS_OBRIGATORIOS" },
      { status: 400 }
    );
  }

  try {
    const perfil = await db.execute({
      sql: "SELECT 1 FROM SEG_PERFIL WHERE ID_PERFIL = ? AND ID_EMPRESA = ? AND ATIVO = 1 LIMIT 1",
      args: [perfilId, Number(empresaId)],
    });

    if (!perfil.rows?.length) {
      return NextResponse.json(
        { success: false, error: "PERFIL_NAO_ENCONTRADO" },
        { status: 404 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT T.CODIGO_TELA, PT.PODE_ACESSAR, PT.PODE_CONSULTAR, PT.PODE_EDITAR
        FROM SEG_PERFIL_TELA PT
        JOIN CORE_TELA T ON T.ID_TELA = PT.ID_TELA
        WHERE PT.ID_PERFIL = ?
          AND T.ATIVA = 1
          AND PT.PODE_ACESSAR = 1
      `,
      args: [perfilId],
    });

    const telas: Record<string, { acessar: boolean; consultar: boolean; editar: boolean }> = {};

    for (const row of result.rows ?? []) {
      const cod = String(row.CODIGO_TELA).toUpperCase();
      telas[cod] = {
        acessar: row.PODE_ACESSAR === 1 || row.PODE_ACESSAR === "1",
        consultar: row.PODE_CONSULTAR === 1 || row.PODE_CONSULTAR === "1",
        editar: row.PODE_EDITAR === 1 || row.PODE_EDITAR === "1",
      };
    }

    return NextResponse.json({ success: true, data: telas });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
