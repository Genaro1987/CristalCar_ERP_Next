"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { HelpPanel, type HelpData } from "./HelpPanel";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";

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

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

export default function LayoutShell({ children }: LayoutShellProps) {
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [ajudaCarregando, setAjudaCarregando] = useState(false);
  const [dadosAjuda, setDadosAjuda] = useState<HelpData | null>(null);
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const isMobile = useIsMobile();

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

  const toggleSidebar = useCallback(() => {
    setSidebarAberta((prev) => !prev);
  }, []);

  const fecharSidebar = useCallback(() => {
    setSidebarAberta(false);
  }, []);

  useEffect(() => {
    if (isMobile && sidebarAberta) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, sidebarAberta]);

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
        {isMobile && sidebarAberta && (
          <div className="mobile-sidebar-backdrop" onClick={fecharSidebar} />
        )}
        <Sidebar
          mobileAberta={isMobile && sidebarAberta}
          onNavegar={isMobile ? fecharSidebar : undefined}
        />

        {isMobile && (
          <MobileHeader onToggleSidebar={toggleSidebar} sidebarAberta={sidebarAberta} />
        )}

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

        {isMobile && <MobileBottomNav />}
      </div>
    </HelpContext.Provider>
  );
}
