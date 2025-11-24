"use client";

import React from "react";

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
  "grid grid-cols-[170px_minmax(260px,1fr)_120px_130px_120px] items-center gap-x-4";

export function PermissoesPorTelaSection({
  perfilCodigo,
  perfilNome,
  telas,
  onTogglePermissao,
  somenteConsulta = false,
}: PermissoesPorTelaSectionProps) {
  const telasPorModulo = moduloOrder
    .map((modulo) => ({
      modulo,
      telas: telas.filter((t) => t.modulo === modulo),
    }))
    .filter((grupo) => grupo.telas.length > 0);

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
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <header className="rounded-t-2xl bg-[#ff7a00] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white">
              {grupo.modulo}
            </header>

            <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <div className={colTemplate}>
                <span>Código tela</span>
                <span>Nome da tela</span>
                <span className="text-center whitespace-nowrap">Pode acessar</span>
                <span className="text-center whitespace-nowrap">Pode consultar</span>
                <span className="text-center whitespace-nowrap">Pode editar</span>
              </div>
            </div>

            <div className="px-6 py-2">
              {grupo.telas.map((tela) => (
                <div
                  key={tela.idTela}
                  className={`${colTemplate} border-b border-slate-100 py-2 text-sm last:border-b-0`}
                >
                  <div className="font-medium text-slate-800">{tela.codigoTela}</div>

                  <div className="text-slate-800">{tela.nomeTela}</div>

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
