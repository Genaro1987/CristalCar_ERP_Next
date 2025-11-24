"use client";

import { useEffect, useMemo, useState } from "react";

export interface EmpresaSelecionada {
  id: number;
  nomeFantasia?: string;
  cnpj?: string;
  logoUrl?: string | null;
}

export interface UseEmpresaSelecionadaResult {
  empresa: EmpresaSelecionada | null;
  carregando: boolean;
  definirEmpresa: (empresa: EmpresaSelecionada | null) => void;
}

const CHAVE_ID = "EMPRESA_ATUAL_ID";
const CHAVE_NOME = "EMPRESA_ATUAL_NOME";
const CHAVE_CNPJ = "EMPRESA_ATUAL_CNPJ";
const CHAVE_LOGO = "EMPRESA_ATUAL_LOGO_URL";

function lerEmpresa(): EmpresaSelecionada | null {
  if (typeof window === "undefined") return null;

  const id = window.localStorage.getItem(CHAVE_ID);
  if (!id) return null;

  const idNumero = Number(id);
  if (!Number.isFinite(idNumero) || idNumero <= 0) return null;

  const nomeFantasia = window.localStorage.getItem(CHAVE_NOME) ?? undefined;
  const cnpj = window.localStorage.getItem(CHAVE_CNPJ) ?? undefined;
  const logoUrl = window.localStorage.getItem(CHAVE_LOGO);
  const logoNormalizado =
    logoUrl && logoUrl !== "null" && logoUrl !== "undefined" && logoUrl !== ""
      ? logoUrl
      : null;

  return {
    id: idNumero,
    nomeFantasia,
    cnpj,
    logoUrl: logoNormalizado,
  };
}

function persistirEmpresa(empresa: EmpresaSelecionada | null) {
  if (typeof window === "undefined") return;

  if (!empresa) {
    window.localStorage.removeItem(CHAVE_ID);
    window.localStorage.removeItem(CHAVE_NOME);
    window.localStorage.removeItem(CHAVE_CNPJ);
    window.localStorage.removeItem(CHAVE_LOGO);
    return;
  }

  window.localStorage.setItem(CHAVE_ID, String(empresa.id));
  window.localStorage.setItem(CHAVE_NOME, empresa.nomeFantasia ?? "");
  if (empresa.cnpj !== undefined) {
    window.localStorage.setItem(CHAVE_CNPJ, empresa.cnpj ?? "");
  }
  if (empresa.logoUrl !== undefined) {
    window.localStorage.setItem(CHAVE_LOGO, empresa.logoUrl ?? "");
  }
}

export function useEmpresaSelecionada(): UseEmpresaSelecionadaResult {
  const [empresa, setEmpresa] = useState<EmpresaSelecionada | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const empresaSalva = lerEmpresa();
    setEmpresa(empresaSalva);
    setCarregando(false);

    const listener = () => {
      const empresaAtualizada = lerEmpresa();
      setEmpresa(empresaAtualizada);
    };

    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  const definirEmpresa = useMemo(
    () =>
      (novaEmpresa: EmpresaSelecionada | null) => {
        persistirEmpresa(novaEmpresa);
        setEmpresa(novaEmpresa);
      },
    []
  );

  return { empresa, carregando, definirEmpresa };
}
