"use client";

import LayoutShell from "@/components/LayoutShell";
import { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import {
  BarraFiltros,
  FiltroPadrao,
  FinanceiroPageHeader,
  ModalOverlay,
  SplitView,
} from "../_components/financeiro-layout";

interface CentroCustoItem {
  id: string;
  nome: string;
  codigo: string;
  status: "ativo" | "inativo";
  descricao?: string;
  filhos?: CentroCustoItem[];
}

function filtrarCentros(dados: CentroCustoItem[], filtro: FiltroPadrao): CentroCustoItem[] {
  const buscaNormalizada = filtro.busca.trim().toLowerCase();

  const atendeFiltro = (item: CentroCustoItem) => {
    const statusOk =
      filtro.status === "todos" ||
      (filtro.status === "ativos" && item.status === "ativo") ||
      (filtro.status === "inativos" && item.status === "inativo");
    const buscaOk = buscaNormalizada
      ? `${item.codigo} ${item.nome}`.toLowerCase().includes(buscaNormalizada)
      : true;
    return statusOk && buscaOk;
  };

  return dados.flatMap<CentroCustoItem>((item) => {
    const filhosFiltrados = item.filhos ? filtrarCentros(item.filhos, filtro) : [];
    const corresponde = atendeFiltro(item);
    if (corresponde || filhosFiltrados.length > 0) {
      return [{ ...item, filhos: filhosFiltrados }];
    }
    return [];
  });
}

export default function CentroCustoPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();

  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "ativos" });
  const [selecionado, setSelecionado] = useState<CentroCustoItem | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState<"novo" | "editar">("novo");
  const [centros, setCentros] = useState<CentroCustoItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Buscar centros de custo da API
  useEffect(() => {
    if (!empresa?.id) return;

    const buscarCentros = async () => {
      try {
        setCarregando(true);
        const resposta = await fetch("/api/financeiro/centro-custo", {
          headers: {
            "x-empresa-id": String(empresa.id),
          },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            setCentros(dados.data);
          }
        }
      } catch (erro) {
        console.error("Erro ao buscar centros de custo:", erro);
      } finally {
        setCarregando(false);
      }
    };

    buscarCentros();
  }, [empresa?.id]);

  const arvoreFiltrada = useMemo(() => filtrarCentros(centros, filtro), [centros, filtro]);

  const handleNovo = () => {
    setModoEdicao("novo");
    setModalAberto(true);
  };

  const handleEditar = (item: CentroCustoItem) => {
    setSelecionado(item);
    setModoEdicao("editar");
    setModalAberto(true);
  };

  const renderNo = (item: CentroCustoItem) => {
    const estaSelecionado = selecionado?.id === item.id;

    return (
      <div key={item.id} className="space-y-2">
        <div
          className={`flex flex-col gap-3 rounded-lg border border-gray-200 p-3 shadow-sm transition hover:border-orange-200 ${
            estaSelecionado ? "border-orange-300 bg-orange-50" : "bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.codigo}</p>
              <p className="text-sm font-bold text-gray-900">{item.nome}</p>
              <p className="text-xs text-gray-600">{item.descricao}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                item.status === "ativo" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
              }`}
            >
              {item.status === "ativo" ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
              onClick={handleNovo}
            >
              Novo filho
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
              onClick={() => handleEditar(item)}
            >
              Editar
            </button>
            <button
              type="button"
              className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
            >
              Inativar
            </button>
            <button
              type="button"
              className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
              onClick={() => setSelecionado(item)}
            >
              Ver detalhes
            </button>
          </div>
        </div>
        {item.filhos && item.filhos.length > 0 ? (
          <div className="ml-5 border-l border-dashed border-gray-200 pl-4">
            {item.filhos.map((filho) => renderNo(filho))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <LayoutShell>
      <div className="page-container">
        <FinanceiroPageHeader
          titulo="Centros de Custo"
          subtitulo="Financeiro | Estrutura analítica"
          onNovo={handleNovo}
          codigoAjuda="FIN_CENTRO_CUSTO"
        />

        <main className="page-content-card space-y-4">
          <section className="panel">
            <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))} />
          </section>

          <section className="panel">
            <SplitView
              left={
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Árvore</p>
                      <h3 className="text-lg font-bold text-gray-900">Organização por áreas</h3>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {arvoreFiltrada.length} grupos principais
                    </span>
                  </div>
                  {carregando ? (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-sm text-gray-600">Carregando centros de custo...</p>
                    </div>
                  ) : arvoreFiltrada.length === 0 ? (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-8">
                      <p className="text-sm text-gray-600">Nenhum centro de custo encontrado</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {arvoreFiltrada.map((item) => renderNo(item))}
                    </div>
                  )}
                </div>
              }
              right={
                <div className="flex h-full flex-col gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Detalhes</p>
                    <h3 className="text-lg font-bold text-gray-900">Centro selecionado</h3>
                    <p className="text-sm text-gray-600">
                      Reveja nomes, códigos e observações para orientar lançamentos e relatórios.
                    </p>
                  </div>
                  {selecionado ? (
                    <div className="space-y-4 rounded-lg bg-gray-50 p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Código</p>
                          <p className="text-lg font-bold text-gray-900">{selecionado.codigo}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
                          <p className="text-sm font-semibold text-gray-900">{selecionado.status === "ativo" ? "Ativo" : "Inativo"}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Título</p>
                          <p className="text-base font-semibold text-gray-800">{selecionado.nome}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Descrição</p>
                        <p className="rounded-lg border border-dashed border-gray-200 bg-white p-3 text-sm text-gray-700">
                          {selecionado.descricao || "Inclua orientações para quem faz lançamentos"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                          onClick={() => handleEditar(selecionado)}
                        >
                          Editar centro
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600">
                      <p className="font-semibold text-gray-800">Selecione um centro para visualizar detalhes</p>
                      <p>Use o painel da esquerda para navegar.</p>
                    </div>
                  )}
                </div>
              }
            />
          </section>
        </main>
      </div>

      <ModalOverlay
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        titulo={modoEdicao === "novo" ? "Novo centro de custo" : "Editar centro de custo"}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold text-gray-700">
            Nome
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              placeholder="Ex: Operações Norte"
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-700">
            Código
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              placeholder="02.04"
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-700">
            Status
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none">
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
          </label>
          <label className="md:col-span-2 space-y-1 text-sm font-semibold text-gray-700">
            Observações
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              placeholder="Regras de rateio, aprovadores ou integrações esperadas"
            />
          </label>
        </div>
      </ModalOverlay>
    </LayoutShell>
  );
}
