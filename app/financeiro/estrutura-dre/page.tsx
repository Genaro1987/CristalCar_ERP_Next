"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";
import { BarraFiltros, FiltroPadrao } from "../_components/financeiro-layout";

interface LinhaDre {
  id: string;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "OUTROS";
  status: "ativo" | "inativo";
  tipo?: string;
  descricao?: string;
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
  natureza: "RECEITA" | "DESPESA" | "OUTROS";
  tipo: string;
  descricao: string;
  ativo: number;
  paiId: string | null;
}

const FORM_VAZIO: FormDre = {
  nome: "",
  codigo: "",
  natureza: "RECEITA",
  tipo: "Fixo",
  descricao: "",
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
            const opcoes = (dados.data ?? []).map((item: any) => ({
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
  };

  const handleEditar = (item: LinhaDre) => {
    setEditandoId(item.id);
    setForm({
      nome: item.nome,
      codigo: item.codigo,
      natureza: item.natureza,
      tipo: item.tipo || "Fixo",
      descricao: item.descricao || "",
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
            paiId: form.paiId ? Number(form.paiId) : null,
          }),
        });
        const json = await resp.json();
        if (json.success) {
          setNotification({ type: "success", message: "Linha do DRE criada com sucesso!" });
          handleLimpar();
          await carregarDre();
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

  const contasFiltradas = useMemo(() => {
    if (!contaBusca.trim()) return planoContas.slice(0, 10);
    const b = contaBusca.toLowerCase();
    return planoContas.filter((c) => c.label.toLowerCase().includes(b)).slice(0, 10);
  }, [planoContas, contaBusca]);

  const renderNo = (item: LinhaDre) => {
    const estaSelecionada = selecionada?.id === item.id;
    return (
      <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          className={`tree-node${estaSelecionada ? " selected" : ""}`}
          onClick={() => { setSelecionada(item); handleEditar(item); }}
          style={{ cursor: "pointer" }}
        >
          <div className="tree-node-header">
            <div>
              <p className="tree-node-code">{item.codigo}</p>
              <p className="tree-node-name">{item.nome}</p>
              <p className="tree-node-meta">
                Natureza: {item.natureza} {item.tipo ? `| Tipo: ${item.tipo}` : ""}
              </p>
            </div>
            <span className={item.status === "ativo" ? "badge badge-success" : "badge badge-danger"}>
              {item.status === "ativo" ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="tree-node-actions">
            <button
              type="button"
              className="button button-secondary button-compact"
              onClick={(e) => { e.stopPropagation(); handleNovo(item.id); }}
            >
              Novo filho
            </button>
            <button
              type="button"
              className="button button-secondary button-compact"
              onClick={(e) => { e.stopPropagation(); handleEditar(item); }}
            >
              Editar
            </button>
          </div>
        </div>
        {item.filhos && item.filhos.length > 0 ? (
          <div className="tree-children">
            {item.filhos.map((filho) => renderNo(filho))}
          </div>
        ) : null}
      </div>
    );
  };

  const contasSelecionadas = selecionada?.contasVinculadas ?? [];

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

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {carregando ? (
                    <div className="empty-state"><p>Carregando estrutura DRE...</p></div>
                  ) : arvoreFiltrada.length === 0 ? (
                    <div className="empty-state">
                      <strong>Nenhuma linha do DRE encontrada</strong>
                      <p>Ajuste os filtros ou cadastre uma nova linha.</p>
                    </div>
                  ) : (
                    arvoreFiltrada.map((item) => renderNo(item))
                  )}
                </div>
              </section>

              {/* RIGHT: Inline Form + Linked accounts */}
              <section className="split-view-panel">
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
                        onChange={(e) => setForm((f) => ({ ...f, natureza: e.target.value as any }))}
                      >
                        <option value="RECEITA">Receita</option>
                        <option value="DESPESA">Despesa</option>
                        <option value="OUTROS">Outros</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="dre-linha-tipo">Tipo</label>
                      <select
                        id="dre-linha-tipo"
                        className="form-input"
                        value={form.tipo}
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
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <input
                          id="dre-busca-conta"
                          className="form-input"
                          placeholder="Buscar pelo codigo ou nome"
                          value={contaBusca}
                          onChange={(e) => setContaBusca(e.target.value)}
                          style={{ flex: 1 }}
                        />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {contasFiltradas.map((conta) => (
                          <button
                            key={conta.id}
                            type="button"
                            className="badge"
                            style={{ backgroundColor: "#dbeafe", color: "#1e40af", cursor: "pointer", border: "none", padding: "4px 10px", fontSize: "0.78rem" }}
                            onClick={() => handleVincularConta(conta.id)}
                            disabled={salvandoVinculo}
                          >
                            + {conta.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}
