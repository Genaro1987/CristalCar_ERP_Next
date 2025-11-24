"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";

interface RequerEmpresaSelecionadaOptions {
  ativo?: boolean;
}

export function useRequerEmpresaSelecionada(options?: RequerEmpresaSelecionadaOptions) {
  const router = useRouter();
  const { empresa, carregando } = useEmpresaSelecionada();
  const ativo = options?.ativo ?? true;

  useEffect(() => {
    if (!ativo) return;
    if (carregando) return;

    if (!empresa?.id) {
      router.replace("/");
    }
  }, [ativo, carregando, empresa, router]);
}
