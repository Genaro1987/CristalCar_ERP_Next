"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";

type ModuloSistema = "CORE" | "EMPRESA" | "RH" | "SEGURANCA";

interface ItemMenu {
  label: string;
  rota: string;
  modulo: ModuloSistema;
  requerEmpresa?: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const { empresa } = useEmpresaSelecionada();

  const itensMenu: ItemMenu[] = useMemo(
    () => [
      { label: "INICIAL", rota: "/", modulo: "CORE" },
      {
        label: "EMPRESA",
        rota: "/core/empresa/nova",
        modulo: "EMPRESA",
        requerEmpresa: true,
      },
      {
        label: "DEPARTAMENTOS",
        rota: "/emp/departamento",
        modulo: "EMPRESA",
        requerEmpresa: true,
      },
      {
        label: "JORNADAS",
        rota: "/rh/jornada",
        modulo: "RH",
        requerEmpresa: true,
      },
      {
        label: "FUNCIONARIOS",
        rota: "/rh/funcionario",
        modulo: "RH",
        requerEmpresa: true,
      },
      {
        label: "LANCAMENTO DE PONTO",
        rota: "/rh/ponto",
        modulo: "RH",
        requerEmpresa: true,
      },
      {
        label: "PERFIS DE ACESSO",
        rota: "/seg/perfil",
        modulo: "SEGURANCA",
        requerEmpresa: true,
      },
    ],
    []
  );

  const possuiEmpresaSelecionada = Boolean(empresa?.id);

  const itensVisiveis = itensMenu.filter((item) => {
    if (item.requerEmpresa && !possuiEmpresaSelecionada) return false;
    return true;
  });

  const isAjuda = pathname.startsWith("/ajuda");

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-logo-block">
          {empresa?.logoUrl ? (
            <img
              src={empresa.logoUrl}
              alt={empresa.nomeFantasia ?? "Logo empresa"}
              className="sidebar-logo-image"
            />
          ) : (
            <div className="sidebar-logo-pill">CristalCar ERP</div>
          )}
        </div>

        <div className="sidebar-section-header">CADASTROS</div>

        <nav className="sidebar-nav">
          {itensVisiveis.map((item) => {
            const ativo =
              item.rota === "/"
                ? pathname === item.rota
                : pathname.startsWith(item.rota);

            return (
              <Link
                key={item.rota}
                href={item.rota}
                className={ativo ? "sidebar-nav-item active" : "sidebar-nav-item"}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <Link
          href="/ajuda"
          className={
            isAjuda ? "sidebar-help-link active" : "sidebar-help-link"
          }
        >
          AJUDA
        </Link>
      </div>
    </aside>
  );
}
