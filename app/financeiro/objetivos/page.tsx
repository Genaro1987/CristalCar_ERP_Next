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

function formatMoney(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/* ── Collect all leaf IDs from tree ── */
function coletarFolhas(nodes: DreNode[]): number[] {
  const ids: number[] = [];
  for (const n of nodes) {
    if (n.filhos.length === 0) {
      ids.push(n.id);
    } else {
      ids.push(...coletarFolhas(n.filhos));
    }
  }
  return ids;
}

/* ── Apply edited percentages and recalculate tree ── */
function recalcularArvore(node: DreNode, editados: Record<number, number>): DreNode {
  if (node.filhos.length === 0) {
    const pct = editados[node.id] ?? node.percentual;
    const objetivo = node.media * (1 + pct / 100);
    return { ...node, percentual: pct, objetivo };
  }

  const filhosRecalc = node.filhos.map((f) => recalcularArvore(f, editados));
  const mediaFilhos = filhosRecalc.reduce((acc, f) => acc + f.media, 0);
  const objetivoFilhos = filhosRecalc.reduce((acc, f) => acc + f.objetivo, 0);

  return {
    ...node,
    filhos: filhosRecalc,
    media: node.filhos.length > 0 ? mediaFilhos : node.media,
    objetivo: node.filhos.length > 0 ? objetivoFilhos : node.objetivo,
  };
}

/* ── Desktop tree row ── */
function ObjetivoLinhaRow({
  node,
  nivel,
  editados,
  onChangePercent,
}: {
  node: DreNode;
  nivel: number;
  editados: Record<number, number>;
  onChangePercent: (id: number, val: string) => void;
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
        <td style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{formatMoney(node.objetivo)}</td>
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
}: {
  node: DreNode;
  nivel: number;
  editados: Record<number, number>;
  onChangePercent: (id: number, val: string) => void;
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
            <span className="dre-card-periodo-label">Media</span>
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
            <span className="dre-card-periodo-valor" style={{ fontWeight: 600 }}>
              {formatMoney(node.objetivo)}
            </span>
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
  const [mesInicio, setMesInicio] = useState(Math.max(1, mesAtual - 2));
  const [mesFim, setMesFim] = useState(mesAtual);
  const [anoRef, setAnoRef] = useState(anoAtual);
  const [anoObjetivo, setAnoObjetivo] = useState(anoAtual);
  const [arvoreOriginal, setArvoreOriginal] = useState<DreNode[]>([]);
  const [percentuaisEditados, setPercentuaisEditados] = useState<Record<number, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(
    null
  );
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

      const resp = await fetch(`/api/financeiro/objetivos/dre?${params}`, {
        headers: headersPadrao,
      });
      const json = await resp.json();

      if (json?.success) {
        const dados: DreNode[] = json.data ?? [];
        setArvoreOriginal(dados);

        // Extract saved percentages from tree (leaf nodes)
        const editados: Record<number, number> = {};
        function extrairPcts(nodes: DreNode[]) {
          for (const n of nodes) {
            if (n.filhos.length === 0) {
              editados[n.id] = n.percentual;
            } else {
              extrairPcts(n.filhos);
            }
          }
        }
        extrairPcts(dados);
        setPercentuaisEditados(editados);
      }
    } catch (err) {
      console.error("Erro ao carregar objetivos DRE:", err);
    } finally {
      setCarregando(false);
    }
  }, [empresa?.id, headersPadrao, anoRef, mesInicio, mesFim, anoObjetivo]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Recalculate tree with edited percentages
  const arvoreCalculada = useMemo(() => {
    return arvoreOriginal.map((n) => recalcularArvore(n, percentuaisEditados));
  }, [arvoreOriginal, percentuaisEditados]);

  // Totals from root nodes
  const totalMedia = useMemo(() => arvoreCalculada.reduce((acc, n) => acc + n.media, 0), [arvoreCalculada]);
  const totalObjetivo = useMemo(
    () => arvoreCalculada.reduce((acc, n) => acc + n.objetivo, 0),
    [arvoreCalculada]
  );

  const handlePercentualChange = (id: number, valor: string) => {
    const num = valor === "" || valor === "-" ? 0 : Number(valor);
    setPercentuaisEditados((prev) => ({ ...prev, [id]: num }));
  };

  const salvarObjetivos = async () => {
    if (!empresa?.id) return;
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
        body: JSON.stringify({ ano: anoObjetivo, percentuais }),
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
    const folhas = coletarFolhas(arvoreOriginal);
    const editados: Record<number, number> = {};
    for (const id of folhas) {
      editados[id] = valor;
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
                  Defina metas baseadas na estrutura do DRE com percentual de crescimento ou reducao por linha
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

              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <div className="form-group" style={{ flex: "0 0 auto", minWidth: 100 }}>
                  <label htmlFor="obj-mes-inicio">Mes inicio</label>
                  <select
                    id="obj-mes-inicio"
                    className="form-input"
                    value={mesInicio}
                    onChange={(e) => setMesInicio(Number(e.target.value))}
                  >
                    {MESES_LABELS.map((m, i) => (
                      <option key={i + 1} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: "0 0 auto", minWidth: 100 }}>
                  <label htmlFor="obj-mes-fim">Mes fim</label>
                  <select
                    id="obj-mes-fim"
                    className="form-input"
                    value={mesFim}
                    onChange={(e) => setMesFim(Number(e.target.value))}
                  >
                    {MESES_LABELS.map((m, i) => (
                      <option key={i + 1} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: "0 0 auto", minWidth: 90 }}>
                  <label htmlFor="obj-ano-ref">Ano Ref.</label>
                  <input
                    id="obj-ano-ref"
                    type="number"
                    className="form-input"
                    value={anoRef}
                    onChange={(e) => setAnoRef(Number(e.target.value))}
                    style={{ width: 90 }}
                  />
                </div>

                <div className="form-group" style={{ flex: "0 0 auto", minWidth: 90 }}>
                  <label htmlFor="obj-ano-objetivo">Ano Obj.</label>
                  <input
                    id="obj-ano-objetivo"
                    type="number"
                    className="form-input"
                    value={anoObjetivo}
                    onChange={(e) => setAnoObjetivo(Number(e.target.value))}
                    style={{ width: 90 }}
                  />
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

                <span style={{ fontSize: "0.8rem", color: "#9ca3af", paddingBottom: 10 }}>
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
                <div className="empty-state">Carregando estrutura DRE...</div>
              ) : arvoreCalculada.length === 0 ? (
                <div className="empty-state">
                  Nenhuma estrutura de DRE encontrada. Cadastre a estrutura do DRE e vincule contas primeiro.
                </div>
              ) : (
                <>
                  {/* Desktop: Table view */}
                  <div className="dre-desktop-table" style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ tableLayout: "auto", width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Estrutura DRE</th>
                          <th style={{ textAlign: "right", width: 140 }}>Media Mensal</th>
                          <th style={{ textAlign: "center", width: 100 }}>Cresc. %</th>
                          <th style={{ textAlign: "right", width: 140 }}>Objetivo</th>
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
                          />
                        ))}
                      </tbody>
                      <tfoot>
                        <tr
                          style={{
                            fontWeight: 700,
                            borderTop: "2px solid #e5e7eb",
                            backgroundColor: "#f3f4f6",
                          }}
                        >
                          <td style={{ paddingLeft: 8 }}>TOTAL</td>
                          <td style={{ textAlign: "right" }}>{formatMoney(totalMedia)}</td>
                          <td></td>
                          <td style={{ textAlign: "right" }}>{formatMoney(totalObjetivo)}</td>
                          <td
                            style={{
                              textAlign: "right",
                              color: totalObjetivo - totalMedia >= 0 ? "#059669" : "#dc2626",
                            }}
                          >
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
                      />
                    ))}

                    <div className="dre-card-resultado">
                      <div className="dre-card-header">
                        <div style={{ flex: 1 }}>
                          <div className="dre-card-title">TOTAL</div>
                        </div>
                        <div
                          className="dre-card-total"
                          style={{ color: totalObjetivo - totalMedia >= 0 ? "#059669" : "#dc2626" }}
                        >
                          {totalObjetivo - totalMedia >= 0 ? "+" : ""}
                          {formatMoney(totalObjetivo - totalMedia)}
                        </div>
                      </div>
                      <div className="dre-card-periodos">
                        <div className="dre-card-periodo-item">
                          <span className="dre-card-periodo-label">Media</span>
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
