import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT DISTINCT CAST(strftime('%Y', FIN_LANCAMENTO_DATA) AS INTEGER) as ANO
        FROM FIN_LANCAMENTO
        WHERE EMPRESA_ID = ?
        ORDER BY ANO DESC
      `,
      args: [empresaId],
    });

    const anos = result.rows.map((r: any) => Number(r.ANO)).filter((a: number) => a > 0);

    if (anos.length === 0) {
      anos.push(new Date().getFullYear());
    }

    return NextResponse.json({ success: true, data: anos });
  } catch (error) {
    console.error("Erro ao buscar anos disponíveis:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar anos" },
      { status: 500 }
    );
  }
}
