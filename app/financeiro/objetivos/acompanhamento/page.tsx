"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import React, { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

type TipoVisao = "mensal" | "trimestral" | "semestral" | "anual";
type TipoObjetivoVal = "ESTRUTURA_DRE" | "PLANO_CONTAS" | "CENTRO_CUSTO";

var TIPO_OBJETIVO_LABELS: Record<TipoObjetivoVal, string> = {
  ESTRUTURA_DRE: "DRE",
  PLANO_CONTAS: "Plano de Contas",
  CENTRO_CUSTO: "Centro de Custo",
};

interface ColunaPeriodo {
  previsto: number;
  realizado: number;
  distorcaoValor: number;
  distorcaoPct: number;
}

interface DreNode {
  id: number;
  paiId: number | null;
  codigo: string;
  nome: string;
  natureza: string;
  previsto: number;
  realizado: number;
  distorcaoValor: number;
  distorcaoPct: number;
  colunas: Record<string, ColunaPeriodo>;
  filhos: DreNode[];
}

interface PeriodoInfo {
  chave: string;
  label: string;
}

function formatMoney(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(val: number): string {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/* ── Desktop row ── */
function AcompLinhaRow({
  node,
  nivel,
  periodos,
  mostrarColunas,
}: {
  node: DreNode;
  nivel: number;
  periodos: PeriodoInfo[];
  mostrarColunas: boolean;
}) {
  const [aberto, setAberto] = useState(true);
  const temFilhos = node.filhos.length > 0;
  const paddingLeft = nivel * 20 + 8;
  const corNatureza =
    node.natureza === "RECEITA" ? "#059669" : node.natureza === "DESPESA" ? "#dc2626" : "#6b7280";

  return (
    <>
      <tr
        style={{
          fontWeight: nivel === 0 ? 700 : temFilhos ? 600 : 400,
          backgroundColor: nivel === 0 ? "#f9fafb" : "transparent",
        }}
      >
        <td
          style={{ paddingLeft, cursor: temFilhos ? "pointer" : "default", whiteSpace: "nowrap" }}
          onClick={() => temFilhos && setAberto((v) => !v)}
        >
          {temFilhos ? (aberto ? "- " : "+ ") : "  "}
          {node.codigo ? `${node.codigo} - ` : ""}
          {node.nome}
          <span style={{ marginLeft: 8, fontSize: "0.7rem", color: corNatureza }}>{node.natureza}</span>
        </td>
        {mostrarColunas &&
          periodos.map((p) => {
            const col = node.colunas[p.chave];
            if (!col) return <React.Fragment key={p.chave}><td></td><td></td><td></td><td></td></React.Fragment>;
            return (
              <React.Fragment key={p.chave}>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatMoney(col.previsto)}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatMoney(col.realizado)}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap", color: col.distorcaoValor >= 0 ? "#059669" : "#dc2626" }}>
                  {col.distorcaoValor >= 0 ? "+" : ""}{formatMoney(col.distorcaoValor)}
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap", color: col.distorcaoPct >= 0 ? "#059669" : "#dc2626", fontSize: "0.82rem" }}>
                  {col.distorcaoPct >= 0 ? "+" : ""}{formatPct(col.distorcaoPct)}
                </td>
              </React.Fragment>
            );
          })}
        {/* Totals */}
        <td style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{formatMoney(node.previsto)}</td>
        <td style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{formatMoney(node.realizado)}</td>
        <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: node.distorcaoValor >= 0 ? "#059669" : "#dc2626" }}>
          {node.distorcaoValor >= 0 ? "+" : ""}{formatMoney(node.distorcaoValor)}
        </td>
        <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: node.distorcaoPct >= 0 ? "#059669" : "#dc2626", fontSize: "0.82rem" }}>
          {node.distorcaoPct >= 0 ? "+" : ""}{formatPct(node.distorcaoPct)}
        </td>
      </tr>
      {aberto &&
        node.filhos.map((filho) => (
          <AcompLinhaRow key={filho.id} node={filho} nivel={nivel + 1} periodos={periodos} mostrarColunas={mostrarColunas} />
        ))}
    </>
  );
}

/* ── Mobile card ── */
function AcompLinhaCard({
  node,
  nivel,
  periodos,
}: {
  node: DreNode;
  nivel: number;
  periodos: PeriodoInfo[];
}) {
  const [aberto, setAberto] = useState(nivel === 0);
  const [detalhes, setDetalhes] = useState(false);
  const temFilhos = node.filhos.length > 0;
  const corNatureza =
    node.natureza === "RECEITA" ? "#059669" : node.natureza === "DESPESA" ? "#dc2626" : "#6b7280";
  const levelClass = `dre-card-level-${Math.min(nivel, 3)}`;

  return (
    <>
      <div className={`dre-card ${levelClass}`}>
        <div
          className="dre-card-header"
          onClick={() => temFilhos ? setAberto((v) => !v) : setDetalhes((v) => !v)}
          style={{ cursor: "pointer" }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dre-card-title">
              {temFilhos && <span style={{ marginRight: 4, color: "#9ca3af" }}>{aberto ? "\u25BC" : "\u25B6"}</span>}
              {node.codigo ? `${node.codigo} - ` : ""}{node.nome}
            </div>
            <div className="dre-card-meta">
              <span className="badge" style={{
                backgroundColor: node.natureza === "RECEITA" ? "#dcfce7" : node.natureza === "DESPESA" ? "#fee2e2" : "#f3f4f6",
                color: corNatureza,
              }}>
                {node.natureza}
              </span>
              <span style={{ marginLeft: 8, fontSize: "0.78rem", color: node.distorcaoPct >= 0 ? "#059669" : "#dc2626" }}>
                {node.distorcaoPct >= 0 ? "+" : ""}{formatPct(node.distorcaoPct)}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Distorcao</div>
            <div className="dre-card-total" style={{ color: node.distorcaoValor >= 0 ? "#059669" : "#dc2626" }}>
              {node.distorcaoValor >= 0 ? "+" : ""}{formatMoney(node.distorcaoValor)}
            </div>
          </div>
        </div>

        <div className="dre-card-periodos">
          <div className="dre-card-periodo-item">
            <span className="dre-card-periodo-label">Previsto</span>
            <span className="dre-card-periodo-valor">{formatMoney(node.previsto)}</span>
          </div>
          <div className="dre-card-periodo-item">
            <span className="dre-card-periodo-label">Realizado</span>
            <span className="dre-card-periodo-valor">{formatMoney(node.realizado)}</span>
          </div>
        </div>

        {detalhes && periodos.length > 0 && (
          <div style={{ padding: "8px 12px", borderTop: "1px solid #e5e7eb" }}>
            {periodos.map((p) => {
              const col = node.colunas[p.chave];
              if (!col) return null;
              return (
                <div key={p.chave} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "0.82rem", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontWeight: 600, minWidth: 80 }}>{p.label}</span>
                  <span>P: {formatMoney(col.previsto)}</span>
                  <span>R: {formatMoney(col.realizado)}</span>
                  <span style={{ color: col.distorcaoValor >= 0 ? "#059669" : "#dc2626" }}>
                    {col.distorcaoValor >= 0 ? "+" : ""}{formatPct(col.distorcaoPct)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {aberto && temFilhos && node.filhos.map((filho) => (
        <AcompLinhaCard key={filho.id} node={filho} nivel={nivel + 1} periodos={periodos} />
      ))}
    </>
  );
}

export default function AcompanhamentoPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/objetivos/acompanhamento";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_OBJETIVOS";
  const nomeTela = tela?.NOME_TELA ?? "PREVISTO x REALIZADO";
  const moduloTela = tela?.MODULO ?? "OBJETIVOS";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;

  const [tipoObjetivo, setTipoObjetivo] = useState<TipoObjetivoVal>("ESTRUTURA_DRE");
  const [visao, setVisao] = useState<TipoVisao>("mensal");
  const [mesInicioRef, setMesInicioRef] = useState(Math.max(1, mesAtual - 2));
  const [mesFimRef, setMesFimRef] = useState(mesAtual);
  const [anoRef, setAnoRef] = useState(anoAtual);
  const [anoObjetivo, setAnoObjetivo] = useState(anoAtual);
  const [arvore, setArvore] = useState<DreNode[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoInfo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (empresa?.id) headers["x-empresa-id"] = String(empresa.id);
    return headers;
  }, [empresa?.id]);

  useEffect(() => {
    if (!empresa?.id) return;

    const carregar = async () => {
      try {
        setCarregando(true);
        const params = new URLSearchParams({
          anoRef: String(anoRef),
          mesInicioRef: String(mesInicioRef),
          mesFimRef: String(mesFimRef),
          anoObjetivo: String(anoObjetivo),
          visao,
          tipo: tipoObjetivo,
        });

        const resp = await fetch(`/api/financeiro/objetivos/acompanhamento?${params}`, {
          headers: headersPadrao,
        });
        const json = await resp.json();

        if (json?.success) {
          setArvore(json.data ?? []);
          setPeriodos(json.periodos ?? []);
        }
      } catch (err) {
        console.error("Erro ao carregar acompanhamento:", err);
      } finally {
        setCarregando(false);
      }
    };

    carregar();
  }, [empresa?.id, headersPadrao, anoRef, mesInicioRef, mesFimRef, anoObjetivo, visao, tipoObjetivo]);

  // Totals
  const totalPrevisto = useMemo(() => arvore.reduce((acc, n) => acc + n.previsto, 0), [arvore]);
  const totalRealizado = useMemo(() => arvore.reduce((acc, n) => acc + n.realizado, 0), [arvore]);
  const totalDistorcao = totalRealizado - totalPrevisto;
  const totalDistorcaoPct = totalPrevisto !== 0 ? (totalDistorcao / Math.abs(totalPrevisto)) * 100 : 0;

  const visaoOpcoes: { valor: TipoVisao; label: string }[] = [
    { valor: "mensal", label: "Mensal" },
    { valor: "trimestral", label: "Trimestral" },
    { valor: "semestral", label: "Semestral" },
    { valor: "anual", label: "Anual" },
  ];

  // Only show period columns for non-anual views
  const mostrarColunas = visao !== "anual" && periodos.length > 1;

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
              <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "0 0 12px 0" }}>
                Acompanhe a distorcao entre o previsto (objetivo) e o realizado - {TIPO_OBJETIVO_LABELS[tipoObjetivo]}
              </p>

              {/* Tipo selector */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {(["ESTRUTURA_DRE", "PLANO_CONTAS", "CENTRO_CUSTO"] as TipoObjetivoVal[]).map(function (t) {
                  return (
                    <button
                      key={t}
                      type="button"
                      className={tipoObjetivo === t ? "button button-primary button-compact" : "button button-secondary button-compact"}
                      onClick={function () { setTipoObjetivo(t); }}
                    >
                      {TIPO_OBJETIVO_LABELS[t]}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="form-group" style={{ flex: "0 0 auto", minWidth: 100 }}>
                  <label htmlFor="acomp-mes-inicio">Mes inicio (ref.)</label>
                  <select id="acomp-mes-inicio" className="form-input" value={mesInicioRef} onChange={(e) => setMesInicioRef(Number(e.target.value))}>
                    {MESES_LABELS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ flex: "0 0 auto", minWidth: 100 }}>
                  <label htmlFor="acomp-mes-fim">Mes fim (ref.)</label>
                  <select id="acomp-mes-fim" className="form-input" value={mesFimRef} onChange={(e) => setMesFimRef(Number(e.target.value))}>
                    {MESES_LABELS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ flex: "0 0 auto", minWidth: 90 }}>
                  <label htmlFor="acomp-ano-ref">Ano Ref.</label>
                  <input id="acomp-ano-ref" type="number" className="form-input" value={anoRef} onChange={(e) => setAnoRef(Number(e.target.value))} style={{ width: 90 }} />
                </div>

                <div className="form-group" style={{ flex: "0 0 auto", minWidth: 90 }}>
                  <label htmlFor="acomp-ano-obj">Ano Obj.</label>
                  <input id="acomp-ano-obj" type="number" className="form-input" value={anoObjetivo} onChange={(e) => setAnoObjetivo(Number(e.target.value))} style={{ width: 90 }} />
                </div>

                <div className="form-group" style={{ flex: "0 0 auto" }}>
                  <label>Visao</label>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
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
            <section className="summary-cards" style={{ marginTop: 20 }}>
              <div className="summary-card">
                <span className="summary-label">Previsto ({anoObjetivo})</span>
                <strong className="summary-value">{formatMoney(totalPrevisto)}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-label">Realizado ({anoObjetivo})</span>
                <strong className="summary-value">{formatMoney(totalRealizado)}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-label">Distorcao R$</span>
                <strong className="summary-value" style={{ color: totalDistorcao >= 0 ? "#059669" : "#dc2626" }}>
                  {totalDistorcao >= 0 ? "+" : ""}{formatMoney(totalDistorcao)}
                </strong>
              </div>
              <div className="summary-card">
                <span className="summary-label">Distorcao %</span>
                <strong className="summary-value" style={{ color: totalDistorcaoPct >= 0 ? "#059669" : "#dc2626" }}>
                  {totalDistorcaoPct >= 0 ? "+" : ""}{formatPct(totalDistorcaoPct)}
                </strong>
              </div>
            </section>

            {/* Data */}
            <section className="panel" style={{ marginTop: 20 }}>
              {carregando ? (
                <div className="empty-state">Carregando dados...</div>
              ) : arvore.length === 0 ? (
                <div className="empty-state">Nenhum dado encontrado. Cadastre objetivos primeiro na tela de Objetivos Financeiros.</div>
              ) : (
                <>
                  {/* Desktop: Table */}
                  <div className="dre-desktop-table" style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ tableLayout: "auto", minWidth: mostrarColunas ? "1200px" : "auto" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }} rowSpan={2}>{TIPO_OBJETIVO_LABELS[tipoObjetivo]}</th>
                          {mostrarColunas && periodos.map((p) => (
                            <th key={p.chave} colSpan={4} style={{ textAlign: "center", borderLeft: "1px solid #e5e7eb" }}>{p.label}</th>
                          ))}
                          <th colSpan={4} style={{ textAlign: "center", borderLeft: "2px solid #9ca3af" }}>Total</th>
                        </tr>
                        <tr>
                          {mostrarColunas && periodos.map((p) => (
                            <React.Fragment key={p.chave}>
                              <th style={{ textAlign: "right", fontSize: "0.75rem", borderLeft: "1px solid #e5e7eb" }}>Prev.</th>
                              <th style={{ textAlign: "right", fontSize: "0.75rem" }}>Real.</th>
                              <th style={{ textAlign: "right", fontSize: "0.75rem" }}>Dist. R$</th>
                              <th style={{ textAlign: "right", fontSize: "0.75rem" }}>Dist. %</th>
                            </React.Fragment>
                          ))}
                          <th style={{ textAlign: "right", fontSize: "0.75rem", borderLeft: "2px solid #9ca3af" }}>Previsto</th>
                          <th style={{ textAlign: "right", fontSize: "0.75rem" }}>Realizado</th>
                          <th style={{ textAlign: "right", fontSize: "0.75rem" }}>Dist. R$</th>
                          <th style={{ textAlign: "right", fontSize: "0.75rem" }}>Dist. %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arvore.map((node) => (
                          <AcompLinhaRow key={node.id} node={node} nivel={0} periodos={periodos} mostrarColunas={mostrarColunas} />
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
                          <td style={{ paddingLeft: 8 }}>TOTAL</td>
                          {mostrarColunas && periodos.map((p) => {
                            const pTotal = arvore.reduce((acc, n) => acc + (n.colunas[p.chave]?.previsto ?? 0), 0);
                            const rTotal = arvore.reduce((acc, n) => acc + (n.colunas[p.chave]?.realizado ?? 0), 0);
                            const dv = rTotal - pTotal;
                            const dp = pTotal !== 0 ? (dv / Math.abs(pTotal)) * 100 : 0;
                            return (
                              <React.Fragment key={p.chave}>
                                <td style={{ textAlign: "right", borderLeft: "1px solid #e5e7eb" }}>{formatMoney(pTotal)}</td>
                                <td style={{ textAlign: "right" }}>{formatMoney(rTotal)}</td>
                                <td style={{ textAlign: "right", color: dv >= 0 ? "#059669" : "#dc2626" }}>{dv >= 0 ? "+" : ""}{formatMoney(dv)}</td>
                                <td style={{ textAlign: "right", color: dp >= 0 ? "#059669" : "#dc2626", fontSize: "0.82rem" }}>{dp >= 0 ? "+" : ""}{formatPct(dp)}</td>
                              </React.Fragment>
                            );
                          })}
                          <td style={{ textAlign: "right", borderLeft: "2px solid #9ca3af" }}>{formatMoney(totalPrevisto)}</td>
                          <td style={{ textAlign: "right" }}>{formatMoney(totalRealizado)}</td>
                          <td style={{ textAlign: "right", color: totalDistorcao >= 0 ? "#059669" : "#dc2626" }}>
                            {totalDistorcao >= 0 ? "+" : ""}{formatMoney(totalDistorcao)}
                          </td>
                          <td style={{ textAlign: "right", color: totalDistorcaoPct >= 0 ? "#059669" : "#dc2626", fontSize: "0.82rem" }}>
                            {totalDistorcaoPct >= 0 ? "+" : ""}{formatPct(totalDistorcaoPct)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile: Cards */}
                  <div className="dre-mobile-cards">
                    {arvore.map((node) => (
                      <AcompLinhaCard key={node.id} node={node} nivel={0} periodos={periodos} />
                    ))}

                    <div className="dre-card-resultado">
                      <div className="dre-card-header">
                        <div style={{ flex: 1 }}>
                          <div className="dre-card-title">TOTAL</div>
                          <div style={{ fontSize: "0.78rem", color: totalDistorcaoPct >= 0 ? "#059669" : "#dc2626" }}>
                            {totalDistorcaoPct >= 0 ? "+" : ""}{formatPct(totalDistorcaoPct)}
                          </div>
                        </div>
                        <div className="dre-card-total" style={{ color: totalDistorcao >= 0 ? "#059669" : "#dc2626" }}>
                          {totalDistorcao >= 0 ? "+" : ""}{formatMoney(totalDistorcao)}
                        </div>
                      </div>
                      <div className="dre-card-periodos">
                        <div className="dre-card-periodo-item">
                          <span className="dre-card-periodo-label">Previsto</span>
                          <span className="dre-card-periodo-valor">{formatMoney(totalPrevisto)}</span>
                        </div>
                        <div className="dre-card-periodo-item">
                          <span className="dre-card-periodo-label">Realizado</span>
                          <span className="dre-card-periodo-valor">{formatMoney(totalRealizado)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}
