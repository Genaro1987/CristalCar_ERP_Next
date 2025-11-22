"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePathname, useRouter } from "next/navigation";
import { HelpPanel, type HelpData } from "./HelpPanel";

interface LayoutShellProps {
  children: ReactNode;
}

type HelpContextValue = {
  abrirAjuda: (codigoTela: string, nomeTela?: string) => Promise<void>;
  fecharAjuda: () => void;
  ajudaAberta: boolean;
  ajudaCarregando: boolean;
  dadosAjuda: HelpData | null;
};

const HelpContext = createContext<HelpContextValue | undefined>(undefined);

export function useHelpContext() {
  const ctx = useContext(HelpContext);
  if (!ctx) {
    throw new Error("useHelpContext deve ser usado dentro de LayoutShell");
  }
  return ctx;
}

export default function LayoutShell({ children }: LayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [ajudaCarregando, setAjudaCarregando] = useState(false);
  const [dadosAjuda, setDadosAjuda] = useState<HelpData | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rotasLivres = ["/", "/ajuda"];

    if (rotasLivres.includes(pathname)) {
      return;
    }

    const empresaId = window.localStorage.getItem("EMPRESA_ATUAL_ID");

    if (!empresaId) {
      console.warn(
        "Nenhuma empresa selecionada. Redirecionando para a tela inicial."
      );
      router.push("/");
    }
  }, [pathname, router]);

  const abrirAjuda = useMemo(
    () =>
      async (codigoTela: string, nomeTela?: string) => {
        setAjudaAberta(true);
        setAjudaCarregando(true);
        setDadosAjuda({ CODIGO_TELA: codigoTela, NOME_TELA: nomeTela ?? codigoTela });
        try {
          const res = await fetch(
            `/api/ajuda?tela=${encodeURIComponent(codigoTela)}`
          );
          const data = await res.json();
          if (data.success) {
            setDadosAjuda(data.help);
          }
        } catch (error) {
          console.error("Erro ao carregar ajuda da tela", error);
        } finally {
          setAjudaCarregando(false);
        }
      },
    []
  );

  const fecharAjuda = () => {
    setAjudaAberta(false);
  };

  return (
    <HelpContext.Provider
      value={{
        abrirAjuda,
        fecharAjuda,
        ajudaAberta,
        ajudaCarregando,
        dadosAjuda,
      }}
    >
      <div className="app-shell">
        <Sidebar />
        <div className="layout-body">
          <div className={ajudaAberta ? "layout-main layout-with-help" : "layout-main"}>
            <main className="page-content">{children}</main>
            {ajudaAberta && (
              <HelpPanel
                helpData={dadosAjuda}
                onClose={fecharAjuda}
                loading={ajudaCarregando}
              />
            )}
          </div>
        </div>
      </div>
    </HelpContext.Provider>
  );
}
