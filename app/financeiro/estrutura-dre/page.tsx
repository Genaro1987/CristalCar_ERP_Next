"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";
import { ModalConfirmacao } from "@/components/ModalConfirmacao";
import { BarraFiltros, FiltroPadrao } from "../_components/financeiro-layout";

interface LinhaDre {
  id: string;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "CALCULADO";
  status: "ativo" | "inativo";
  tipo?: string;
  descricao?: string;
  formula?: string;
  referencia100?: boolean;
  contasVinculadas?: string[];
  filhos?: LinhaDre[];
}

interface PlanoContaOption {
  id: number;
  label: string;
  codigo: string;
}

interface FormDre {
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "CALCULADO";
  tipo: string;
  descricao: string;
  formula: string;
  referencia100: number;
  ativo: number;
  paiId: string | null;
}

const FORM_VAZIO: FormDre = {
  nome: "",
  codigo: "",
  natureza: "RECEITA",
  tipo: "Fixo",
  descricao: "",
  formula: "",
  referencia100: 0,
  ativo: 1,
  paiId: null,
};

function filtrarDre(dados: LinhaDre[], filtro: FiltroPadrao): LinhaDre[] {
  const buscaNormalizada = filtro.busca.trim().toLowerCase();

  const atendeFiltro = (item: LinhaDre) => {
    const statusOk =
      filtro.status === "todos" ||
      (filtro.status === "ativos" && item.status === "ativo") ||
      (filtro.status === "inativos" && item.status === "inativo");
    const buscaOk = buscaNormalizada
      ? `${item.codigo} ${item.nome}`.toLowerCase().includes(buscaNormalizada)
      : true;
    return statusOk && buscaOk;
  };

  return dados.flatMap((item) => {
    const filhosFiltrados = item.filhos ? filtrarDre(item.filhos, filtro) : [];
    const corresponde = atendeFiltro(item);
    if (corresponde || filhosFiltrados.length > 0) {
      return [{ ...item, filhos: filhosFiltrados }];
    }
    return [];
  });
}

function coletarIds(items: LinhaDre[]): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  for (const item of items) {
    result.push({ id: item.id, label: `${item.codigo} - ${item.nome}` });
    if (item.filhos?.length) result.push(...coletarIds(item.filhos));
  }
  return result;
}

export default function EstruturaDrePage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/estrutura-dre";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_ESTRUTURA_DRE";
  const nomeTela = tela?.NOME_TELA ?? "ESTRUTURA DO DRE";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "ativos" });
  const [selecionada, setSelecionada] = useState<LinhaDre | null>(null);
  const [linhasDre, setLinhasDre] = useState<LinhaDre[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [planoContas, setPlanoContas] = useState<PlanoContaOption[]>([]);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form state
  const [form, setForm] = useState<FormDre>({ ...FORM_VAZIO });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const formRef = useRef<HTMLElement>(null);

  // Vinculacao de contas
  const [contaBusca, setContaBusca] = useState("");
  const [contasSelecionadasVinc, setContasSelecionadasVinc] = useState<string[]>([]);
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    if (empresa?.id) h["x-empresa-id"] = String(empresa.id);
    return h;
  }, [empresa?.id]);

  const carregarDre = useCallback(async () => {
    if (!empresa?.id) return;
    try {
      setCarregando(true);
      const resposta = await fetch("/api/financeiro/estrutura-dre", { headers });
      if (resposta.ok) {
        const dados = await resposta.json();
        if (dados.success) setLinhasDre(dados.data);
      }
    } catch (erro) {
      console.error("Erro ao buscar estrutura DRE:", erro);
    } finally {
      setCarregando(false);
    }
  }, [empresa?.id, headers]);

  useEffect(() => { carregarDre(); }, [carregarDre]);

  useEffect(() => {
    if (!empresa?.id) return;
    const carregarPlanoContas = async () => {
      try {
        const resposta = await fetch("/api/financeiro/plano-contas", { headers });
        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            const opcoes = (dados.data ?? [])
            .filter((item: any) => item.FIN_PLANO_CONTA_VISIVEL_DRE === 1)
            .map((item: any) => ({
              id: item.FIN_PLANO_CONTA_ID,
              label: `${item.FIN_PLANO_CONTA_CODIGO} ${item.FIN_PLANO_CONTA_NOME}`,
              codigo: item.FIN_PLANO_CONTA_CODIGO,
            }));
            setPlanoContas(opcoes);
          }
        }
      } catch (erro) {
        console.error("Erro ao carregar plano de contas:", erro);
      }
    };
    carregarPlanoContas();
  }, [empresa?.id, headers]);

  const arvoreFiltrada = useMemo(() => filtrarDre(linhasDre, filtro), [linhasDre, filtro]);
  const opcoesLinhasPai = useMemo(() => coletarIds(linhasDre), [linhasDre]);

  const handleNovo = (paiId?: string) => {
    setEditandoId(null);
    setForm({ ...FORM_VAZIO, paiId: paiId || null });
    setSelecionada(null);
    setTimeout(() => { formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
  };

  const handleEditar = (item: LinhaDre) => {
    setEditandoId(item.id);
    setForm({
      nome: item.nome,
      codigo: item.codigo,
      natureza: item.natureza,
      tipo: item.tipo || "Fixo",
      descricao: item.descricao || "",
      formula: item.formula || "",
      referencia100: item.referencia100 ? 1 : 0,
      ativo: item.status === "ativo" ? 1 : 0,
      paiId: null,
    });
    setSelecionada(item);
    setContasSelecionadasVinc(item.contasVinculadas ?? []);
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
        // UPDATE
        const resp = await fetch(`/api/financeiro/estrutura-dre?id=${editandoId}`, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: form.nome,
            codigo: form.codigo,
            natureza: form.natureza,
            tipo: form.tipo,
            descricao: form.descricao,
            formula: form.natureza === "CALCULADO" ? form.formula : null,
            referencia100: form.referencia100 === 1,
            ativo: form.ativo,
          }),
        });
        const json = await resp.json();
        if (json.success) {
          setNotification({ type: "success", message: "Linha do DRE atualizada com sucesso!" });
          await carregarDre();
        } else {
          setNotification({ type: "error", message: json.error || "Erro ao atualizar" });
        }
      } else {
        // CREATE
        const resp = await fetch("/api/financeiro/estrutura-dre", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: form.nome,
            codigo: form.codigo,
            natureza: form.natureza,
            tipo: form.tipo,
            descricao: form.descricao,
            formula: form.natureza === "CALCULADO" ? form.formula : null,
            referencia100: form.referencia100 === 1,
            paiId: form.paiId ? Number(form.paiId) : null,
          }),
        });
        let json: any;
        try { json = await resp.json(); } catch { json = { success: false, error: `Erro HTTP ${resp.status}` }; }
        if (json.success) {
          setNotification({ type: "success", message: "Linha do DRE criada com sucesso!" });
          handleLimpar();
          await carregarDre();
        } else {
          setNotification({ type: "error", message: json.error || "Erro ao criar" });
        }
      }
    } catch (err) {
      setNotification({ type: "error", message: "Erro de conexao: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setSalvando(false);
    }
  };

  const handleLimpar = () => {
    setEditandoId(null);
    setForm({ ...FORM_VAZIO });
    setSelecionada(null);
    setContasSelecionadasVinc([]);
  };

  const handleVincularConta = async (contaId: number) => {
    if (!selecionada || !empresa?.id) return;
    setSalvandoVinculo(true);
    try {
      const resp = await fetch("/api/financeiro/estrutura-dre/vincular", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          dreId: Number(selecionada.id),
          planoContaId: contaId,
        }),
      });
      const json = await resp.json();
      if (json.success) {
        setNotification({ type: "success", message: "Conta vinculada!" });
        await carregarDre();
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao vincular" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexao." });
    } finally {
      setSalvandoVinculo(false);
    }
  };

  const handleDesvincularConta = async (contaLabel: string) => {
    if (!selecionada || !empresa?.id) return;
    // Extract code from "CODE NOME" format
    const contaCodigo = contaLabel.split(" ")[0];
    const conta = planoContas.find((c) => c.codigo === contaCodigo);
    if (!conta) return;

    setSalvandoVinculo(true);
    try {
      const resp = await fetch("/api/financeiro/estrutura-dre/vincular", {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          dreId: Number(selecionada.id),
          planoContaId: conta.id,
        }),
      });
      const json = await resp.json();
      if (json.success) {
        setNotification({ type: "success", message: "Conta desvinculada!" });
        await carregarDre();
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao desvincular" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexao." });
    } finally {
      setSalvandoVinculo(false);
    }
  };

  const contasSelecionadas = selecionada?.contasVinculadas ?? [];

  const contasFiltradas = useMemo(() => {
    // Excluir contas já vinculadas
    const vinculadasSet = new Set(contasSelecionadas.map((c: string) => c.split(" ")[0]));
    const disponiveis = planoContas.filter((c) => !vinculadasSet.has(c.codigo));

    if (!contaBusca.trim()) return disponiveis;
    const b = contaBusca.toLowerCase();
    return disponiveis.filter((c) => c.label.toLowerCase().includes(b));
  }, [planoContas, contaBusca, contasSelecionadas]);

  const [confirmExcluir, setConfirmExcluir] = useState<{ item: LinhaDre; msg: string } | null>(null);

  const pedirExcluir = (item: LinhaDre) => {
    const temFilhos = (item.filhos?.length ?? 0) > 0;
    const msg = temFilhos
      ? `Excluir "${item.codigo} - ${item.nome}" e todas as ${item.filhos!.length} sub-linha(s)? Se houver lancamentos vinculados, serao inativadas.`
      : `Excluir "${item.codigo} - ${item.nome}"? Se houver lancamentos vinculados, sera inativada.`;
    setConfirmExcluir({ item, msg });
  };

  const executarExcluir = async () => {
    if (!confirmExcluir) return;
    const { item } = confirmExcluir;
    setConfirmExcluir(null);

    try {
      const resp = await fetch(`/api/financeiro/estrutura-dre?id=${item.id}`, {
        method: "DELETE",
        headers,
      });
      const json = await resp.json();
      if (json.success) {
        setNotification({
          type: json.inativada ? "error" : "success",
          message: json.message,
        });
        if (selecionada?.id === item.id) handleLimpar();
        await carregarDre();
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao excluir" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexao." });
    }
  };

  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  const toggleColapso = (id: string) => {
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderNo = (item: LinhaDre, nivel: number, parentLines: boolean[], isLast: boolean) => {
    const sel = selecionada?.id === item.id;
    const temFilhos = (item.filhos?.length ?? 0) > 0;
    const col = colapsados.has(item.id);

    return (
      <div key={item.id}>
        <div className="tree-row">
          <div className="tree-indent">
            {parentLines.map((showLine, i) => (
              <div key={i} className={`tree-indent-segment${showLine ? " line" : ""}`} />
            ))}
            {nivel > 0 && <div className={`tree-indent-segment ${isLast ? "branch-last" : "branch"}`} />}
          </div>
          <div
            className={`tree-node tree-level-${Math.min(nivel, 3)}${sel ? " selected" : ""}`}
            onClick={() => { setSelecionada(item); handleEditar(item); }}
          >
            {temFilhos && (
              <button type="button" className="tree-toggle" onClick={(e) => { e.stopPropagation(); toggleColapso(item.id); }}>
                {col ? "+" : "\u2212"}
              </button>
            )}
            <div className="tree-node-header">
              <div className="tree-node-info">
                <span className="tree-node-code">{item.codigo}</span>
                <span className="tree-node-name">{item.nome}</span>
                <span className="tree-node-meta">
                  {item.natureza}{item.tipo ? ` | ${item.tipo}` : ""}{item.formula ? ` | ${item.formula}` : ""}{temFilhos ? ` | ${item.filhos!.length}` : ""}
                </span>
              </div>
              <div className="tree-node-right">
                {item.referencia100 && (
                  <span className="badge badge-info">100%</span>
                )}
                <span className={item.status === "ativo" ? "badge badge-success" : "badge badge-danger"}>
                  {item.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
                <div className="tree-node-actions">
                  <button type="button" className="button button-secondary button-compact"
                    onClick={(e) => { e.stopPropagation(); handleNovo(item.id); }}>+Filho</button>
                  <button type="button" className="button button-secondary button-compact"
                    onClick={(e) => { e.stopPropagation(); handleEditar(item); }}>Editar</button>
                  <button type="button" className="button button-danger button-compact"
                    onClick={(e) => { e.stopPropagation(); pedirExcluir(item); }}>Excluir</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {temFilhos && !col && (
          <div className="tree-children">
            {item.filhos!.map((filho, idx) =>
              renderNo(filho, nivel + 1, [...parentLines, ...(nivel > 0 ? [!isLast] : [])], idx === item.filhos!.length - 1)
            )}
          </div>
        )}
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
          {notification && <NotificationBar type={notification.type} message={notification.message} />}

          <div className="departamentos-page">
            <div className="split-view">
              {/* LEFT: Tree */}
              <section className="split-view-panel">
                <div className="section-header">
                  <div>
                    <h2>Arvore da estrutura do DRE</h2>
                    <p>Estruture linhas e conecte contas para garantir o fechamento correto do resultado.</p>
                  </div>
                  <button type="button" className="button button-primary" onClick={() => handleNovo()}>
                    Nova linha
                  </button>
                </div>

                <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))} />

                <div className="tree-container" style={{ marginTop: 12 }}>
                  {carregando ? (
                    <div className="empty-state"><p>Carregando estrutura DRE...</p></div>
                  ) : arvoreFiltrada.length === 0 ? (
                    <div className="empty-state">
                      <strong>Nenhuma linha do DRE encontrada</strong>
                      <p>Ajuste os filtros ou cadastre uma nova linha.</p>
                    </div>
                  ) : (
                    arvoreFiltrada.map((item, idx) => renderNo(item, 0, [], idx === arvoreFiltrada.length - 1))
                  )}
                </div>
              </section>

              {/* RIGHT: Inline Form + Linked accounts */}
              <section className="split-view-panel" ref={formRef}>
                <header className="form-section-header">
                  <h2>{editandoId ? "Editar linha do DRE" : "Nova linha do DRE"}</h2>
                  <p>
                    {editandoId
                      ? `Editando: ${form.codigo} - ${form.nome}`
                      : "Preencha os campos para cadastrar uma nova linha na estrutura."}
                  </p>
                </header>

                <form className="form" onSubmit={(e) => { e.preventDefault(); handleSalvar(); }}>
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="dre-linha-nome">Nome da linha *</label>
                      <input
                        id="dre-linha-nome"
                        className="form-input"
                        placeholder="Ex: Resultado Operacional"
                        value={form.nome}
                        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="dre-linha-codigo">Codigo *</label>
                      <input
                        id="dre-linha-codigo"
                        className="form-input"
                        placeholder="1.2.1"
                        value={form.codigo}
                        onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="dre-linha-natureza">Natureza</label>
                      <select
                        id="dre-linha-natureza"
                        className="form-input"
                        value={form.natureza}
                        onChange={(e) => setForm((f) => ({ ...f, natureza: e.target.value as any, ...(e.target.value === "CALCULADO" ? { tipo: "Calculado" } : f.tipo === "Calculado" ? { tipo: "Fixo" } : {}) }))}
                      >
                        <option value="RECEITA">Receita</option>
                        <option value="DESPESA">Despesa</option>
                        <option value="CALCULADO">Calculado</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="dre-linha-tipo">Tipo</label>
                      <select
                        id="dre-linha-tipo"
                        className="form-input"
                        value={form.natureza === "CALCULADO" ? "Calculado" : form.tipo}
                        disabled={form.natureza === "CALCULADO"}
                        onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                      >
                        <option value="Fixo">Fixo</option>
                        <option value="Variavel">Variavel</option>
                        <option value="Calculado">Calculado</option>
                      </select>
                    </div>
                  </div>
                  {!editandoId && (
                    <div className="form-grid two-columns">
                      <div className="form-group">
                        <label htmlFor="dre-linha-pai">Linha pai (opcional)</label>
                        <select
                          id="dre-linha-pai"
                          className="form-input"
                          value={form.paiId ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, paiId: e.target.value || null }))}
                        >
                          <option value="">Raiz (sem pai)</option>
                          {opcoesLinhasPai.map((op) => (
                            <option key={op.id} value={op.id}>{op.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" />
                    </div>
                  )}
                  {editandoId && (
                    <div className="form-grid two-columns">
                      <div className="form-group">
                        <label htmlFor="dre-linha-status">Status</label>
                        <select
                          id="dre-linha-status"
                          className="form-input"
                          value={form.ativo}
                          onChange={(e) => setForm((f) => ({ ...f, ativo: Number(e.target.value) }))}
                        >
                          <option value={1}>Ativo</option>
                          <option value={0}>Inativo</option>
                        </select>
                      </div>
                      <div className="form-group" />
                    </div>
                  )}
                  {form.natureza === "CALCULADO" && (
                    <div className="form-group">
                      <label htmlFor="dre-linha-formula">Formula</label>
                      <input
                        id="dre-linha-formula"
                        className="form-input"
                        placeholder="Ex: (1 + 2) - 3 * 4 / 5"
                        value={form.formula}
                        onChange={(e) => setForm((f) => ({ ...f, formula: e.target.value }))}
                      />
                      <small style={{ color: "#6b7280", fontSize: "0.78rem", marginTop: 4, display: "block" }}>
                        Use codigos das linhas com operadores: + - * / e parenteses ( ) para prioridade. Ex: (1 + 2) - 3
                      </small>
                    </div>
                  )}
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="dre-linha-ref100">Referencia 100% (base para %)</label>
                      <select
                        id="dre-linha-ref100"
                        className="form-input"
                        value={form.referencia100}
                        onChange={(e) => setForm((f) => ({ ...f, referencia100: Number(e.target.value) }))}
                      >
                        <option value={0}>Nao</option>
                        <option value={1}>Sim - Esta linha sera 100% no DRE</option>
                      </select>
                    </div>
                    <div className="form-group" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="dre-linha-descricao">Descricao</label>
                    <textarea
                      id="dre-linha-descricao"
                      className="form-input"
                      style={{ minHeight: 80 }}
                      placeholder="Explique como calcular e consolidar esta linha"
                      value={form.descricao}
                      onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                    />
                  </div>
                  <div className="form-actions departamentos-actions">
                    <div className="button-row">
                      <button type="submit" className="button button-primary" disabled={salvando}>
                        {salvando ? "Salvando..." : editandoId ? "Atualizar" : "Salvar"}
                      </button>
                      <button type="button" className="button button-secondary" onClick={handleLimpar}>
                        Limpar
                      </button>
                    </div>
                  </div>
                </form>

                {/* Linked accounts section - only when editing */}
                {editandoId && selecionada && (
                  <div style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
                    <div className="section-header">
                      <div>
                        <h3>Contas vinculadas</h3>
                        <p>Plano de contas conectado a esta linha do DRE.</p>
                      </div>
                    </div>

                    {contasSelecionadas.length > 0 ? (
                      <div className="detail-card">
                        {contasSelecionadas.map((conta) => (
                          <div
                            key={conta}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: 8,
                              padding: "8px 12px",
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              backgroundColor: "#ffffff",
                              fontSize: "0.9rem",
                            }}
                          >
                            <span style={{ minWidth: 0, wordBreak: "break-word", flex: 1 }}>{conta}</span>
                            <button
                              type="button"
                              className="button button-secondary button-compact"
                              style={{ flexShrink: 0 }}
                              onClick={() => handleDesvincularConta(conta)}
                              disabled={salvandoVinculo}
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state"><p>Nenhuma conta associada a esta linha.</p></div>
                    )}

                    <div style={{ marginTop: 16 }}>
                      <label htmlFor="dre-busca-conta" className="detail-label">Vincular nova conta</label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                        <input
                          id="dre-busca-conta"
                          className="form-input"
                          placeholder="Buscar pelo codigo ou nome"
                          value={contaBusca}
                          onChange={(e) => setContaBusca(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <span style={{ fontSize: "0.75rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {contasFiltradas.length} conta(s)
                        </span>
                      </div>
                      <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 8, backgroundColor: "#fafafa" }}>
                        {contasFiltradas.length === 0 ? (
                          <div style={{ padding: "12px 14px", fontSize: "0.82rem", color: "#6b7280", textAlign: "center" }}>
                            {contaBusca.trim() ? "Nenhuma conta encontrada" : "Todas as contas ja estao vinculadas"}
                          </div>
                        ) : (
                          contasFiltradas.map((conta) => (
                            <button
                              key={conta.id}
                              type="button"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                width: "100%",
                                padding: "8px 12px",
                                border: "none",
                                borderBottom: "1px solid #f3f4f6",
                                backgroundColor: "transparent",
                                cursor: "pointer",
                                textAlign: "left",
                                fontSize: "0.82rem",
                                color: "#1e40af",
                                transition: "background-color 0.15s",
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#dbeafe"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                              onClick={() => handleVincularConta(conta.id)}
                              disabled={salvandoVinculo}
                            >
                              <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.9rem", flexShrink: 0 }}>+</span>
                              <span style={{ fontWeight: 600, minWidth: 60, flexShrink: 0 }}>{conta.codigo}</span>
                              <span style={{ color: "#374151" }}>{conta.label.replace(conta.codigo + " ", "")}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </main>
        </PaginaProtegida>

        <ModalConfirmacao
          aberto={!!confirmExcluir}
          titulo="Excluir linha do DRE"
          mensagem={confirmExcluir?.msg ?? ""}
          textoBotaoConfirmar="Excluir"
          tipo="danger"
          onConfirmar={executarExcluir}
          onCancelar={() => setConfirmExcluir(null)}
        />
      </div>
    </LayoutShell>
  );
}
