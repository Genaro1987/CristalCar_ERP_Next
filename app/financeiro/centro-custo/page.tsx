"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import {
  BarraFiltros,
  FiltroPadrao,
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
              className="button button-secondary button-compact"
              onClick={handleNovo}
            >
              Novo filho
            </button>
            <button
              type="button"
              className="button button-secondary button-compact"
              onClick={() => handleEditar(item)}
            >
              Editar
            </button>
            <button
              type="button"
              className="button button-secondary button-compact"
            >
              Inativar
            </button>
            <button
              type="button"
              className="button button-primary button-compact"
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
      <div className="page-container financeiro-page">
        <HeaderBar
          nomeTela="Centros de Custo"
          codigoTela="FIN_CENTRO_CUSTO"
          caminhoRota="/financeiro/centro-custo"
          modulo="FINANCEIRO"
        />

        <main className="page-content-card space-y-4">
          <section className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cadastro financeiro</p>
                <h2 className="text-lg font-bold text-gray-900">Estrutura de centros de custo</h2>
                <p className="text-sm text-gray-600">
                  Organize agrupamentos e mantenha a hierarquia alinhada ao orçamento da empresa.
                </p>
              </div>
              <button type="button" className="button button-primary" onClick={handleNovo}>
                Novo centro de custo
              </button>
            </div>

            <div className="mt-4">
              <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))} />
            </div>
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
                          className="button button-secondary"
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
          <div className="form-group">
            <label htmlFor="centro-nome">Nome</label>
            <input
              id="centro-nome"
              className="form-input"
              placeholder="Ex: Operações Norte"
            />
          </div>
          <div className="form-group">
            <label htmlFor="centro-codigo">Código</label>
            <input id="centro-codigo" className="form-input" placeholder="02.04" />
          </div>
          <div className="form-group">
            <label htmlFor="centro-status">Status</label>
            <select id="centro-status" className="form-input">
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
          </div>
          <div className="form-group md:col-span-2">
            <label htmlFor="centro-observacao">Observações</label>
            <textarea
              id="centro-observacao"
              className="form-input min-h-[100px]"
              placeholder="Regras de rateio, aprovadores ou integrações esperadas"
            />
          </div>
        </div>
      </ModalOverlay>
    </LayoutShell>
  );
}
