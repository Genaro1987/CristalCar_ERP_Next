import { db } from "@/db/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codigoTela = searchParams.get("tela")?.trim();

    if (!codigoTela) {
      return NextResponse.json(
        { success: false, error: "CODIGO_TELA_OBRIGATORIO" },
        { status: 400 }
      );
    }

    const resultado = await db.execute({
      sql: `
        SELECT
          T.CODIGO_TELA,
          T.NOME_TELA,
          T.MODULO,
          T.CAMINHO_ROTA,
          A.OBJETIVO_TELA,
          A.QUANDO_UTILIZAR,
          A.DESCRICAO_PROCESSO,
          A.PASSO_A_PASSO,
          A.CAMPOS_OBRIGATORIOS,
          A.CAMPOS_OPCIONAIS,
          A.REFLEXOS_PROCESSO,
          A.ERROS_COMUNS
        FROM CORE_TELA T
        LEFT JOIN CORE_AJUDA_TELA A ON A.ID_TELA = T.ID_TELA
        WHERE T.CODIGO_TELA = ?
      `,
      args: [codigoTela],
    });

    const help = resultado.rows?.[0];

    if (!help) {
      return NextResponse.json(
        { success: false, error: "AJUDA_NAO_ENCONTRADA" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, help });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
