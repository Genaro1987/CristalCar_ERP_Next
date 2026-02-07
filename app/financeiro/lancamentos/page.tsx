"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

type Lancamento = {
  id: string;
  data: string;
  historico: string;
  conta: string;
  contaId: number;
  centroCusto: string;
  centroCustoId: number | null;
  valor: number;
  tipo: "Entrada" | "Saída";
  status: "confirmado" | "pendente";
  documento?: string;
};

type PlanoContaOption = { id: number; label: string };
type CentroCustoOption = { id: number; label: string };

export default function LancamentosPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/lancamentos";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_LANCAMENTOS";
  const nomeTela = tela?.NOME_TELA ?? "Lançamentos (Caixa)";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState("");
  const [busca, setBusca] = useState("");
  const [planoContas, setPlanoContas] = useState<PlanoContaOption[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoOption[]>([]);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Form state
  const [selecionado, setSelecionado] = useState<Lancamento | null>(null);
  const [formData, setFormData] = useState("");
  const [formHistorico, setFormHistorico] = useState("");
  const [formContaId, setFormContaId] = useState("");
  const [formCentroId, setFormCentroId] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formTipo, setFormTipo] = useState<"Entrada" | "Saída">("Entrada");
  const [formDocumento, setFormDocumento] = useState("");
  const [formStatus, setFormStatus] = useState<"confirmado" | "pendente">("confirmado");
  const [salvando, setSalvando] = useState(false);

  const headersPadrao = useMemo<HeadersInit>(() => {
    const h: Record<string, string> = {};
    if (empresa?.id) h["x-empresa-id"] = String(empresa.id);
    return h;
  }, [empresa?.id]);

  const limparForm = () => {
    setSelecionado(null);
    setFormData("");
    setFormHistorico("");
    setFormContaId("");
    setFormCentroId("");
    setFormValor("");
    setFormTipo("Entrada");
    setFormDocumento("");
    setFormStatus("confirmado");
  };

  const preencherForm = (item: Lancamento) => {
    setSelecionado(item);
    setFormData(item.data);
    setFormHistorico(item.historico);
    setFormContaId(String(item.contaId));
    setFormCentroId(item.centroCustoId ? String(item.centroCustoId) : "");
    setFormValor(String(Math.abs(item.valor)));
    setFormTipo(item.tipo);
    setFormDocumento(item.documento ?? "");
    setFormStatus(item.status);
  };

  // Buscar lançamentos
  const buscarLancamentos = useCallback(async () => {
    if (!empresa?.id) return;
    setCarregando(true);
    try {
      let url = "/api/financeiro/lancamentos";
      if (periodo) url += `?periodo=${periodo}`;
      const res = await fetch(url, { headers: headersPadrao });
      const json = await res.json();
      if (res.ok && json.success) setLancamentos(json.data);
    } catch (e) {
      console.error("Erro ao buscar lançamentos:", e);
    } finally {
      setCarregando(false);
    }
  }, [empresa?.id, periodo, headersPadrao]);

  useEffect(() => {
    buscarLancamentos();
  }, [buscarLancamentos]);

  // Carregar opções
  useEffect(() => {
    if (!empresa?.id) return;
    const carregar = async () => {
      try {
        const [planosRes, centrosRes] = await Promise.all([
          fetch("/api/financeiro/plano-contas", { headers: headersPadrao }),
          fetch("/api/financeiro/centro-custo", { headers: headersPadrao }),
        ]);
        if (planosRes.ok) {
          const json = await planosRes.json();
          if (json.success)
            setPlanoContas(
              (json.data ?? []).map((i: any) => ({
                id: i.FIN_PLANO_CONTA_ID,
                label: `${i.FIN_PLANO_CONTA_CODIGO} ${i.FIN_PLANO_CONTA_NOME}`,
              }))
            );
        }
        if (centrosRes.ok) {
          const json = await centrosRes.json();
          if (json.success) {
            const flatten = (items: any[]): CentroCustoOption[] =>
              items.flatMap((i) => [
                { id: Number(i.id), label: `${i.codigo} ${i.nome}` },
                ...(i.filhos ? flatten(i.filhos) : []),
              ]);
            setCentrosCusto(flatten(json.data ?? []));
          }
        }
      } catch (e) {
        console.error("Erro ao carregar opções:", e);
      }
    };
    carregar();
  }, [empresa?.id, headersPadrao]);

  // Filtro local
  const dadosFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return lancamentos.filter((item) => {
      if (b && !`${item.historico} ${item.conta} ${item.centroCusto}`.toLowerCase().includes(b))
        return false;
      return true;
    });
  }, [busca, lancamentos]);

  const formatadorMoeda = useMemo(
    () => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
    []
  );

  // Salvar
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa?.id) return;
    const valorNum = Number(formValor) || 0;
    const valorFinal = formTipo === "Saída" ? -Math.abs(valorNum) : Math.abs(valorNum);
    const payload = {
      id: selecionado?.id,
      data: formData,
      historico: formHistorico,
      contaId: Number(formContaId) || 0,
      centroCustoId: Number(formCentroId) || null,
      valor: valorFinal,
      documento: formDocumento,
      status: formStatus,
    };

    setSalvando(true);
    try {
      const res = await fetch("/api/financeiro/lancamentos", {
        method: selecionado ? "PUT" : "POST",
        headers: { ...headersPadrao, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (selecionado) {
          setLancamentos((prev) => prev.map((i) => (i.id === json.data.id ? json.data : i)));
        } else {
          setLancamentos((prev) => [json.data, ...prev]);
        }
        limparForm();
        setNotification({ type: "success", message: "Lançamento salvo com sucesso" });
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao salvar" });
      }
    } catch (err) {
      setNotification({ type: "error", message: "Erro de conexão" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <LayoutShell>
      <div className="page-container financeiro-page">
        <HeaderBar
          codigoTela={codigoTela}
          nomeTela={nomeTela}
          caminhoRota={caminhoTela}
          modulo={moduloTela}
        />

        <main className="page-content-card">
          {notification && (
            <NotificationBar type={notification.type} message={notification.message} />
          )}

          <div className="departamentos-page">
            {/* 2-column: form + table */}
            <div className="split-view">
              {/* LEFT: Form */}
              <section className="split-view-panel">
                <header className="form-section-header">
                  <h2>{selecionado ? "Editar lançamento" : "Novo lançamento"}</h2>
                  <p>
                    {selecionado
                      ? "Atualize os dados do lançamento selecionado."
                      : "Informe os dados para registrar um novo lançamento."}
                  </p>
                </header>

                <form className="form" onSubmit={handleSalvar}>
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="lanc-data">Data *</label>
                      <input
                        id="lanc-data"
                        type="date"
                        className="form-input"
                        value={formData}
                        onChange={(e) => setFormData(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="lanc-tipo">Tipo *</label>
                      <select
                        id="lanc-tipo"
                        className="form-input"
                        value={formTipo}
                        onChange={(e) => setFormTipo(e.target.value as "Entrada" | "Saída")}
                      >
                        <option value="Entrada">Entrada</option>
                        <option value="Saída">Saída</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="lanc-historico">Histórico *</label>
                      <input
                        id="lanc-historico"
                        className="form-input"
                        value={formHistorico}
                        onChange={(e) => setFormHistorico(e.target.value)}
                        placeholder="Descrição do lançamento"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="lanc-conta">Plano de conta *</label>
                      <select
                        id="lanc-conta"
                        className="form-input"
                        value={formContaId}
                        onChange={(e) => setFormContaId(e.target.value)}
                        required
                      >
                        <option value="">Selecione</option>
                        {planoContas.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="lanc-centro">Centro de custo</label>
                      <select
                        id="lanc-centro"
                        className="form-input"
                        value={formCentroId}
                        onChange={(e) => setFormCentroId(e.target.value)}
                      >
                        <option value="">Nenhum</option>
                        {centrosCusto.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="lanc-valor">Valor *</label>
                      <input
                        id="lanc-valor"
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        value={formValor}
                        onChange={(e) => setFormValor(e.target.value)}
                        placeholder="0,00"
                        style={{ textAlign: "right" }}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="lanc-doc">Documento</label>
                      <input
                        id="lanc-doc"
                        className="form-input"
                        value={formDocumento}
                        onChange={(e) => setFormDocumento(e.target.value)}
                        placeholder="Número ou referência"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="lanc-status">Status</label>
                      <select
                        id="lanc-status"
                        className="form-input"
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as "confirmado" | "pendente")}
                      >
                        <option value="confirmado">Confirmado</option>
                        <option value="pendente">Pendente</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-actions departamentos-actions">
                    <div className="button-row">
                      <button type="submit" className="button button-primary" disabled={salvando}>
                        {salvando ? "Salvando..." : "Salvar"}
                      </button>
                      <button type="button" className="button button-secondary" onClick={limparForm}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                </form>
              </section>

              {/* RIGHT: List */}
              <section className="split-view-panel">
                <header className="form-section-header">
                  <h2>Lançamentos cadastrados</h2>
                  <p>Selecione um lançamento para editar.</p>
                </header>

                <div className="form-grid two-columns" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label htmlFor="filtro-periodo">Período</label>
                    <input
                      id="filtro-periodo"
                      type="month"
                      className="form-input"
                      value={periodo}
                      onChange={(e) => setPeriodo(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="filtro-busca">Busca</label>
                    <input
                      id="filtro-busca"
                      type="text"
                      className="form-input"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Histórico, conta..."
                    />
                  </div>
                </div>

                {carregando ? (
                  <div className="empty-state">
                    <p>Carregando lançamentos...</p>
                  </div>
                ) : dadosFiltrados.length === 0 ? (
                  <div className="empty-state">
                    <strong>Nenhum lançamento encontrado</strong>
                    <p>Ajuste o período ou adicione um novo lançamento.</p>
                  </div>
                ) : (
                  <table className="data-table mobile-cards">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Histórico</th>
                        <th>Conta</th>
                        <th>Tipo</th>
                        <th style={{ textAlign: "right" }}>Valor</th>
                        <th style={{ textAlign: "center" }}>Status</th>
                        <th style={{ textAlign: "center" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosFiltrados.map((item) => (
                        <tr key={item.id} onClick={() => preencherForm(item)} style={{ cursor: "pointer" }}>
                          <td data-label="Data">{item.data}</td>
                          <td data-label="Histórico">{item.historico}</td>
                          <td data-label="Conta">{item.conta}</td>
                          <td data-label="Tipo">
                            <span className={item.tipo === "Entrada" ? "badge badge-success" : "badge badge-danger"}>
                              {item.tipo}
                            </span>
                          </td>
                          <td data-label="Valor" style={{ fontWeight: 600 }}>
                            {formatadorMoeda.format(Math.abs(item.valor))}
                          </td>
                          <td data-label="Status">
                            <span className={item.status === "confirmado" ? "badge badge-success" : "badge badge-danger"}>
                              {item.status === "confirmado" ? "Confirmado" : "Pendente"}
                            </span>
                          </td>
                          <td data-label="">
                            <button
                              type="button"
                              className="button button-secondary button-compact"
                              onClick={(e) => { e.stopPropagation(); preencherForm(item); }}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
          </div>
        </main>
      </div>
    </LayoutShell>
  );
}
