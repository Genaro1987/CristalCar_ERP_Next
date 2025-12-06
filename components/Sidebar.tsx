"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import Image from "next/image";

type SecaoMenu = {
  label: string;
  itens: ItemMenu[];
};

type ItemMenu = {
  label: string;
  rota: string;
  requerEmpresa?: boolean;
  codigoTela?: string;
};

const CHAVES_PERMISSOES = ["SEG_PERFIL_TELAS", "TELAS_PERMITIDAS", "TELAS_AUTORIZADAS"];

function extrairCodigosTela(valor: string | null): string[] {
  if (!valor) return [];

  try {
    const parsed = JSON.parse(valor);
    if (Array.isArray(parsed)) {
      if (parsed.every((item) => typeof item === "string")) {
        return parsed as string[];
      }

      if (parsed.every((item) => typeof item === "object" && item !== null)) {
        return parsed
          .map((item) => {
            const possivel = item as { CODIGO_TELA?: string; codigoTela?: string };
            return possivel?.CODIGO_TELA ?? possivel?.codigoTela;
          })
          .filter((codigo): codigo is string => Boolean(codigo));
      }
    }
  } catch (error) {
    // Ignora erros de parse e tenta fallback abaixo
  }

  return valor
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);
}

function lerTelasPermitidas(): Set<string> {
  if (typeof window === "undefined") return new Set();

  for (const chave of CHAVES_PERMISSOES) {
    const valor = window.localStorage.getItem(chave);
    const codigos = extrairCodigosTela(valor).map((codigo) => codigo.toUpperCase());

    if (codigos.length > 0) {
      return new Set(codigos);
    }
  }

  return new Set();
}

export function Sidebar() {
  const pathname = usePathname();
  const { empresa } = useEmpresaSelecionada();

  const [telasPermitidas, setTelasPermitidas] = useState<Set<string>>(new Set());

  useEffect(() => {
    setTelasPermitidas(lerTelasPermitidas());

    const listener = (event: StorageEvent) => {
      if (event.key && CHAVES_PERMISSOES.includes(event.key)) {
        setTelasPermitidas(lerTelasPermitidas());
      }
    };

    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [empresa?.id]);

  const secoesMenu: SecaoMenu[] = useMemo(
    () => [
      {
        label: "CADASTROS",
        itens: [
          { label: "Inicial", rota: "/" },
          {
            label: "Empresa",
            rota: "/core/empresa/nova",
            requerEmpresa: true,
            codigoTela: "CAD002_EMP_EMPRESA",
          },
          {
            label: "Departamentos",
            rota: "/emp/departamento",
            requerEmpresa: true,
            codigoTela: "CAD003_EMP_DEPARTAMENTO",
          },
          {
            label: "Perfis de acesso",
            rota: "/seg/perfil",
            requerEmpresa: true,
            codigoTela: "CAD006_SEG_PERFIL",
          },
        ],
      },
      {
        label: "RECURSOS HUMANOS",
        itens: [
          {
            label: "Jornadas",
            rota: "/rh/jornada",
            requerEmpresa: true,
            codigoTela: "CAD004_RH_JORNADA",
          },
          {
            label: "Funcionários",
            rota: "/rh/funcionario",
            requerEmpresa: true,
            codigoTela: "CAD005_RH_FUNCIONARIO",
          },
          {
            label: "Lançamento de ponto",
            rota: "/rh/ponto",
            requerEmpresa: true,
            codigoTela: "LAN001_RH_PONTO",
          },
          {
            label: "Banco de Horas",
            rota: "/rh/banco-horas",
            requerEmpresa: true,
            codigoTela: "REL001_RH_BANCO_HORAS",
          },
          {
            label: "Consulta Banco de Horas",
            rota: "/rh/banco-horas/consulta",
            requerEmpresa: true,
            codigoTela: "CONS001_RH_BANCO_HORAS",
          },
        ],
      },
    ],
    []
  );

  const possuiEmpresaSelecionada = Boolean(empresa?.id);

  const usuarioTemPermissao = (codigoTela?: string) => {
    if (!codigoTela) return true;
    if (telasPermitidas.size === 0) return true;
    return telasPermitidas.has(codigoTela.toUpperCase());
  };

  const filtrarItens = (itens: ItemMenu[]) =>
    itens.filter((item) => {
      if (item.requerEmpresa && !possuiEmpresaSelecionada) return false;
      if (!usuarioTemPermissao(item.codigoTela)) return false;
      return true;
    });

  const isAjuda = pathname.startsWith("/ajuda");

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-logo-block">
          {empresa?.logoUrl ? (
            <Image
              src={empresa.logoUrl}
              alt={empresa.nomeFantasia ?? "Logo empresa"}
              className="sidebar-logo-image"
              width={160}
              height={60}
              unoptimized
            />
          ) : (
            <div className="sidebar-logo-pill">CristalCar ERP</div>
          )}
        </div>

        {secoesMenu.map((secao) => {
          const itensVisiveis = filtrarItens(secao.itens);
          if (!itensVisiveis.length) return null;

          return (
            <div key={secao.label}>
              <div className="sidebar-section-header">{secao.label}</div>
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
          );
        })}
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
