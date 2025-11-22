"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

interface LayoutShellProps {
  children: ReactNode;
}

export default function LayoutShell({ children }: LayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rotasLivres = ["/", "/ajuda"];

    if (rotasLivres.includes(pathname)) {
      return;
    }

    if (pathname.startsWith("/core/empresa/nova")) {
      return;
    }

    const empresaId = window.localStorage.getItem("EMPRESA_ATUAL_ID");
    if (!empresaId) {
      router.push("/");
    }
  }, [pathname, router]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <div className="main-content">{children}</div>
      </div>
    </div>
  );
}
