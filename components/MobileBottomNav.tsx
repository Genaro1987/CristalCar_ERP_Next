"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconRH() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconFinanceiro() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconDRE() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconAjuda() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

const tabs = [
  { label: "Início", rota: "/", icon: IconHome },
  { label: "RH", rota: "/rh/ponto", icon: IconRH },
  { label: "Financeiro", rota: "/financeiro/dashboard", icon: IconFinanceiro },
  { label: "DRE", rota: "/financeiro/dre", icon: IconDRE },
  { label: "Ajuda", rota: "/ajuda", icon: IconAjuda },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  const isActive = (rota: string) => {
    if (rota === "/") return pathname === "/";
    return pathname.startsWith(rota);
  };

  return (
    <nav className="mobile-bottom-nav">
      {tabs.map((tab) => {
        const ativo = isActive(tab.rota);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.rota}
            href={tab.rota}
            className={ativo ? "mobile-bottom-tab mobile-bottom-tab-active" : "mobile-bottom-tab"}
          >
            <span className="mobile-bottom-icon">
              <Icon />
            </span>
            <span className="mobile-bottom-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
