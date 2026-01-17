"use client";

import { useEffect, useState } from "react";

export type TelaFinanceira = {
  ID_TELA: number;
  CODIGO_TELA: string;
  NOME_TELA: string;
  MODULO?: string | null;
  CAMINHO_ROTA?: string | null;
};

const cacheTelas = new Map<string, TelaFinanceira>();

export function useTelaFinanceira(caminhoRota: string) {
  const [tela, setTela] = useState<TelaFinanceira | null>(() => cacheTelas.get(caminhoRota) ?? null);
  const [carregando, setCarregando] = useState(() => !cacheTelas.has(caminhoRota));

  useEffect(() => {
    let ativo = true;

    const buscarTela = async () => {
      setCarregando(true);
      try {
        const resposta = await fetch(`/api/telas?rota=${encodeURIComponent(caminhoRota)}`);
        const dados = await resposta.json();

        if (!ativo) return;

        if (resposta.ok && dados?.success && dados.tela) {
          cacheTelas.set(caminhoRota, dados.tela as TelaFinanceira);
          setTela(dados.tela);
        } else {
          setTela(null);
        }
      } catch (error) {
        console.error("Erro ao buscar dados da tela:", error);
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    };

    if (!cacheTelas.has(caminhoRota)) {
      buscarTela();
    } else {
      setCarregando(false);
    }

    return () => {
      ativo = false;
    };
  }, [caminhoRota]);

  return { tela, carregando };
}
