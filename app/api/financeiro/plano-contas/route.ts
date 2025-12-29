import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

const CAMPOS = [
  "FIN_PLANO_CONTA_ID",
  "FIN_PLANO_CONTA_PAI_ID",
  "FIN_PLANO_CONTA_NATUREZA",
  "FIN_PLANO_CONTA_NOME",
  "FIN_PLANO_CONTA_CODIGO",
  "FIN_PLANO_CONTA_ATIVO",
  "FIN_PLANO_CONTA_VISIVEL_DRE",
  "FIN_PLANO_CONTA_OBRIGA_CENTRO_CUSTO",
].join(", ");

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  try {
    const resultado = await db.execute({
      sql: `
        SELECT ${CAMPOS}
        FROM FIN_PLANO_CONTA
        WHERE ID_EMPRESA = ?
        ORDER BY COALESCE(FIN_PLANO_CONTA_ORDEM, 0), FIN_PLANO_CONTA_CODIGO
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
