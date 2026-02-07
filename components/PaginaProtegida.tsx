"use client";

import { usePermissoes } from "@/app/_hooks/usePermissoes";
import LayoutShell from "./LayoutShell";

interface PaginaProtegidaProps {
  codigoTela: string;
  children: React.ReactNode;
}

export function PaginaProtegida({ codigoTela, children }: PaginaProtegidaProps) {
  const { podeAcessar, podeEditar, permissoesCarregadas } = usePermissoes();

  if (permissoesCarregadas && !podeAcessar(codigoTela)) {
    return (
      <LayoutShell>
        <div className="page-container">
          <div className="acesso-negado-container">
            <div className="acesso-negado-icon">&#x26D4;</div>
            <h2>ACESSO NEGADO</h2>
            <p>Voce nao tem permissao para acessar esta tela.</p>
            <p className="acesso-negado-detalhe">
              Codigo da tela: <strong>{codigoTela}</strong>
            </p>
            <p className="acesso-negado-detalhe">
              Solicite ao administrador a liberacao de acesso no perfil.
            </p>
          </div>
        </div>
      </LayoutShell>
    );
  }

  const sc = permissoesCarregadas && !podeEditar(codigoTela);

  return (
    <>
      {sc && (
        <div className="somente-consulta-banner">
          MODO CONSULTA — Edicao nao permitida para este perfil
        </div>
      )}
      <div className={sc ? "somente-consulta" : ""}>
        {children}
      </div>
    </>
  );
}
