"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export const ROTAS_LIVRES = new Set([
  "/",
  "/ajuda",
  "/emp/selecao",
  "/core/empresa/nova",
]);

export function useEmpresaObrigatoria() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (ROTAS_LIVRES.has(pathname)) return;

    const empresaSelecionada = window.localStorage.getItem("EMPRESA_ATUAL_ID");

    if (!empresaSelecionada) {
      console.warn(
        "Nenhuma empresa selecionada. Redirecionando para a tela de seleção de empresa."
      );
      router.push("/emp/selecao");
    }
  }, [pathname, router]);
}
