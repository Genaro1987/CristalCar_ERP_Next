"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "SEG_PERMISSOES_TELA";

export type PermissaoTela = {
  acessar: boolean;
  consultar: boolean;
  editar: boolean;
};

export type PermissoesData = {
  perfilId: string;
  perfilNome: string;
  telas: Record<string, PermissaoTela>;
};

function lerPermissoes(): PermissoesData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PermissoesData;
  } catch {
    return null;
  }
}

export function salvarPermissoesLocal(data: PermissoesData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function limparPermissoesLocal() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function usePermissoes() {
  const [data, setData] = useState<PermissoesData | null>(null);

  useEffect(() => {
    setData(lerPermissoes());

    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setData(lerPermissoes());
      }
    };

    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  const permissoesCarregadas = data !== null && Object.keys(data.telas).length > 0;

  const podeAcessar = useCallback(
    (codigoTela: string): boolean => {
      if (!data || !permissoesCarregadas) return true;
      const perm = data.telas[codigoTela.toUpperCase()];
      if (!perm) return false;
      return perm.acessar;
    },
    [data, permissoesCarregadas]
  );

  const podeConsultar = useCallback(
    (codigoTela: string): boolean => {
      if (!data || !permissoesCarregadas) return true;
      const perm = data.telas[codigoTela.toUpperCase()];
      if (!perm) return false;
      return perm.consultar;
    },
    [data, permissoesCarregadas]
  );

  const podeEditar = useCallback(
    (codigoTela: string): boolean => {
      if (!data || !permissoesCarregadas) return true;
      const perm = data.telas[codigoTela.toUpperCase()];
      if (!perm) return false;
      return perm.editar;
    },
    [data, permissoesCarregadas]
  );

  const somenteConsulta = useCallback(
    (codigoTela: string): boolean => {
      if (!data || !permissoesCarregadas) return false;
      const perm = data.telas[codigoTela.toUpperCase()];
      if (!perm) return true;
      return perm.acessar && perm.consultar && !perm.editar;
    },
    [data, permissoesCarregadas]
  );

  const aplicarPerfil = useCallback(
    async (perfilId: string, perfilNome: string, empresaId: number) => {
      try {
        const res = await fetch(
          `/api/seg/permissoes?perfilId=${encodeURIComponent(perfilId)}`,
          { headers: { "x-empresa-id": String(empresaId) } }
        );
        const json = await res.json();
        if (json.success && json.data) {
          const permissoes: PermissoesData = {
            perfilId,
            perfilNome,
            telas: json.data,
          };
          salvarPermissoesLocal(permissoes);
          setData(permissoes);
          return true;
        }
        return false;
      } catch (error) {
        console.error("Erro ao carregar permissoes do perfil:", error);
        return false;
      }
    },
    []
  );

  const limparPermissoes = useCallback(() => {
    limparPermissoesLocal();
    setData(null);
  }, []);

  return {
    perfilAtivo: data?.perfilId ?? null,
    perfilNome: data?.perfilNome ?? null,
    permissoesCarregadas,
    podeAcessar,
    podeConsultar,
    podeEditar,
    somenteConsulta,
    aplicarPerfil,
    limparPermissoes,
  };
}
