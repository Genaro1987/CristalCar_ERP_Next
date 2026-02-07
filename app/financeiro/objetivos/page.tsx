"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";
import { NotificationBar } from "@/components/NotificationBar";

type TipoPlano = "PLANO_CONTAS" | "CENTRO_CUSTO";

interface ContaComMedia {
  contaId: number;
  nome: string;
  natureza: string;
  media: number;
  percentual: number;
  objetivo: number;
}

function formatMoney(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function ObjetivosPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/objetivos";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_OBJETIVOS";
  const nomeTela = tela?.NOME_TELA ?? "OBJETIVOS FINANCEIROS";
  const moduloTela = tela?.MODULO ?? "OBJETIVOS";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const mesAtual = new Date().getMonth() + 1;
  const [tipoPlano, setTipoPlano] = useState<TipoPlano>("PLANO_CONTAS");
  const [mesInicio, setMesInicio] = useState(Math.max(1, mesAtual - 2));
  const [mesFim, setMesFim] = useState(mesAtual);
  const [anoObjetivo, setAnoObjetivo] = useState(new Date().getFullYear());
  const [contas, setContas] = useState<ContaComMedia[]>([]);
  const [percentuaisEditados, setPercentuaisEditados] = useState<Record<number, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [pctGlobal, setPctGlobal] = useState("");

  const mesesRef = useMemo(() => {
    if (mesFim >= mesInicio) return mesFim - mesInicio + 1;
    return 12 - mesInicio + 1 + mesFim;
  }, [mesInicio, mesFim]);

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (empresa?.id) headers["x-empresa-id"] = String(empresa.id);
    return headers;
  }, [empresa?.id]);

  const carregarContas = useCallback(async () => {
    if (!empresa?.id) return;
    try {
      setCarregando(true);
      const params = new URLSearchParams({
        tipo: tipoPlano,
        mesInicio: String(mesInicio),
        mesFim: String(mesFim),
        ano: String(anoObjetivo),
      });

      const resp = await fetch(`/api/financeiro/objetivos/contas?${params}`, {
        headers: headersPadrao,
      });
      const json = await resp.json();

      if (json?.success) {
        setContas(json.data ?? []);
        const editados: Record<number, number> = {};
        for (const c of json.data ?? []) {
          editados[c.contaId] = c.percentual;
        }
        setPercentuaisEditados(editados);
      }
    } catch (err) {
      console.error("Erro ao carregar contas:", err);
    } finally {
      setCarregando(false);
    }
  }, [empresa?.id, headersPadrao, tipoPlano, mesInicio, mesFim, anoObjetivo]);

  useEffect(() => {
    carregarContas();
  }, [carregarContas]);

  const contasComObjetivo = useMemo(() => {
    return contas.map((c) => {
      const pct = percentuaisEditados[c.contaId] ?? c.percentual;
      return {
        ...c,
        percentualEditado: pct,
        objetivoCalculado: c.media * (1 + pct / 100),
      };
    });
  }, [contas, percentuaisEditados]);

  const totalMedia = useMemo(() => contasComObjetivo.reduce((acc, c) => acc + c.media, 0), [contasComObjetivo]);
  const totalObjetivo = useMemo(() => contasComObjetivo.reduce((acc, c) => acc + c.objetivoCalculado, 0), [contasComObjetivo]);

  const handlePercentualChange = (contaId: number, valor: string) => {
    const num = valor === "" || valor === "-" ? 0 : Number(valor);
    setPercentuaisEditados((prev) => ({ ...prev, [contaId]: num }));
  };

  const salvarObjetivos = async () => {
    if (!empresa?.id) return;
    setSalvando(true);
    setNotification(null);
    try {
      const contasParaSalvar = Object.entries(percentuaisEditados).map(([id, pct]) => ({
        contaId: Number(id),
        percentual: pct,
      }));

      const resp = await fetch("/api/financeiro/objetivos/contas", {
        method: "POST",
        headers: headersPadrao,
        body: JSON.stringify({
          tipo: tipoPlano,
          ano: anoObjetivo,
          contas: contasParaSalvar,
        }),
      });

      const json = await resp.json();
      if (json?.success) {
        setNotification({ type: "success", message: "Objetivos salvos com sucesso!" });
      } else {
        setNotification({ type: "error", message: "Erro ao salvar objetivos" });
      }
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setNotification({ type: "error", message: "Erro ao salvar objetivos" });
    } finally {
      setSalvando(false);
    }
  };

  const aplicarPercentualGlobal = () => {
    const valor = Number(pctGlobal) || 0;
    const editados: Record<number, number> = {};
    for (const c of contas) {
      editados[c.contaId] = valor;
    }
    setPercentuaisEditados(editados);
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

          <section className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
                Defina metas baseadas na media do periodo com percentual de crescimento ou reducao por conta
              </p>
              <button
                type="button"
                className="button button-primary"
                onClick={salvarObjetivos}
                disabled={salvando || carregando}
              >
                {salvando ? "Salvando..." : "Salvar Objetivos"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 16, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
              <div className="form-group" style={{ flex: "0 0 auto" }}>
                <label>Base</label>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    className={tipoPlano === "PLANO_CONTAS" ? "button button-primary button-compact" : "button button-secondary button-compact"}
                    onClick={() => setTipoPlano("PLANO_CONTAS")}
                  >
                    Plano de Contas
                  </button>
                  <button
                    type="button"
                    className={tipoPlano === "CENTRO_CUSTO" ? "button button-primary button-compact" : "button button-secondary button-compact"}
                    onClick={() => setTipoPlano("CENTRO_CUSTO")}
                  >
                    Centro de Custo
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ flex: "0 0 auto", minWidth: 80 }}>
                <label htmlFor="obj-mes-inicio">Mes inicio</label>
                <select
                  id="obj-mes-inicio"
                  className="form-input"
                  value={mesInicio}
                  onChange={(e) => setMesInicio(Number(e.target.value))}
                  style={{ padding: "6px 8px" }}
                >
                  {MESES_LABELS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: "0 0 auto", minWidth: 80 }}>
                <label htmlFor="obj-mes-fim">Mes fim</label>
                <select
                  id="obj-mes-fim"
                  className="form-input"
                  value={mesFim}
                  onChange={(e) => setMesFim(Number(e.target.value))}
                  style={{ padding: "6px 8px" }}
                >
                  {MESES_LABELS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: "0 0 auto", minWidth: 80 }}>
                <label htmlFor="obj-ano">Ano</label>
                <input
                  id="obj-ano"
                  type="number"
                  className="form-input"
                  value={anoObjetivo}
                  onChange={(e) => setAnoObjetivo(Number(e.target.value))}
                  style={{ width: 80, padding: "6px 8px" }}
                />
              </div>

              <div className="form-group" style={{ flex: "0 0 auto", minWidth: 80 }}>
                <label htmlFor="obj-pct-global">% Global</label>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    id="obj-pct-global"
                    type="number"
                    className="form-input"
                    style={{ width: 65, textAlign: "center", padding: "6px 8px" }}
                    placeholder="0"
                    value={pctGlobal}
                    onChange={(e) => setPctGlobal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        aplicarPercentualGlobal();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="button button-secondary button-compact"
                    onClick={aplicarPercentualGlobal}
                  >
                    Aplicar
                  </button>
                </div>
              </div>

              <span style={{ fontSize: "0.75rem", color: "#9ca3af", paddingBottom: 8 }}>
                {mesesRef} {mesesRef === 1 ? "mes" : "meses"}
              </span>
            </div>
          </section>

          {/* Summary */}
          <section className="summary-cards" style={{ marginTop: 20 }}>
            <div className="summary-card">
              <span className="summary-label">Media Mensal (periodo)</span>
              <strong className="summary-value">{formatMoney(totalMedia)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Objetivo Mensal ({anoObjetivo})</span>
              <strong className="summary-value" style={{ color: "#059669" }}>{formatMoney(totalObjetivo)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Diferenca</span>
              <strong className="summary-value" style={{ color: totalObjetivo - totalMedia >= 0 ? "#059669" : "#dc2626" }}>
                {formatMoney(totalObjetivo - totalMedia)}
              </strong>
            </div>
          </section>

          {/* Table */}
          <section className="panel" style={{ marginTop: 20 }}>
            {carregando ? (
              <div className="empty-state">Carregando contas...</div>
            ) : contasComObjetivo.length === 0 ? (
              <div className="empty-state">
                Nenhuma conta encontrada. Cadastre {tipoPlano === "PLANO_CONTAS" ? "o plano de contas" : "centros de custo"} primeiro.
              </div>
            ) : (
              <table className="data-table mobile-cards">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Conta</th>
                    <th style={{ textAlign: "left" }}>Natureza</th>
                    <th style={{ textAlign: "right" }}>Media</th>
                    <th style={{ textAlign: "center", width: 100 }}>Cresc. %</th>
                    <th style={{ textAlign: "right" }}>Objetivo</th>
                    <th style={{ textAlign: "right" }}>Variacao</th>
                  </tr>
                </thead>
                <tbody>
                  {contasComObjetivo.map((conta) => {
                    const variacao = conta.objetivoCalculado - conta.media;
                    return (
                      <tr key={conta.contaId}>
                        <td data-label="Conta" style={{ fontWeight: 600 }}>{conta.nome}</td>
                        <td data-label="Natureza">
                          <span
                            className="badge"
                            style={{
                              backgroundColor: conta.natureza === "RECEITA" ? "#d1fae5" : conta.natureza === "DESPESA" ? "#fee2e2" : "#f3f4f6",
                              color: conta.natureza === "RECEITA" ? "#065f46" : conta.natureza === "DESPESA" ? "#991b1b" : "#374151",
                            }}
                          >
                            {conta.natureza}
                          </span>
                        </td>
                        <td data-label="Media">{formatMoney(conta.media)}</td>
                        <td data-label="Cresc. %">
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: 70, textAlign: "center", padding: "4px 8px" }}
                            value={conta.percentualEditado}
                            onChange={(e) => handlePercentualChange(conta.contaId, e.target.value)}
                            step={1}
                          />
                        </td>
                        <td data-label="Objetivo" style={{ fontWeight: 600 }}>{formatMoney(conta.objetivoCalculado)}</td>
                        <td data-label="Variacao" style={{ color: variacao >= 0 ? "#059669" : "#dc2626" }}>
                          {variacao >= 0 ? "+" : ""}{formatMoney(variacao)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
                    <td data-label="" colSpan={2}>TOTAL</td>
                    <td data-label="Media">{formatMoney(totalMedia)}</td>
                    <td data-label=""></td>
                    <td data-label="Objetivo">{formatMoney(totalObjetivo)}</td>
                    <td data-label="Variacao" style={{ color: totalObjetivo - totalMedia >= 0 ? "#059669" : "#dc2626" }}>
                      {totalObjetivo - totalMedia >= 0 ? "+" : ""}{formatMoney(totalObjetivo - totalMedia)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </section>
        </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}
