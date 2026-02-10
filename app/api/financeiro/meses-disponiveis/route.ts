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
        SELECT DISTINCT strftime('%Y-%m', FIN_LANCAMENTO_DATA) as MES
        FROM FIN_LANCAMENTO
        WHERE EMPRESA_ID = ?
          AND FIN_LANCAMENTO_DATA IS NOT NULL
        ORDER BY MES ASC
      `,
      args: [empresaId],
    });

    const meses = result.rows
      .map((r: any) => String(r.MES))
      .filter((m: string) => m && m.length === 7);

    if (meses.length === 0) {
      const agora = new Date();
      const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
      meses.push(mesAtual);
    }

    return NextResponse.json({ success: true, data: meses });
  } catch (error) {
    console.error("Erro ao buscar meses disponiveis:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar meses" },
      { status: 500 }
    );
  }
}
