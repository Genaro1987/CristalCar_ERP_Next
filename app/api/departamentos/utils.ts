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
