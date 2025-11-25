import { db } from "@/db/client";
import { listarHistoricoSalarios } from "@/db/rhSalario";
import { NextRequest, NextResponse } from "next/server";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const funcionarioId = params.id;

  if (!funcionarioId) {
    return NextResponse.json(
      { success: false, error: "FUNCIONARIO_NAO_INFORMADO" },
      { status: 400 }
    );
  }

  try {
    const funcionarioExiste = await db.execute({
      sql: `
        SELECT 1
          FROM RH_FUNCIONARIO
         WHERE ID_EMPRESA = ?
           AND ID_FUNCIONARIO = ?
         LIMIT 1
      `,
      args: [empresaId, funcionarioId],
    });

    if (!funcionarioExiste.rows?.length) {
      return NextResponse.json(
        { success: false, error: "FUNCIONARIO_NAO_ENCONTRADO" },
        { status: 404 }
      );
    }

    const historico = await listarHistoricoSalarios(funcionarioId);

    return NextResponse.json({ success: true, data: historico });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
