"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { usePermissoes } from "@/app/_hooks/usePermissoes";
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
  matchExact?: boolean;
};

interface SidebarProps {
  mobileAberta?: boolean;
  onNavegar?: () => void;
}

export function Sidebar({ mobileAberta, onNavegar }: SidebarProps) {
  const pathname = usePathname();
  const { empresa } = useEmpresaSelecionada();
  const { podeAcessar, permissoesCarregadas, perfilNome } = usePermissoes();

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
          {
            label: "Clientes / Fornecedores",
            rota: "/cadastros/pessoas",
            requerEmpresa: true,
            codigoTela: "CAD_PESSOA",
          },
        ],
      },
      {
        label: "RECURSOS HUMANOS",
        itens: [
          {
            label: "Dashboard RH",
            rota: "/rh/resumo",
            requerEmpresa: true,
            codigoTela: "RH_RESUMO",
          },
          {
            label: "Jornadas",
            rota: "/rh/jornada",
            requerEmpresa: true,
            codigoTela: "CAD004_RH_JORNADA",
          },
          {
            label: "Funcionarios",
            rota: "/rh/funcionario",
            requerEmpresa: true,
            codigoTela: "CAD005_RH_FUNCIONARIO",
          },
          {
            label: "Lancamento de ponto",
            rota: "/rh/ponto",
            requerEmpresa: true,
            codigoTela: "LAN001_RH_PONTO",
          },
          {
            label: "Fechamento Ponto",
            rota: "/rh/banco-horas",
            requerEmpresa: true,
            codigoTela: "REL001_RH_BANCO_HORAS",
            matchExact: true,
          },
          {
            label: "Consulta Ponto",
            rota: "/rh/banco-horas/consulta",
            requerEmpresa: true,
            codigoTela: "CONS001_RH_BANCO_HORAS",
            matchExact: true,
          },
        ],
      },
      {
        label: "FINANCEIRO",
        itens: [
          {
            label: "Dashboard",
            rota: "/financeiro/dashboard",
            requerEmpresa: true,
            codigoTela: "FIN_DASHBOARD",
            matchExact: true,
          },
          {
            label: "Lancamentos (Caixa)",
            rota: "/financeiro/lancamentos",
            requerEmpresa: true,
            codigoTela: "FIN_LANCAMENTOS",
            matchExact: true,
          },
          {
            label: "Plano de Contas",
            rota: "/financeiro/plano-conta",
            requerEmpresa: true,
            codigoTela: "FIN_PLANO_CONTA",
          },
          {
            label: "Centro de Custo",
            rota: "/financeiro/centro-custo",
            requerEmpresa: true,
            codigoTela: "FIN_CENTRO_CUSTO",
          },
          {
            label: "Estrutura do DRE",
            rota: "/financeiro/estrutura-dre",
            requerEmpresa: true,
            codigoTela: "FIN_ESTRUTURA_DRE",
          },
          {
            label: "DRE",
            rota: "/financeiro/dre",
            requerEmpresa: true,
            codigoTela: "FIN_DRE",
          },
          {
            label: "Relatorio Caixa",
            rota: "/financeiro/relatorio-caixa",
            requerEmpresa: true,
            codigoTela: "FIN_REL_CAIXA",
          },
          {
            label: "Extrato Pro-labore",
            rota: "/financeiro/extrato-prolabore",
            requerEmpresa: true,
            codigoTela: "FIN_PROLABORE",
          },
          {
            label: "Importacao de Dados",
            rota: "/financeiro/importar",
            requerEmpresa: true,
            codigoTela: "FIN_IMPORTAR",
          },
        ],
      },
      {
        label: "OBJETIVOS",
        itens: [
          {
            label: "Objetivos Financeiros",
            rota: "/financeiro/objetivos",
            requerEmpresa: true,
            codigoTela: "FIN_OBJETIVOS",
            matchExact: true,
          },
          {
            label: "Acompanhamento",
            rota: "/financeiro/objetivos/acompanhamento",
            requerEmpresa: true,
            codigoTela: "FIN_OBJETIVOS",
            matchExact: true,
          },
          {
            label: "Objetivos Semanais",
            rota: "/financeiro/objetivos-semanais",
            requerEmpresa: true,
            codigoTela: "FIN_OBJETIVOS_SEMANAIS",
            matchExact: true,
          },
        ],
      },
    ],
    []
  );

  const possuiEmpresaSelecionada = Boolean(empresa?.id);

  const filtrarItens = (itens: ItemMenu[]) =>
    itens.filter((item) => {
      if (item.requerEmpresa && !possuiEmpresaSelecionada) return false;
      if (!item.codigoTela) return true;
      if (!permissoesCarregadas) return true;
      return podeAcessar(item.codigoTela);
    });

  const isAjuda = pathname.startsWith("/ajuda");

  const sidebarClass = mobileAberta ? "sidebar sidebar-mobile-open" : "sidebar";

  return (
    <aside className={sidebarClass}>
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
                  const ativo = item.matchExact
                    ? pathname === item.rota
                    : item.rota === "/"
                      ? pathname === item.rota
                      : pathname.startsWith(item.rota);

                  return (
                    <Link
                      key={item.rota}
                      href={item.rota}
                      className={ativo ? "sidebar-nav-item active" : "sidebar-nav-item"}
                      onClick={onNavegar}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}

        <div style={{ marginTop: 8 }}>
          <nav className="sidebar-nav">
            <Link
              href="/ajuda"
              className={isAjuda ? "sidebar-nav-item active" : "sidebar-nav-item"}
              onClick={onNavegar}
            >
              Ajuda
            </Link>
          </nav>
        </div>
      </div>

      <div className="sidebar-bottom">
        {perfilNome && (
          <div className="sidebar-perfil-indicator">
            PERFIL ATIVO
            <strong>{perfilNome}</strong>
          </div>
        )}
      </div>
    </aside>
  );
}
