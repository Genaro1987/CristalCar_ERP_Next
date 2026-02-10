"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { usePermissoes } from "@/app/_hooks/usePermissoes";

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

function IconObjetivos() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconProlabore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <line x1="2" y1="9" x2="22" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
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

function IconGeneric() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

type TabConfig = {
  label: string;
  rota: string;
  icon: () => React.JSX.Element;
  codigoTela?: string;
};

/* Tabs principais desejados (em ordem de prioridade) */
var tabsPrincipais: TabConfig[] = [
  { label: "RH", rota: "/rh/resumo", icon: IconRH, codigoTela: "RH_RESUMO" },
  { label: "Financeiro", rota: "/financeiro/dashboard", icon: IconFinanceiro, codigoTela: "FIN_DASHBOARD" },
  { label: "DRE", rota: "/financeiro/dre", icon: IconDRE, codigoTela: "FIN_DRE" },
  { label: "Objetivos", rota: "/financeiro/objetivos/acompanhamento", icon: IconObjetivos, codigoTela: "FIN_OBJETIVOS" },
  { label: "Prolabore", rota: "/financeiro/extrato-prolabore", icon: IconProlabore, codigoTela: "FIN_PROLABORE" },
];

/* Pool de telas de fallback (Home, Ajuda + outras telas) */
var tabsFallback: TabConfig[] = [
  { label: "Início", rota: "/", icon: IconHome },
  { label: "Ajuda", rota: "/ajuda", icon: IconAjuda },
  { label: "Ponto", rota: "/rh/ponto", icon: IconRH, codigoTela: "LAN001_RH_PONTO" },
  { label: "Caixa", rota: "/financeiro/lancamentos", icon: IconFinanceiro, codigoTela: "FIN_LANCAMENTOS" },
  { label: "Plano Contas", rota: "/financeiro/plano-conta", icon: IconGeneric, codigoTela: "FIN_PLANO_CONTA" },
  { label: "Rel. Caixa", rota: "/financeiro/relatorio-caixa", icon: IconGeneric, codigoTela: "FIN_REL_CAIXA" },
  { label: "Funcionarios", rota: "/rh/funcionario", icon: IconRH, codigoTela: "CAD005_RH_FUNCIONARIO" },
  { label: "Empresa", rota: "/core/empresa/nova", icon: IconGeneric, codigoTela: "CAD002_EMP_EMPRESA" },
  { label: "Depto.", rota: "/emp/departamento", icon: IconGeneric, codigoTela: "CAD003_EMP_DEPARTAMENTO" },
];

var MAX_TABS = 5;

export function MobileBottomNav() {
  var pathname = usePathname();
  var { podeAcessar, permissoesCarregadas } = usePermissoes();

  var tabsVisiveis = useMemo(function () {
    /* Sem permissões carregadas: mostra os 5 principais */
    if (!permissoesCarregadas) {
      return tabsPrincipais.slice(0, MAX_TABS);
    }

    /* Filtra tabs principais que o usuário tem acesso */
    var permitidos: TabConfig[] = [];
    for (var i = 0; i < tabsPrincipais.length; i++) {
      var tab = tabsPrincipais[i];
      if (!tab.codigoTela || podeAcessar(tab.codigoTela)) {
        permitidos.push(tab);
      }
    }

    /* Se já tem 5, retorna direto */
    if (permitidos.length >= MAX_TABS) {
      return permitidos.slice(0, MAX_TABS);
    }

    /* Precisa completar com fallbacks */
    var rotasUsadas: Record<string, boolean> = {};
    for (var j = 0; j < permitidos.length; j++) {
      rotasUsadas[permitidos[j].rota] = true;
    }

    for (var k = 0; k < tabsFallback.length; k++) {
      if (permitidos.length >= MAX_TABS) break;
      var fb = tabsFallback[k];
      if (rotasUsadas[fb.rota]) continue;
      if (fb.codigoTela && !podeAcessar(fb.codigoTela)) continue;
      permitidos.push(fb);
      rotasUsadas[fb.rota] = true;
    }

    return permitidos.slice(0, MAX_TABS);
  }, [permissoesCarregadas, podeAcessar]);

  var isActive = function (rota: string) {
    if (rota === "/") return pathname === "/";
    return pathname.startsWith(rota);
  };

  return (
    <nav className="mobile-bottom-nav">
      {tabsVisiveis.map(function (tab) {
        var ativo = isActive(tab.rota);
        var Icon = tab.icon;
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
