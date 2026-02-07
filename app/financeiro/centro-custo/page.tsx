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

  const renderNo = (item: CentroCustoItem) => {
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
              {item.descricao && <p className="tree-node-meta">{item.descricao}</p>}
            </div>
            <span className={item.status === "ativo" ? "badge badge-success" : "badge badge-danger"}>
              {item.status === "ativo" ? "Ativo" : "Inativo"}
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
        {item.filhos && item.filhos.length > 0 ? (
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

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {carregando ? (
                    <div className="empty-state"><p>Carregando centros de custo...</p></div>
                  ) : arvoreFiltrada.length === 0 ? (
                    <div className="empty-state">
                      <strong>Nenhum centro de custo encontrado</strong>
                      <p>Ajuste os filtros ou cadastre um novo centro.</p>
                    </div>
                  ) : (
                    arvoreFiltrada.map((item) => renderNo(item))
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
      </div>
    </LayoutShell>
  );
}
