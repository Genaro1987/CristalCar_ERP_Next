"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type EmpresaAtual = {
  nomeFantasia: string;
  logoUrl?: string | null;
};

export function Sidebar() {
  const [empresa, setEmpresa] = useState<EmpresaAtual | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nome = localStorage.getItem("EMPRESA_ATUAL_NOME");
    const logo = localStorage.getItem("EMPRESA_ATUAL_LOGO_URL");
    if (nome) {
      setEmpresa({ nomeFantasia: nome, logoUrl: logo });
    }
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo-block">
        {empresa?.logoUrl ? (
          <img
            src={empresa.logoUrl}
            alt={empresa.nomeFantasia}
            className="sidebar-logo-img"
          />
        ) : (
          <div className="sidebar-logo-placeholder">CristalCar ERP</div>
        )}
      </div>

      <div className="sidebar-section-header">MÓDULOS</div>

      <nav className="sidebar-nav">
        <Link href="/">CORE</Link>
        <Link href="/core/empresa/nova">CADASTROS</Link>
        <span>FINANCEIRO</span>
      </nav>
    </aside>
  );
}
