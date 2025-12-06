import { NextRequest, NextResponse } from "next/server";

import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const { searchParams } = new URL(request.url);
  const idFuncionario = searchParams.get("idFuncionario");

  if (!idFuncionario) {
    return NextResponse.json(
      { success: false, error: "ID_FUNCIONARIO_OBRIGATORIO" },
      { status: 400 }
    );
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT DISTINCT ANO, MES
        FROM RH_BANCO_HORAS_FECHAMENTO
        WHERE ID_EMPRESA = ? AND ID_FUNCIONARIO = ?
        ORDER BY ANO DESC, MES DESC
      `,
      args: [empresaId, idFuncionario],
    });

    const mesesFechados = result.rows.map((row) => ({
      ano: Number(row.ANO),
      mes: Number(row.MES),
    }));

    return NextResponse.json({
      success: true,
      data: mesesFechados,
    });
  } catch (error) {
    console.error("Erro ao buscar meses fechados:", error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
