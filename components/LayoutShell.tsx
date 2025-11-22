import Link from "next/link";
import { ReactNode } from "react";

interface LayoutShellProps {
  codigoTela: string;
  nomeTela: string;
  children: ReactNode;
}

export default function LayoutShell({
  codigoTela,
  nomeTela,
  children,
}: LayoutShellProps) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#f7f7f7",
        color: "#1f2937",
      }}
    >
      <aside
        style={{
          width: 240,
          backgroundColor: "#e5e7eb",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18 }}>CristalCar ERP</div>
        <div
          style={{
            padding: 12,
            backgroundColor: "#d1d5db",
            borderRadius: 8,
            textAlign: "center",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          LOGO EMPRESA
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Módulos</div>
          <Link style={{ color: "#111827" }} href="#">
            CORE
          </Link>
          <Link style={{ color: "#111827" }} href="#">
            CADASTROS
          </Link>
          <Link style={{ color: "#111827" }} href="#">
            FINANCEIRO
          </Link>
        </nav>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            padding: "16px 24px",
            backgroundColor: "#fff",
            borderBottom: "1px solid #e5e7eb",
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          {codigoTela} - {nomeTela}
        </header>
        <main style={{ flex: 1, padding: 24 }}>{children}</main>
      </div>
    </div>
  );
}
