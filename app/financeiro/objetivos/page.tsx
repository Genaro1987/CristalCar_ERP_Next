"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";
import { NotificationBar } from "@/components/NotificationBar";

interface DreNode {
  id: number;
  paiId: number | null;
  codigo: string;
  nome: string;
  natureza: string;
  media: number;
  percentual: number;
  objetivo: number;
  filhos: DreNode[];
}

type TipoPeriodo = "mensal" | "trimestral" | "semestral" | "anual";
type TipoObjetivoVal = "ESTRUTURA_DRE" | "PLANO_CONTAS" | "CENTRO_CUSTO";

function formatMoney(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TIPO_PERIODO_LABELS: Record<TipoPeriodo, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

const TIPO_OBJETIVO_LABELS: Record<TipoObjetivoVal, string> = {
  ESTRUTURA_DRE: "DRE",
  PLANO_CONTAS: "Plano de Contas",
  CENTRO_CUSTO: "Centro de Custo",
};

function mesesNoPeriodo(tipo: TipoPeriodo): number {
  if (tipo === "mensal") return 1;
  if (tipo === "trimestral") return 3;
  if (tipo === "semestral") return 6;
  return 12;
}

function gerarOpcoesPeriodo(tipo: TipoPeriodo, ano: number): { valor: string; label: string }[] {
  if (tipo === "mensal") {
    return MESES_LABELS.map((m, i) => ({
      valor: `${ano}-${String(i + 1).padStart(2, "0")}`,
      label: `${m}/${ano}`,
    }));
  }
  if (tipo === "trimestral") {
    return [
      { valor: `${ano}-T1`, label: `1o Trim/${ano} (Jan-Mar)` },
      { valor: `${ano}-T2`, label: `2o Trim/${ano} (Abr-Jun)` },
      { valor: `${ano}-T3`, label: `3o Trim/${ano} (Jul-Set)` },
      { valor: `${ano}-T4`, label: `4o Trim/${ano} (Out-Dez)` },
    ];
  }
  if (tipo === "semestral") {
    return [
      { valor: `${ano}-S1`, label: `1o Sem/${ano} (Jan-Jun)` },
      { valor: `${ano}-S2`, label: `2o Sem/${ano} (Jul-Dez)` },
    ];
  }
  return [{ valor: `${ano}`, label: `Ano ${ano}` }];
}

function labelPeriodo(tipo: TipoPeriodo, ref: string): string {
  if (tipo === "mensal") {
    const parts = ref.split("-");
    if (parts.length === 2) {
      const m = Number(parts[1]) - 1;
      return `${MESES_LABELS[m] ?? ""}/${parts[0]}`;
    }
  }
  if (tipo === "trimestral") {
    const parts = ref.split("-");
    if (parts.length === 2) return `${parts[1].replace("T", "")}o Trimestre/${parts[0]}`;
  }
  if (tipo === "semestral") {
    const parts = ref.split("-");
    if (parts.length === 2) return `${parts[1].replace("S", "")}o Semestre/${parts[0]}`;
  }
  return `Ano ${ref}`;
}

/* ── Collect all leaf IDs from tree ── */
function coletarFolhas(nodes: DreNode[]): number[] {
  const ids: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.filhos.length === 0) {
      ids.push(n.id);
    } else {
      ids.push(...coletarFolhas(n.filhos));
    }
  }
  return ids;
}

/* ── Apply edited percentages and recalculate tree ── */
function recalcularArvore(node: DreNode, editados: Record<number, number>, multiplicador: number): DreNode {
  if (node.filhos.length === 0) {
    const pct = editados[node.id] ?? node.percentual;
    const mediaPeriodo = node.media * multiplicador;
    const objetivo = mediaPeriodo * (1 + pct / 100);
    return { ...node, percentual: pct, media: mediaPeriodo, objetivo };
  }

  const filhosRecalc = node.filhos.map((f) => recalcularArvore(f, editados, multiplicador));
  const mediaFilhos = filhosRecalc.reduce((acc, f) => acc + f.media, 0);
  const objetivoFilhos = filhosRecalc.reduce((acc, f) => acc + f.objetivo, 0);

  return {
    ...node,
    filhos: filhosRecalc,
    media: node.filhos.length > 0 ? mediaFilhos : node.media * multiplicador,
    objetivo: node.filhos.length > 0 ? objetivoFilhos : node.objetivo,
  };
}

/* ── Desktop tree row ── */
function ObjetivoLinhaRow({
  node,
  nivel,
  editados,
  onChangePercent,
  onChangeValor,
}: {
  node: DreNode;
  nivel: number;
  editados: Record<number, number>;
  onChangePercent: (id: number, val: string) => void;
  onChangeValor: (id: number, val: string, media: number) => void;
}) {
  const [aberto, setAberto] = useState(true);
  const temFilhos = node.filhos.length > 0;
  const paddingLeft = nivel * 20 + 8;
  const isFolha = !temFilhos;
  const variacao = node.objetivo - node.media;
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
        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatMoney(node.media)}</td>
        <td style={{ textAlign: "center" }}>
          {isFolha ? (
            <input
              type="number"
              className="form-input"
              style={{ width: 80, textAlign: "center", padding: "4px 8px", margin: "0 auto", display: "block" }}
              value={editados[node.id] ?? node.percentual}
              onChange={(e) => onChangePercent(node.id, e.target.value)}
              step={1}
            />
          ) : (
            <span style={{ color: "#9ca3af", fontSize: "0.82rem" }}>--</span>
          )}
        </td>
        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {isFolha ? (
            <input
              type="number"
              className="form-input"
              style={{ width: 120, textAlign: "right", padding: "4px 8px", fontWeight: 600 }}
              value={Number(node.objetivo.toFixed(2))}
              onChange={(e) => onChangeValor(node.id, e.target.value, node.media)}
              step={0.01}
            />
          ) : (
            <span style={{ fontWeight: 600 }}>{formatMoney(node.objetivo)}</span>
          )}
        </td>
        <td
          style={{
            textAlign: "right",
            whiteSpace: "nowrap",
            color: variacao >= 0 ? "#059669" : "#dc2626",
          }}
        >
          {variacao >= 0 ? "+" : ""}
          {formatMoney(variacao)}
        </td>
      </tr>
      {aberto &&
        node.filhos.map((filho) => (
          <ObjetivoLinhaRow
            key={filho.id}
            node={filho}
            nivel={nivel + 1}
            editados={editados}
            onChangePercent={onChangePercent}
            onChangeValor={onChangeValor}
          />
        ))}
    </>
  );
}

/* ── Mobile tree card ── */
function ObjetivoLinhaCard({
  node,
  nivel,
  editados,
  onChangePercent,
  onChangeValor,
}: {
  node: DreNode;
  nivel: number;
  editados: Record<number, number>;
  onChangePercent: (id: number, val: string) => void;
  onChangeValor: (id: number, val: string, media: number) => void;
}) {
  const [aberto, setAberto] = useState(nivel === 0);
  const temFilhos = node.filhos.length > 0;
  const isFolha = !temFilhos;
  const variacao = node.objetivo - node.media;
  const corNatureza =
    node.natureza === "RECEITA" ? "#059669" : node.natureza === "DESPESA" ? "#dc2626" : "#6b7280";
  const levelClass = `dre-card-level-${Math.min(nivel, 3)}`;

  return (
    <>
      <div className={`dre-card ${levelClass}`}>
        <div
          className="dre-card-header"
          onClick={() => temFilhos && setAberto((v) => !v)}
          style={{ cursor: temFilhos ? "pointer" : "default" }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dre-card-title">
              {temFilhos && (
                <span style={{ marginRight: 4, color: "#9ca3af" }}>{aberto ? "\u25BC" : "\u25B6"}</span>
              )}
              {node.codigo ? `${node.codigo} - ` : ""}
              {node.nome}
            </div>
            <div className="dre-card-meta">
              <span
                className="badge"
                style={{
                  backgroundColor:
                    node.natureza === "RECEITA" ? "#dcfce7" : node.natureza === "DESPESA" ? "#fee2e2" : "#f3f4f6",
                  color: corNatureza,
                }}
              >
                {node.natureza}
              </span>
            </div>
          </div>
        </div>

        <div className="dre-card-periodos">
          <div className="dre-card-periodo-item">
            <span className="dre-card-periodo-label">Base</span>
            <span className="dre-card-periodo-valor">{formatMoney(node.media)}</span>
          </div>
          {isFolha && (
            <div className="dre-card-periodo-item" style={{ alignItems: "center" }}>
              <span className="dre-card-periodo-label">Cresc. %</span>
              <input
                type="number"
                className="form-input"
                style={{ width: 70, textAlign: "center", padding: "4px 6px" }}
                value={editados[node.id] ?? node.percentual}
                onChange={(e) => onChangePercent(node.id, e.target.value)}
                step={1}
              />
            </div>
          )}
          <div className="dre-card-periodo-item">
            <span className="dre-card-periodo-label">Objetivo</span>
            {isFolha ? (
              <input
                type="number"
                className="form-input"
                style={{ width: 100, textAlign: "right", padding: "4px 6px", fontWeight: 600 }}
                value={Number(node.objetivo.toFixed(2))}
                onChange={(e) => onChangeValor(node.id, e.target.value, node.media)}
                step={0.01}
              />
            ) : (
              <span className="dre-card-periodo-valor" style={{ fontWeight: 600 }}>
                {formatMoney(node.objetivo)}
              </span>
            )}
          </div>
          <div className="dre-card-periodo-item">
            <span className="dre-card-periodo-label">Variacao</span>
            <span
              className="dre-card-periodo-valor"
              style={{ color: variacao >= 0 ? "#059669" : "#dc2626" }}
            >
              {variacao >= 0 ? "+" : ""}
              {formatMoney(variacao)}
            </span>
          </div>
        </div>
      </div>

      {aberto &&
        temFilhos &&
        node.filhos.map((filho) => (
          <ObjetivoLinhaCard
            key={filho.id}
            node={filho}
            nivel={nivel + 1}
            editados={editados}
            onChangePercent={onChangePercent}
            onChangeValor={onChangeValor}
          />
        ))}
    </>
  );
}

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
  const anoAtual = new Date().getFullYear();

  // Tipo de objetivo (DRE / Plano de Contas / Centro de Custo)
  const [tipoObjetivo, setTipoObjetivo] = useState<TipoObjetivoVal>("ESTRUTURA_DRE");

  // Reference period (for media calculation)
  const [mesInicio, setMesInicio] = useState(Math.max(1, mesAtual - 2));
  const [mesFim, setMesFim] = useState(mesAtual);
  const [anoRef, setAnoRef] = useState(anoAtual);

  // Objective period configuration
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>("mensal");
  const [anoObjetivo, setAnoObjetivo] = useState(anoAtual);
  const [refPeriodo, setRefPeriodo] = useState("");

  const [arvoreOriginal, setArvoreOriginal] = useState<DreNode[]>([]);
  const [percentuaisEditados, setPercentuaisEditados] = useState<Record<number, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(
    null
  );
  const [pctGlobal, setPctGlobal] = useState("");

  const multiplicador = mesesNoPeriodo(tipoPeriodo);

  const opcoesPeriodo = useMemo(() => gerarOpcoesPeriodo(tipoPeriodo, anoObjetivo), [tipoPeriodo, anoObjetivo]);

  // Set default period when type or year changes
  useEffect(() => {
    const opcoes = gerarOpcoesPeriodo(tipoPeriodo, anoObjetivo);
    if (tipoPeriodo === "mensal") {
      const mesAtualRef = `${anoObjetivo}-${String(mesAtual).padStart(2, "0")}`;
      const temMesAtual = opcoes.some((o) => o.valor === mesAtualRef);
      setRefPeriodo(temMesAtual ? mesAtualRef : opcoes[0]?.valor ?? "");
    } else {
      setRefPeriodo(opcoes[0]?.valor ?? "");
    }
  }, [tipoPeriodo, anoObjetivo, mesAtual]);

  // Clear edited percentages when tipo changes
  useEffect(() => {
    setPercentuaisEditados({});
  }, [tipoObjetivo]);

  const periodoLabel = useMemo(() => {
    if (!refPeriodo) return "";
    return labelPeriodo(tipoPeriodo, refPeriodo);
  }, [tipoPeriodo, refPeriodo]);

  const tipoLabel = TIPO_OBJETIVO_LABELS[tipoObjetivo];

  const mesesRef = useMemo(() => {
    if (mesFim >= mesInicio) return mesFim - mesInicio + 1;
    return 12 - mesInicio + 1 + mesFim;
  }, [mesInicio, mesFim]);

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (empresa?.id) headers["x-empresa-id"] = String(empresa.id);
    return headers;
  }, [empresa?.id]);

  const carregarDados = useCallback(async () => {
    if (!empresa?.id) return;
    try {
      setCarregando(true);
      const params = new URLSearchParams({
        anoRef: String(anoRef),
        mesInicio: String(mesInicio),
        mesFim: String(mesFim),
        anoObjetivo: String(anoObjetivo),
      });

      const resp = await fetch(`/api/financeiro/objetivos/dre?${params}&tipo=${tipoObjetivo}`, {
        headers: headersPadrao,
      });
      const json = await resp.json();

      if (json?.success) {
        const dados: DreNode[] = json.data ?? [];
        setArvoreOriginal(dados);

        const editados: Record<number, number> = {};
        const extrairPcts = (nodes: DreNode[]) => {
          for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            if (n.filhos.length === 0) {
              editados[n.id] = n.percentual;
            } else {
              extrairPcts(n.filhos);
            }
          }
        };
        extrairPcts(dados);
        setPercentuaisEditados(editados);
      }
    } catch (err) {
      console.error("Erro ao carregar objetivos DRE:", err);
    } finally {
      setCarregando(false);
    }
  }, [empresa?.id, headersPadrao, anoRef, mesInicio, mesFim, anoObjetivo, tipoObjetivo]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Recalculate tree with edited percentages and period multiplier
  const arvoreCalculada = useMemo(() => {
    return arvoreOriginal.map((n) => recalcularArvore(n, percentuaisEditados, multiplicador));
  }, [arvoreOriginal, percentuaisEditados, multiplicador]);

  const totalMedia = useMemo(() => arvoreCalculada.reduce((acc, n) => acc + n.media, 0), [arvoreCalculada]);
  const totalObjetivo = useMemo(
    () => arvoreCalculada.reduce((acc, n) => acc + n.objetivo, 0),
    [arvoreCalculada]
  );

  const handlePercentualChange = (id: number, valor: string) => {
    const num = valor === "" || valor === "-" ? 0 : Number(valor);
    setPercentuaisEditados((prev) => ({ ...prev, [id]: num }));
  };

  const handleValorChange = (id: number, valorStr: string, media: number) => {
    const valorObj = valorStr === "" || valorStr === "-" ? 0 : Number(valorStr);
    const pct = media !== 0 ? ((valorObj / media) - 1) * 100 : 0;
    setPercentuaisEditados((prev) => ({ ...prev, [id]: Math.round(pct * 100) / 100 }));
  };

  const salvarObjetivos = async () => {
    if (!empresa?.id || !refPeriodo) return;
    setSalvando(true);
    setNotification(null);
    try {
      const percentuais = Object.entries(percentuaisEditados).map(([id, pct]) => ({
        dreId: Number(id),
        percentual: pct,
      }));

      const resp = await fetch("/api/financeiro/objetivos/dre", {
        method: "POST",
        headers: headersPadrao,
        body: JSON.stringify({
          ano: anoObjetivo,
          percentuais,
          tipoPeriodo,
          refPeriodo,
          valorTotal: totalObjetivo,
          periodoLabel,
          tipo: tipoObjetivo,
        }),
      });

      const json = await resp.json();
      if (json?.success) {
        setNotification({ type: "success", message: `Objetivo ${TIPO_PERIODO_LABELS[tipoPeriodo]} para ${periodoLabel} (${tipoLabel}) salvo com sucesso!` });
      } else {
        setNotification({ type: "error", message: json?.error ?? "Erro ao salvar objetivos" });
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
    const folhas = coletarFolhas(arvoreOriginal);
    const editados: Record<number, number> = {};
    for (let i = 0; i < folhas.length; i++) {
      editados[folhas[i]] = valor;
    }
    setPercentuaisEditados(editados);
  };

  const tipoObjetivoOpcoes = [
    { val: "ESTRUTURA_DRE" as TipoObjetivoVal, label: "DRE" },
    { val: "PLANO_CONTAS" as TipoObjetivoVal, label: "Plano de Contas" },
    { val: "CENTRO_CUSTO" as TipoObjetivoVal, label: "Centro de Custo" },
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
            {notification && <NotificationBar type={notification.type} message={notification.message} />}

            {/* Period type and specific period - CLEAR */}
            <section className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: "1.1rem", color: "#111827" }}>
                    Objetivo {TIPO_PERIODO_LABELS[tipoPeriodo]}
                    {periodoLabel ? ` - ${periodoLabel}` : ""}
                    {` (${tipoLabel})`}
                  </h2>
                  <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
                    Defina o objetivo para o periodo selecionado. Informe o % ou o valor desejado por linha.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={salvarObjetivos}
                  disabled={salvando || carregando || !refPeriodo}
                >
                  {salvando ? "Salvando..." : "Salvar Objetivo"}
                </button>
              </div>

              {/* Tipo de Objetivo selector */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Tipo de Objetivo</label>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {tipoObjetivoOpcoes.map((t) => (
                      <button
                        key={t.val}
                        type="button"
                        className={tipoObjetivo === t.val ? "button button-primary button-compact" : "button button-secondary button-compact"}
                        onClick={() => setTipoObjetivo(t.val)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Period type buttons */}
                <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div className="form-group" style={{ flex: "0 0 auto" }}>
                    <label>Tipo de Periodo</label>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(["mensal", "trimestral", "semestral", "anual"] as TipoPeriodo[]).map((tp) => (
                        <button
                          key={tp}
                          type="button"
                          className={tipoPeriodo === tp ? "button button-primary button-compact" : "button button-secondary button-compact"}
                          onClick={() => setTipoPeriodo(tp)}
                        >
                          {TIPO_PERIODO_LABELS[tp]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group" style={{ flex: "0 0 auto", minWidth: 90 }}>
                    <label htmlFor="obj-ano-objetivo">Ano</label>
                    <input
                      id="obj-ano-objetivo"
                      type="number"
                      className="form-input"
                      value={anoObjetivo}
                      onChange={(e) => setAnoObjetivo(Number(e.target.value))}
                      style={{ width: 90 }}
                    />
                  </div>

                  {tipoPeriodo !== "anual" && (
                    <div className="form-group" style={{ flex: "0 0 auto", minWidth: 180 }}>
                      <label htmlFor="obj-periodo">Periodo</label>
                      <select
                        id="obj-periodo"
                        className="form-input"
                        value={refPeriodo}
                        onChange={(e) => setRefPeriodo(e.target.value)}
                      >
                        {opcoesPeriodo.map((op) => (
                          <option key={op.valor} value={op.valor}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Reference period (for media) */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e5e7eb" }}>
                <span style={{ fontSize: "0.8rem", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" }}>
                  Base de referencia (media mensal)
                </span>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
                  <div className="form-group" style={{ flex: "0 0 auto", minWidth: 100 }}>
                    <label htmlFor="obj-mes-inicio">Mes inicio</label>
                    <select id="obj-mes-inicio" className="form-input" value={mesInicio} onChange={(e) => setMesInicio(Number(e.target.value))}>
                      {MESES_LABELS.map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: "0 0 auto", minWidth: 100 }}>
                    <label htmlFor="obj-mes-fim">Mes fim</label>
                    <select id="obj-mes-fim" className="form-input" value={mesFim} onChange={(e) => setMesFim(Number(e.target.value))}>
                      {MESES_LABELS.map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: "0 0 auto", minWidth: 90 }}>
                    <label htmlFor="obj-ano-ref">Ano Ref.</label>
                    <input id="obj-ano-ref" type="number" className="form-input" value={anoRef} onChange={(e) => setAnoRef(Number(e.target.value))} style={{ width: 90 }} />
                  </div>
                  <div className="form-group" style={{ flex: "0 0 auto", minWidth: 100 }}>
                    <label htmlFor="obj-pct-global">% Global</label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        id="obj-pct-global"
                        type="number"
                        className="form-input"
                        style={{ width: 70, textAlign: "center" }}
                        placeholder="0"
                        value={pctGlobal}
                        onChange={(e) => setPctGlobal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); aplicarPercentualGlobal(); }
                        }}
                      />
                      <button type="button" className="button button-secondary button-compact" onClick={aplicarPercentualGlobal}>Aplicar</button>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#9ca3af", paddingBottom: 10 }}>
                    {mesesRef} {mesesRef === 1 ? "mes" : "meses"} de ref. | Objetivo: {multiplicador} {multiplicador === 1 ? "mes" : "meses"}
                  </span>
                </div>
              </div>
            </section>

            {/* Summary */}
            <section className="summary-cards" style={{ marginTop: 20 }}>
              <div className="summary-card">
                <span className="summary-label">Base ({TIPO_PERIODO_LABELS[tipoPeriodo]})</span>
                <strong className="summary-value">{formatMoney(totalMedia)}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-label">Objetivo ({periodoLabel || TIPO_PERIODO_LABELS[tipoPeriodo]})</span>
                <strong className="summary-value" style={{ color: "#059669" }}>
                  {formatMoney(totalObjetivo)}
                </strong>
              </div>
              <div className="summary-card">
                <span className="summary-label">Diferenca</span>
                <strong
                  className="summary-value"
                  style={{ color: totalObjetivo - totalMedia >= 0 ? "#059669" : "#dc2626" }}
                >
                  {formatMoney(totalObjetivo - totalMedia)}
                </strong>
              </div>
            </section>

            {/* DRE Tree */}
            <section className="panel" style={{ marginTop: 20 }}>
              {carregando ? (
                <div className="empty-state">Carregando estrutura {tipoLabel}...</div>
              ) : arvoreCalculada.length === 0 ? (
                <div className="empty-state">
                  Nenhuma estrutura de {tipoLabel} encontrada. Cadastre a estrutura e vincule contas primeiro.
                </div>
              ) : (
                <>
                  {/* Desktop: Table view */}
                  <div className="dre-desktop-table" style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ tableLayout: "auto", width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>{tipoLabel}</th>
                          <th style={{ textAlign: "right", width: 150 }}>Base ({TIPO_PERIODO_LABELS[tipoPeriodo]})</th>
                          <th style={{ textAlign: "center", width: 100 }}>Cresc. %</th>
                          <th style={{ textAlign: "right", width: 150 }}>Objetivo R$</th>
                          <th style={{ textAlign: "right", width: 140 }}>Variacao</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arvoreCalculada.map((node) => (
                          <ObjetivoLinhaRow
                            key={node.id}
                            node={node}
                            nivel={0}
                            editados={percentuaisEditados}
                            onChangePercent={handlePercentualChange}
                            onChangeValor={handleValorChange}
                          />
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
                          <td style={{ paddingLeft: 8 }}>TOTAL</td>
                          <td style={{ textAlign: "right" }}>{formatMoney(totalMedia)}</td>
                          <td style={{ textAlign: "center", color: "#9ca3af", fontSize: "0.82rem" }}>--</td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(totalObjetivo)}</td>
                          <td style={{ textAlign: "right", color: totalObjetivo - totalMedia >= 0 ? "#059669" : "#dc2626" }}>
                            {totalObjetivo - totalMedia >= 0 ? "+" : ""}
                            {formatMoney(totalObjetivo - totalMedia)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile: Card view */}
                  <div className="dre-mobile-cards">
                    {arvoreCalculada.map((node) => (
                      <ObjetivoLinhaCard
                        key={node.id}
                        node={node}
                        nivel={0}
                        editados={percentuaisEditados}
                        onChangePercent={handlePercentualChange}
                        onChangeValor={handleValorChange}
                      />
                    ))}

                    <div className="dre-card-resultado">
                      <div className="dre-card-header">
                        <div style={{ flex: 1 }}>
                          <div className="dre-card-title">TOTAL</div>
                        </div>
                        <div className="dre-card-total" style={{ color: totalObjetivo - totalMedia >= 0 ? "#059669" : "#dc2626" }}>
                          {totalObjetivo - totalMedia >= 0 ? "+" : ""}
                          {formatMoney(totalObjetivo - totalMedia)}
                        </div>
                      </div>
                      <div className="dre-card-periodos">
                        <div className="dre-card-periodo-item">
                          <span className="dre-card-periodo-label">Base</span>
                          <span className="dre-card-periodo-valor">{formatMoney(totalMedia)}</span>
                        </div>
                        <div className="dre-card-periodo-item">
                          <span className="dre-card-periodo-label">Objetivo</span>
                          <span className="dre-card-periodo-valor" style={{ fontWeight: 600, color: "#059669" }}>
                            {formatMoney(totalObjetivo)}
                          </span>
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
