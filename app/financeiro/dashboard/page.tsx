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
type TopGasto = { contaId: number; contaNome: string; contaCodigo: string; total: number };
type Alertas = { entradasPeriodo: number; saidasPeriodo: number; topGastos: TopGasto[] };

interface ContaAnalise {
  contaId: number;
  conta: string;
  contaCodigo: string;
  natureza: string;
  paiId: number | null;
  grupoPaiNome: string | null;
  grupoPaiCodigo: string | null;
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
  codigo: string;
  natureza: string;
  paiId: number | null;
  origem: string;
}

interface LancamentoItem {
  id: number;
  data: string;
  descricao: string;
  valor: number;
  placa: string;
  contaId: number;
  contaNome: string;
  pessoaNome: string;
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

// Group accounts by root parent for tree view
function agruparPorPai(contas: ContaAnalise[]): { grupo: string; contas: ContaAnalise[]; total: number }[] {
  const grupos = new Map<string, { contas: ContaAnalise[]; total: number }>();

  for (const conta of contas) {
    const grupoKey = conta.grupoPaiNome
      ? `${conta.grupoPaiCodigo ?? ""} ${conta.grupoPaiNome}`
      : conta.conta;

    if (!grupos.has(grupoKey)) {
      grupos.set(grupoKey, { contas: [], total: 0 });
    }
    const g = grupos.get(grupoKey)!;
    g.contas.push(conta);
    g.total += conta.total;
  }

  return Array.from(grupos.entries())
    .map(([grupo, data]) => ({ grupo, contas: data.contas, total: data.total }))
    .sort((a, b) => b.total - a.total);
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
  // Periodo ativo: only updates when user clicks "Atualizar" (prevents auto-fetch on period change)
  const [periodoAtivo, setPeriodoAtivo] = useState({ inicio: defaultDataInicio(), fim: defaultDataFim() });

  const [carteira, setCarteira] = useState<ResumoCarteira[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [alertas, setAlertas] = useState<Alertas>({ entradasPeriodo: 0, saidasPeriodo: 0, topGastos: [] });
  const [carregandoGeral, setCarregandoGeral] = useState(true);

  const [receitasData, setReceitasData] = useState<any>(null);
  const [despesasData, setDespesasData] = useState<any>(null);
  const [chartTypeReceitas, setChartTypeReceitas] = useState<ChartType>("bar");
  const [chartTypeDespesas, setChartTypeDespesas] = useState<ChartType>("bar");
  const [carregandoReceitas, setCarregandoReceitas] = useState(false);
  const [carregandoDespesas, setCarregandoDespesas] = useState(false);
  const [buscaReceitas, setBuscaReceitas] = useState("");
  const [buscaDespesas, setBuscaDespesas] = useState("");

  const [evolucao, setEvolucao] = useState<EvolucaoMes[]>([]);

  const [contasDisponiveis, setContasDisponiveis] = useState<ContaOpcao[]>([]);
  const [contasSelecionadas, setContasSelecionadas] = useState<number[]>([]);
  const [cruzamentoData, setCruzamentoData] = useState<any>(null);
  const [chartTypeGraficos, setChartTypeGraficos] = useState<ChartType>("line");
  const [carregandoGraficos, setCarregandoGraficos] = useState(false);
  const [filtroOrigem, setFiltroOrigem] = useState<"PLANO_CONTAS" | "DRE">("PLANO_CONTAS");
  const [buscaCruzamento, setBuscaCruzamento] = useState("");

  // Edit modal
  const [lancamentoEditando, setLancamentoEditando] = useState<LancamentoItem | null>(null);
  const [editForm, setEditForm] = useState({ descricao: "", valor: "", placa: "" });
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  // Lancamento listing
  const [lancamentos, setLancamentos] = useState<LancamentoItem[]>([]);
  const [buscaLancamentos, setBuscaLancamentos] = useState("");
  const [contaIdFiltro, setContaIdFiltro] = useState<number | null>(null);
  const [contaNomeFiltro, setContaNomeFiltro] = useState<string>("");
  const [carregandoLancamentos, setCarregandoLancamentos] = useState(false);
  const [mostrarLancamentos, setMostrarLancamentos] = useState(false);

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    if (empresa?.id) h["x-empresa-id"] = String(empresa.id);
    return h;
  }, [empresa?.id]);

  const fetchAnalise = useCallback(async (tipo: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams({ dataInicio: periodoAtivo.inicio, dataFim: periodoAtivo.fim, tipo, ...extra });
    const res = await fetch(`/api/financeiro/dashboard/analise?${params}`, { headers });
    const json = await res.json();
    return json?.success ? json.data : null;
  }, [periodoAtivo.inicio, periodoAtivo.fim, headers]);

  const handleAtualizar = () => {
    setPeriodoAtivo({ inicio: dataInicio, fim: dataFim });
  };

  useEffect(() => {
    if (!empresa?.id) return;
    const load = async () => {
      setCarregandoGeral(true);
      try {
        const params = new URLSearchParams({ dataInicio: periodoAtivo.inicio, dataFim: periodoAtivo.fim });
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
  }, [empresa?.id, periodoAtivo.inicio, periodoAtivo.fim, headers]);

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

  // Load lancamentos - direct fetch instead of going through fetchAnalise to avoid stale closures
  async function carregarLancamentos(busca?: string, contaId?: number | null) {
    if (!empresa?.id) return;
    setCarregandoLancamentos(true);
    try {
      const params = new URLSearchParams({
        dataInicio: periodoAtivo.inicio,
        dataFim: periodoAtivo.fim,
        tipo: "lancamentos",
      });
      if (busca && busca.trim().length >= 3) params.set("busca", busca.trim());
      if (contaId) params.set("contaId", String(contaId));
      const res = await fetch(`/api/financeiro/dashboard/analise?${params}`, {
        headers: { "x-empresa-id": String(empresa.id) },
      });
      const json = await res.json();
      if (json?.success && json.data) {
        setLancamentos(json.data);
      } else {
        setLancamentos([]);
      }
    } catch (e) {
      console.error("Erro ao carregar lancamentos:", e);
      setLancamentos([]);
    } finally {
      setCarregandoLancamentos(false);
    }
  }

  const carteiraSelecionada = useMemo(
    () => carteira[0] || { empresa: "", saldo: 0, entradas: 0, saidas: 0 },
    [carteira]
  );

  const periodoLabel = (() => {
    try {
      const di = new Date(periodoAtivo.inicio + "T00:00:00");
      const df = new Date(periodoAtivo.fim + "T00:00:00");
      const fmtD = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      return `${fmtD(di)} a ${fmtD(df)}`;
    } catch { return "Periodo"; }
  })();

  const contasFiltradas = useMemo(() => {
    let lista = contasDisponiveis.filter((c) => c.origem === filtroOrigem);
    if (buscaCruzamento.trim().length >= 3) {
      const b = buscaCruzamento.toLowerCase();
      lista = lista.filter((c) => `${c.codigo} ${c.nome}`.toLowerCase().includes(b));
    }
    return lista;
  }, [contasDisponiveis, filtroOrigem, buscaCruzamento]);

  // Group cruzamento accounts by parent
  const contasAgrupadasCruz = useMemo(() => {
    const grupos = new Map<string, ContaOpcao[]>();
    for (const c of contasFiltradas) {
      let parentLabel = "";
      if (c.paiId) {
        const parent = contasDisponiveis.find((p) => p.id === c.paiId && p.origem === c.origem);
        parentLabel = parent ? `${parent.codigo} ${parent.nome}` : "Outros";
      }
      const groupKey = c.paiId ? parentLabel : `${c.codigo} ${c.nome}`;
      if (!grupos.has(groupKey)) grupos.set(groupKey, []);
      grupos.get(groupKey)!.push(c);
    }
    return Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [contasFiltradas, contasDisponiveis]);

  const toggleConta = (id: number) => {
    setContasSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleEditarLancamento = (lanc: LancamentoItem) => {
    setLancamentoEditando(lanc);
    setEditForm({
      descricao: lanc.descricao,
      valor: String(Math.abs(lanc.valor)),
      placa: lanc.placa,
    });
  };

  const handleSalvarEdit = async () => {
    if (!lancamentoEditando || !empresa?.id) return;
    setSalvandoEdit(true);
    try {
      const valorNum = parseFloat(editForm.valor.replace(",", "."));
      const valorFinal = lancamentoEditando.valor >= 0 ? Math.abs(valorNum) : -Math.abs(valorNum);

      const resp = await fetch(`/api/financeiro/lancamentos?id=${lancamentoEditando.id}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          data: lancamentoEditando.data,
          descricao: editForm.descricao,
          valor: valorFinal,
          planoContaId: lancamentoEditando.contaId,
          placa: editForm.placa,
        }),
      });
      const json = await resp.json();
      if (json.success) {
        setLancamentoEditando(null);
        if (mostrarLancamentos) { carregarLancamentos(buscaLancamentos, contaIdFiltro); }
        if (activeTab === "receitas") {
          setCarregandoReceitas(true);
          fetchAnalise("receitas").then((d) => { setReceitasData(d); setCarregandoReceitas(false); });
        } else if (activeTab === "despesas") {
          setCarregandoDespesas(true);
          fetchAnalise("despesas").then((d) => { setDespesasData(d); setCarregandoDespesas(false); });
        }
      }
    } catch (err) {
      console.error("Erro ao salvar:", err);
    } finally {
      setSalvandoEdit(false);
    }
  };

  const handleVerLancamentos = (contaId?: number, contaNome?: string) => {
    setContaIdFiltro(contaId ?? null);
    setContaNomeFiltro(contaNome ?? "");
    setMostrarLancamentos(true);
    setBuscaLancamentos("");
    carregarLancamentos("", contaId ?? null);
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
    busca: string,
    setBusca: (s: string) => void,
  ) {
    if (carregando) return <div className="empty-state">Carregando dados...</div>;
    if (!data) return <div className="empty-state">Nenhum dado encontrado no periodo.</div>;

    const { contas, mesesLabels, totalGeral, mediaGeral, topConta } = data;
    const contasTyped = (contas ?? []) as ContaAnalise[];
    const isPie = chartType === "pie" || chartType === "doughnut";

    const contasFilt = busca.trim().length >= 3
      ? contasTyped.filter((c) => `${c.contaCodigo} ${c.conta}`.toLowerCase().includes(busca.toLowerCase()))
      : contasTyped;

    const grupos = agruparPorPai(contasFilt);

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
            <strong className="summary-value">{contasTyped.length}</strong>
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
              labels={contasFilt.map((c) => c.conta)}
              datasets={[{ label: titulo, data: contasFilt.map((c) => c.total) }]}
              height={350}
            />
          ) : (
            <RenderChart
              tipo={chartType}
              labels={mesesLabels ?? []}
              datasets={contasFilt.slice(0, 8).map((c, i) => ({
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Detalhamento por conta</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="form-input"
                placeholder="Buscar conta..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ width: 200, fontSize: "0.82rem", padding: "6px 10px" }}
              />
              <button
                type="button"
                className="button button-secondary button-compact"
                onClick={() => handleVerLancamentos()}
                style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}
              >
                Ver Lancamentos
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table mobile-cards">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Conta</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Media</th>
                  <th style={{ textAlign: "right" }}>% Part.</th>
                  <th style={{ textAlign: "center", width: 60 }}>Det.</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <React.Fragment key={g.grupo}>
                    {g.contas.length > 1 && (
                      <tr style={{ backgroundColor: "#f1f5f9", fontWeight: 700 }}>
                        <td style={{ paddingLeft: 8 }}>{g.grupo}</td>
                        <td style={{ textAlign: "right", color: cor }}>{formatMoney(g.total)}</td>
                        <td style={{ textAlign: "right" }}></td>
                        <td style={{ textAlign: "right" }}>{totalGeral > 0 ? ((g.total / totalGeral) * 100).toFixed(1) : "0"}%</td>
                        <td></td>
                      </tr>
                    )}
                    {g.contas.map((c) => (
                      <tr key={c.contaId}>
                        <td data-label="Conta" style={{ fontWeight: g.contas.length > 1 ? 400 : 600, paddingLeft: g.contas.length > 1 ? 24 : 8 }}>
                          {c.contaCodigo ? `${c.contaCodigo} ` : ""}{c.conta}
                        </td>
                        <td data-label="Total" style={{ textAlign: "right", color: cor }}>{formatMoney(c.total)}</td>
                        <td data-label="Media" style={{ textAlign: "right" }}>{formatMoney(c.media)}</td>
                        <td data-label="% Part." style={{ textAlign: "right" }}>{totalGeral > 0 ? ((c.total / totalGeral) * 100).toFixed(1) : "0"}%</td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="button button-secondary button-compact"
                            style={{ fontSize: "0.7rem", padding: "2px 6px" }}
                            onClick={() => handleVerLancamentos(c.contaId, `${c.contaCodigo ? c.contaCodigo + " " : ""}${c.conta}`)}
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
                  <td>TOTAL</td>
                  <td style={{ textAlign: "right", color: cor }}>{formatMoney(totalGeral)}</td>
                  <td style={{ textAlign: "right" }}>{formatMoney(mediaGeral)}</td>
                  <td style={{ textAlign: "right" }}>100%</td>
                  <td></td>
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
              <button
                type="button"
                className="button button-primary button-compact"
                onClick={handleAtualizar}
                style={{ fontSize: "0.8rem", padding: "6px 16px", marginTop: 2 }}
              >
                Atualizar
              </button>
            </div>
          </section>

          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", marginTop: 16 }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setMostrarLancamentos(false); }}
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
                    <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>5 Maiores Gastos</h3>
                    {alertas.topGastos && alertas.topGastos.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {alertas.topGastos.map((g, idx) => (
                          <div
                            key={g.contaId}
                            className="detail-card"
                            style={{
                              borderLeft: `4px solid ${CORES[idx % CORES.length]}`,
                              padding: "10px 14px",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                            onClick={() => {
                              setActiveTab("despesas");
                              setMostrarLancamentos(true);
                              setContaIdFiltro(g.contaId);
                              setContaNomeFiltro(`${g.contaCodigo ? g.contaCodigo + " " : ""}${g.contaNome}`);
                              setBuscaLancamentos("");
                              carregarLancamentos("", g.contaId);
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>
                                {g.contaCodigo ? `${g.contaCodigo} ` : ""}{g.contaNome}
                              </span>
                            </div>
                            <strong style={{ fontSize: "0.95rem", color: "#dc2626", whiteSpace: "nowrap", marginLeft: 8 }}>
                              {formatMoney(g.total)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>Nenhum gasto no periodo.</p>
                    )}
                  </div>
                  <div className="panel">
                    <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>Movimentacao por Empresa</h3>
                    <table className="data-table mobile-cards">
                      <thead>
                        <tr>
                          <th style={{ textAlign: "center" }}>Empresa</th>
                          <th style={{ textAlign: "center" }}>Entradas</th>
                          <th style={{ textAlign: "center" }}>Saidas</th>
                          <th style={{ textAlign: "center" }}>Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {carteira.map((c, i) => (
                          <tr key={i}>
                            <td data-label="Empresa" style={{ fontWeight: 600, textAlign: "center" }}>{c.empresa}</td>
                            <td data-label="Entradas" style={{ color: "#059669", textAlign: "center" }}>{formatMoney(c.entradas)}</td>
                            <td data-label="Saidas" style={{ color: "#dc2626", textAlign: "center" }}>{formatMoney(c.saidas)}</td>
                            <td data-label="Resultado" style={{ fontWeight: 700, textAlign: "center", color: (c.entradas - c.saidas) >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(c.entradas - c.saidas)}</td>
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

            {activeTab === "receitas" && !mostrarLancamentos && renderAnaliseTab(receitasData, carregandoReceitas, chartTypeReceitas, setChartTypeReceitas, "Receitas", "#059669", buscaReceitas, setBuscaReceitas)}

            {activeTab === "despesas" && !mostrarLancamentos && renderAnaliseTab(despesasData, carregandoDespesas, chartTypeDespesas, setChartTypeDespesas, "Despesas", "#dc2626", buscaDespesas, setBuscaDespesas)}

            {/* Lancamentos detail view */}
            {mostrarLancamentos && (activeTab === "receitas" || activeTab === "despesas") && (
              <section className="panel">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <button
                        type="button"
                        className="button button-secondary button-compact"
                        onClick={() => { setMostrarLancamentos(false); setContaIdFiltro(null); setContaNomeFiltro(""); }}
                        style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                      >
                        Voltar
                      </button>
                      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                        Movimentos Detalhados
                      </h3>
                    </div>
                    {contaNomeFiltro && (
                      <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 6,
                        padding: "6px 12px",
                        backgroundColor: activeTab === "receitas" ? "#ecfdf5" : "#fef2f2",
                        border: `1px solid ${activeTab === "receitas" ? "#a7f3d0" : "#fecaca"}`,
                        borderRadius: 6,
                        fontSize: "0.82rem",
                      }}>
                        <span style={{ color: "#6b7280" }}>Conta:</span>
                        <strong style={{ color: activeTab === "receitas" ? "#065f46" : "#991b1b" }}>{contaNomeFiltro}</strong>
                        <button
                          type="button"
                          onClick={() => { setContaIdFiltro(null); setContaNomeFiltro(""); carregarLancamentos(buscaLancamentos, null); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "1rem", padding: 0, lineHeight: 1 }}
                          title="Remover filtro de conta"
                        >
                          &times;
                        </button>
                      </div>
                    )}
                    {!contaNomeFiltro && (
                      <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
                        Todos os movimentos do periodo - clique em um lancamento para editar
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      className="form-input"
                      placeholder="Buscar descricao, placa, pessoa..."
                      value={buscaLancamentos}
                      onChange={(e) => {
                        setBuscaLancamentos(e.target.value);
                        if (e.target.value.trim().length >= 3 || e.target.value.trim().length === 0) {
                          carregarLancamentos(e.target.value, contaIdFiltro);
                        }
                      }}
                      style={{ width: 280, fontSize: "0.82rem", padding: "6px 10px" }}
                    />
                  </div>
                </div>

                {/* Summary cards */}
                {!carregandoLancamentos && lancamentos.length > 0 && (
                  <div className="summary-cards" style={{ marginBottom: 16 }}>
                    <div className="summary-card" style={{ padding: "10px 14px" }}>
                      <span className="summary-label" style={{ fontSize: "0.72rem" }}>Lancamentos</span>
                      <strong className="summary-value" style={{ fontSize: "1.1rem" }}>{lancamentos.length}</strong>
                    </div>
                    <div className="summary-card" style={{ padding: "10px 14px" }}>
                      <span className="summary-label" style={{ fontSize: "0.72rem" }}>Total Entradas</span>
                      <strong className="summary-value" style={{ fontSize: "1rem", color: "#059669" }}>
                        {formatMoney(lancamentos.filter((l) => l.valor >= 0).reduce((a, l) => a + l.valor, 0))}
                      </strong>
                    </div>
                    <div className="summary-card" style={{ padding: "10px 14px" }}>
                      <span className="summary-label" style={{ fontSize: "0.72rem" }}>Total Saidas</span>
                      <strong className="summary-value" style={{ fontSize: "1rem", color: "#dc2626" }}>
                        {formatMoney(Math.abs(lancamentos.filter((l) => l.valor < 0).reduce((a, l) => a + l.valor, 0)))}
                      </strong>
                    </div>
                    <div className="summary-card" style={{ padding: "10px 14px" }}>
                      <span className="summary-label" style={{ fontSize: "0.72rem" }}>Resultado</span>
                      <strong className="summary-value" style={{
                        fontSize: "1rem",
                        color: lancamentos.reduce((a, l) => a + l.valor, 0) >= 0 ? "#059669" : "#dc2626",
                      }}>
                        {formatMoney(lancamentos.reduce((a, l) => a + l.valor, 0))}
                      </strong>
                    </div>
                  </div>
                )}

                {carregandoLancamentos ? (
                  <div className="empty-state">Carregando lancamentos...</div>
                ) : lancamentos.length === 0 ? (
                  <div className="empty-state">Nenhum lancamento encontrado no periodo.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table mobile-cards">
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Data</th>
                          <th style={{ textAlign: "left" }}>Descricao</th>
                          <th style={{ textAlign: "left" }}>Conta</th>
                          <th style={{ textAlign: "left" }}>Pessoa</th>
                          <th style={{ textAlign: "left" }}>Placa</th>
                          <th style={{ textAlign: "right" }}>Valor</th>
                          <th style={{ width: 50 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lancamentos.map((l) => (
                          <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => handleEditarLancamento(l)}>
                            <td data-label="Data">{l.data}</td>
                            <td data-label="Descricao" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descricao}</td>
                            <td data-label="Conta">{l.contaNome}</td>
                            <td data-label="Pessoa">{l.pessoaNome || "-"}</td>
                            <td data-label="Placa">{l.placa || "-"}</td>
                            <td data-label="Valor" style={{ textAlign: "right", color: l.valor >= 0 ? "#059669" : "#dc2626", fontWeight: 600 }}>
                              {formatMoney(Math.abs(l.valor))}
                            </td>
                            <td>
                              <button type="button" className="button button-secondary button-compact" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                                Editar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

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

                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {(["PLANO_CONTAS", "DRE"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={filtroOrigem === f ? "button button-primary button-compact" : "button button-secondary button-compact"}
                        onClick={() => setFiltroOrigem(f)}
                        style={{ fontSize: "0.75rem" }}
                      >
                        {f === "PLANO_CONTAS" ? "Plano de Contas" : "DRE"}
                      </button>
                    ))}
                    <input
                      className="form-input"
                      placeholder="Buscar conta (min. 3 caracteres)..."
                      value={buscaCruzamento}
                      onChange={(e) => setBuscaCruzamento(e.target.value)}
                      style={{ flex: 1, minWidth: 200, fontSize: "0.82rem", padding: "6px 10px" }}
                    />
                  </div>

                  <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 0 }}>
                    {contasAgrupadasCruz.length === 0 ? (
                      <p style={{ color: "#6b7280", fontSize: "0.85rem", textAlign: "center", padding: 12 }}>
                        {buscaCruzamento.trim().length > 0 && buscaCruzamento.trim().length < 3 ? "Digite pelo menos 3 caracteres" : "Nenhuma conta disponivel."}
                      </p>
                    ) : (
                      contasAgrupadasCruz.map(([grupo, items]) => (
                        <div key={grupo}>
                          {items.length > 0 && items[0].paiId && (
                            <div style={{ padding: "6px 12px", backgroundColor: "#f1f5f9", fontWeight: 600, fontSize: "0.82rem", borderBottom: "1px solid #e5e7eb" }}>
                              {grupo}
                            </div>
                          )}
                          {items.map((c) => (
                            <label
                              key={`${c.origem}-${c.id}`}
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                padding: "6px 12px",
                                paddingLeft: c.paiId ? 28 : 12,
                                cursor: "pointer",
                                fontSize: "0.82rem",
                                borderBottom: "1px solid #f3f4f6",
                                backgroundColor: contasSelecionadas.includes(c.id) ? "#eff6ff" : "transparent",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={contasSelecionadas.includes(c.id)}
                                onChange={() => toggleConta(c.id)}
                              />
                              <span style={{ fontWeight: 500, minWidth: 50, color: "#6b7280", fontSize: "0.75rem" }}>{c.codigo}</span>
                              <span style={{ fontWeight: 500, flex: 1 }}>{c.nome}</span>
                              <span className="badge" style={{
                                backgroundColor: c.natureza === "RECEITA" ? "#d1fae5" : c.natureza === "DESPESA" ? "#fee2e2" : "#f3f4f6",
                                color: c.natureza === "RECEITA" ? "#065f46" : c.natureza === "DESPESA" ? "#991b1b" : "#374151",
                                fontSize: "0.65rem",
                              }}>
                                {c.natureza}
                              </span>
                              <span style={{ fontSize: "0.65rem", color: "#9ca3af" }}>{c.origem === "DRE" ? "DRE" : "Fin"}</span>
                            </label>
                          ))}
                        </div>
                      ))
                    )}
                  </div>

                  {contasSelecionadas.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: "0.75rem", color: "#6b7280" }}>
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
                                <td key={j} data-label={cruzamentoData.mesesLabels[j]} style={{ textAlign: "right" }}>{formatMoney(v)}</td>
                              ))}
                              <td data-label="Total" style={{ textAlign: "right", fontWeight: 700 }}>
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

        {/* Edit Modal */}
        {lancamentoEditando && (
          <div className="modal-overlay" onClick={() => setLancamentoEditando(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <div className="modal-header">
                <h3>Editar Lancamento</h3>
                <button type="button" className="modal-close" onClick={() => setLancamentoEditando(null)}>&times;</button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: 12, padding: "8px 12px", backgroundColor: "#f9fafb", borderRadius: 8, fontSize: "0.82rem" }}>
                  <div><strong>Data:</strong> {lancamentoEditando.data}</div>
                  <div><strong>Conta:</strong> {lancamentoEditando.contaNome}</div>
                  {lancamentoEditando.pessoaNome && <div><strong>Pessoa:</strong> {lancamentoEditando.pessoaNome}</div>}
                </div>
                <div className="form-group">
                  <label>Descricao</label>
                  <input
                    className="form-input"
                    value={editForm.descricao}
                    onChange={(e) => setEditForm((f) => ({ ...f, descricao: e.target.value }))}
                  />
                </div>
                <div className="form-grid two-columns">
                  <div className="form-group">
                    <label>Valor (R$)</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.valor}
                      onChange={(e) => setEditForm((f) => ({ ...f, valor: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Placa</label>
                    <input
                      className="form-input"
                      value={editForm.placa}
                      onChange={(e) => setEditForm((f) => ({ ...f, placa: e.target.value.toUpperCase() }))}
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button button-secondary" onClick={() => setLancamentoEditando(null)}>Cancelar</button>
                <button type="button" className="button button-primary" disabled={salvandoEdit} onClick={handleSalvarEdit}>
                  {salvandoEdit ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
