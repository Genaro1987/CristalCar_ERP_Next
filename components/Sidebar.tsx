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

  return (
    <aside className="sidebar">
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

      <div className="sidebar-help-link">
        <Link href="/ajuda">AJUDA</Link>
      </div>

      <div className="sidebar-section-header">CADASTROS</div>

      <nav className="sidebar-nav">
        <Link
          href="/"
          className={
            pathname === "/" ? "sidebar-nav-item active" : "sidebar-nav-item"
          }
        >
          INICIAL
        </Link>
        <Link
          href="/core/empresa/nova"
          className={
            pathname.startsWith("/core/empresa")
              ? "sidebar-nav-item active"
              : "sidebar-nav-item"
          }
        >
          EMPRESA
        </Link>
        <span className="sidebar-nav-item disabled">FINANCEIRO</span>
      </nav>
    </aside>
  );
}
