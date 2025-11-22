import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";

interface LayoutShellProps {
  children: ReactNode;
}

export default function LayoutShell({ children }: LayoutShellProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <div className="main-content">{children}</div>
      </div>
    </div>
  );
}
