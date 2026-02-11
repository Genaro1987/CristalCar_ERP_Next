"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { ModalConfirmacao } from "@/components/ModalConfirmacao";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";

interface AuditLogEntry {
  id: number;
  tabela: string;
  registroId: number;
  operacao: string;
  dadosAntes: Record<string, any> | null;
  dadosDepois: Record<string, any> | null;
  descricao: string;
  dataOperacao: string;
  revertido: boolean;
  dataReversao: string | null;
}

const TABELAS = [
  { value: "", label: "Todas" },
  { value: "FIN_LANCAMENTO", label: "Lançamentos Financeiros" },
  { value: "RH_PONTO_LANCAMENTO", label: "Lançamentos de Ponto" },
];

const OPERACOES = [
  { value: "", label: "Todas" },
  { value: "INSERT", label: "Inclusão" },
  { value: "UPDATE", label: "Alteração" },
  { value: "DELETE", label: "Exclusão" },
];

const OPERACAO_LABEL: Record<string, string> = {
  INSERT: "Inclusão",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
};

const TABELA_LABEL: Record<string, string> = {
  FIN_LANCAMENTO: "Lançamento Financeiro",
  RH_PONTO_LANCAMENTO: "Ponto",
};

export default function LogAuditoriaPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();

  const [registros, setRegistros] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Filters
  const [filtroTabela, setFiltroTabela] = useState("");
  const [filtroOperacao, setFiltroOperacao] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const POR_PAGINA = 50;

  // Expanded row
  const [expandidoId, setExpandidoId] = useState<number | null>(null);

  // Revert modal
  const [revertendoId, setRevertendoId] = useState<number | null>(null);
  const [revertendo, setRevertendo] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresa?.id) return;
    setCarregando(true);

    try {
      const params = new URLSearchParams();
      if (filtroTabela) params.set("tabela", filtroTabela);
      if (filtroOperacao) params.set("operacao", filtroOperacao);
      if (filtroDataInicio) params.set("dataInicio", filtroDataInicio);
      if (filtroDataFim) params.set("dataFim", filtroDataFim);
      if (filtroBusca) params.set("busca", filtroBusca);
      params.set("limite", String(POR_PAGINA));
      params.set("offset", String(pagina * POR_PAGINA));

      const res = await fetch(`/api/auditoria?${params.toString()}`, {
        headers: { "x-empresa-id": String(empresa.id) },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setRegistros(json.data);
          setTotal(json.total);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar logs:", e);
      setNotification({ type: "error", message: "Erro ao carregar registros" });
    } finally {
      setCarregando(false);
    }
  }, [empresa?.id, filtroTabela, filtroOperacao, filtroDataInicio, filtroDataFim, filtroBusca, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const handleReverter = async () => {
    if (!empresa?.id || !revertendoId) return;
    setRevertendo(true);
    setNotification(null);

    try {
      const res = await fetch("/api/auditoria/reverter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-empresa-id": String(empresa.id),
        },
        body: JSON.stringify({ auditLogId: revertendoId }),
      });

      const json = await res.json();

      if (json.success) {
        setNotification({ type: "success", message: "Operação revertida com sucesso!" });
        setRevertendoId(null);
        carregar();
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao reverter" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexão" });
    } finally {
      setRevertendo(false);
    }
  };

  const formatadorMoeda = useMemo(
    () => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
    []
  );

  function formatarDataHora(dt: string): string {
    if (!dt) return "";
    try {
      const d = new Date(dt);
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dt;
    }
  }

  function renderDados(dados: Record<string, any> | null, label: string): React.ReactNode {
    if (!dados) return null;

    // If it's an array (ponto batch), show summary
    if (Array.isArray(dados)) {
      return (
        <div style={{ marginBottom: 8 }}>
          <strong style={{ fontSize: "0.8rem", color: "#374151" }}>{label}:</strong>
          <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 4, maxHeight: 150, overflowY: "auto" }}>
            {dados.map((item: any, i: number) => (
              <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid #f3f4f6" }}>
                {Object.entries(item).map(([k, v]) => (
                  <span key={k} style={{ marginRight: 12 }}>
                    <strong>{k}:</strong> {String(v ?? "-")}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 8 }}>
        <strong style={{ fontSize: "0.8rem", color: "#374151" }}>{label}:</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 4, marginTop: 4 }}>
          {Object.entries(dados).map(([key, value]) => (
            <div key={key} style={{ fontSize: "0.78rem", color: "#6b7280" }}>
              <span style={{ fontWeight: 600 }}>{key}:</span>{" "}
              {key === "valor" && typeof value === "number"
                ? formatadorMoeda.format(value)
                : String(value ?? "-")}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          nomeTela="LOG DE AUDITORIA"
          codigoTela="LOG_AUDITORIA"
          caminhoRota="/cadastros/log"
          modulo="CADASTROS"
        />

        <PaginaProtegida codigoTela="LOG_AUDITORIA">
          <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
            {notification && <NotificationBar type={notification.type} message={notification.message} />}

            {/* Filters */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
              <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
                <label htmlFor="f-tabela">Tabela</label>
                <select
                  id="f-tabela"
                  className="form-input"
                  value={filtroTabela}
                  onChange={(e) => { setFiltroTabela(e.target.value); setPagina(0); }}
                >
                  {TABELAS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0, minWidth: 130 }}>
                <label htmlFor="f-operacao">Operação</label>
                <select
                  id="f-operacao"
                  className="form-input"
                  value={filtroOperacao}
                  onChange={(e) => { setFiltroOperacao(e.target.value); setPagina(0); }}
                >
                  {OPERACOES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
                <label htmlFor="f-data-inicio">Data início</label>
                <input
                  id="f-data-inicio"
                  type="date"
                  className="form-input"
                  value={filtroDataInicio}
                  onChange={(e) => { setFiltroDataInicio(e.target.value); setPagina(0); }}
                />
              </div>

              <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
                <label htmlFor="f-data-fim">Data fim</label>
                <input
                  id="f-data-fim"
                  type="date"
                  className="form-input"
                  value={filtroDataFim}
                  onChange={(e) => { setFiltroDataFim(e.target.value); setPagina(0); }}
                />
              </div>

              <div className="form-group" style={{ margin: 0, minWidth: 180, flex: 1 }}>
                <label htmlFor="f-busca">Busca</label>
                <input
                  id="f-busca"
                  type="text"
                  className="form-input"
                  placeholder="Buscar na descrição..."
                  value={filtroBusca}
                  onChange={(e) => { setFiltroBusca(e.target.value); setPagina(0); }}
                />
              </div>

              <button
                type="button"
                className="button button-secondary"
                onClick={() => { setPagina(0); carregar(); }}
                disabled={carregando}
              >
                {carregando ? "Carregando..." : "Atualizar"}
              </button>
            </div>

            {/* Results */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  {total} registro(s) encontrado(s)
                </span>
              </div>

              <div style={{ overflowX: "auto", flex: 1 }}>
                <table className="data-table" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th style={{ width: 150 }}>Data/Hora</th>
                      <th style={{ width: 140 }}>Tabela</th>
                      <th style={{ width: 90 }}>Operação</th>
                      <th style={{ width: 80, textAlign: "center" }}>Registro</th>
                      <th>Descrição</th>
                      <th style={{ width: 90, textAlign: "center" }}>Status</th>
                      <th style={{ width: 90, textAlign: "center" }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", color: "#9ca3af", padding: 24 }}>
                          {carregando ? "Carregando..." : "Nenhum registro encontrado"}
                        </td>
                      </tr>
                    )}
                    {registros.map((reg, idx) => (
                      <React.Fragment key={reg.id}>
                        <tr
                          style={{
                            cursor: "pointer",
                            backgroundColor: expandidoId === reg.id ? "#f0f9ff" : reg.revertido ? "#fefce8" : undefined,
                          }}
                          onClick={() => setExpandidoId(expandidoId === reg.id ? null : reg.id)}
                        >
                          <td>{pagina * POR_PAGINA + idx + 1}</td>
                          <td>{formatarDataHora(reg.dataOperacao)}</td>
                          <td>
                            <span className="badge" style={{ fontSize: "0.72rem" }}>
                              {TABELA_LABEL[reg.tabela] || reg.tabela}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                reg.operacao === "DELETE"
                                  ? "badge-danger"
                                  : reg.operacao === "UPDATE"
                                  ? "badge-warning"
                                  : "badge-success"
                              }`}
                              style={{ fontSize: "0.72rem" }}
                            >
                              {OPERACAO_LABEL[reg.operacao] || reg.operacao}
                            </span>
                          </td>
                          <td style={{ textAlign: "center", fontFamily: "monospace" }}>
                            {reg.registroId}
                          </td>
                          <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {reg.descricao || "-"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {reg.revertido ? (
                              <span className="badge" style={{ fontSize: "0.72rem", background: "#fef3c7", color: "#92400e" }}>
                                Revertido
                              </span>
                            ) : (
                              <span className="badge" style={{ fontSize: "0.72rem", background: "#f3f4f6", color: "#6b7280" }}>
                                Ativo
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {!reg.revertido && (reg.operacao === "UPDATE" || reg.operacao === "DELETE") && (
                              <button
                                type="button"
                                className="button button-secondary button-compact"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRevertendoId(reg.id);
                                }}
                                style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                              >
                                Reverter
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Expanded details */}
                        {expandidoId === reg.id && (
                          <tr>
                            <td colSpan={8} style={{ padding: 16, background: "#f9fafb" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                {renderDados(reg.dadosAntes, "Dados Anteriores")}
                                {renderDados(reg.dadosDepois, "Dados Posteriores")}
                              </div>
                              {reg.revertido && reg.dataReversao && (
                                <p style={{ marginTop: 8, fontSize: "0.78rem", color: "#92400e" }}>
                                  Revertido em: {formatarDataHora(reg.dataReversao)}
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPaginas > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    className="button button-secondary button-compact"
                    disabled={pagina === 0}
                    onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </button>
                  <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    Página {pagina + 1} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    className="button button-secondary button-compact"
                    disabled={pagina >= totalPaginas - 1}
                    onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                  >
                    Próxima
                  </button>
                </div>
              )}
            </div>

            {/* Confirmation modal for revert */}
            <ModalConfirmacao
              aberto={revertendoId !== null}
              titulo="Reverter operação"
              mensagem="Tem certeza que deseja reverter esta operação? Os dados originais serão restaurados."
              textoBotaoConfirmar={revertendo ? "Revertendo..." : "Reverter"}
              textoBotaoCancelar="Cancelar"
              tipo="warning"
              onConfirmar={handleReverter}
              onCancelar={() => setRevertendoId(null)}
            />
          </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}
