"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

import { BarraFiltros, type FiltroPadrao, type StatusFiltro } from "./financeiro-layout";

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
  const nomeTela = tela?.NOME_TELA ?? "PLANO DE CONTAS";
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
  const [selecionado, setSelecionado] = useState<PlanoContaNode | null>(null);
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

  const renderNo = (item: PlanoContaNode) => {
    const estaSelecionado = selecionado?.id === item.id;

    return (
      <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          className={`tree-node${estaSelecionado ? " selected" : ""}`}
          onClick={() => setSelecionado(item)}
          style={{ cursor: "pointer" }}
        >
          <div className="tree-node-header">
            <div>
              <p className="tree-node-code">{item.codigo}</p>
              <p className="tree-node-name">{item.nome}</p>
              <p className="tree-node-meta">
                {item.natureza} | Centro custo: {item.obrigatorioCentroCusto ? "Sim" : "Não"} | DRE: {item.visivelDre ? "Sim" : "Não"}
              </p>
            </div>
            <span className={item.ativo ? "badge badge-success" : "badge badge-danger"}>
              {item.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="tree-node-actions">
            <button type="button" className="button button-secondary button-compact">
              Editar
            </button>
          </div>
        </div>
        {item.filhos.length > 0 ? (
          <div className="tree-children">
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

        <main className="page-content-card">
          {erroLista ? <NotificationBar type="error" message={erroLista} /> : null}

          <div className="departamentos-page">
            <div className="split-view">
              {/* LEFT: Tree view */}
              <section className="split-view-panel">
                <header className="form-section-header">
                  <h2>Árvore do plano de contas</h2>
                  <p>Navegue pela estrutura hierárquica. Clique para selecionar.</p>
                </header>

                <BarraFiltros
                  filtro={filtro}
                  onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))}
                  exibirNatureza
                />

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {carregandoLista ? (
                    <div className="empty-state">
                      <p>Buscando contas financeiras...</p>
                    </div>
                  ) : arvoreFiltrada.length > 0 ? (
                    arvoreFiltrada.map((item) => renderNo(item))
                  ) : (
                    <div className="empty-state">
                      <strong>Nenhuma conta encontrada</strong>
                      <p>Ajuste os filtros ou cadastre uma nova conta.</p>
                    </div>
                  )}
                </div>
              </section>

              {/* RIGHT: Form */}
              <section className="split-view-panel">
                <header className="form-section-header">
                  <h2>{selecionado ? "Detalhes da conta" : "Nova conta"}</h2>
                  <p>
                    {selecionado
                      ? `${selecionado.codigo} - ${selecionado.nome}`
                      : "Defina contas sintéticas e analíticas para organizar lançamentos e a DRE."}
                  </p>
                </header>

                {selecionado && (
                  <div className="detail-card" style={{ marginBottom: 16 }}>
                    <div className="detail-grid">
                      <div>
                        <p className="detail-label">Código</p>
                        <p className="detail-value">{selecionado.codigo}</p>
                      </div>
                      <div>
                        <p className="detail-label">Natureza</p>
                        <p className="detail-value">{selecionado.natureza}</p>
                      </div>
                      <div>
                        <p className="detail-label">Status</p>
                        <p className="detail-value">{selecionado.ativo ? "Ativo" : "Inativo"}</p>
                      </div>
                      <div>
                        <p className="detail-label">Visível no DRE</p>
                        <p className="detail-value">{selecionado.visivelDre ? "Sim" : "Não"}</p>
                      </div>
                    </div>
                  </div>
                )}

                <form className="form">
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="plano-nivel">Nível</label>
                      <input id="plano-nivel" type="number" min={1} className="form-input" placeholder="Ex.: 1" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="plano-descricao">Descrição *</label>
                      <input
                        id="plano-descricao"
                        type="text"
                        className="form-input"
                        placeholder="Nome oficial da conta"
                      />
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="plano-tipo">Tipo de conta</label>
                      <select id="plano-tipo" className="form-input">
                        <option value="SINTETICA">Sintética</option>
                        <option value="ANALITICA">Analítica</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="plano-natureza">Natureza *</label>
                      <select id="plano-natureza" className="form-input">
                        <option value="RECEITA">Receita</option>
                        <option value="DESPESA">Despesa</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="plano-status">Status</label>
                      <select id="plano-status" className="form-input">
                        <option value="ATIVA">Ativa</option>
                        <option value="INATIVA">Inativa</option>
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
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="plano-conta-dre">Conta do DRE vinculada</label>
                      <select id="plano-conta-dre" className="form-input">
                        <option value="">Selecione</option>
                        <option value="DRE_RECEITA_BRUTA">Receita bruta</option>
                        <option value="DRE_CUSTOS">Custos</option>
                        <option value="DRE_DESPESAS">Despesas operacionais</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="plano-data-inclusao">Data de inclusão</label>
                      <input id="plano-data-inclusao" type="date" className="form-input" />
                    </div>
                  </div>

                  <div className="form-actions departamentos-actions">
                    <div className="button-row">
                      <button type="button" className="button button-primary">
                        Salvar conta
                      </button>
                      <button type="button" className="button button-secondary">
                        Limpar
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </main>
      </div>
    </LayoutShell>
  );
}
