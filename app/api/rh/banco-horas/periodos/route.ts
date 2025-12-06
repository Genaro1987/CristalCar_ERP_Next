import { NextRequest, NextResponse } from "next/server";

import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { listarPeriodosPorFuncionarioAno } from "@/db/rhBancoHorasPeriodo";

function parseSituacoes(searchParams: URLSearchParams): string[] | undefined {
  const situacoesQuery = searchParams.getAll("situacoes");
  if (situacoesQuery.length === 0) {
    const unicoParametro = searchParams.get("situacoes");
    if (!unicoParametro) return undefined;
    return unicoParametro.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return situacoesQuery.flatMap((s) => s.split(",").map((item) => item.trim())).filter(Boolean);
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const search = request.nextUrl.searchParams;
  const funcionarioId = search.get("funcionarioId") ?? "";
  const anoReferencia = Number(search.get("ano"));
  const situacoes = parseSituacoes(search);

  if (!funcionarioId || !Number.isFinite(anoReferencia)) {
    return NextResponse.json({ success: false, error: "PARAMETROS_INVALIDOS" }, { status: 400 });
  }

  try {
    const periodos = await listarPeriodosPorFuncionarioAno(empresaId, funcionarioId, anoReferencia, {
      situacoes,
    });

    return NextResponse.json({ success: true, data: periodos });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "ERRO_INESPERADO" }, { status: 500 });
  }
}
