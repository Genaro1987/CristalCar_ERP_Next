import { NextRequest, NextResponse } from "next/server";

import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";
import { fecharPeriodo, reabrirPeriodo, obterSituacaoPeriodo } from "@/db/rhBancoHorasPeriodo";

interface PeriodoPayload {
  funcionarioId?: string;
  ano?: number;
  mes?: number;
  acao?: "fechar" | "reabrir";
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const funcionarioId = request.nextUrl.searchParams.get("funcionarioId") ?? "";
  const ano = Number(request.nextUrl.searchParams.get("ano") ?? 0);
  const mes = Number(request.nextUrl.searchParams.get("mes") ?? 0);

  if (
    !funcionarioId ||
    !Number.isFinite(ano) ||
    !Number.isFinite(mes) ||
    mes < 1 ||
    mes > 12
  ) {
    return NextResponse.json(
      { success: false, error: "PARAMETROS_INVALIDOS" },
      { status: 400 }
    );
  }

  try {
    const situacao = await obterSituacaoPeriodo(empresaId, funcionarioId, ano, mes);

    return NextResponse.json({ success: true, situacao: situacao ?? "NAO_INICIADO" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const body = (await request.json().catch(() => null)) as PeriodoPayload | null;

  const funcionarioId = body?.funcionarioId ?? "";
  const ano = body?.ano ?? 0;
  const mes = body?.mes ?? 0;
  const acao = body?.acao ?? "";
  const usuarioId =
    request.headers.get("x-usuario-id") ||
    request.headers.get("x-user-id") ||
    request.headers.get("x-usuario") ||
    null;

  if (
    !funcionarioId ||
    !Number.isFinite(ano) ||
    !Number.isFinite(mes) ||
    mes < 1 ||
    mes > 12 ||
    (acao !== "fechar" && acao !== "reabrir")
  ) {
    return NextResponse.json(
      { success: false, error: "PARAMETROS_INVALIDOS" },
      { status: 400 }
    );
  }

  try {
    const params = {
      idEmpresa: empresaId,
      idFuncionario: funcionarioId,
      anoReferencia: ano,
      mesReferencia: mes,
      idUsuarioUltimaAtualizacao: usuarioId,
    };

    if (acao === "fechar") {
      await fecharPeriodo(params);
    } else {
      await reabrirPeriodo(params);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
