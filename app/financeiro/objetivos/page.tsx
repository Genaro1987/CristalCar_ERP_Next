"use client";

import LayoutShell from "@/components/LayoutShell";
import React, { useMemo, useState } from "react";
import {
  BarraFiltros,
  FiltroPadrao,
  FinanceiroPageHeader,
  ModalOverlay,
} from "../_components/financeiro-layout";

type ObjetivoFinanceiro = {
  id: string;
  titulo: string;
  empresa: string;
  periodo: "Mensal" | "Trimestral" | "Anual";
  meta: number;
  responsavel: string;
  status: "ativo" | "inativo";
  observacao?: string;
};

const objetivosMock: ObjetivoFinanceiro[] = [
  {
    id: "OBJ-001",
    titulo: "Receita Mensal",
    empresa: "Grupo Matriz",
    periodo: "Mensal",
    meta: 750000,
    responsavel: "Financeiro",
    status: "ativo",
    observacao: "Meta consolidada alinhada ao DRE",
  },
  {
    id: "OBJ-002",
    titulo: "Margem de Contribuição",
    empresa: "Filial Joinville",
    periodo: "Trimestral",
    meta: 38,
    responsavel: "Controladoria",
    status: "ativo",
    observacao: "Validar centros de custo obrigatórios",
  },
  {
    id: "OBJ-003",
    titulo: "Investimentos (CAPEX)",
    empresa: "Grupo Matriz",
    periodo: "Anual",
    meta: 150000,
    responsavel: "Diretoria",
    status: "inativo",
    observacao: "Liberar após revisão de fluxo de caixa",
  },
];

export default function ObjetivosPage() {
  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "ativos" });
  const [objetivos, setObjetivos] = useState<ObjetivoFinanceiro[]>(objetivosMock);
  const [modalAberto, setModalAberto] = useState(false);
  const [modo, setModo] = useState<"novo" | "editar">("novo");
  const [selecionado, setSelecionado] = useState<ObjetivoFinanceiro | null>(null);

  const objetivosFiltrados = useMemo(() => {
    const busca = filtro.busca.trim().toLowerCase();

    return objetivos.filter((item) => {
      const statusOk =
        filtro.status === "todos" ||
        (filtro.status === "ativos" && item.status === "ativo") ||
        (filtro.status === "inativos" && item.status === "inativo");
      const buscaOk =
        !busca || `${item.titulo} ${item.empresa} ${item.responsavel}`.toLowerCase().includes(busca);

      return statusOk && buscaOk;
    });
  }, [filtro, objetivos]);

  const handleNovo = () => {
    setModo("novo");
    setSelecionado(null);
    setModalAberto(true);
  };

  const handleEditar = (objetivo: ObjetivoFinanceiro) => {
    setSelecionado(objetivo);
    setModo("editar");
    setModalAberto(true);
  };

  const handleSalvar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const novo: ObjetivoFinanceiro = {
      id: modo === "novo" ? `OBJ-${String(objetivos.length + 1).padStart(3, "0")}` : selecionado?.id ?? "",
      titulo: (formData.get("titulo") as string) ?? "",
      empresa: (formData.get("empresa") as string) ?? "",
      periodo: (formData.get("periodo") as ObjetivoFinanceiro["periodo"]) ?? "Mensal",
      meta: Number(formData.get("meta")) || 0,
      responsavel: (formData.get("responsavel") as string) ?? "",
      status: (formData.get("status") as ObjetivoFinanceiro["status"]) ?? "ativo",
      observacao: (formData.get("observacao") as string) ?? "",
    };

    if (modo === "novo") {
      setObjetivos((prev) => [...prev, novo]);
    } else {
      setObjetivos((prev) => prev.map((item) => (item.id === novo.id ? novo : item)));
    }

    setModalAberto(false);
  };

  return (
    <LayoutShell>
      <div className="space-y-4">
        <FinanceiroPageHeader
          titulo="Objetivos Financeiros"
          subtitulo="Financeiro | Planejamento"
          onNovo={handleNovo}
          codigoAjuda="FIN_OBJETIVOS"
        />

        <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((prev) => ({ ...prev, ...novo }))} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {objetivosFiltrados.map((objetivo) => (
            <div key={objetivo.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{objetivo.id}</p>
                  <p className="text-base font-bold text-gray-900">{objetivo.titulo}</p>
                  <p className="text-sm text-gray-600">Empresa: {objetivo.empresa}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    objetivo.status === "ativo" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {objetivo.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Período</p>
                  <p className="font-semibold text-gray-900">{objetivo.periodo}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Meta</p>
                  <p className="font-semibold text-gray-900">
                    {objetivo.meta <= 100
                      ? `${objetivo.meta}%`
                      : `R$ ${objetivo.meta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Responsável</p>
                  <p className="font-semibold text-gray-900">{objetivo.responsavel}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Observações</p>
                  <p className="text-gray-700">{objetivo.observacao || "—"}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  onClick={() => handleEditar(objetivo)}
                >
                  Editar objetivo
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
                >
                  Aplicar metas semanais
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ModalOverlay
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        titulo={modo === "novo" ? "Novo objetivo" : "Editar objetivo"}
      >
        <form className="space-y-3" onSubmit={handleSalvar}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Título
              <input
                name="titulo"
                defaultValue={selecionado?.titulo}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Ex: Receita mensal"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Empresa
              <input
                name="empresa"
                defaultValue={selecionado?.empresa}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Empresa ativa"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Período de medição
              <select
                name="periodo"
                defaultValue={selecionado?.periodo}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              >
                <option value="Mensal">Mensal</option>
                <option value="Trimestral">Trimestral</option>
                <option value="Anual">Anual</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Meta
              <input
                name="meta"
                type="number"
                defaultValue={selecionado?.meta}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Valor numérico"
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
                defaultValue={selecionado?.status ?? "ativo"}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
            <label className="md:col-span-2 space-y-1 text-sm font-semibold text-gray-700">
              Observações
              <textarea
                name="observacao"
                defaultValue={selecionado?.observacao}
                className="min-h-[100px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Oriente o time sobre como medir, quem atualiza e onde o resultado impacta o DRE"
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
              Salvar alterações
            </button>
          </div>
        </form>
      </ModalOverlay>
    </LayoutShell>
  );
}
