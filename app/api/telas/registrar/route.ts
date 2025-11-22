import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const codigoTela: string = body.codigoTela;
    const nomeTela: string = body.nomeTela;
    const modulo: string = body.modulo ?? "";
    const caminhoRota: string = body.caminhoRota ?? "";

    if (!codigoTela || !nomeTela) {
      return NextResponse.json(
        { success: false, error: "DADOS_INVALIDOS" },
        { status: 400 }
      );
    }

    const consulta = await db.execute({
      sql: "SELECT ID_TELA FROM CORE_TELA WHERE CODIGO_TELA = ?",
      args: [codigoTela],
    });

    if (consulta.rows.length > 0) {
      await db.execute({
        sql: `
          UPDATE CORE_TELA
          SET NOME_TELA = ?, MODULO = ?, CAMINHO_ROTA = ?, DATA_ATUALIZACAO = datetime('now')
          WHERE CODIGO_TELA = ?
        `,
        args: [nomeTela, modulo, caminhoRota, codigoTela],
      });
    } else {
      await db.execute({
        sql: `
          INSERT INTO CORE_TELA (CODIGO_TELA, NOME_TELA, MODULO, CAMINHO_ROTA, ATIVA, DATA_CADASTRO)
          VALUES (?, ?, ?, ?, 1, datetime('now'))
        `,
        args: [codigoTela, nomeTela, modulo, caminhoRota],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "ERRO_INESPERADO" }, { status: 500 });
  }
}
