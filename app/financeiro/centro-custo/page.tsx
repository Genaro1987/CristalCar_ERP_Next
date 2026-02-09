"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";
import { ModalConfirmacao } from "@/components/ModalConfirmacao";
import { BarraFiltros, FiltroPadrao } from "../_components/financeiro-layout";

interface CentroCustoItem {
  id: string;
  nome: string;
  codigo: string;
  status: "ativo" | "inativo";
  descricao?: string;
  filhos?: CentroCustoItem[];
}

interface FormCentro {
  nome: string;
  codigo: string;
  descricao: string;
  ativo: number;
  paiId: string;
}

const FORM_VAZIO: FormCentro = {
  nome: "",
  codigo: "",
  descricao: "",
  ativo: 1,
  paiId: "",
};

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

function coletarIds(items: CentroCustoItem[]): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  for (const item of items) {
    result.push({ id: item.id, label: `${item.codigo} - ${item.nome}` });
    if (item.filhos?.length) result.push(...coletarIds(item.filhos));
  }
  return result;
}

export default function CentroCustoPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/centro-custo";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_CENTRO_CUSTO";
  const nomeTela = tela?.NOME_TELA ?? "CENTRO DE CUSTO";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "ativos" });
  const [selecionado, setSelecionado] = useState<CentroCustoItem | null>(null);
  const [centros, setCentros] = useState<CentroCustoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form
  const [form, setForm] = useState<FormCentro>({ ...FORM_VAZIO });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    if (empresa?.id) h["x-empresa-id"] = String(empresa.id);
    return h;
  }, [empresa?.id]);

  const carregarCentros = useCallback(async () => {
    if (!empresa?.id) return;
    try {
      setCarregando(true);
      const resposta = await fetch("/api/financeiro/centro-custo", { headers });
      if (resposta.ok) {
        const dados = await resposta.json();
        if (dados.success) setCentros(dados.data);
      }
    } catch (erro) {
      console.error("Erro ao buscar centros de custo:", erro);
    } finally {
      setCarregando(false);
    }
  }, [empresa?.id, headers]);

  useEffect(() => { carregarCentros(); }, [carregarCentros]);

  const arvoreFiltrada = useMemo(() => filtrarCentros(centros, filtro), [centros, filtro]);
  const opcoesPai = useMemo(() => coletarIds(centros), [centros]);

  const handleEditar = (item: CentroCustoItem) => {
    setSelecionado(item);
    setEditandoId(item.id);
    setForm({
      nome: item.nome,
      codigo: item.codigo,
      descricao: item.descricao || "",
      ativo: item.status === "ativo" ? 1 : 0,
      paiId: "",
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
        const resp = await fetch(`/api/financeiro/centro-custo?id=${editandoId}`, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: form.nome,
            codigo: form.codigo,
            descricao: form.descricao,
            ativo: form.ativo,
          }),
        });
        const json = await resp.json();
        if (json.success) {
          setNotification({ type: "success", message: "Centro de custo atualizado com sucesso!" });
          await carregarCentros();
        } else {
          setNotification({ type: "error", message: json.error || "Erro ao atualizar" });
        }
      } else {
        const resp = await fetch("/api/financeiro/centro-custo", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: form.nome,
            codigo: form.codigo,
            descricao: form.descricao,
            paiId: form.paiId ? Number(form.paiId) : null,
          }),
        });
        const json = await resp.json();
        if (json.success) {
          setNotification({ type: "success", message: "Centro de custo criado com sucesso!" });
          handleLimpar();
          await carregarCentros();
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

  const [confirmExcluir, setConfirmExcluir] = useState<{ item: CentroCustoItem; msg: string } | null>(null);

  const pedirExcluir = (item: CentroCustoItem) => {
    const temFilhos = (item.filhos?.length ?? 0) > 0;
    const msg = temFilhos
      ? `Excluir "${item.codigo} - ${item.nome}" e todos os ${item.filhos!.length} sub-centro(s)? Se houver lancamentos, serao inativados.`
      : `Excluir "${item.codigo} - ${item.nome}"? Se houver lancamentos, sera inativado.`;
    setConfirmExcluir({ item, msg });
  };

  const executarExcluir = async () => {
    if (!confirmExcluir) return;
    const { item } = confirmExcluir;
    setConfirmExcluir(null);

    try {
      const resp = await fetch(`/api/financeiro/centro-custo?id=${item.id}`, {
        method: "DELETE",
        headers,
      });
      const json = await resp.json();
      if (json.success) {
        setNotification({
          type: json.inativada ? "error" : "success",
          message: json.message,
        });
        if (selecionado?.id === item.id) handleLimpar();
        await carregarCentros();
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

  const renderNo = (item: CentroCustoItem, nivel: number, parentLines: boolean[], isLast: boolean) => {
    const sel = selecionado?.id === item.id;
    const temFilhos = (item.filhos?.length ?? 0) > 0;
    const col = colapsados.has(item.id);

    return (
      <div key={item.id}>
        <div className="tree-row">
          <div className="tree-indent">
            {parentLines.map((showLine, i) => (
              <div key={i} className={`tree-indent-segment${showLine ? " line" : ""}`} />
            ))}
            {nivel > 0 && (
              <div className={`tree-indent-segment ${isLast ? "branch-last" : "branch"}`} />
            )}
          </div>
          <div
            className={`tree-node tree-level-${Math.min(nivel, 3)}${sel ? " selected" : ""}`}
            onClick={() => handleEditar(item)}
          >
            {temFilhos && (
              <button
                type="button"
                className="tree-toggle"
                onClick={(e) => { e.stopPropagation(); toggleColapso(item.id); }}
              >
                {col ? "+" : "−"}
              </button>
            )}
            <div className="tree-node-header">
              <div className="tree-node-info">
                <span className="tree-node-code">{item.codigo}</span>
                <span className="tree-node-name">{item.nome}</span>
                {item.descricao && <span className="tree-node-meta">{item.descricao}</span>}
              </div>
              <div className="tree-node-right">
                <span className={`badge ${item.status === "ativo" ? "badge-success" : "badge-danger"}`}>
                  {item.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
                <div className="tree-node-actions">
                  <button
                    type="button"
                    className="button button-secondary button-compact"
                    onClick={(e) => { e.stopPropagation(); handleEditar(item); }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="button button-danger button-compact"
                    onClick={(e) => { e.stopPropagation(); pedirExcluir(item); }}
                  >
                    Excluir
                  </button>
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
                    <h2>Estrutura de centros de custo</h2>
                    <p>Organize agrupamentos e mantenha a hierarquia alinhada ao orcamento.</p>
                  </div>
                  <button type="button" className="button button-primary" onClick={handleNovo}>
                    Novo
                  </button>
                </div>

                <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))} />

                <div className="tree-container" style={{ marginTop: 12 }}>
                  {carregando ? (
                    <div className="empty-state"><p>Carregando centros de custo...</p></div>
                  ) : arvoreFiltrada.length === 0 ? (
                    <div className="empty-state">
                      <strong>Nenhum centro de custo encontrado</strong>
                      <p>Ajuste os filtros ou cadastre um novo centro.</p>
                    </div>
                  ) : (
                    arvoreFiltrada.map((item, idx) => renderNo(item, 0, [], idx === arvoreFiltrada.length - 1))
                  )}
                </div>
              </section>

              {/* RIGHT: Form */}
              <section className="split-view-panel">
                <header className="form-section-header">
                  <h2>{editandoId ? "Editar centro de custo" : "Novo centro de custo"}</h2>
                  <p>
                    {editandoId
                      ? `Editando: ${form.codigo} - ${form.nome}`
                      : "Preencha os campos para cadastrar um novo centro de custo."}
                  </p>
                </header>

                <form className="form" onSubmit={(e) => { e.preventDefault(); handleSalvar(); }}>
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="centro-codigo">Codigo *</label>
                      <input
                        id="centro-codigo"
                        className="form-input"
                        placeholder="02.04"
                        value={form.codigo}
                        onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="centro-nome">Nome *</label>
                      <input
                        id="centro-nome"
                        className="form-input"
                        placeholder="Ex: Operacoes Norte"
                        value={form.nome}
                        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="centro-status">Status</label>
                      <select
                        id="centro-status"
                        className="form-input"
                        value={form.ativo}
                        onChange={(e) => setForm((f) => ({ ...f, ativo: Number(e.target.value) }))}
                      >
                        <option value={1}>Ativo</option>
                        <option value={0}>Inativo</option>
                      </select>
                    </div>
                    {!editandoId && (
                      <div className="form-group">
                        <label htmlFor="centro-pai">Centro pai (opcional)</label>
                        <select
                          id="centro-pai"
                          className="form-input"
                          value={form.paiId}
                          onChange={(e) => setForm((f) => ({ ...f, paiId: e.target.value }))}
                        >
                          <option value="">Raiz (sem pai)</option>
                          {opcoesPai.map((op) => (
                            <option key={op.id} value={op.id}>{op.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="centro-observacao">Observacoes</label>
                    <textarea
                      id="centro-observacao"
                      className="form-input"
                      style={{ minHeight: 80 }}
                      placeholder="Regras de rateio, aprovadores ou integracoes esperadas"
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
              </section>
            </div>
          </div>
        </main>
        </PaginaProtegida>

        <ModalConfirmacao
          aberto={!!confirmExcluir}
          titulo="Excluir centro de custo"
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
