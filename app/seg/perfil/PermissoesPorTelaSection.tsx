"use client";

import React, { useMemo } from "react";

export type TipoPermissao = "acessar" | "consultar" | "editar";

export interface TelaPermissao {
  idTela: number;
  codigoTela: string;
  nomeTela: string;
  modulo: string;
  podeAcessar: boolean;
  podeConsultar: boolean;
  podeEditar: boolean;
}

export interface PermissoesPorTelaSectionProps {
  perfilCodigo: string;
  perfilNome: string;
  telas: TelaPermissao[];
  onTogglePermissao: (idTela: number, tipo: TipoPermissao) => void;
  somenteConsulta?: boolean;
}

const colTemplate = "permissoes-grid permissoes-grid-template";

export function PermissoesPorTelaSection({
  perfilCodigo,
  perfilNome,
  telas,
  onTogglePermissao,
  somenteConsulta = false,
}: PermissoesPorTelaSectionProps) {
  const telasPorModulo = useMemo(() => {
    const modulosOrdenados = Array.from(new Set(telas.map((t) => t.modulo))).sort((a, b) =>
      a.localeCompare(b)
    );

    return modulosOrdenados
      .map((modulo) => ({
        modulo,
        telas: [...telas]
          .filter((t) => t.modulo === modulo)
          .sort((a, b) => a.codigoTela.localeCompare(b.codigoTela)),
      }))
      .filter((grupo) => grupo.telas.length > 0);
  }, [telas]);

  if (!telasPorModulo.length) {
    return null;
  }

  return (
    <section className="permissoes-section">
      <h2 className="permissoes-section-title">
        Telas permitidas para o perfil selecionado
      </h2>
      <p className="permissoes-section-description">
        Configure abaixo as permissões de cada tela para o perfil em edição.
      </p>
      <p className="permissoes-section-highlight">
        Configurando acessos para: {" "}
        <span>
          {perfilCodigo} - {perfilNome}
        </span>
      </p>

      <div className="permissoes-cards">
        {telasPorModulo.map((grupo) => (
          <article key={grupo.modulo} className="permissoes-card">
            <header className="permissoes-card-header">{grupo.modulo}</header>

            <div className="permissoes-grid-header">
              <div className={colTemplate}>
                <span className="whitespace-nowrap">Código tela</span>
                <span className="whitespace-nowrap">Nome da tela</span>
                <span className="whitespace-nowrap text-center">Pode acessar</span>
                <span className="whitespace-nowrap text-center">Pode consultar</span>
                <span className="whitespace-nowrap text-center">Pode editar</span>
              </div>
            </div>

            <div className="permissoes-grid-body">
              {grupo.telas.map((tela) => (
                <div key={tela.idTela} className={`${colTemplate} permissoes-grid-row`}>
                  <div className="permissoes-grid-codigo whitespace-nowrap">
                    {tela.codigoTela}
                  </div>

                  <div className="permissoes-grid-nome">{tela.nomeTela}</div>

                  <div className="permissoes-grid-checkbox">
                    <input
                      type="checkbox"
                      className="permissoes-checkbox"
                      checked={tela.podeAcessar}
                      disabled={somenteConsulta}
                      onChange={() => onTogglePermissao(tela.idTela, "acessar")}
                    />
                  </div>

                  <div className="permissoes-grid-checkbox">
                    <input
                      type="checkbox"
                      className="permissoes-checkbox"
                      checked={tela.podeConsultar}
                      disabled={somenteConsulta || !tela.podeAcessar}
                      onChange={() => onTogglePermissao(tela.idTela, "consultar")}
                    />
                  </div>

                  <div className="permissoes-grid-checkbox">
                    <input
                      type="checkbox"
                      className="permissoes-checkbox"
                      checked={tela.podeEditar}
                      disabled={somenteConsulta || !tela.podeAcessar}
                      onChange={() => onTogglePermissao(tela.idTela, "editar")}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
