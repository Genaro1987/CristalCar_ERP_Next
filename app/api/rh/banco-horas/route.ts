import { NextRequest, NextResponse } from "next/server";

import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";
import { listarResumoBancoHorasPorFuncionario } from "@/db/rhBancoHoras";

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const competencia = request.nextUrl.searchParams.get("competencia") ?? "";
  const funcionario = request.nextUrl.searchParams.get("funcionario") ?? undefined;
  const departamento = request.nextUrl.searchParams.get("departamento");
  const idDepartamento = Number(departamento ?? NaN);

  if (!competencia) {
    return NextResponse.json(
      { success: false, error: "COMPETENCIA_OBRIGATORIA" },
      { status: 400 }
    );
  }

  try {
    const resumo = await listarResumoBancoHorasPorFuncionario(empresaId, competencia, {
      idFuncionario: funcionario || undefined,
      idDepartamento: Number.isFinite(idDepartamento) ? idDepartamento : undefined,
    });

    return NextResponse.json({ success: true, data: resumo });
  } catch (error) {
    console.error(error);
    const mensagemErro =
      error instanceof Error && error.message.toLowerCase().includes("compet")
        ? { success: false, error: "COMPETENCIA_INVALIDA" }
        : { success: false, error: "ERRO_INESPERADO" };

    return NextResponse.json(mensagemErro, {
      status: mensagemErro.error === "COMPETENCIA_INVALIDA" ? 400 : 500,
    });
  }
}
