"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import React, { useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

type TipoVisao = "agrupado" | "diario";

const formatMoney = (val: number) =>
  val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function defaultDataInicio() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
}

function defaultDataFim() {
  return new Date().toISOString().slice(0, 10);
}

interface ContaAgrupada {
  contaId: number;
  contaNome: string;
  contaCodigo: string;
  natureza: string;
  grupoPaiNome: string | null;
  grupoPaiCodigo: string | null;
  receitas: number;
  despesas: number;
  saldo: number;
  qtd: number;
}

interface LancamentoDetalhe {
  id: number;
  data: string;
  descricao: string;
  valor: number;
  placa: string;
  contaId: number;
  contaNome: string;
  contaCodigo: string;
  pessoaNome: string;
}

interface DiaSumario {
  data: string;
  receitas: number;
  despesas: number;
  saldo: number;
  qtd: number;
}

function agruparContasPorPai(contas: ContaAgrupada[]): { grupo: string; contas: ContaAgrupada[]; receitas: number; despesas: number; saldo: number }[] {
  const grupos = new Map<string, { contas: ContaAgrupada[]; receitas: number; despesas: number; saldo: number }>();

  for (const c of contas) {
    const key = c.grupoPaiNome ? `${c.grupoPaiCodigo ?? ""} ${c.grupoPaiNome}` : c.contaNome;
    if (!grupos.has(key)) {
      grupos.set(key, { contas: [], receitas: 0, despesas: 0, saldo: 0 });
    }
    const g = grupos.get(key)!;
    g.contas.push(c);
    g.receitas += c.receitas;
    g.despesas += c.despesas;
    g.saldo += c.saldo;
  }

  return Array.from(grupos.entries())
    .map(([grupo, data]) => ({ grupo, ...data }))
    .sort((a, b) => (a.grupo).localeCompare(b.grupo));
}

// Group lancamentos by date (for agrupado expansion)
function agruparPorData(lancamentos: LancamentoDetalhe[]): { data: string; lancamentos: LancamentoDetalhe[] }[] {
  const mapa = new Map<string, LancamentoDetalhe[]>();
  for (const l of lancamentos) {
    if (!mapa.has(l.data)) mapa.set(l.data, []);
    mapa.get(l.data)!.push(l);
  }
  return Array.from(mapa.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([data, items]) => ({ data, lancamentos: items }));
}

// Group lancamentos by conta (for diario expansion)
function agruparPorConta(lancamentos: LancamentoDetalhe[]): { contaCodigo: string; contaNome: string; lancamentos: LancamentoDetalhe[] }[] {
  const mapa = new Map<string, { contaCodigo: string; contaNome: string; lancamentos: LancamentoDetalhe[] }>();
  for (const l of lancamentos) {
    const key = `${l.contaId}`;
    if (!mapa.has(key)) mapa.set(key, { contaCodigo: l.contaCodigo, contaNome: l.contaNome, lancamentos: [] });
    mapa.get(key)!.lancamentos.push(l);
  }
  return Array.from(mapa.values()).sort((a, b) => a.contaCodigo.localeCompare(b.contaCodigo));
}

export default function RelatorioCaixaPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/relatorio-caixa";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_REL_CAIXA";
  const nomeTela = tela?.NOME_TELA ?? "RELATORIO DE CAIXA";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [visao, setVisao] = useState<TipoVisao>("agrupado");
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);

  // Expansion state: key = contaId (agrupado) or date string (diario)
  const [expandedItems, setExpandedItems] = useState<Record<string, LancamentoDetalhe[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!empresa?.id) return;

    const carregar = async () => {
      setCarregando(true);
      setExpandedItems({});
      setLoadingItems({});
      try {
        const params = new URLSearchParams({ dataInicio, dataFim, visao });
        if (busca.trim().length >= 3) params.set("busca", busca.trim());

        const res = await fetch(`/api/financeiro/relatorio-caixa?${params}`, {
          headers: { "x-empresa-id": String(empresa.id) },
        });
        const json = await res.json();
        if (json.success) setDados(json.data);
      } catch (e) {
        console.error(e);
      } finally {
        setCarregando(false);
      }
    };

    carregar();
  }, [empresa?.id, visao, dataInicio, dataFim, busca]);

  // Simple expansion handler - no useCallback/useRef to avoid stale closures
  async function handleExpand(key: string, extraParams: Record<string, string>) {
    // If already expanded, toggle off
    if (expandedItems[key] !== undefined) {
      setExpandedItems((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    // If already loading, ignore
    if (loadingItems[key]) return;
    if (!empresa?.id) return;

    setLoadingItems((prev) => ({ ...prev, [key]: true }));

    try {
      const params = new URLSearchParams({
        dataInicio,
        dataFim,
        visao: "detalhado",
        ...extraParams,
      });
      const res = await fetch(`/api/financeiro/relatorio-caixa?${params}`, {
        headers: { "x-empresa-id": String(empresa.id) },
      });
      const json = await res.json();
      if (json.success && json.data?.lancamentos) {
        setExpandedItems((prev) => ({ ...prev, [key]: json.data.lancamentos }));
      } else {
        setExpandedItems((prev) => ({ ...prev, [key]: [] }));
      }
    } catch (e) {
      console.error("Erro ao buscar detalhes:", e);
      setExpandedItems((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setLoadingItems((prev) => ({ ...prev, [key]: false }));
    }
  }

  const visaoOpcoes: { valor: TipoVisao; label: string }[] = [
    { valor: "agrupado", label: "Agrupado" },
    { valor: "diario", label: "Diario" },
  ];

  function renderAgrupado() {
    if (!dados?.contas) return null;
    const contas = dados.contas as ContaAgrupada[];
    const grupos = agruparContasPorPai(contas);

    return (
      <div style={{ overflowX: "auto" }}>
        <table className="data-table mobile-cards">
          <thead>
            <tr>
              <th style={{ textAlign: "center", width: 40 }}></th>
              <th style={{ textAlign: "left" }}>Conta</th>
              <th style={{ textAlign: "right" }}>Receitas</th>
              <th style={{ textAlign: "right" }}>Despesas</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
              <th style={{ textAlign: "right" }}>Qtd</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <React.Fragment key={g.grupo}>
                {g.contas.length > 1 && (
                  <tr style={{ backgroundColor: "#f1f5f9", fontWeight: 700 }}>
                    <td></td>
                    <td style={{ paddingLeft: 8 }}>{g.grupo}</td>
                    <td style={{ textAlign: "right", color: "#059669" }}>{formatMoney(g.receitas)}</td>
                    <td style={{ textAlign: "right", color: "#dc2626" }}>{formatMoney(g.despesas)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: g.saldo >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(g.saldo)}</td>
                    <td style={{ textAlign: "right" }}></td>
                  </tr>
                )}
                {g.contas.map((c) => {
                  const itemKey = `conta-${c.contaId}`;
                  const isExpanded = expandedItems[itemKey] !== undefined;
                  const isLoading = !!loadingItems[itemKey];
                  const lancamentos = expandedItems[itemKey] ?? [];
                  const porData = isExpanded ? agruparPorData(lancamentos) : [];

                  return (
                    <React.Fragment key={c.contaId}>
                      <tr>
                        <td style={{ textAlign: "center", width: 40 }}>
                          <button
                            type="button"
                            onClick={() => handleExpand(itemKey, { contaId: String(c.contaId) })}
                            style={{
                              background: "none",
                              border: "1px solid #d1d5db",
                              borderRadius: 4,
                              width: 26,
                              height: 26,
                              cursor: "pointer",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              color: isExpanded ? "#dc2626" : "#059669",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title={isExpanded ? "Fechar detalhes" : "Ver lancamentos"}
                          >
                            {isLoading ? "..." : isExpanded ? "-" : "+"}
                          </button>
                        </td>
                        <td data-label="Conta" style={{ paddingLeft: g.contas.length > 1 ? 24 : 8 }}>
                          {c.contaCodigo} {c.contaNome}
                        </td>
                        <td data-label="Receitas" style={{ textAlign: "right", color: "#059669" }}>{formatMoney(c.receitas)}</td>
                        <td data-label="Despesas" style={{ textAlign: "right", color: "#dc2626" }}>{formatMoney(c.despesas)}</td>
                        <td data-label="Saldo" style={{ textAlign: "right", color: c.saldo >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(c.saldo)}</td>
                        <td data-label="Qtd" style={{ textAlign: "right" }}>{c.qtd}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <div style={{ backgroundColor: "#f9fafb", padding: "8px 12px 8px 48px", borderTop: "1px dashed #e5e7eb", borderBottom: "1px dashed #e5e7eb" }}>
                              {lancamentos.length === 0 && !isLoading ? (
                                <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "4px 0" }}>Nenhum lancamento encontrado para esta conta.</p>
                              ) : (
                                <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr style={{ color: "#6b7280" }}>
                                      <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>Data</th>
                                      <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>Descricao</th>
                                      <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>Pessoa</th>
                                      <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>Placa</th>
                                      <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 600 }}>Valor</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {porData.map((grupo) => (
                                      <React.Fragment key={grupo.data}>
                                        <tr style={{ backgroundColor: "#eef2ff" }}>
                                          <td colSpan={5} style={{ padding: "6px 8px", fontWeight: 600, fontSize: "0.8rem", color: "#4338ca" }}>
                                            {formatDate(grupo.data)} ({grupo.lancamentos.length} lancamentos)
                                          </td>
                                        </tr>
                                        {grupo.lancamentos.map((l) => (
                                          <tr key={l.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                                            <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>{formatDate(l.data)}</td>
                                            <td style={{ padding: "4px 8px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descricao}</td>
                                            <td style={{ padding: "4px 8px" }}>{l.pessoaNome || "-"}</td>
                                            <td style={{ padding: "4px 8px" }}>{l.placa || "-"}</td>
                                            <td style={{ padding: "4px 8px", textAlign: "right", color: l.valor >= 0 ? "#059669" : "#dc2626", fontWeight: 600 }}>
                                              {l.valor >= 0 ? "+" : "-"}{formatMoney(Math.abs(l.valor))}
                                            </td>
                                          </tr>
                                        ))}
                                      </React.Fragment>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
              <td></td>
              <td>TOTAL</td>
              <td style={{ textAlign: "right", color: "#059669" }}>{formatMoney(dados.totalReceitas)}</td>
              <td style={{ textAlign: "right", color: "#dc2626" }}>{formatMoney(dados.totalDespesas)}</td>
              <td style={{ textAlign: "right", color: dados.saldoTotal >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(dados.saldoTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  function renderDiario() {
    if (!dados?.dias) return null;
    const dias = dados.dias as DiaSumario[];

    let saldoAcumulado = 0;

    return (
      <div style={{ overflowX: "auto" }}>
        <table className="data-table mobile-cards">
          <thead>
            <tr>
              <th style={{ textAlign: "center", width: 40 }}></th>
              <th style={{ textAlign: "left" }}>Data</th>
              <th style={{ textAlign: "right" }}>Receitas</th>
              <th style={{ textAlign: "right" }}>Despesas</th>
              <th style={{ textAlign: "right" }}>Saldo Dia</th>
              <th style={{ textAlign: "right" }}>Acumulado</th>
              <th style={{ textAlign: "right" }}>Movimentos</th>
            </tr>
          </thead>
          <tbody>
            {[...dias].reverse().map((d) => {
              saldoAcumulado += d.saldo;
              const itemKey = `dia-${d.data}`;
              const isExpanded = expandedItems[itemKey] !== undefined;
              const isLoading = !!loadingItems[itemKey];
              const lancamentos = expandedItems[itemKey] ?? [];
              const porConta = isExpanded ? agruparPorConta(lancamentos) : [];

              return (
                <React.Fragment key={d.data}>
                  <tr>
                    <td style={{ textAlign: "center", width: 40 }}>
                      <button
                        type="button"
                        onClick={() => handleExpand(itemKey, { dataExata: d.data })}
                        style={{
                          background: "none",
                          border: "1px solid #d1d5db",
                          borderRadius: 4,
                          width: 26,
                          height: 26,
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: isExpanded ? "#dc2626" : "#059669",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title={isExpanded ? "Fechar detalhes" : "Ver lancamentos do dia"}
                      >
                        {isLoading ? "..." : isExpanded ? "-" : "+"}
                      </button>
                    </td>
                    <td data-label="Data">{formatDate(d.data)}</td>
                    <td data-label="Receitas" style={{ textAlign: "right", color: "#059669" }}>{formatMoney(d.receitas)}</td>
                    <td data-label="Despesas" style={{ textAlign: "right", color: "#dc2626" }}>{formatMoney(d.despesas)}</td>
                    <td data-label="Saldo" style={{ textAlign: "right", color: d.saldo >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(d.saldo)}</td>
                    <td data-label="Acumulado" style={{ textAlign: "right", fontWeight: 600, color: saldoAcumulado >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(saldoAcumulado)}</td>
                    <td data-label="Movimentos" style={{ textAlign: "right" }}>{d.qtd}</td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <div style={{ backgroundColor: "#f9fafb", padding: "8px 12px 8px 48px", borderTop: "1px dashed #e5e7eb", borderBottom: "1px dashed #e5e7eb" }}>
                          {lancamentos.length === 0 && !isLoading ? (
                            <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "4px 0" }}>Nenhum lancamento encontrado para este dia.</p>
                          ) : (
                            <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                              <thead>
                                <tr style={{ color: "#6b7280" }}>
                                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>Conta</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>Descricao</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>Pessoa</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>Placa</th>
                                  <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 600 }}>Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {porConta.map((grupo) => (
                                  <React.Fragment key={grupo.contaCodigo}>
                                    <tr style={{ backgroundColor: "#eef2ff" }}>
                                      <td colSpan={5} style={{ padding: "6px 8px", fontWeight: 600, fontSize: "0.8rem", color: "#4338ca" }}>
                                        {grupo.contaCodigo} {grupo.contaNome} ({grupo.lancamentos.length} lancamentos)
                                      </td>
                                    </tr>
                                    {grupo.lancamentos.map((l) => (
                                      <tr key={l.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                                        <td style={{ padding: "4px 8px", fontSize: "0.78rem", color: "#6b7280" }}>{l.contaCodigo}</td>
                                        <td style={{ padding: "4px 8px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descricao}</td>
                                        <td style={{ padding: "4px 8px" }}>{l.pessoaNome || "-"}</td>
                                        <td style={{ padding: "4px 8px" }}>{l.placa || "-"}</td>
                                        <td style={{ padding: "4px 8px", textAlign: "right", color: l.valor >= 0 ? "#059669" : "#dc2626", fontWeight: 600 }}>
                                          {l.valor >= 0 ? "+" : "-"}{formatMoney(Math.abs(l.valor))}
                                        </td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
              <td></td>
              <td>TOTAL ({dias.length} dias)</td>
              <td style={{ textAlign: "right", color: "#059669" }}>{formatMoney(dados.totalReceitas)}</td>
              <td style={{ textAlign: "right", color: "#dc2626" }}>{formatMoney(dados.totalDespesas)}</td>
              <td style={{ textAlign: "right", color: dados.saldoTotal >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(dados.saldoTotal)}</td>
              <td style={{ textAlign: "right", fontWeight: 700, color: saldoAcumulado >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(saldoAcumulado)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

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
          <section className="panel">
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-group" style={{ flex: "0 0 140px" }}>
                <label htmlFor="rc-inicio">Data Inicio</label>
                <input id="rc-inicio" type="date" className="form-input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: "0 0 140px" }}>
                <label htmlFor="rc-fim">Data Fim</label>
                <input id="rc-fim" type="date" className="form-input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: "1 0 200px" }}>
                <label htmlFor="rc-busca">Buscar</label>
                <input
                  id="rc-busca"
                  className="form-input"
                  placeholder="Descricao, placa, pessoa (min. 3 caracteres)..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: "0 0 auto" }}>
                <label>Visao</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {visaoOpcoes.map((op) => (
                    <button
                      key={op.valor}
                      type="button"
                      className={visao === op.valor ? "button button-primary button-compact" : "button button-secondary button-compact"}
                      onClick={() => setVisao(op.valor)}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Summary cards */}
          {dados && !carregando && (
            <section className="summary-cards" style={{ marginTop: 16 }}>
              <div className="summary-card">
                <span className="summary-label">Total Receitas</span>
                <strong className="summary-value" style={{ color: "#059669" }}>{formatMoney(dados.totalReceitas ?? 0)}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-label">Total Despesas</span>
                <strong className="summary-value" style={{ color: "#dc2626" }}>{formatMoney(dados.totalDespesas ?? 0)}</strong>
              </div>
              <div className="summary-card" style={{ borderLeft: `4px solid ${(dados.saldoTotal ?? 0) >= 0 ? "#059669" : "#dc2626"}` }}>
                <span className="summary-label">Saldo do Periodo</span>
                <strong className="summary-value" style={{ color: (dados.saldoTotal ?? 0) >= 0 ? "#059669" : "#dc2626" }}>
                  {(dados.saldoTotal ?? 0) >= 0 ? "+" : ""}{formatMoney(dados.saldoTotal ?? 0)}
                </strong>
              </div>
            </section>
          )}

          <section className="panel" style={{ marginTop: 16 }}>
            {carregando ? (
              <div className="empty-state">Carregando relatorio...</div>
            ) : !dados ? (
              <div className="empty-state">Nenhum dado disponivel.</div>
            ) : visao === "agrupado" ? (
              renderAgrupado()
            ) : (
              renderDiario()
            )}
          </section>
        </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}
