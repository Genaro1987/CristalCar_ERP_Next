import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const term = searchParams.get("q")?.trim();

    let sql = `
      SELECT ID_TELA, CODIGO_TELA, NOME_TELA, MODULO, CAMINHO_ROTA
      FROM CORE_TELA
    `;
    const args: string[] = [];

    if (term) {
      sql += " WHERE CODIGO_TELA LIKE ? OR NOME_TELA LIKE ?";
      const likeTerm = `%${term}%`;
      args.push(likeTerm, likeTerm);
    }

    const resultado = await db.execute({ sql, args });
    return NextResponse.json({ success: true, telas: resultado.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
