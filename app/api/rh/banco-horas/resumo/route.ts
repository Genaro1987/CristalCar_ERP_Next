import { NextRequest, NextResponse } from "next/server";

import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";
import {
  calcularBancoHorasMes,
  PoliticaFaltas,
} from "@/db/rhBancoHoras";

function parseBoolean(value: string | null): boolean {
  return value === "true" || value === "1" || value === "on";
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const search = request.nextUrl.searchParams;
  const idFuncionario = search.get("idFuncionario") ?? "";
  const ano = Number(search.get("ano"));
  const mes = Number(search.get("mes"));
  const politica = (search.get("politicaFaltas") as PoliticaFaltas | null) ?? "COMPENSAR_COM_HORAS_EXTRAS";
  const zerar = parseBoolean(search.get("zerarBancoNoMes"));

  if (!idFuncionario || !Number.isFinite(ano) || !Number.isFinite(mes)) {
    return NextResponse.json(
      { success: false, error: "PARAMETROS_INVALIDOS" },
      { status: 400 }
    );
  }

  try {
    const resumo = await calcularBancoHorasMes({
      idFuncionario,
      ano,
      mes,
      politicaFaltas: politica,
      zerarBancoNoMes: zerar,
    });

    return NextResponse.json({ success: true, data: resumo });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "ERRO_INESPERADO" }, { status: 500 });
  }
}
