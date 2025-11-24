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

const moduloOrder = ["CORE", "EMPRESA", "RH", "SEGURANCA"];
const colTemplate =
  "grid grid-cols-[minmax(160px,0.22fr)_minmax(320px,0.46fr)_minmax(130px,0.1fr)_minmax(150px,0.11fr)_minmax(130px,0.11fr)] items-center gap-x-6";

export function PermissoesPorTelaSection({
  perfilCodigo,
  perfilNome,
  telas,
  onTogglePermissao,
  somenteConsulta = false,
}: PermissoesPorTelaSectionProps) {
  const telasPorModulo = useMemo(() => {
    return moduloOrder
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
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">
        Telas permitidas para o perfil selecionado
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Configure abaixo as permissões de cada tela para o perfil em edição.
      </p>
      <p className="mt-2 text-sm font-medium text-slate-700">
        Configurando acessos para: {" "}
        <span className="font-semibold">
          {perfilCodigo} - {perfilNome}
        </span>
      </p>

      <div className="mt-6 space-y-8">
        {telasPorModulo.map((grupo) => (
          <article
            key={grupo.modulo}
            className="rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/70"
          >
            <header className="rounded-t-2xl bg-[#ff7a00] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white">
              {grupo.modulo}
            </header>

            <div className={`${colTemplate} px-6 py-3 bg-slate-50 border-b border-slate-200`}>
              <span className="text-xs font-semibold uppercase text-slate-600 whitespace-nowrap">
                Código tela
              </span>
              <span className="text-xs font-semibold uppercase text-slate-600 whitespace-nowrap">
                Nome da tela
              </span>
              <span className="text-xs font-semibold uppercase text-slate-600 whitespace-nowrap text-center">
                Pode acessar
              </span>
              <span className="text-xs font-semibold uppercase text-slate-600 whitespace-nowrap text-center">
                Pode consultar
              </span>
              <span className="text-xs font-semibold uppercase text-slate-600 whitespace-nowrap text-center">
                Pode editar
              </span>
            </div>

            <div className="px-6 pb-4">
              {grupo.telas.map((tela) => (
                <div
                  key={tela.idTela}
                  className={`${colTemplate} px-0 py-2 border-t border-slate-100`}
                >
                  <div className="text-sm font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {tela.codigoTela}
                  </div>

                  <div className="text-sm text-slate-800">{tela.nomeTela}</div>

                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#ff7a00] focus:ring-[#ff7a00]"
                      checked={tela.podeAcessar}
                      disabled={somenteConsulta}
                      onChange={() => onTogglePermissao(tela.idTela, "acessar")}
                    />
                  </div>

                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#ff7a00] focus:ring-[#ff7a00]"
                      checked={tela.podeConsultar}
                      disabled={somenteConsulta || !tela.podeAcessar}
                      onChange={() => onTogglePermissao(tela.idTela, "consultar")}
                    />
                  </div>

                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#ff7a00] focus:ring-[#ff7a00]"
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
