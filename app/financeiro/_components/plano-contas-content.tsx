"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

import { BarraFiltros, SplitView, type FiltroPadrao, type StatusFiltro } from "./financeiro-layout";

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

export function PlanoContasContent() {
  const { empresa, carregando } = useEmpresaSelecionada();
  useRequerEmpresaSelecionada();
  const caminhoRota = "/financeiro/plano-contas";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN001_PLANO_CONTA";
  const nomeTela = tela?.NOME_TELA ?? "Plano de Contas";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [filtro, setFiltro] = useState<FiltroPadrao>({
    busca: "",
    status: "ativos",
    natureza: "",
  });
  const [planoContas, setPlanoContas] = useState<PlanoContaNode[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [consideraDre, setConsideraDre] = useState(false);

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

  const textoStatus = useMemo(() => {
    const legenda: Record<StatusFiltro, string> = {
      todos: "Todos os status",
      ativos: "Apenas ativos",
      inativos: "Apenas inativos",
    };
    return legenda[filtro.status];
  }, [filtro.status]);

  const renderNo = (item: PlanoContaNode) => {
    const statusClass = item.ativo ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700";

    return (
      <div key={item.id} className="space-y-2">
        <div
          className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-orange-200"
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
            <button type="button" className="button button-secondary button-compact">
              Editar conta
            </button>
          </div>
        </div>
        {item.filhos.length > 0 ? (
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
          nomeTela={nomeTela}
          codigoTela={codigoTela}
          caminhoRota={caminhoTela}
          modulo={moduloTela}
        />

        <main className="page-content-card space-y-4">
          {erroLista ? <NotificationBar type="error" message={erroLista} /> : null}

          <section className="panel">
            <SplitView
              left={
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estrutura financeira</p>
                      <h2 className="text-xl font-bold text-gray-900">Árvore do plano de contas</h2>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {arvoreFiltrada.length} grupos principais
                    </span>
                  </div>

                  <BarraFiltros
                    filtro={filtro}
                    onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))}
                    exibirNatureza
                    exibirBusca={false}
                  />

                  <div className="space-y-3">
                    {carregandoLista ? (
                      <div className="flex items-center justify-center py-8">
                        <p className="text-sm text-gray-600">Buscando contas financeiras...</p>
                      </div>
                    ) : arvoreFiltrada.length > 0 ? (
                      arvoreFiltrada.map((item) => renderNo(item))
                    ) : (
                      <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-8">
                        <p className="text-sm text-gray-600">Nenhuma conta encontrada para os filtros atuais.</p>
                      </div>
                    )}
                  </div>
                </div>
              }
              right={
                <div className="space-y-4">
                  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cadastro principal</p>
                      <h2 className="text-xl font-bold text-gray-900">Nova conta</h2>
                      <p className="text-sm text-gray-600">
                        Defina as contas sintéticas e analíticas para organizar lançamentos e a DRE do financeiro.
                      </p>
                    </div>
                  </header>

                  <form className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      <div className="form-group">
                        <label htmlFor="plano-nivel">Nível</label>
                        <input id="plano-nivel" type="number" min={1} className="form-input" placeholder="Ex.: 1" />
                      </div>
                      <div className="form-group lg:col-span-2">
                        <label htmlFor="plano-descricao">Descrição</label>
                        <input
                          id="plano-descricao"
                          type="text"
                          className="form-input"
                          placeholder="Informe a descrição oficial da conta"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      <div className="form-group">
                        <label htmlFor="plano-tipo">Tipo de conta</label>
                        <select id="plano-tipo" className="form-input">
                          <option value="SINTETICA">Sintética</option>
                          <option value="ANALITICA">Analítica</option>
                        </select>
                        <p className="text-xs text-gray-500">Apenas contas analíticas recebem lançamento.</p>
                      </div>
                      <div className="form-group">
                        <label htmlFor="plano-natureza">Natureza</label>
                        <select id="plano-natureza" className="form-input">
                          <option value="RECEITA">Receita</option>
                          <option value="DESPESA">Despesa</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="plano-status">Status</label>
                        <select id="plano-status" className="form-input">
                          <option value="ATIVA">Ativa</option>
                          <option value="INATIVA">Inativa</option>
                        </select>
                        <p className="text-xs text-gray-500">Contas inativas deixam de aparecer para lançamentos.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      <div className="form-group">
                        <label htmlFor="plano-conta-dre">Conta do DRE vinculada</label>
                        <select id="plano-conta-dre" className="form-input">
                          <option value="">Selecione a conta do DRE</option>
                          <option value="DRE_RECEITA_BRUTA">Receita bruta</option>
                          <option value="DRE_CUSTOS">Custos</option>
                          <option value="DRE_DESPESAS">Despesas operacionais</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="plano-considera-dre">Considerar no DRE</label>
                        <select
                          id="plano-considera-dre"
                          className="form-input"
                          value={consideraDre ? "SIM" : "NAO"}
                          onChange={(event) => setConsideraDre(event.target.value === "SIM")}
                        >
                          <option value="SIM">Sim</option>
                          <option value="NAO">Não</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="plano-data-inclusao">Data de inclusão</label>
                        <input id="plano-data-inclusao" type="date" className="form-input" />
                        <p className="text-xs text-gray-500">
                          Evita lançamentos com data anterior à criação da conta.
                        </p>
                      </div>
                    </div>

                    {consideraDre ? (
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="form-group lg:col-span-2">
                          <label htmlFor="plano-rubrica-dre">Rubrica do DRE relacionada</label>
                          <select id="plano-rubrica-dre" className="form-input">
                            <option value="">Selecione a rubrica do DRE</option>
                            <option value="RUBRICA_RECEITAS">Receitas operacionais</option>
                            <option value="RUBRICA_DESPESAS">Despesas administrativas</option>
                            <option value="RUBRICA_IMPOSTOS">Impostos e contribuições</option>
                          </select>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-4">
                      <button type="button" className="button button-primary">
                        Salvar conta
                      </button>
                      <button type="button" className="button button-secondary">
                        Limpar formulário
                      </button>
                    </div>
                  </form>
                </div>
              }
            />
          </section>
        </main>
      </div>
    </LayoutShell>
  );
}
