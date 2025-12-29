"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BarraFiltros, type FiltroPadrao, type StatusFiltro } from "../_components/financeiro-layout";

interface PlanoContaApiItem {
  FIN_PLANO_CONTA_ID: number;
  FIN_PLANO_CONTA_PAI_ID: number | null;
  FIN_PLANO_CONTA_NATUREZA: "RECEITA" | "DESPESA";
  FIN_PLANO_CONTA_NOME: string;
  FIN_PLANO_CONTA_CODIGO: string;
  FIN_PLANO_CONTA_ATIVO: 0 | 1;
  FIN_PLANO_CONTA_VISIVEL_DRE: 0 | 1;
  FIN_PLANO_CONTA_OBRIGA_CENTRO_CUSTO: 0 | 1;
}

interface PlanoContaNode {
  id: number;
  paiId: number | null;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA";
  ativo: boolean;
  visivelDre: boolean;
  obrigatorioCentroCusto: boolean;
  filhos: PlanoContaNode[];
}

function construirArvore(nodes: PlanoContaNode[]): PlanoContaNode[] {
  const mapa = new Map<number, PlanoContaNode & { filhos: PlanoContaNode[] }>();
  const raizes: PlanoContaNode[] = [];

  nodes.forEach((node) => {
    mapa.set(node.id, { ...node, filhos: [] });
  });

  mapa.forEach((node) => {
    if (node.paiId !== null && mapa.has(node.paiId)) {
      mapa.get(node.paiId)?.filhos.push(node);
      return;
    }

    raizes.push(node);
  });

  return raizes;
}

function filtrarArvore(dados: PlanoContaNode[], filtro: FiltroPadrao): PlanoContaNode[] {
  const buscaNormalizada = filtro.busca.trim().toLowerCase();

  return dados.reduce<PlanoContaNode[]>((lista, item) => {
    const filhosFiltrados = filtrarArvore(item.filhos, filtro);
    const statusOk =
      filtro.status === "todos" ||
      (filtro.status === "ativos" && item.ativo) ||
      (filtro.status === "inativos" && !item.ativo);
    const naturezaOk = filtro.natureza ? item.natureza === filtro.natureza : true;
    const buscaOk = buscaNormalizada
      ? `${item.codigo} ${item.nome}`.toLowerCase().includes(buscaNormalizada)
      : true;

    if (statusOk && naturezaOk && buscaOk) {
      lista.push({ ...item, filhos: filhosFiltrados });
      return lista;
    }

    if (filhosFiltrados.length > 0) {
      lista.push({ ...item, filhos: filhosFiltrados });
    }

    return lista;
  }, []);
}

export default function PlanoContasPage() {
  const { empresa, carregando } = useEmpresaSelecionada();
  useRequerEmpresaSelecionada();

  const [filtro, setFiltro] = useState<FiltroPadrao>({
    busca: "",
    status: "ativos",
    natureza: "",
  });
  const [planoContas, setPlanoContas] = useState<PlanoContaNode[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = {};
    if (empresa?.id) {
      headers["x-empresa-id"] = String(empresa.id);
    }
    return headers;
  }, [empresa?.id]);

  const carregarPlanoContas = useCallback(async () => {
    if (!empresa?.id) return;

    setCarregandoLista(true);
    setErroLista(null);

    try {
      const resposta = await fetch("/api/financeiro/plano-contas", {
        headers: headersPadrao,
      });
      const json = await resposta.json();

      if (resposta.ok && json?.success) {
        const itens: PlanoContaApiItem[] = json.data ?? [];
        const normalizados = itens.map<PlanoContaNode>((item) => ({
          id: item.FIN_PLANO_CONTA_ID,
          paiId: item.FIN_PLANO_CONTA_PAI_ID,
          nome: item.FIN_PLANO_CONTA_NOME,
          codigo: item.FIN_PLANO_CONTA_CODIGO,
          natureza: item.FIN_PLANO_CONTA_NATUREZA,
          ativo: item.FIN_PLANO_CONTA_ATIVO === 1,
          visivelDre: item.FIN_PLANO_CONTA_VISIVEL_DRE === 1,
          obrigatorioCentroCusto: item.FIN_PLANO_CONTA_OBRIGA_CENTRO_CUSTO === 1,
          filhos: [],
        }));

        setPlanoContas(normalizados);
        setSelecionadoId((idAtual) => idAtual ?? normalizados[0]?.id ?? null);
      } else {
        setErroLista("Não foi possível carregar o plano de contas.");
      }
    } catch (error) {
      console.error(error);
      setErroLista("Erro ao consultar o plano de contas.");
    } finally {
      setCarregandoLista(false);
    }
  }, [empresa?.id, headersPadrao]);

  useEffect(() => {
    if (carregando) return;
    carregarPlanoContas();
  }, [carregando, carregarPlanoContas]);

  const arvoreCompleta = useMemo(() => construirArvore(planoContas), [planoContas]);
  const arvoreFiltrada = useMemo(() => filtrarArvore(arvoreCompleta, filtro), [arvoreCompleta, filtro]);

  const mapaPorId = useMemo(() => {
    const mapa = new Map<number, PlanoContaNode>();
    planoContas.forEach((item) => mapa.set(item.id, item));
    return mapa;
  }, [planoContas]);

  const selecionado = selecionadoId ? mapaPorId.get(selecionadoId) ?? null : null;

  const textoStatus = useMemo(() => {
    const legenda: Record<StatusFiltro, string> = {
      todos: "Todos os status",
      ativos: "Apenas ativos",
      inativos: "Apenas inativos",
    };
    return legenda[filtro.status];
  }, [filtro.status]);

  const renderNo = (item: PlanoContaNode) => {
    const estaSelecionado = selecionadoId === item.id;
    const statusClass = item.ativo ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700";

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
              <p className="text-xs text-gray-600">
                Natureza: {item.natureza} | Centro de custo obrigatório: {" "}
                {item.obrigatorioCentroCusto ? "Sim" : "Não"}
              </p>
              <p className="text-xs text-gray-600">Visível no DRE: {item.visivelDre ? "Sim" : "Não"}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
              {item.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
              onClick={() => setSelecionadoId(item.id)}
            >
              Ver detalhes
            </button>
          </div>
        </div>
        {item.filhos.length > 0 ? <div className="ml-5 border-l border-dashed border-gray-200 pl-4">{item.filhos.map((filho) => renderNo(filho))}</div> : null}
      </div>
    );
  };

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          nomeTela="Plano de Contas"
          codigoTela="FIN001_PLANO_CONTA"
          caminhoRota="/financeiro/plano-contas"
          modulo="FINANCEIRO"
        />

        <main className="page-content-card space-y-4">
          {erroLista ? <NotificationBar type="error" message={erroLista} /> : null}

          <section className="panel">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {empresa?.nomeFantasia ?? "Empresa"}
                </p>
                <h2 className="text-xl font-bold text-gray-900">Hierarquia do plano de contas</h2>
                <p className="text-sm text-gray-600">
                  {carregandoLista
                    ? "Carregando contas..."
                    : `Filtro aplicado: ${textoStatus}${filtro.natureza ? ` | Natureza ${filtro.natureza}` : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {arvoreFiltrada.length} grupos principais
                </span>
              </div>
            </header>

            <div className="space-y-3">
              <BarraFiltros
                filtro={filtro}
                onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))}
                exibirNatureza
              />

              <div className="space-y-3">
                {carregandoLista ? (
                  <p className="text-sm text-gray-600">Buscando contas financeiras...</p>
                ) : arvoreFiltrada.length > 0 ? (
                  arvoreFiltrada.map((item) => renderNo(item))
                ) : (
                  <p className="text-sm text-gray-600">Nenhuma conta encontrada para os filtros atuais.</p>
                )}
              </div>
            </div>
          </section>

          <section className="panel">
            <header className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Detalhes</p>
              <h2 className="text-xl font-bold text-gray-900">Conta selecionada</h2>
              <p className="text-sm text-gray-600">
                Visualize status, obrigatoriedade de centro de custo e visibilidade no DRE da conta ativa.
              </p>
            </header>

            {selecionado ? (
              <div className="mt-4 space-y-4 rounded-lg bg-gray-50 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Código</p>
                    <p className="text-base font-bold text-gray-900">{selecionado.codigo}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
                    <p className="text-base font-semibold text-gray-900">{selecionado.ativo ? "Ativo" : "Inativo"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Título</p>
                    <p className="text-base font-semibold text-gray-900">{selecionado.nome}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Natureza</p>
                    <p className="text-base font-semibold text-gray-900">{selecionado.natureza}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Centro de custo</p>
                    <p className="font-semibold text-gray-900">{selecionado.obrigatorioCentroCusto ? "Obrigatório" : "Opcional"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Visível no DRE</p>
                    <p className="font-semibold text-gray-900">{selecionado.visivelDre ? "Sim" : "Não"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Código do pai</p>
                    <p className="font-semibold text-gray-900">{selecionado.paiId ? `#${selecionado.paiId}` : "Raiz"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600">
                <p className="font-semibold text-gray-800">Selecione uma conta para visualizar detalhes.</p>
                <p>Use a árvore à esquerda para navegar pela hierarquia.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </LayoutShell>
  );
}
