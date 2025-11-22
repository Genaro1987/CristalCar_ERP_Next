"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type EmpresaSidebar = {
  nomeFantasia: string | null;
  logoUrl?: string | null;
};

export function Sidebar() {
  const [empresaAtual, setEmpresaAtual] = useState<EmpresaSidebar | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nome = window.localStorage.getItem("EMPRESA_ATUAL_NOME");
    const logo = window.localStorage.getItem("EMPRESA_ATUAL_LOGO_URL");

    if (nome) {
      setEmpresaAtual({
        nomeFantasia: nome,
        logoUrl:
          logo && logo !== "null" && logo !== "undefined" && logo !== ""
            ? logo
            : null,
      });
    }
  }, []);

  const isInicio = pathname === "/";
  const isEmpresa = pathname.startsWith("/core/empresa");
  const isDepartamento = pathname.startsWith("/emp/departamento");
  const isAjuda = pathname.startsWith("/ajuda");

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-logo-block">
          {empresaAtual?.logoUrl ? (
            <img
              src={empresaAtual.logoUrl}
              alt={empresaAtual.nomeFantasia ?? "Logo empresa"}
              className="sidebar-logo-image"
            />
          ) : (
            <div className="sidebar-logo-pill">CristalCar ERP</div>
          )}
        </div>

        <div className="sidebar-section-header">CADASTROS</div>

        <nav className="sidebar-nav">
          <Link
            href="/"
            className={isInicio ? "sidebar-nav-item active" : "sidebar-nav-item"}
          >
            INICIAL
          </Link>
          <Link
            href="/core/empresa/nova"
            className={isEmpresa ? "sidebar-nav-item active" : "sidebar-nav-item"}
          >
            EMPRESA
          </Link>
          <Link
            href="/emp/departamento"
            className={
              isDepartamento ? "sidebar-nav-item active" : "sidebar-nav-item"
            }
          >
            DEPARTAMENTOS
          </Link>
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
