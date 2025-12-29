"use client";

import LayoutShell from "@/components/LayoutShell";
import React, { useMemo, useState } from "react";
import { BarraFiltros, FiltroPadrao, FinanceiroPageHeader, ModalOverlay } from "../_components/financeiro-layout";

type Lancamento = {
  id: string;
  data: string;
  historico: string;
  conta: string;
  centroCusto: string;
  valor: number;
  tipo: "Entrada" | "Saída";
  status: "confirmado" | "pendente";
};

const lancamentosMock: Lancamento[] = [
  {
    id: "LAN-001",
    data: "2024-06-03",
    historico: "Recebimento contrato 1020",
    conta: "3.1 Vendas de Produtos",
    centroCusto: "01.02 Pessoas",
    valor: 18500,
    tipo: "Entrada",
    status: "confirmado",
  },
  {
    id: "LAN-002",
    data: "2024-06-04",
    historico: "Pagamento fornecedor logístico",
    conta: "4.3 Custos Logísticos",
    centroCusto: "02.01 Serviços",
    valor: -6200,
    tipo: "Saída",
    status: "pendente",
  },
];

export default function LancamentosPage() {
  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "todos" });
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(lancamentosMock);
  const [modalAberto, setModalAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<Lancamento | null>(null);
  const [modo, setModo] = useState<"novo" | "editar">("novo");

  const dadosFiltrados = useMemo(() => {
    const busca = filtro.busca.trim().toLowerCase();
    return lancamentos.filter((item) => {
      const statusOk =
        filtro.status === "todos" ||
        (filtro.status === "ativos" && item.status === "confirmado") ||
        (filtro.status === "inativos" && item.status === "pendente");
      const buscaOk =
        !busca || `${item.historico} ${item.conta} ${item.centroCusto}`.toLowerCase().includes(busca);

      return statusOk && buscaOk;
    });
  }, [filtro, lancamentos]);

  const handleNovo = () => {
    setModo("novo");
    setSelecionado(null);
    setModalAberto(true);
  };

  const handleEditar = (item: Lancamento) => {
    setSelecionado(item);
    setModo("editar");
    setModalAberto(true);
  };

  const handleSalvar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const novo: Lancamento = {
      id: modo === "novo" ? `LAN-${String(lancamentos.length + 1).padStart(3, "0")}` : selecionado?.id ?? "",
      data: (form.get("data") as string) ?? "",
      historico: (form.get("historico") as string) ?? "",
      conta: (form.get("conta") as string) ?? "",
      centroCusto: (form.get("centroCusto") as string) ?? "",
      valor: Number(form.get("valor")) || 0,
      tipo: (form.get("tipo") as Lancamento["tipo"]) ?? "Entrada",
      status: (form.get("status") as Lancamento["status"]) ?? "confirmado",
    };

    if (modo === "novo") {
      setLancamentos((prev) => [...prev, novo]);
    } else {
      setLancamentos((prev) => prev.map((item) => (item.id === novo.id ? novo : item)));
    }
    setModalAberto(false);
  };

  return (
    <LayoutShell>
      <div className="space-y-4">
        <FinanceiroPageHeader
          titulo="Lançamentos (Caixa)"
          subtitulo="Financeiro | Contas a pagar e receber"
          onNovo={handleNovo}
          codigoAjuda="FIN_LANCAMENTOS"
        />

        <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((prev) => ({ ...prev, ...novo }))} />

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contexto</p>
              <h2 className="text-lg font-bold text-gray-900">Filtros principais</h2>
              <p className="text-sm text-gray-600">
                Cada lançamento respeita a empresa ativa, natureza e centro de custo. Utilize os filtros antes de incluir dados.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
              onClick={handleNovo}
            >
              Novo lançamento
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Período
              <input
                type="month"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                defaultValue="2024-06"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Plano de Conta
              <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none">
                <option>3.1 Vendas de Produtos</option>
                <option>4.2 Folha de Pagamento</option>
                <option>4.3 Custos Logísticos</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Centro de Custo
              <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none">
                <option>01.01 Financeiro</option>
                <option>01.02 Pessoas</option>
                <option>02.01 Serviços</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Forma de Pagamento
              <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none">
                <option>Boleto</option>
                <option>Pix</option>
                <option>Cartão</option>
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-inner">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Visão consolidada</p>
              <h3 className="text-lg font-bold text-gray-900">Lançamentos cadastrados</h3>
              <p className="text-sm text-gray-600">Use editar para ajustar histórico, conta e centros antes do envio ao DRE.</p>
            </div>
            <span className="rounded bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">ID_EMPRESA obrigatório</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-dashed border-gray-200 bg-white text-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Histórico</th>
                  <th className="px-4 py-3 text-left">Conta</th>
                  <th className="px-4 py-3 text-left">Centro de Custo</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Valor</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dadosFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-orange-50/40">
                    <td className="px-4 py-3 text-xs font-semibold text-gray-800">{item.data}</td>
                    <td className="px-4 py-3 text-xs text-gray-800">{item.historico}</td>
                    <td className="px-4 py-3 text-xs text-gray-800">{item.conta}</td>
                    <td className="px-4 py-3 text-xs text-gray-800">{item.centroCusto}</td>
                    <td className="px-4 py-3 text-xs text-gray-800">{item.tipo}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-800">
                      R$ {Math.abs(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] ${
                          item.status === "confirmado"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {item.status === "confirmado" ? "Confirmado" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 px-3 py-1 font-semibold text-gray-700 transition hover:bg-gray-100"
                          onClick={() => handleEditar(item)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-orange-500 px-3 py-1 font-semibold text-white shadow-sm transition hover:bg-orange-600"
                        >
                          Conciliar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ModalOverlay
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        titulo={modo === "novo" ? "Novo lançamento" : "Editar lançamento"}
      >
        <form className="space-y-3" onSubmit={handleSalvar}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Data
              <input
                name="data"
                type="date"
                defaultValue={selecionado?.data}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Tipo
              <select
                name="tipo"
                defaultValue={selecionado?.tipo ?? "Entrada"}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              >
                <option value="Entrada">Entrada</option>
                <option value="Saída">Saída</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Histórico
              <input
                name="historico"
                defaultValue={selecionado?.historico}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Descrição do lançamento"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Plano de Conta
              <input
                name="conta"
                defaultValue={selecionado?.conta}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Código e descrição"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Centro de Custo
              <input
                name="centroCusto"
                defaultValue={selecionado?.centroCusto}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Ex: 01.01 Financeiro"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Valor
              <input
                name="valor"
                type="number"
                defaultValue={selecionado?.valor ?? 0}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Informe valores positivos para entradas e negativos para saídas"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Status
              <select
                name="status"
                defaultValue={selecionado?.status ?? "confirmado"}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              >
                <option value="confirmado">Confirmado</option>
                <option value="pendente">Pendente</option>
              </select>
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
              Salvar lançamento
            </button>
          </div>
        </form>
      </ModalOverlay>
    </LayoutShell>
  );
}
