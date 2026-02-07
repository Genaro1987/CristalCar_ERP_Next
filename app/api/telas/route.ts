import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rota = (searchParams.get("rota") ?? "").trim();
    const q = (searchParams.get("q") ?? "").trim();
    const qUpper = q ? q.toUpperCase() : null;

    if (rota) {
      const resultado = await db.execute({
        sql: `
          SELECT ID_TELA, CODIGO_TELA, NOME_TELA, MODULO, CAMINHO_ROTA
          FROM CORE_TELA
          WHERE ATIVA = 1
            AND CAMINHO_ROTA = ?
          LIMIT 1
        `,
        args: [rota],
      });

      return NextResponse.json({ success: true, tela: resultado.rows?.[0] ?? null });
    }

    const baseQuery = `
      SELECT ID_TELA, CODIGO_TELA, NOME_TELA, MODULO, CAMINHO_ROTA
      FROM CORE_TELA
      WHERE ATIVA = 1
    `;

    const sql = qUpper
      ? `${baseQuery}
          AND (
            UPPER(CODIGO_TELA) LIKE '%' || ? || '%'
            OR UPPER(NOME_TELA) LIKE '%' || ? || '%'
            OR UPPER(COALESCE(DESCRICAO_TELA, '')) LIKE '%' || ? || '%'
          )
        ORDER BY COALESCE(ORDEM_MENU, 999), MODULO, CODIGO_TELA;`
      : `${baseQuery}
        ORDER BY COALESCE(ORDEM_MENU, 999), MODULO, CODIGO_TELA;`;

    const args = qUpper ? [qUpper, qUpper, qUpper] : [];

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
