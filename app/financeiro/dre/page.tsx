"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import React, { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

type TipoVisao = "mensal" | "trimestral" | "semestral" | "anual";

interface DreLinha {
  id: number;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "CALCULADO";
  referencia100?: boolean;
  valor: number;
  colunas?: Record<string, number>;
  filhos?: DreLinha[];
}

interface PeriodoInfo {
  chave: string;
  label: string;
}

function formatarValor(valor: number): string {
  return Math.abs(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarPct(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

function calcularImpacto(linha: DreLinha): number {
  const valorAbsoluto = Math.abs(linha.valor);
  if (linha.natureza === "RECEITA") return valorAbsoluto;
  if (linha.natureza === "DESPESA") return -valorAbsoluto;
  return valorAbsoluto;
}

function calcularImpactoValor(natureza: string, valor: number): number {
  const abs = Math.abs(valor);
  if (natureza === "RECEITA") return abs;
  if (natureza === "DESPESA") return -abs;
  return abs;
}

// Collect all values by codigo from tree for percentage calc
function coletarValoresPorCodigo(linhas: DreLinha[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const l of linhas) {
    if (l.codigo) mapa.set(l.codigo, l.valor);
    if (l.filhos?.length) {
      const sub = coletarValoresPorCodigo(l.filhos);
      sub.forEach((v, k) => mapa.set(k, v));
    }
  }
  return mapa;
}

function coletarColunasPorCodigo(linhas: DreLinha[], chave: string): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const l of linhas) {
    if (l.codigo) mapa.set(l.codigo, l.colunas?.[chave] ?? 0);
    if (l.filhos?.length) {
      const sub = coletarColunasPorCodigo(l.filhos, chave);
      sub.forEach((v, k) => mapa.set(k, v));
    }
  }
  return mapa;
}

function encontrarRef100(linhas: DreLinha[]): string | null {
  for (const l of linhas) {
    if (l.referencia100) return l.codigo;
    if (l.filhos?.length) {
      const found = encontrarRef100(l.filhos);
      if (found) return found;
    }
  }
  return null;
}

function calcPct(valor: number, ref: number): number {
  if (ref === 0) return 0;
  return (valor / ref) * 100;
}

function formatarMesLabel(mes: string): string {
  const [ano, m] = mes.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(m) - 1]}/${ano}`;
}

/* ── Desktop: table row (hierarchical) ── */
function DreLinhaRow({
  node,
  periodos,
  nivel,
  ref100Codigo,
  linhasRaiz,
  mediaData,
}: {
  node: DreLinha;
  periodos: PeriodoInfo[];
  nivel: number;
  ref100Codigo: string | null;
  linhasRaiz: DreLinha[];
  mediaData?: Record<string, number> | null;
}) {
  const [aberto, setAberto] = useState(true);
  const temFilhos = (node.filhos?.length ?? 0) > 0;
  const paddingLeft = nivel * 20 + 8;
  const isRef100 = node.referencia100;

  // Get ref100 total value for percentage
  const ref100ValorTotal = useMemo(() => {
    if (!ref100Codigo) return 0;
    const mapa = coletarValoresPorCodigo(linhasRaiz);
    return mapa.get(ref100Codigo) ?? 0;
  }, [ref100Codigo, linhasRaiz]);

  return (
    <>
      <tr
        style={{
          fontWeight: nivel === 0 ? 700 : 400,
          backgroundColor: isRef100 ? "#eff6ff" : nivel === 0 ? "#f9fafb" : "transparent",
        }}
      >
        <td
          style={{ paddingLeft, cursor: temFilhos ? "pointer" : "default", whiteSpace: "nowrap" }}
          onClick={() => temFilhos && setAberto((v) => !v)}
        >
          {temFilhos ? (aberto ? "- " : "+ ") : "  "}
          {node.codigo ? `${node.codigo} - ` : ""}
          {node.nome}
          <span
            style={{
              marginLeft: 8,
              fontSize: "0.7rem",
              color: node.natureza === "RECEITA" ? "#059669" : node.natureza === "DESPESA" ? "#dc2626" : "#6b7280",
            }}
          >
            {node.natureza}
          </span>
          {isRef100 && <span style={{ marginLeft: 6, fontSize: "0.65rem", color: "#2563eb", fontWeight: 700 }}>[100%]</span>}
        </td>
        {periodos.length > 0 ? (
          <>
            {periodos.map((p) => {
              const val = node.colunas?.[p.chave] ?? 0;
              // % for this period
              let pctVal = 0;
              if (ref100Codigo) {
                const mapaPeriodo = coletarColunasPorCodigo(linhasRaiz, p.chave);
                const refVal = mapaPeriodo.get(ref100Codigo) ?? 0;
                pctVal = calcPct(val, refVal);
              }
              return (
                <React.Fragment key={p.chave}>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ color: val >= 0 ? "#059669" : "#dc2626" }}>
                      {formatarValor(val)}
                    </span>
                  </td>
                  {ref100Codigo && (
                    <td style={{ textAlign: "right", whiteSpace: "nowrap", color: "#6b7280", fontSize: "0.82rem" }}>
                      {formatarPct(pctVal)}
                    </td>
                  )}
                </React.Fragment>
              );
            })}
            <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
              {formatarValor(node.valor)}
            </td>
            {ref100Codigo && (
              <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: "#6b7280", fontSize: "0.82rem" }}>
                {formatarPct(calcPct(node.valor, ref100ValorTotal))}
              </td>
            )}
            {mediaData && (() => {
              const mVal = mediaData[String(node.id)] ?? 0;
              const dist = node.valor - mVal;
              const distPct = mVal !== 0 ? (dist / Math.abs(mVal)) * 100 : 0;
              return (
                <>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", borderLeft: "2px solid #a78bfa", color: "#7c3aed" }}>{formatarValor(mVal)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", color: dist >= 0 ? "#059669" : "#dc2626" }}>
                    {dist >= 0 ? "+" : "-"}{formatarValor(dist)}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", fontSize: "0.82rem", color: distPct >= 0 ? "#059669" : "#dc2626" }}>
                    {distPct >= 0 ? "+" : ""}{formatarPct(distPct)}
                  </td>
                </>
              );
            })()}
          </>
        ) : (
          <>
            <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
              {formatarValor(node.valor)}
            </td>
            {ref100Codigo && (
              <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: "#6b7280", fontSize: "0.82rem" }}>
                {formatarPct(calcPct(node.valor, ref100ValorTotal))}
              </td>
            )}
            {mediaData && (() => {
              const mVal = mediaData[String(node.id)] ?? 0;
              const dist = node.valor - mVal;
              const distPct = mVal !== 0 ? (dist / Math.abs(mVal)) * 100 : 0;
              return (
                <>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", borderLeft: "2px solid #a78bfa", color: "#7c3aed" }}>{formatarValor(mVal)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", color: dist >= 0 ? "#059669" : "#dc2626" }}>
                    {dist >= 0 ? "+" : "-"}{formatarValor(dist)}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", fontSize: "0.82rem", color: distPct >= 0 ? "#059669" : "#dc2626" }}>
                    {distPct >= 0 ? "+" : ""}{formatarPct(distPct)}
                  </td>
                </>
              );
            })()}
          </>
        )}
      </tr>
      {aberto &&
        node.filhos?.map((filho) => (
          <DreLinhaRow key={filho.id} node={filho} periodos={periodos} nivel={nivel + 1} ref100Codigo={ref100Codigo} linhasRaiz={linhasRaiz} mediaData={mediaData} />
        ))}
    </>
  );
}

/* ── Mobile: card view (hierarchical) ── */
function DreLinhaCard({
  node,
  periodos,
  nivel,
  ref100Codigo,
  linhasRaiz,
  mediaData,
}: {
  node: DreLinha;
  periodos: PeriodoInfo[];
  nivel: number;
  ref100Codigo: string | null;
  linhasRaiz: DreLinha[];
  mediaData?: Record<string, number> | null;
}) {
  const [aberto, setAberto] = useState(nivel === 0);
  const [detalhes, setDetalhes] = useState(false);
  const temFilhos = (node.filhos?.length ?? 0) > 0;
  const temPeriodos = periodos.length > 0 && node.colunas;
  const levelClass = `dre-card-level-${Math.min(nivel, 3)}`;
  const corValor = node.valor >= 0 ? "#059669" : "#dc2626";
  const corNatureza = node.natureza === "RECEITA" ? "#059669" : node.natureza === "DESPESA" ? "#dc2626" : "#6b7280";

  const ref100ValorTotal = useMemo(() => {
    if (!ref100Codigo) return 0;
    const mapa = coletarValoresPorCodigo(linhasRaiz);
    return mapa.get(ref100Codigo) ?? 0;
  }, [ref100Codigo, linhasRaiz]);

  const pctTotal = ref100Codigo ? calcPct(node.valor, ref100ValorTotal) : null;

  return (
    <>
      <div className={`dre-card ${levelClass}`} style={node.referencia100 ? { borderLeft: "3px solid #2563eb" } : {}}>
        <div
          className="dre-card-header"
          onClick={() => temFilhos ? setAberto((v) => !v) : setDetalhes((v) => !v)}
          style={{ cursor: "pointer" }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dre-card-title">
              {temFilhos && <span style={{ marginRight: 4, color: "#9ca3af" }}>{aberto ? "\u25BC" : "\u25B6"}</span>}
              {node.codigo ? `${node.codigo} - ` : ""}{node.nome}
              {node.referencia100 && <span style={{ marginLeft: 6, fontSize: "0.65rem", color: "#2563eb", fontWeight: 700 }}>[100%]</span>}
            </div>
            <div className="dre-card-meta">
              <span className="badge" style={{
                backgroundColor: node.natureza === "RECEITA" ? "#dcfce7" : node.natureza === "DESPESA" ? "#fee2e2" : "#f3f4f6",
                color: corNatureza,
              }}>
                {node.natureza}
              </span>
              {pctTotal !== null && (
                <span style={{ fontSize: "0.78rem", color: "#6b7280", marginLeft: 8 }}>
                  {formatarPct(pctTotal)}
                </span>
              )}
            </div>
          </div>
          <div className="dre-card-total" style={{ color: corValor }}>
            {formatarValor(node.valor)}
          </div>
        </div>

        {(detalhes || (temFilhos && aberto)) && temPeriodos && (
          <div className="dre-card-periodos">
            {periodos.map((p) => {
              const val = node.colunas?.[p.chave] ?? 0;
              let pctVal = 0;
              if (ref100Codigo) {
                const mapaPeriodo = coletarColunasPorCodigo(linhasRaiz, p.chave);
                const refVal = mapaPeriodo.get(ref100Codigo) ?? 0;
                pctVal = calcPct(val, refVal);
              }
              return (
                <div key={p.chave} className="dre-card-periodo-item">
                  <span className="dre-card-periodo-label">{p.label}</span>
                  <span className="dre-card-periodo-valor" style={{ color: val >= 0 ? "#059669" : "#dc2626" }}>
                    {formatarValor(val)}
                    {ref100Codigo && (
                      <span style={{ color: "#6b7280", fontSize: "0.75rem", marginLeft: 4 }}>
                        ({formatarPct(pctVal)})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Media comparison on mobile */}
        {mediaData && (() => {
          const mVal = mediaData[String(node.id)] ?? 0;
          const dist = node.valor - mVal;
          const distPct = mVal !== 0 ? (dist / Math.abs(mVal)) * 100 : 0;
          return (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", borderTop: "1px solid #ede9fe", backgroundColor: "#faf5ff", fontSize: "0.82rem" }}>
              <span style={{ color: "#7c3aed", fontWeight: 600 }}>Media: {formatarValor(mVal)}</span>
              <span style={{ color: dist >= 0 ? "#059669" : "#dc2626" }}>
                Dist: {dist >= 0 ? "+" : "-"}{formatarValor(dist)} ({distPct >= 0 ? "+" : ""}{formatarPct(distPct)})
              </span>
            </div>
          );
        })()}
      </div>

      {aberto && temFilhos && node.filhos!.map((filho) => (
        <DreLinhaCard key={filho.id} node={filho} periodos={periodos} nivel={nivel + 1} ref100Codigo={ref100Codigo} linhasRaiz={linhasRaiz} mediaData={mediaData} />
      ))}
    </>
  );
}

export default function DrePage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/dre";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_DRE";
  const nomeTela = tela?.NOME_TELA ?? "RELATORIO DRE";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [visao, setVisao] = useState<TipoVisao>("mensal");
  const [linhas, setLinhas] = useState<DreLinha[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoInfo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ref100Codigo, setRef100Codigo] = useState<string | null>(null);

  // Media comparison state
  const [compararMedia, setCompararMedia] = useState(false);
  const [mediaData, setMediaData] = useState<Record<string, number> | null>(null);
  const [mediaMeses, setMediaMeses] = useState(0);

  // Generate selectable months (3 years back to end of current year)
  const anoAtual = new Date().getFullYear();
  const mesAtualNum = new Date().getMonth() + 1;
  const mesesDisponiveis = useMemo(() => {
    const lista: string[] = [];
    for (let a = anoAtual - 2; a <= anoAtual; a++) {
      for (let m = 1; m <= 12; m++) {
        lista.push(`${a}-${String(m).padStart(2, "0")}`);
      }
    }
    return lista;
  }, [anoAtual]);

  const [mesInicio, setMesInicio] = useState(`${anoAtual}-01`);
  const [mesFim, setMesFim] = useState(`${anoAtual}-${String(mesAtualNum).padStart(2, "0")}`);
  const [mediaInicio, setMediaInicio] = useState(`${anoAtual - 1}-01`);
  const [mediaFim, setMediaFim] = useState(`${anoAtual - 1}-12`);

  useEffect(() => {
    if (!empresa?.id || !mesInicio || !mesFim) return;

    const carregarDre = async () => {
      try {
        setCarregando(true);
        const params = new URLSearchParams();
        params.set("visao", visao);
        params.set("mesInicio", mesInicio);
        params.set("mesFim", mesFim);
        if (compararMedia) {
          params.set("mediaInicio", mediaInicio);
          params.set("mediaFim", mediaFim);
        }

        const resposta = await fetch(`/api/financeiro/dre?${params.toString()}`, {
          headers: { "x-empresa-id": String(empresa.id) },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            setLinhas(dados.data ?? []);
            setPeriodos(dados.periodos ?? []);
            setRef100Codigo(dados.referencia100Codigo ?? null);
            setMediaData(dados.media ?? null);
            setMediaMeses(dados.mediaMeses ?? 0);
          }
        }
      } catch (erro) {
        console.error("Erro ao buscar DRE:", erro);
      } finally {
        setCarregando(false);
      }
    };

    carregarDre();
  }, [empresa?.id, visao, mesInicio, mesFim, compararMedia, mediaInicio, mediaFim]);

  const totalResultado = useMemo(() => {
    return linhas.reduce((acc, linha) => acc + calcularImpacto(linha), 0);
  }, [linhas]);

  const resultadoPorPeriodo = useMemo(() => {
    if (periodos.length === 0) return {};
    const resultado: Record<string, number> = {};
    for (const p of periodos) {
      resultado[p.chave] = linhas.reduce((acc, linha) => {
        const val = linha.colunas?.[p.chave] ?? 0;
        return acc + calcularImpactoValor(linha.natureza, val);
      }, 0);
    }
    return resultado;
  }, [linhas, periodos]);

  // Ref100 total for resultado row %
  const ref100ValorTotal = useMemo(() => {
    if (!ref100Codigo) return 0;
    const mapa = coletarValoresPorCodigo(linhas);
    return mapa.get(ref100Codigo) ?? 0;
  }, [ref100Codigo, linhas]);

  const visaoOpcoes: { valor: TipoVisao; label: string }[] = [
    { valor: "mensal", label: "Mensal" },
    { valor: "trimestral", label: "Trimestral" },
    { valor: "semestral", label: "Semestral" },
    { valor: "anual", label: "Anual" },
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

        <PaginaProtegida codigoTela={codigoTela}>
        <main className="page-content-card">
          <section className="panel">
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-group" style={{ flex: "0 0 160px" }}>
                <label htmlFor="dre-mes-inicio">Periodo Inicio</label>
                <select
                  id="dre-mes-inicio"
                  className="form-input"
                  value={mesInicio}
                  onChange={(e) => {
                    setMesInicio(e.target.value);
                    if (e.target.value > mesFim) setMesFim(e.target.value);
                  }}
                >
                  {mesesDisponiveis.map((m) => (
                    <option key={m} value={m}>{formatarMesLabel(m)}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: "0 0 160px" }}>
                <label htmlFor="dre-mes-fim">Periodo Fim</label>
                <select
                  id="dre-mes-fim"
                  className="form-input"
                  value={mesFim}
                  onChange={(e) => {
                    setMesFim(e.target.value);
                    if (e.target.value < mesInicio) setMesInicio(e.target.value);
                  }}
                >
                  {mesesDisponiveis.filter((m) => m >= mesInicio).map((m) => (
                    <option key={m} value={m}>{formatarMesLabel(m)}</option>
                  ))}
                </select>
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

            {/* Media comparison toggle */}
            <div style={{ marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600, fontSize: "0.88rem" }}>
                  <input
                    type="checkbox"
                    checked={compararMedia}
                    onChange={(e) => setCompararMedia(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Comparar com Media
                </label>

                {compararMedia && (
                  <>
                    <div className="form-group" style={{ flex: "0 0 160px" }}>
                      <label htmlFor="dre-media-inicio">Media Inicio</label>
                      <select
                        id="dre-media-inicio"
                        className="form-input"
                        value={mediaInicio}
                        onChange={(e) => {
                          setMediaInicio(e.target.value);
                          if (e.target.value > mediaFim) setMediaFim(e.target.value);
                        }}
                      >
                        {mesesDisponiveis.map((m) => (
                          <option key={m} value={m}>{formatarMesLabel(m)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: "0 0 160px" }}>
                      <label htmlFor="dre-media-fim">Media Fim</label>
                      <select
                        id="dre-media-fim"
                        className="form-input"
                        value={mediaFim}
                        onChange={(e) => {
                          setMediaFim(e.target.value);
                          if (e.target.value < mediaInicio) setMediaInicio(e.target.value);
                        }}
                      >
                        {mesesDisponiveis.filter((m) => m >= mediaInicio).map((m) => (
                          <option key={m} value={m}>{formatarMesLabel(m)}</option>
                        ))}
                      </select>
                    </div>
                    {mediaMeses > 0 && (
                      <span style={{ fontSize: "0.82rem", color: "#6b7280" }}>
                        ({mediaMeses} {mediaMeses === 1 ? "mes" : "meses"})
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="panel" style={{ marginTop: 16 }}>
            {carregando ? (
              <div className="empty-state">Carregando dados do DRE...</div>
            ) : linhas.length === 0 ? (
              <div className="empty-state">Nenhum dado disponivel. Cadastre a estrutura de DRE e vincule contas do plano.</div>
            ) : (
              <>
                {/* Desktop: Table view */}
                <div className="dre-desktop-table" style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ tableLayout: "auto", minWidth: periodos.length > 3 ? "900px" : "auto" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Conta DRE</th>
                        {periodos.map((p) => (
                          <React.Fragment key={p.chave}>
                            <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>{p.label}</th>
                            {ref100Codigo && <th style={{ textAlign: "right", whiteSpace: "nowrap", fontSize: "0.78rem", color: "#6b7280" }}>%</th>}
                          </React.Fragment>
                        ))}
                        <th style={{ textAlign: "right" }}>Total</th>
                        {ref100Codigo && <th style={{ textAlign: "right", fontSize: "0.78rem", color: "#6b7280" }}>%</th>}
                        {compararMedia && mediaData && (
                          <>
                            <th style={{ textAlign: "right", borderLeft: "2px solid #a78bfa", color: "#7c3aed", whiteSpace: "nowrap" }}>Media</th>
                            <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Dist. R$</th>
                            <th style={{ textAlign: "right", whiteSpace: "nowrap", fontSize: "0.78rem" }}>Dist. %</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((linha) => (
                        <DreLinhaRow key={linha.id} node={linha} periodos={periodos} nivel={0} ref100Codigo={ref100Codigo} linhasRaiz={linhas} mediaData={compararMedia ? mediaData : null} />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
                        <td style={{ paddingLeft: 8 }}>RESULTADO DO EXERCICIO</td>
                        {periodos.map((p) => {
                          const val = resultadoPorPeriodo[p.chave] ?? 0;
                          let pctVal = 0;
                          if (ref100Codigo) {
                            const mapaPeriodo = coletarColunasPorCodigo(linhas, p.chave);
                            const refVal = mapaPeriodo.get(ref100Codigo) ?? 0;
                            pctVal = calcPct(val, refVal);
                          }
                          return (
                            <React.Fragment key={p.chave}>
                              <td style={{ textAlign: "right", color: val >= 0 ? "#059669" : "#dc2626" }}>
                                {val >= 0 ? "+" : "-"}{formatarValor(val)}
                              </td>
                              {ref100Codigo && (
                                <td style={{ textAlign: "right", color: "#6b7280", fontSize: "0.82rem" }}>
                                  {formatarPct(pctVal)}
                                </td>
                              )}
                            </React.Fragment>
                          );
                        })}
                        <td style={{ textAlign: "right", color: totalResultado >= 0 ? "#059669" : "#dc2626" }}>
                          {totalResultado >= 0 ? "+" : "-"}{formatarValor(totalResultado)}
                        </td>
                        {ref100Codigo && (
                          <td style={{ textAlign: "right", color: "#6b7280", fontSize: "0.82rem" }}>
                            {formatarPct(calcPct(totalResultado, ref100ValorTotal))}
                          </td>
                        )}
                        {compararMedia && mediaData && (() => {
                          const totalMediaRes = linhas.reduce(function (acc, l) {
                            const mVal = mediaData[String(l.id)] ?? 0;
                            return acc + (l.natureza === "RECEITA" ? Math.abs(mVal) : l.natureza === "DESPESA" ? -Math.abs(mVal) : Math.abs(mVal));
                          }, 0);
                          const dist = totalResultado - totalMediaRes;
                          const distPct = totalMediaRes !== 0 ? (dist / Math.abs(totalMediaRes)) * 100 : 0;
                          return (
                            <>
                              <td style={{ textAlign: "right", borderLeft: "2px solid #a78bfa", color: "#7c3aed" }}>{totalMediaRes >= 0 ? "+" : "-"}{formatarValor(totalMediaRes)}</td>
                              <td style={{ textAlign: "right", color: dist >= 0 ? "#059669" : "#dc2626" }}>{dist >= 0 ? "+" : "-"}{formatarValor(dist)}</td>
                              <td style={{ textAlign: "right", fontSize: "0.82rem", color: distPct >= 0 ? "#059669" : "#dc2626" }}>{distPct >= 0 ? "+" : ""}{formatarPct(distPct)}</td>
                            </>
                          );
                        })()}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile: Card view */}
                <div className="dre-mobile-cards">
                  {linhas.map((linha) => (
                    <DreLinhaCard key={linha.id} node={linha} periodos={periodos} nivel={0} ref100Codigo={ref100Codigo} linhasRaiz={linhas} mediaData={compararMedia ? mediaData : null} />
                  ))}

                  <div className="dre-card-resultado">
                    <div className="dre-card-header">
                      <div style={{ flex: 1 }}>
                        <div className="dre-card-title">RESULTADO DO EXERCICIO</div>
                        {ref100Codigo && (
                          <div style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                            {formatarPct(calcPct(totalResultado, ref100ValorTotal))}
                          </div>
                        )}
                      </div>
                      <div className="dre-card-total" style={{ color: totalResultado >= 0 ? "#059669" : "#dc2626" }}>
                        {totalResultado >= 0 ? "+" : "-"}{formatarValor(totalResultado)}
                      </div>
                    </div>
                    {periodos.length > 0 && (
                      <div className="dre-card-periodos">
                        {periodos.map((p) => {
                          const val = resultadoPorPeriodo[p.chave] ?? 0;
                          return (
                            <div key={p.chave} className="dre-card-periodo-item">
                              <span className="dre-card-periodo-label">{p.label}</span>
                              <span className="dre-card-periodo-valor" style={{ color: val >= 0 ? "#059669" : "#dc2626" }}>
                                {val >= 0 ? "+" : "-"}{formatarValor(val)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
