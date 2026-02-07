"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";
import { BarraFiltros, type FiltroPadrao } from "./financeiro-layout";

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

interface FormPlano {
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA";
  paiId: string;
  visivelDre: number;
  obrigaCentroCusto: number;
  ativo: number;
}

const FORM_VAZIO: FormPlano = {
  nome: "",
  codigo: "",
  natureza: "DESPESA",
  paiId: "",
  visivelDre: 1,
  obrigaCentroCusto: 0,
  ativo: 1,
};

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

function coletarOpcoes(nodes: PlanoContaNode[]): { id: number; label: string }[] {
  const result: { id: number; label: string }[] = [];
  for (const node of nodes) {
    result.push({ id: node.id, label: `${node.codigo} - ${node.nome}` });
    if (node.filhos.length) result.push(...coletarOpcoes(node.filhos));
  }
  return result;
}

export function PlanoContasContent() {
  const { empresa, carregando } = useEmpresaSelecionada();
  useRequerEmpresaSelecionada();
  const caminhoRota = "/financeiro/plano-contas";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_PLANO_CONTA";
  const nomeTela = tela?.NOME_TELA ?? "PLANO DE CONTAS";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "ativos", natureza: "" });
  const [planoContas, setPlanoContas] = useState<PlanoContaNode[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<PlanoContaNode | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form state
  const [form, setForm] = useState<FormPlano>({ ...FORM_VAZIO });
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = {};
    if (empresa?.id) headers["x-empresa-id"] = String(empresa.id);
    return headers;
  }, [empresa?.id]);

  const carregarPlanoContas = useCallback(async () => {
    if (!empresa?.id) return;
    setCarregandoLista(true);
    setErroLista(null);

    try {
      const resposta = await fetch("/api/financeiro/plano-contas", { headers: headersPadrao });
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
        setErroLista("Nao foi possivel carregar o plano de contas.");
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
  const opcoesPai = useMemo(() => coletarOpcoes(arvoreCompleta), [arvoreCompleta]);

  const handleEditar = (item: PlanoContaNode) => {
    setEditandoId(item.id);
    setSelecionado(item);
    setForm({
      nome: item.nome,
      codigo: item.codigo,
      natureza: item.natureza,
      paiId: item.paiId ? String(item.paiId) : "",
      visivelDre: item.visivelDre ? 1 : 0,
      obrigaCentroCusto: item.obrigatorioCentroCusto ? 1 : 0,
      ativo: item.ativo ? 1 : 0,
    });
  };

  const handleNovo = () => {
    setEditandoId(null);
    setSelecionado(null);
    setForm({ ...FORM_VAZIO });
  };

  const handleLimpar = () => {
    setEditandoId(null);
    setSelecionado(null);
    setForm({ ...FORM_VAZIO });
  };

  const handleSalvar = async () => {
    if (!empresa?.id) return;
    if (!form.nome.trim() || !form.codigo.trim()) {
      setNotification({ type: "error", message: "Nome e codigo sao obrigatorios." });
      return;
    }

    setSalvando(true);
    setNotification(null);

    try {
      if (editandoId) {
        const resp = await fetch(`/api/financeiro/plano-contas?id=${editandoId}`, {
          method: "PUT",
          headers: { ...headersPadrao, "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: form.nome,
            codigo: form.codigo,
            natureza: form.natureza,
            paiId: form.paiId ? Number(form.paiId) : null,
            visivelDre: form.visivelDre,
            obrigaCentroCusto: form.obrigaCentroCusto,
            ativo: form.ativo,
          }),
        });
        const json = await resp.json();
        if (json.success) {
          setNotification({ type: "success", message: "Conta atualizada com sucesso!" });
          await carregarPlanoContas();
        } else {
          setNotification({ type: "error", message: json.error || "Erro ao atualizar" });
        }
      } else {
        const resp = await fetch("/api/financeiro/plano-contas", {
          method: "POST",
          headers: { ...headersPadrao, "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: form.nome,
            codigo: form.codigo,
            natureza: form.natureza,
            paiId: form.paiId ? Number(form.paiId) : null,
            visivelDre: form.visivelDre,
            obrigaCentroCusto: form.obrigaCentroCusto,
          }),
        });
        const json = await resp.json();
        if (json.success) {
          setNotification({ type: "success", message: "Conta criada com sucesso!" });
          handleLimpar();
          await carregarPlanoContas();
        } else {
          setNotification({ type: "error", message: json.error || "Erro ao criar" });
        }
      }
    } catch (err) {
      setNotification({ type: "error", message: "Erro de conexao." });
    } finally {
      setSalvando(false);
    }
  };

  const renderNo = (item: PlanoContaNode) => {
    const estaSelecionado = selecionado?.id === item.id;

    return (
      <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          className={`tree-node${estaSelecionado ? " selected" : ""}`}
          onClick={() => handleEditar(item)}
          style={{ cursor: "pointer" }}
        >
          <div className="tree-node-header">
            <div>
              <p className="tree-node-code">{item.codigo}</p>
              <p className="tree-node-name">{item.nome}</p>
              <p className="tree-node-meta">
                {item.natureza} | Centro custo: {item.obrigatorioCentroCusto ? "Sim" : "Nao"} | DRE: {item.visivelDre ? "Sim" : "Nao"}
              </p>
            </div>
            <span className={item.ativo ? "badge badge-success" : "badge badge-danger"}>
              {item.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="tree-node-actions">
            <button
              type="button"
              className="button button-secondary button-compact"
              onClick={(e) => { e.stopPropagation(); handleEditar(item); }}
            >
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

        <PaginaProtegida codigoTela={codigoTela}>
        <main className="page-content-card">
          {erroLista ? <NotificationBar type="error" message={erroLista} /> : null}
          {notification && <NotificationBar type={notification.type} message={notification.message} />}

          <div className="departamentos-page">
            <div className="split-view">
              {/* LEFT: Tree view */}
              <section className="split-view-panel">
                <div className="section-header">
                  <div>
                    <h2>Arvore do plano de contas</h2>
                    <p>Navegue pela estrutura hierarquica. Clique para editar.</p>
                  </div>
                  <button type="button" className="button button-primary" onClick={handleNovo}>
                    Nova conta
                  </button>
                </div>

                <BarraFiltros
                  filtro={filtro}
                  onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))}
                  exibirNatureza
                />

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {carregandoLista ? (
                    <div className="empty-state"><p>Buscando contas financeiras...</p></div>
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
                  <h2>{editandoId ? "Editar conta" : "Nova conta"}</h2>
                  <p>
                    {editandoId
                      ? `Editando: ${form.codigo} - ${form.nome}`
                      : "Defina contas sinteticas e analiticas para organizar lancamentos e a DRE."}
                  </p>
                </header>

                <form className="form" onSubmit={(e) => { e.preventDefault(); handleSalvar(); }}>
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="plano-codigo">Codigo *</label>
                      <input
                        id="plano-codigo"
                        type="text"
                        className="form-input"
                        placeholder="Ex: 1.01.001"
                        value={form.codigo}
                        onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="plano-descricao">Nome *</label>
                      <input
                        id="plano-descricao"
                        type="text"
                        className="form-input"
                        placeholder="Nome oficial da conta"
                        value={form.nome}
                        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="plano-natureza">Natureza *</label>
                      <select
                        id="plano-natureza"
                        className="form-input"
                        value={form.natureza}
                        onChange={(e) => setForm((f) => ({ ...f, natureza: e.target.value as any }))}
                      >
                        <option value="RECEITA">Receita</option>
                        <option value="DESPESA">Despesa</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="plano-pai">Conta pai</label>
                      <select
                        id="plano-pai"
                        className="form-input"
                        value={form.paiId}
                        onChange={(e) => setForm((f) => ({ ...f, paiId: e.target.value }))}
                      >
                        <option value="">Raiz (sem pai)</option>
                        {opcoesPai
                          .filter((op) => op.id !== editandoId)
                          .map((op) => (
                            <option key={op.id} value={op.id}>{op.label}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="plano-status">Status</label>
                      <select
                        id="plano-status"
                        className="form-input"
                        value={form.ativo}
                        onChange={(e) => setForm((f) => ({ ...f, ativo: Number(e.target.value) }))}
                      >
                        <option value={1}>Ativo</option>
                        <option value={0}>Inativo</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="plano-considera-dre">Visivel no DRE</label>
                      <select
                        id="plano-considera-dre"
                        className="form-input"
                        value={form.visivelDre}
                        onChange={(e) => setForm((f) => ({ ...f, visivelDre: Number(e.target.value) }))}
                      >
                        <option value={1}>Sim</option>
                        <option value={0}>Nao</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="plano-centro-custo">Obriga centro de custo</label>
                      <select
                        id="plano-centro-custo"
                        className="form-input"
                        value={form.obrigaCentroCusto}
                        onChange={(e) => setForm((f) => ({ ...f, obrigaCentroCusto: Number(e.target.value) }))}
                      >
                        <option value={0}>Nao</option>
                        <option value={1}>Sim</option>
                      </select>
                    </div>
                    <div className="form-group" />
                  </div>

                  <div className="form-actions departamentos-actions">
                    <div className="button-row">
                      <button type="submit" className="button button-primary" disabled={salvando}>
                        {salvando ? "Salvando..." : editandoId ? "Atualizar" : "Salvar conta"}
                      </button>
                      <button type="button" className="button button-secondary" onClick={handleLimpar}>
                        Limpar
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}
