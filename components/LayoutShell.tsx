import Link from "next/link";
import { ReactNode } from "react";

interface LayoutShellProps {
  header?: ReactNode;
  children: ReactNode;
}

export default function LayoutShell({ header, children }: LayoutShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">CristalCar ERP</div>
        <div className="sidebar-logo-placeholder">LOGO EMPRESA</div>

        <div className="sidebar-section">
          <div className="sidebar-section-header">MÓDULOS</div>
          <nav className="sidebar-nav">
            <Link href="#">CORE</Link>
            <Link href="#">CADASTROS</Link>
            <Link href="#">FINANCEIRO</Link>
          </nav>
        </div>
      </aside>

      <div className="main-area">
        {header}
        <div className="main-content">{children}</div>
      </div>
    </div>
  );
}
