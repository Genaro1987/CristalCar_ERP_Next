import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = (searchParams.get("q") ?? "").trim();
    const qUpper = q ? q.toUpperCase() : null;

    const resultado = await db.execute({
      sql: `
        SELECT ID_TELA, CODIGO_TELA, NOME_TELA, MODULO, CAMINHO_ROTA
        FROM CORE_TELA
        WHERE ATIVA = 1
          AND (
            ? IS NULL
            OR UPPER(CODIGO_TELA) LIKE '%' || ? || '%'
            OR UPPER(NOME_TELA) LIKE '%' || ? || '%'
            OR UPPER(MODULO) LIKE '%' || ? || '%'
          )
        ORDER BY MODULO, NOME_TELA;
      `,
      args: [qUpper, qUpper, qUpper, qUpper],
    });

    return NextResponse.json({ success: true, telas: resultado.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
