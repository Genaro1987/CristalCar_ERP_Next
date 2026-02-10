"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { ModalConfirmacao } from "@/components/ModalConfirmacao";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";

interface Pessoa {
  CAD_PESSOA_ID: number;
  CAD_PESSOA_NOME: string;
  CAD_PESSOA_DOCUMENTO: string | null;
  CAD_PESSOA_TIPO: "CLIENTE" | "FORNECEDOR" | "AMBOS";
  CAD_PESSOA_ENDERECO: string | null;
  CAD_PESSOA_CIDADE: string | null;
  CAD_PESSOA_UF: string | null;
  CAD_PESSOA_CEP: string | null;
  CAD_PESSOA_TELEFONE: string | null;
  CAD_PESSOA_EMAIL: string | null;
  CAD_PESSOA_OBSERVACAO: string | null;
  CAD_PESSOA_ATIVO: number;
}

interface FormPessoa {
  nome: string;
  documento: string;
  tipo: "CLIENTE" | "FORNECEDOR" | "AMBOS";
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  observacao: string;
  ativo: number;
}

const FORM_VAZIO: FormPessoa = {
  nome: "",
  documento: "",
  tipo: "AMBOS",
  endereco: "",
  cidade: "",
  uf: "",
  cep: "",
  telefone: "",
  email: "",
  observacao: "",
  ativo: 1,
};

const TIPO_LABELS: Record<string, string> = {
  CLIENTE: "Cliente",
  FORNECEDOR: "Fornecedor",
  AMBOS: "Cliente e Fornecedor",
};

export default function PessoasPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [form, setForm] = useState<FormPessoa>({ ...FORM_VAZIO });
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativos" | "inativos">("ativos");
  const [confirmExcluir, setConfirmExcluir] = useState<{ item: Pessoa; msg: string } | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (empresa?.id) h["x-empresa-id"] = String(empresa.id);
    return h;
  }, [empresa?.id]);

  const carregarPessoas = useCallback(async () => {
    if (!empresa?.id) return;
    setCarregando(true);
    try {
      const resp = await fetch("/api/cadastros/pessoas", { headers });
      const json = await resp.json();
      if (json.success) setPessoas(json.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, [empresa?.id, headers]);

  useEffect(() => { carregarPessoas(); }, [carregarPessoas]);

  const pessoasFiltradas = useMemo(() => {
    const b = busca.toLowerCase().trim();
    return pessoas.filter((p) => {
      if (filtroStatus === "ativos" && !p.CAD_PESSOA_ATIVO) return false;
      if (filtroStatus === "inativos" && p.CAD_PESSOA_ATIVO) return false;
      if (filtroTipo && p.CAD_PESSOA_TIPO !== filtroTipo && p.CAD_PESSOA_TIPO !== "AMBOS") return false;
      if (b) {
        const texto = `${p.CAD_PESSOA_NOME} ${p.CAD_PESSOA_DOCUMENTO ?? ""}`.toLowerCase();
        if (!texto.includes(b)) return false;
      }
      return true;
    });
  }, [pessoas, busca, filtroTipo, filtroStatus]);

  const handleEditar = (p: Pessoa) => {
    setEditandoId(p.CAD_PESSOA_ID);
    setForm({
      nome: p.CAD_PESSOA_NOME,
      documento: p.CAD_PESSOA_DOCUMENTO ?? "",
      tipo: p.CAD_PESSOA_TIPO,
      endereco: p.CAD_PESSOA_ENDERECO ?? "",
      cidade: p.CAD_PESSOA_CIDADE ?? "",
      uf: p.CAD_PESSOA_UF ?? "",
      cep: p.CAD_PESSOA_CEP ?? "",
      telefone: p.CAD_PESSOA_TELEFONE ?? "",
      email: p.CAD_PESSOA_EMAIL ?? "",
      observacao: p.CAD_PESSOA_OBSERVACAO ?? "",
      ativo: p.CAD_PESSOA_ATIVO,
    });
  };

  const handleLimpar = () => {
    setEditandoId(null);
    setForm({ ...FORM_VAZIO });
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa?.id) return;
    if (!form.nome.trim()) {
      setNotification({ type: "error", message: "Nome e obrigatorio." });
      return;
    }
    setSalvando(true);
    setNotification(null);

    try {
      const url = editandoId ? `/api/cadastros/pessoas?id=${editandoId}` : "/api/cadastros/pessoas";
      const method = editandoId ? "PUT" : "POST";
      const resp = await fetch(url, { method, headers, body: JSON.stringify(form) });
      const json = await resp.json();
      if (json.success) {
        setNotification({ type: "success", message: json.message });
        if (!editandoId) handleLimpar();
        await carregarPessoas();
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao salvar" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexao." });
    } finally {
      setSalvando(false);
    }
  };

  const executarExcluir = async () => {
    if (!confirmExcluir) return;
    setConfirmExcluir(null);
    try {
      const resp = await fetch(`/api/cadastros/pessoas?id=${confirmExcluir.item.CAD_PESSOA_ID}`, { method: "DELETE", headers });
      const json = await resp.json();
      if (json.success) {
        setNotification({ type: "success", message: json.message });
        if (editandoId === confirmExcluir.item.CAD_PESSOA_ID) handleLimpar();
        await carregarPessoas();
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao excluir" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexao." });
    }
  };

  return (
    <LayoutShell>
      <div className="page-container financeiro-page">
        <HeaderBar
          nomeTela="CLIENTES E FORNECEDORES"
          codigoTela="CAD_PESSOA"
          caminhoRota="/cadastros/pessoas"
          modulo="CADASTROS"
        />

        <PaginaProtegida codigoTela="CAD_PESSOA">
        <main className="page-content-card">
          {notification && <NotificationBar type={notification.type} message={notification.message} />}

          <div className="departamentos-page">
            <div className="split-view">
              {/* LEFT: List */}
              <section className="split-view-panel">
                <div className="section-header">
                  <div>
                    <h2>Cadastros</h2>
                    <p>Clientes, fornecedores ou ambos. Clique para editar.</p>
                  </div>
                  <button type="button" className="button button-primary" onClick={handleLimpar}>Novo</button>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <input
                    className="form-input"
                    placeholder="Buscar por nome ou documento"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <select className="form-input" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={{ width: 140 }}>
                    <option value="">Todos os tipos</option>
                    <option value="CLIENTE">Cliente</option>
                    <option value="FORNECEDOR">Fornecedor</option>
                    <option value="AMBOS">Ambos</option>
                  </select>
                  <select className="form-input" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as any)} style={{ width: 120 }}>
                    <option value="ativos">Ativos</option>
                    <option value="inativos">Inativos</option>
                    <option value="todos">Todos</option>
                  </select>
                </div>

                <div style={{ maxHeight: 600, overflowY: "auto" }}>
                  {carregando ? (
                    <div className="empty-state"><p>Carregando...</p></div>
                  ) : pessoasFiltradas.length === 0 ? (
                    <div className="empty-state"><strong>Nenhum cadastro encontrado</strong><p>Ajuste os filtros ou cadastre um novo.</p></div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th style={{ width: 140 }}>Documento</th>
                          <th style={{ width: 120, textAlign: "center" }}>Tipo</th>
                          <th style={{ width: 80 }}>Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pessoasFiltradas.map((p) => (
                          <tr
                            key={p.CAD_PESSOA_ID}
                            onClick={() => handleEditar(p)}
                            style={{ cursor: "pointer", backgroundColor: editandoId === p.CAD_PESSOA_ID ? "#fff7ed" : undefined }}
                          >
                            <td style={{ fontWeight: 600 }}>
                              {p.CAD_PESSOA_NOME}
                              {!p.CAD_PESSOA_ATIVO && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: "0.65rem" }}>Inativo</span>}
                            </td>
                            <td style={{ fontSize: "0.82rem", color: "#6b7280" }}>{p.CAD_PESSOA_DOCUMENTO || "—"}</td>
                            <td style={{ textAlign: "center" }}>
                              <span className="badge" style={{
                                backgroundColor: p.CAD_PESSOA_TIPO === "CLIENTE" ? "#dbeafe" : p.CAD_PESSOA_TIPO === "FORNECEDOR" ? "#fee2e2" : "#d1fae5",
                                color: p.CAD_PESSOA_TIPO === "CLIENTE" ? "#1e40af" : p.CAD_PESSOA_TIPO === "FORNECEDOR" ? "#991b1b" : "#065f46",
                              }}>
                                {TIPO_LABELS[p.CAD_PESSOA_TIPO]}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="button button-danger button-compact"
                                onClick={(e) => { e.stopPropagation(); setConfirmExcluir({ item: p, msg: `Excluir "${p.CAD_PESSOA_NOME}"?` }); }}
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              {/* RIGHT: Form */}
              <section className="split-view-panel">
                <header className="form-section-header">
                  <h2>{editandoId ? "Editar cadastro" : "Novo cadastro"}</h2>
                  <p>{editandoId ? `Editando: ${form.nome}` : "Preencha os dados para cadastrar cliente, fornecedor ou ambos."}</p>
                </header>

                <form className="form" onSubmit={handleSalvar}>
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="pes-nome">Nome / Razao Social *</label>
                      <input id="pes-nome" className="form-input" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome completo ou razao social" required />
                    </div>
                    <div className="form-group">
                      <label htmlFor="pes-doc">CPF / CNPJ</label>
                      <input id="pes-doc" className="form-input" value={form.documento} onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))} placeholder="000.000.000-00 ou 00.000.000/0000-00" />
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="pes-tipo">Tipo *</label>
                      <select id="pes-tipo" className="form-input" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as any }))}>
                        <option value="AMBOS">Cliente e Fornecedor</option>
                        <option value="CLIENTE">Cliente</option>
                        <option value="FORNECEDOR">Fornecedor</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="pes-status">Status</label>
                      <select id="pes-status" className="form-input" value={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: Number(e.target.value) }))}>
                        <option value={1}>Ativo</option>
                        <option value={0}>Inativo</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="pes-end">Endereco</label>
                    <input id="pes-end" className="form-input" value={form.endereco} onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} placeholder="Rua, numero, complemento" />
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="pes-cidade">Cidade</label>
                      <input id="pes-cidade" className="form-input" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
                    </div>
                    <div className="form-grid two-columns">
                      <div className="form-group">
                        <label htmlFor="pes-uf">UF</label>
                        <input id="pes-uf" className="form-input" value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))} maxLength={2} style={{ textTransform: "uppercase" }} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="pes-cep">CEP</label>
                        <input id="pes-cep" className="form-input" value={form.cep} onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))} placeholder="00000-000" />
                      </div>
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="pes-tel">Telefone</label>
                      <input id="pes-tel" className="form-input" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="pes-email">E-mail</label>
                      <input id="pes-email" type="email" className="form-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="pes-obs">Observacoes</label>
                    <textarea id="pes-obs" className="form-input" style={{ minHeight: 60 }} value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} />
                  </div>

                  <div className="form-actions departamentos-actions">
                    <div className="button-row">
                      <button type="submit" className="button button-primary" disabled={salvando}>
                        {salvando ? "Salvando..." : editandoId ? "Atualizar" : "Salvar"}
                      </button>
                      <button type="button" className="button button-secondary" onClick={handleLimpar}>Limpar</button>
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
          titulo="Excluir cadastro"
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
