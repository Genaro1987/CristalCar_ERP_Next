import { NextRequest, NextResponse } from "next/server";

export function obterEmpresaIdDaRequest(req: NextRequest): number | null {
  const raw = req.headers.get("x-empresa-id");
  if (!raw) return null;

  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;

  return id;
}

export function respostaEmpresaNaoSelecionada() {
  return NextResponse.json(
    {
      success: false,
      erro: "Empresa não selecionada. Selecione uma empresa para continuar.",
    },
    { status: 400 }
  );
}
