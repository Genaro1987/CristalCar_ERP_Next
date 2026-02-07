"use client";

import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";

interface MobileHeaderProps {
  onToggleSidebar: () => void;
  sidebarAberta: boolean;
}

export function MobileHeader({ onToggleSidebar, sidebarAberta }: MobileHeaderProps) {
  const { empresa } = useEmpresaSelecionada();
  const nomeEmpresa = empresa?.nomeFantasia || "CristalCar ERP";

  return (
    <header className="mobile-header">
      <button
        type="button"
        className="mobile-hamburger"
        onClick={onToggleSidebar}
        aria-label={sidebarAberta ? "Fechar menu" : "Abrir menu"}
      >
        <span className={sidebarAberta ? "hamburger-line hamburger-line-x1" : "hamburger-line"} />
        <span className={sidebarAberta ? "hamburger-line hamburger-line-x2" : "hamburger-line"} />
        <span className={sidebarAberta ? "hamburger-line hamburger-line-x3" : "hamburger-line"} />
      </button>

      <span className="mobile-header-title">{nomeEmpresa}</span>

      <div style={{ width: 40 }} />
    </header>
  );
}
