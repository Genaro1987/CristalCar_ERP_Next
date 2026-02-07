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
    const resultado = await db.execute({
      sql: `
        SELECT DISTINCT CAST(strftime('%Y', DATA_REFERENCIA) AS INTEGER) as ANO
        FROM RH_PONTO_LANCAMENTO
        WHERE ID_EMPRESA = ?
        ORDER BY ANO DESC
      `,
      args: [empresaId],
    });

    const anos = resultado.rows.map((r: any) => Number(r.ANO)).filter((a) => a > 0);

    if (anos.length === 0) {
      anos.push(new Date().getFullYear());
    }

    return NextResponse.json({ success: true, data: anos });
  } catch (error) {
    console.error("Erro ao buscar anos disponíveis:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar anos disponíveis" },
      { status: 500 }
    );
  }
}
