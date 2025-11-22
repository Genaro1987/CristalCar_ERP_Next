import { NextRequest } from "next/server";

export function obterEmpresaId(request: NextRequest): number | null {
  const headerId = request.headers.get("x-empresa-id");
  const queryId = request.nextUrl.searchParams.get("empresaId");
  const valor = headerId ?? queryId;

  if (!valor) return null;

  const parsed = Number(valor);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizarTextoBasico(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .trim();
}

export function interpretarAtivo(valor: unknown): 0 | 1 {
  if (valor === 0 || valor === "0" || valor === false) {
    return 0;
  }

  return 1;
}
