"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
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

export default function ObjetivosPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/objetivos";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_OBJETIVOS";
  const nomeTela = tela?.NOME_TELA ?? "Objetivos Financeiros";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [tipoPlano, setTipoPlano] = useState<TipoPlano>("PLANO_CONTAS");
  const [mesesRef, setMesesRef] = useState(3);
  const [anoObjetivo, setAnoObjetivo] = useState(new Date().getFullYear());
  const [contas, setContas] = useState<ContaComMedia[]>([]);
  const [percentuaisEditados, setPercentuaisEditados] = useState<Record<number, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

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
        meses: String(mesesRef),
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
  }, [empresa?.id, headersPadrao, tipoPlano, mesesRef, anoObjetivo]);

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

  const aplicarPercentualGlobal = (valor: number) => {
    const editados: Record<number, number> = {};
    for (const c of contas) {
      editados[c.contaId] = valor;
    }
    setPercentuaisEditados(editados);
  };

  const periodosRef = [
    { valor: 1, label: "1 mês" },
    { valor: 3, label: "3 meses" },
    { valor: 6, label: "6 meses" },
    { valor: 12, label: "12 meses" },
  ];

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
          {notification && <NotificationBar type={notification.type} message={notification.message} />}

          <section className="panel">
            <div className="form-section-header">
              <div>
                <h2>Objetivos Financeiros</h2>
                <p>Defina metas baseadas na média do período com percentual de crescimento ou redução por conta</p>
              </div>
              <button
                type="button"
                className="button button-primary"
                onClick={salvarObjetivos}
                disabled={salvando || carregando}
              >
                {salvando ? "Salvando..." : "Salvar Objetivos"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginTop: 20, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
              <div className="form-group" style={{ flex: "0 0 auto" }}>
                <label>Base</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
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

              <div className="form-group" style={{ flex: "0 0 auto" }}>
                <label>Período (média)</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {periodosRef.map((p) => (
                    <button
                      key={p.valor}
                      type="button"
                      className={mesesRef === p.valor ? "button button-primary button-compact" : "button button-secondary button-compact"}
                      onClick={() => setMesesRef(p.valor)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ flex: "1 1 130px", minWidth: 130 }}>
                <label htmlFor="obj-ano">Ano</label>
                <input
                  id="obj-ano"
                  type="number"
                  className="form-input"
                  value={anoObjetivo}
                  onChange={(e) => setAnoObjetivo(Number(e.target.value))}
                />
              </div>

              <div className="form-group" style={{ flex: "1 1 130px", minWidth: 130 }}>
                <label htmlFor="obj-pct-global">% Global</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    id="obj-pct-global"
                    type="number"
                    className="form-input"
                    style={{ flex: 1, textAlign: "center" }}
                    placeholder="0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = Number((e.target as HTMLInputElement).value) || 0;
                        aplicarPercentualGlobal(val);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="button button-secondary button-compact"
                    onClick={() => {
                      const el = document.getElementById("obj-pct-global") as HTMLInputElement;
                      const val = Number(el?.value) || 0;
                      aplicarPercentualGlobal(val);
                    }}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Summary */}
          <section className="summary-cards" style={{ marginTop: 20 }}>
            <div className="summary-card">
              <span className="summary-label">Média Mensal (período)</span>
              <strong className="summary-value">{formatMoney(totalMedia)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Objetivo Mensal ({anoObjetivo})</span>
              <strong className="summary-value" style={{ color: "#059669" }}>{formatMoney(totalObjetivo)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Diferença</span>
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
                    <th style={{ textAlign: "right" }}>Média</th>
                    <th style={{ textAlign: "center", width: 100 }}>Cresc. %</th>
                    <th style={{ textAlign: "right" }}>Objetivo</th>
                    <th style={{ textAlign: "right" }}>Variação</th>
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
                        <td data-label="Média">{formatMoney(conta.media)}</td>
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
                        <td data-label="Variação" style={{ color: variacao >= 0 ? "#059669" : "#dc2626" }}>
                          {variacao >= 0 ? "+" : ""}{formatMoney(variacao)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
                    <td data-label="" colSpan={2}>TOTAL</td>
                    <td data-label="Média">{formatMoney(totalMedia)}</td>
                    <td data-label=""></td>
                    <td data-label="Objetivo">{formatMoney(totalObjetivo)}</td>
                    <td data-label="Variação" style={{ color: totalObjetivo - totalMedia >= 0 ? "#059669" : "#dc2626" }}>
                      {totalObjetivo - totalMedia >= 0 ? "+" : ""}{formatMoney(totalObjetivo - totalMedia)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </section>
        </main>
      </div>
    </LayoutShell>
  );
}
