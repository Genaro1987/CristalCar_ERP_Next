"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

type TabId = "geral" | "receitas" | "despesas" | "graficos";
type ChartType = "bar" | "line" | "pie" | "doughnut";

type ResumoCarteira = { empresa: string; saldo: number; entradas: number; saidas: number };
type Indicador = { titulo: string; valor: string; descricao: string };
type Alertas = { entradasPeriodo: number; saidasPeriodo: number; vencidos: number };

interface ContaAnalise {
  contaId: number;
  conta: string;
  natureza: string;
  meses: Record<string, number>;
  total: number;
  media: number;
}

interface EvolucaoMes {
  mes: string;
  label: string;
  receitas: number;
  despesas: number;
}

interface ContaOpcao {
  id: number;
  nome: string;
  natureza: string;
  origem: string;
}

const CORES = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#e11d48", "#a855f7", "#22c55e", "#eab308",
];

function defaultDataInicio() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
}

function defaultDataFim() {
  return new Date().toISOString().slice(0, 10);
}

const formatMoney = (val: number) =>
  val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ChartTypeSelector({ value, onChange }: { value: ChartType; onChange: (t: ChartType) => void }) {
  const tipos: { id: ChartType; label: string }[] = [
    { id: "bar", label: "Barras" },
    { id: "line", label: "Linhas" },
    { id: "pie", label: "Pizza" },
    { id: "doughnut", label: "Rosca" },
  ];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {tipos.map((t) => (
        <button
          key={t.id}
          type="button"
          className={value === t.id ? "button button-primary button-compact" : "button button-secondary button-compact"}
          onClick={() => onChange(t.id)}
          style={{ fontSize: "0.75rem", padding: "4px 10px" }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function RenderChart({
  tipo,
  labels,
  datasets,
  height = 300,
}: {
  tipo: ChartType;
  labels: string[];
  datasets: { label: string; data: number[]; backgroundColor?: string | string[]; borderColor?: string }[];
  height?: number;
}) {
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const, labels: { font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed?.y ?? ctx.parsed ?? 0;
            return `${ctx.dataset.label}: ${formatMoney(val)}`;
          },
        },
      },
    },
  };

  if (tipo !== "pie" && tipo !== "doughnut") {
    options.scales = {
      y: { ticks: { callback: (val: any) => `R$ ${(Number(val) / 1000).toFixed(0)}k`, font: { size: 10 } } },
      x: { ticks: { font: { size: 10 } } },
    };
  }

  if (tipo === "pie") {
    const pieData = {
      labels,
      datasets: [{ data: datasets[0]?.data ?? [], backgroundColor: labels.map((_, i) => CORES[i % CORES.length]) }],
    };
    return <div style={{ height }}><Pie data={pieData} options={options} /></div>;
  }

  if (tipo === "doughnut") {
    const dData = {
      labels,
      datasets: [{ data: datasets[0]?.data ?? [], backgroundColor: labels.map((_, i) => CORES[i % CORES.length]) }],
    };
    return <div style={{ height }}><Doughnut data={dData} options={options} /></div>;
  }

  if (tipo === "line") {
    const lineDatasets = datasets.map((ds, i) => ({
      ...ds,
      borderColor: ds.borderColor ?? CORES[i % CORES.length],
      backgroundColor: (ds.borderColor ?? CORES[i % CORES.length]) + "33",
      fill: true,
      tension: 0.3,
      pointRadius: 3,
    }));
    return <div style={{ height }}><Line data={{ labels, datasets: lineDatasets }} options={options} /></div>;
  }

  const barDatasets = datasets.map((ds, i) => ({
    ...ds,
    backgroundColor: ds.backgroundColor ?? CORES[i % CORES.length],
    borderRadius: 4,
  }));
  return <div style={{ height }}><Bar data={{ labels, datasets: barDatasets }} options={options} /></div>;
}

export default function FinanceiroDashboardPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/dashboard";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_DASHBOARD";
  const nomeTela = tela?.NOME_TELA ?? "DASHBOARD FINANCEIRO";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [activeTab, setActiveTab] = useState<TabId>("geral");
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);

  const [carteira, setCarteira] = useState<ResumoCarteira[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [alertas, setAlertas] = useState<Alertas>({ entradasPeriodo: 0, saidasPeriodo: 0, vencidos: 0 });
  const [carregandoGeral, setCarregandoGeral] = useState(true);

  const [receitasData, setReceitasData] = useState<any>(null);
  const [despesasData, setDespesasData] = useState<any>(null);
  const [chartTypeReceitas, setChartTypeReceitas] = useState<ChartType>("bar");
  const [chartTypeDespesas, setChartTypeDespesas] = useState<ChartType>("bar");
  const [carregandoReceitas, setCarregandoReceitas] = useState(false);
  const [carregandoDespesas, setCarregandoDespesas] = useState(false);

  const [evolucao, setEvolucao] = useState<EvolucaoMes[]>([]);

  const [contasDisponiveis, setContasDisponiveis] = useState<ContaOpcao[]>([]);
  const [contasSelecionadas, setContasSelecionadas] = useState<number[]>([]);
  const [cruzamentoData, setCruzamentoData] = useState<any>(null);
  const [chartTypeGraficos, setChartTypeGraficos] = useState<ChartType>("line");
  const [carregandoGraficos, setCarregandoGraficos] = useState(false);
  const [filtroOrigem, setFiltroOrigem] = useState<"TODOS" | "PLANO_CONTAS" | "DRE">("TODOS");

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    if (empresa?.id) h["x-empresa-id"] = String(empresa.id);
    return h;
  }, [empresa?.id]);

  const fetchAnalise = useCallback(async (tipo: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams({ dataInicio, dataFim, tipo, ...extra });
    const res = await fetch(`/api/financeiro/dashboard/analise?${params}`, { headers });
    const json = await res.json();
    return json?.success ? json.data : null;
  }, [dataInicio, dataFim, headers]);

  useEffect(() => {
    if (!empresa?.id) return;
    const load = async () => {
      setCarregandoGeral(true);
      try {
        const params = new URLSearchParams({ dataInicio, dataFim });
        const res = await fetch(`/api/financeiro/dashboard?${params}`, { headers });
        const json = await res.json();
        if (json?.success) {
          setCarteira(json.data.carteira);
          setIndicadores(json.data.indicadores);
          setAlertas(json.data.alertas);
        }
      } catch (e) { console.error(e); }
      finally { setCarregandoGeral(false); }
    };
    load();
  }, [empresa?.id, dataInicio, dataFim, headers]);

  useEffect(() => {
    if (!empresa?.id || activeTab !== "geral") return;
    fetchAnalise("evolucao").then((d) => d && setEvolucao(d));
  }, [empresa?.id, activeTab, fetchAnalise]);

  useEffect(() => {
    if (!empresa?.id || activeTab !== "receitas") return;
    setCarregandoReceitas(true);
    fetchAnalise("receitas").then((d) => { setReceitasData(d); setCarregandoReceitas(false); });
  }, [empresa?.id, activeTab, fetchAnalise]);

  useEffect(() => {
    if (!empresa?.id || activeTab !== "despesas") return;
    setCarregandoDespesas(true);
    fetchAnalise("despesas").then((d) => { setDespesasData(d); setCarregandoDespesas(false); });
  }, [empresa?.id, activeTab, fetchAnalise]);

  useEffect(() => {
    if (!empresa?.id || activeTab !== "graficos") return;
    fetchAnalise("contas").then((d) => d && setContasDisponiveis(d));
  }, [empresa?.id, activeTab, fetchAnalise]);

  useEffect(() => {
    if (!empresa?.id || activeTab !== "graficos" || contasSelecionadas.length === 0) {
      setCruzamentoData(null);
      return;
    }
    setCarregandoGraficos(true);
    fetchAnalise("cruzamento", { contaIds: contasSelecionadas.join(",") })
      .then((d) => { setCruzamentoData(d); setCarregandoGraficos(false); });
  }, [empresa?.id, activeTab, contasSelecionadas, fetchAnalise]);

  const carteiraSelecionada = useMemo(
    () => carteira[0] || { empresa: "", saldo: 0, entradas: 0, saidas: 0 },
    [carteira]
  );

  const periodoLabel = (() => {
    try {
      const di = new Date(dataInicio + "T00:00:00");
      const df = new Date(dataFim + "T00:00:00");
      const fmtD = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      return `${fmtD(di)} a ${fmtD(df)}`;
    } catch { return "Periodo"; }
  })();

  const contasFiltradas = useMemo(() => {
    if (filtroOrigem === "TODOS") return contasDisponiveis;
    return contasDisponiveis.filter((c) => c.origem === filtroOrigem);
  }, [contasDisponiveis, filtroOrigem]);

  const toggleConta = (id: number) => {
    setContasSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "geral", label: "VISAO GERAL" },
    { id: "receitas", label: "RECEITAS" },
    { id: "despesas", label: "DESPESAS" },
    { id: "graficos", label: "GRAFICOS" },
  ];

  function renderAnaliseTab(
    data: any,
    carregando: boolean,
    chartType: ChartType,
    setChartType: (t: ChartType) => void,
    titulo: string,
    cor: string,
  ) {
    if (carregando) return <div className="empty-state">Carregando dados...</div>;
    if (!data) return <div className="empty-state">Nenhum dado encontrado no periodo.</div>;

    const { contas, mesesLabels, totalGeral, mediaGeral, topConta } = data;
    const isPie = chartType === "pie" || chartType === "doughnut";

    return (
      <>
        <section className="summary-cards">
          <div className="summary-card">
            <span className="summary-label">Total {titulo}</span>
            <strong className="summary-value" style={{ color: cor }}>{formatMoney(totalGeral)}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Media Mensal</span>
            <strong className="summary-value">{formatMoney(mediaGeral)}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Maior Conta</span>
            <strong className="summary-value" style={{ fontSize: "0.95rem" }}>{topConta?.nome ?? "-"}</strong>
            <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{topConta ? formatMoney(topConta.total) : ""}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Contas Ativas</span>
            <strong className="summary-value">{contas?.length ?? 0}</strong>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Evolucao por conta</h3>
            <ChartTypeSelector value={chartType} onChange={setChartType} />
          </div>
          {isPie ? (
            <RenderChart
              tipo={chartType}
              labels={(contas ?? []).map((c: any) => c.conta)}
              datasets={[{ label: titulo, data: (contas ?? []).map((c: any) => c.total) }]}
              height={350}
            />
          ) : (
            <RenderChart
              tipo={chartType}
              labels={mesesLabels ?? []}
              datasets={(contas ?? []).slice(0, 8).map((c: any, i: number) => ({
                label: c.conta,
                data: (data.meses ?? []).map((m: string) => c.meses?.[m] ?? 0),
                backgroundColor: CORES[i % CORES.length],
                borderColor: CORES[i % CORES.length],
              }))}
              height={350}
            />
          )}
        </section>

        <section className="panel" style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>Detalhamento por conta</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table mobile-cards">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Conta</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Media</th>
                  <th style={{ textAlign: "right" }}>% Participacao</th>
                </tr>
              </thead>
              <tbody>
                {(contas ?? []).map((c: any) => (
                  <tr key={c.contaId}>
                    <td data-label="Conta" style={{ fontWeight: 600 }}>{c.conta}</td>
                    <td data-label="Total" style={{ color: cor }}>{formatMoney(c.total)}</td>
                    <td data-label="Media">{formatMoney(c.media)}</td>
                    <td data-label="% Part.">{totalGeral > 0 ? ((c.total / totalGeral) * 100).toFixed(1) : "0"}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
                  <td>TOTAL</td>
                  <td style={{ color: cor }}>{formatMoney(totalGeral)}</td>
                  <td>{formatMoney(mediaGeral)}</td>
                  <td>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </>
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
        <main className="page-content-card" style={{ background: "transparent", boxShadow: "none", padding: 0 }}>
          <section className="summary-cards">
            <div className="summary-card" style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)", color: "#fff" }}>
              <span className="summary-label" style={{ color: "#94a3b8" }}>Saldo em Caixa</span>
              <strong className="summary-value" style={{ color: "#fff" }}>{formatMoney(carteiraSelecionada.saldo)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Entradas</span>
              <strong className="summary-value" style={{ color: "#059669" }}>{formatMoney(carteiraSelecionada.entradas)}</strong>
              <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>Receitas ({periodoLabel})</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Saidas</span>
              <strong className="summary-value" style={{ color: "#dc2626" }}>{formatMoney(carteiraSelecionada.saidas)}</strong>
              <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>Despesas ({periodoLabel})</span>
            </div>
            <div className="summary-card" style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
              <span className="summary-label">Periodo</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="form-input" style={{ fontSize: "0.8rem", padding: "4px 6px", flex: 1, minWidth: 110 }} />
                <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>a</span>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="form-input" style={{ fontSize: "0.8rem", padding: "4px 6px", flex: 1, minWidth: 110 }} />
              </div>
            </div>
          </section>

          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", marginTop: 16 }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 20px",
                  fontSize: "0.85rem",
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  color: activeTab === tab.id ? "#1e293b" : "#6b7280",
                  background: activeTab === tab.id ? "#fff" : "transparent",
                  border: "none",
                  borderBottom: activeTab === tab.id ? "2px solid #1e293b" : "2px solid transparent",
                  marginBottom: -2,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            {activeTab === "geral" && (
              <div className="split-view">
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className="panel">
                    <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>Evolucao Mensal</h3>
                    {evolucao.length > 0 ? (
                      <RenderChart
                        tipo="bar"
                        labels={evolucao.map((e) => e.label)}
                        datasets={[
                          { label: "Receitas", data: evolucao.map((e) => e.receitas), backgroundColor: "#059669" },
                          { label: "Despesas", data: evolucao.map((e) => e.despesas), backgroundColor: "#dc2626" },
                        ]}
                        height={280}
                      />
                    ) : (
                      <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>Sem dados no periodo.</p>
                    )}
                  </div>
                  <div className="panel">
                    <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>Indicadores de Performance</h3>
                    <div className="summary-cards">
                      {indicadores.map((ind, idx) => (
                        <div key={idx} className="detail-card" style={{ padding: "12px 16px" }}>
                          <span className="detail-label">{ind.titulo}</span>
                          <strong style={{ fontSize: "1.15rem", color: "#111827" }}>{ind.valor}</strong>
                          <span style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 4 }}>{ind.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className="panel">
                    <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>Atencao Necessaria</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div className="detail-card" style={{ borderLeft: "4px solid #dc2626", padding: "12px 16px" }}>
                        <span className="detail-label" style={{ color: "#dc2626" }}>Contas Vencidas</span>
                        <strong style={{ fontSize: "1.15rem", color: "#991b1b" }}>{formatMoney(alertas.vencidos)}</strong>
                      </div>
                      <div className="detail-card" style={{ borderLeft: "4px solid #f59e0b", padding: "12px 16px" }}>
                        <span className="detail-label" style={{ color: "#d97706" }}>Saidas Previstas</span>
                        <strong style={{ fontSize: "1.15rem", color: "#92400e" }}>{formatMoney(alertas.saidasPeriodo)}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="panel">
                    <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>Movimentacao por Empresa</h3>
                    <table className="data-table mobile-cards">
                      <thead>
                        <tr>
                          <th>Empresa</th>
                          <th style={{ textAlign: "right" }}>Entradas</th>
                          <th style={{ textAlign: "right" }}>Saidas</th>
                          <th style={{ textAlign: "right" }}>Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {carteira.map((c, i) => (
                          <tr key={i}>
                            <td data-label="Empresa" style={{ fontWeight: 600 }}>{c.empresa}</td>
                            <td data-label="Entradas" style={{ color: "#059669" }}>{formatMoney(c.entradas)}</td>
                            <td data-label="Saidas" style={{ color: "#dc2626" }}>{formatMoney(c.saidas)}</td>
                            <td data-label="Resultado" style={{ fontWeight: 700 }}>{formatMoney(c.entradas - c.saidas)}</td>
                          </tr>
                        ))}
                        {carteira.length === 0 && !carregandoGeral && (
                          <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>Nenhum movimento.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="panel">
                    <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem", fontWeight: 600 }}>Links Rapidos</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <a href="/financeiro/lancamentos" className="button button-secondary" style={{ textAlign: "left", textDecoration: "none" }}>Lancamentos Financeiros</a>
                      <a href="/financeiro/dre" className="button button-secondary" style={{ textAlign: "left", textDecoration: "none" }}>Relatorio DRE</a>
                      <a href="/financeiro/objetivos" className="button button-secondary" style={{ textAlign: "left", textDecoration: "none" }}>Objetivos Financeiros</a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "receitas" && renderAnaliseTab(receitasData, carregandoReceitas, chartTypeReceitas, setChartTypeReceitas, "Receitas", "#059669")}

            {activeTab === "despesas" && renderAnaliseTab(despesasData, carregandoDespesas, chartTypeDespesas, setChartTypeDespesas, "Despesas", "#dc2626")}

            {activeTab === "graficos" && (
              <>
                <section className="panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Cruzamento de Contas</h3>
                      <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
                        Selecione contas para comparar evolucao e tendencias
                      </p>
                    </div>
                    <ChartTypeSelector value={chartTypeGraficos} onChange={setChartTypeGraficos} />
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    {(["TODOS", "PLANO_CONTAS", "DRE"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={filtroOrigem === f ? "button button-primary button-compact" : "button button-secondary button-compact"}
                        onClick={() => setFiltroOrigem(f)}
                        style={{ fontSize: "0.75rem" }}
                      >
                        {f === "TODOS" ? "Todas" : f === "PLANO_CONTAS" ? "Plano de Contas" : "DRE"}
                      </button>
                    ))}
                  </div>

                  <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                    {contasFiltradas.length === 0 ? (
                      <p style={{ color: "#6b7280", fontSize: "0.85rem", textAlign: "center", padding: 12 }}>Nenhuma conta disponivel.</p>
                    ) : (
                      contasFiltradas.map((c) => (
                        <label key={`${c.origem}-${c.id}`} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", cursor: "pointer", fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            checked={contasSelecionadas.includes(c.id)}
                            onChange={() => toggleConta(c.id)}
                          />
                          <span style={{ fontWeight: 500 }}>{c.nome}</span>
                          <span className="badge" style={{
                            backgroundColor: c.natureza === "RECEITA" ? "#d1fae5" : c.natureza === "DESPESA" ? "#fee2e2" : "#f3f4f6",
                            color: c.natureza === "RECEITA" ? "#065f46" : c.natureza === "DESPESA" ? "#991b1b" : "#374151",
                            fontSize: "0.7rem",
                          }}>
                            {c.natureza}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{c.origem === "DRE" ? "DRE" : "Fin"}</span>
                        </label>
                      ))
                    )}
                  </div>

                  {contasSelecionadas.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: "0.75rem", color: "#6b7280" }}>
                      {contasSelecionadas.length} conta(s) selecionada(s)
                      <button
                        type="button"
                        onClick={() => setContasSelecionadas([])}
                        style={{ marginLeft: 8, color: "#dc2626", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: "0.75rem" }}
                      >
                        Limpar
                      </button>
                    </div>
                  )}
                </section>

                {carregandoGraficos ? (
                  <div className="panel" style={{ marginTop: 16 }}><div className="empty-state">Carregando grafico...</div></div>
                ) : cruzamentoData && cruzamentoData.series?.length > 0 ? (
                  <section className="panel" style={{ marginTop: 16 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>Comparativo de Contas</h3>
                    {(chartTypeGraficos === "pie" || chartTypeGraficos === "doughnut") ? (
                      <RenderChart
                        tipo={chartTypeGraficos}
                        labels={cruzamentoData.series.map((s: any) => s.nome)}
                        datasets={[{
                          label: "Total",
                          data: cruzamentoData.series.map((s: any) => s.valores.reduce((a: number, b: number) => a + Math.abs(b), 0)),
                        }]}
                        height={350}
                      />
                    ) : (
                      <RenderChart
                        tipo={chartTypeGraficos}
                        labels={cruzamentoData.mesesLabels}
                        datasets={cruzamentoData.series.map((s: any, i: number) => ({
                          label: s.nome,
                          data: s.valores,
                          backgroundColor: CORES[i % CORES.length],
                          borderColor: CORES[i % CORES.length],
                        }))}
                        height={350}
                      />
                    )}

                    <div style={{ marginTop: 16, overflowX: "auto" }}>
                      <table className="data-table mobile-cards">
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left" }}>Conta</th>
                            {(cruzamentoData.mesesLabels ?? []).map((m: string) => (
                              <th key={m} style={{ textAlign: "right" }}>{m}</th>
                            ))}
                            <th style={{ textAlign: "right" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cruzamentoData.series.map((s: any, i: number) => (
                            <tr key={s.contaId}>
                              <td data-label="Conta" style={{ fontWeight: 600, color: CORES[i % CORES.length] }}>{s.nome}</td>
                              {s.valores.map((v: number, j: number) => (
                                <td key={j} data-label={cruzamentoData.mesesLabels[j]}>{formatMoney(v)}</td>
                              ))}
                              <td data-label="Total" style={{ fontWeight: 700 }}>
                                {formatMoney(s.valores.reduce((a: number, b: number) => a + b, 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : contasSelecionadas.length > 0 ? (
                  <div className="panel" style={{ marginTop: 16 }}>
                    <div className="empty-state">Nenhum dado para as contas selecionadas no periodo.</div>
                  </div>
                ) : (
                  <div className="panel" style={{ marginTop: 16 }}>
                    <div className="empty-state">Selecione contas acima para visualizar o grafico comparativo.</div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}
