"use client";

import LayoutShell from "@/components/LayoutShell";
import React, { useMemo, useState } from "react";
import { FinanceiroPageHeader, ModalOverlay } from "../_components/financeiro-layout";

type ObjetivoSemanal = {
  id: string;
  objetivo: string;
  semana: string;
  metaSemanal: number;
  responsavel: string;
  status: "pendente" | "andamento" | "concluido";
  observacao?: string;
};

const roadmapMock: ObjetivoSemanal[] = [
  {
    id: "SEM-001",
    objetivo: "Receita Mensal",
    semana: "Semana 1",
    metaSemanal: 180000,
    responsavel: "Marketing",
    status: "andamento",
    observacao: "Campanhas digitais ativas",
  },
  {
    id: "SEM-002",
    objetivo: "Margem de Contribuição",
    semana: "Semana 2",
    metaSemanal: 12,
    responsavel: "Controladoria",
    status: "pendente",
    observacao: "Revisar precificação",
  },
  {
    id: "SEM-003",
    objetivo: "Investimentos (CAPEX)",
    semana: "Semana 3",
    metaSemanal: 50000,
    responsavel: "Diretoria",
    status: "concluido",
    observacao: "Projetos homologados",
  },
];

export default function ObjetivosSemanaisPage() {
  const [filtroObjetivo, setFiltroObjetivo] = useState<string>("");
  const [itens, setItens] = useState<ObjetivoSemanal[]>(roadmapMock);
  const [modalAberto, setModalAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<ObjetivoSemanal | null>(null);
  const [modo, setModo] = useState<"novo" | "editar">("novo");

  const itensFiltrados = useMemo(() => {
    const busca = filtroObjetivo.trim().toLowerCase();
    if (!busca) return itens;
    return itens.filter((item) => item.objetivo.toLowerCase().includes(busca));
  }, [filtroObjetivo, itens]);

  const handleNovo = () => {
    setModo("novo");
    setSelecionado(null);
    setModalAberto(true);
  };

  const handleEditar = (item: ObjetivoSemanal) => {
    setSelecionado(item);
    setModo("editar");
    setModalAberto(true);
  };

  const handleSalvar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const novo: ObjetivoSemanal = {
      id: modo === "novo" ? `SEM-${String(itens.length + 1).padStart(3, "0")}` : selecionado?.id ?? "",
      objetivo: (form.get("objetivo") as string) ?? "",
      semana: (form.get("semana") as string) ?? "",
      metaSemanal: Number(form.get("metaSemanal")) || 0,
      responsavel: (form.get("responsavel") as string) ?? "",
      status: (form.get("status") as ObjetivoSemanal["status"]) ?? "pendente",
      observacao: (form.get("observacao") as string) ?? "",
    };

    if (modo === "novo") {
      setItens((prev) => [...prev, novo]);
    } else {
      setItens((prev) => prev.map((item) => (item.id === novo.id ? novo : item)));
    }
    setModalAberto(false);
  };

  return (
    <LayoutShell>
      <div className="space-y-4">
        <FinanceiroPageHeader
          titulo="Objetivos Semanais"
          subtitulo="Financeiro | Execução"
          onNovo={handleNovo}
          codigoAjuda="FIN_OBJETIVOS_SEMANAIS"
        />

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filtrar por objetivo</p>
              <h2 className="text-lg font-bold text-gray-900">Roadmap semanal</h2>
              <p className="text-sm text-gray-600">Planeje entregas semanais alinhadas ao plano financeiro.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={filtroObjetivo}
                onChange={(e) => setFiltroObjetivo(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Busque pelo nome do objetivo"
              />
              <button
                type="button"
                onClick={handleNovo}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                Nova semana
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {itensFiltrados.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.semana}</p>
                    <p className="text-sm font-bold text-gray-900">{item.objetivo}</p>
                    <p className="text-xs text-gray-600">Responsável: {item.responsavel}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      item.status === "concluido"
                        ? "bg-green-100 text-green-700"
                        : item.status === "andamento"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {item.status === "concluido" ? "Concluído" : item.status === "andamento" ? "Em andamento" : "Pendente"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                  <div>
                    <p className="uppercase tracking-wide text-gray-500">Meta semanal</p>
                    <p className="font-semibold text-gray-900">
                      {item.metaSemanal <= 100
                        ? `${item.metaSemanal}%`
                        : `R$ ${item.metaSemanal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-gray-500">Observações</p>
                    <p className="text-gray-800">{item.observacao || "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                    onClick={() => handleEditar(item)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
                  >
                    Atualizar status
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ModalOverlay
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        titulo={modo === "novo" ? "Novo planejamento semanal" : "Editar planejamento semanal"}
      >
        <form className="space-y-3" onSubmit={handleSalvar}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Objetivo
              <input
                name="objetivo"
                defaultValue={selecionado?.objetivo}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Ex: Receita Mensal"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Semana
              <select
                name="semana"
                defaultValue={selecionado?.semana}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              >
                <option>Semana 1</option>
                <option>Semana 2</option>
                <option>Semana 3</option>
                <option>Semana 4</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Meta semanal
              <input
                name="metaSemanal"
                type="number"
                defaultValue={selecionado?.metaSemanal}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Valor ou percentual"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Responsável
              <input
                name="responsavel"
                defaultValue={selecionado?.responsavel}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Equipe ou pessoa"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Status
              <select
                name="status"
                defaultValue={selecionado?.status ?? "pendente"}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              >
                <option value="pendente">Pendente</option>
                <option value="andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
              </select>
            </label>
            <label className="md:col-span-2 space-y-1 text-sm font-semibold text-gray-700">
              Observações
              <textarea
                name="observacao"
                defaultValue={selecionado?.observacao}
                className="min-h-[80px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Alinhe dependências, entregáveis e impactos no caixa"
              />
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalAberto(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              Salvar semana
            </button>
          </div>
        </form>
      </ModalOverlay>
    </LayoutShell>
  );
}
