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

/* ── Desktop: table row (hierarchical) ── */
function DreLinhaRow({
  node,
  periodos,
  nivel,
}: {
  node: DreLinha;
  periodos: PeriodoInfo[];
  nivel: number;
}) {
  const [aberto, setAberto] = useState(true);
  const temFilhos = (node.filhos?.length ?? 0) > 0;
  const paddingLeft = nivel * 20 + 8;

  return (
    <>
      <tr
        style={{
          fontWeight: nivel === 0 ? 700 : 400,
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
          <span
            style={{
              marginLeft: 8,
              fontSize: "0.7rem",
              color: node.natureza === "RECEITA" ? "#059669" : node.natureza === "DESPESA" ? "#dc2626" : "#6b7280",
            }}
          >
            {node.natureza}
          </span>
        </td>
        {periodos.length > 0 ? (
          <>
            {periodos.map((p) => {
              const val = node.colunas?.[p.chave] ?? 0;
              return (
                <td key={p.chave} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <span style={{ color: val >= 0 ? "#059669" : "#dc2626" }}>
                    {formatarValor(val)}
                  </span>
                </td>
              );
            })}
            <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
              {formatarValor(node.valor)}
            </td>
          </>
        ) : (
          <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
            {formatarValor(node.valor)}
          </td>
        )}
      </tr>
      {aberto &&
        node.filhos?.map((filho) => (
          <DreLinhaRow key={filho.id} node={filho} periodos={periodos} nivel={nivel + 1} />
        ))}
    </>
  );
}

/* ── Mobile: card view (hierarchical) ── */
function DreLinhaCard({
  node,
  periodos,
  nivel,
}: {
  node: DreLinha;
  periodos: PeriodoInfo[];
  nivel: number;
}) {
  const [aberto, setAberto] = useState(nivel === 0);
  const [detalhes, setDetalhes] = useState(false);
  const temFilhos = (node.filhos?.length ?? 0) > 0;
  const temPeriodos = periodos.length > 0 && node.colunas;
  const levelClass = `dre-card-level-${Math.min(nivel, 3)}`;
  const corValor = node.valor >= 0 ? "#059669" : "#dc2626";
  const corNatureza = node.natureza === "RECEITA" ? "#059669" : node.natureza === "DESPESA" ? "#dc2626" : "#6b7280";

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
            </div>
          </div>
          <div className="dre-card-total" style={{ color: corValor }}>
            {formatarValor(node.valor)}
          </div>
        </div>

        {/* Period breakdown - toggle on tap for leaf nodes */}
        {(detalhes || (temFilhos && aberto)) && temPeriodos && (
          <div className="dre-card-periodos">
            {periodos.map((p) => {
              const val = node.colunas?.[p.chave] ?? 0;
              return (
                <div key={p.chave} className="dre-card-periodo-item">
                  <span className="dre-card-periodo-label">{p.label}</span>
                  <span className="dre-card-periodo-valor" style={{ color: val >= 0 ? "#059669" : "#dc2626" }}>
                    {formatarValor(val)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Render children */}
      {aberto && temFilhos && node.filhos!.map((filho) => (
        <DreLinhaCard key={filho.id} node={filho} periodos={periodos} nivel={nivel + 1} />
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
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([new Date().getFullYear()]);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [linhas, setLinhas] = useState<DreLinha[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoInfo[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Fetch available years
  useEffect(() => {
    if (!empresa?.id) return;
    fetch("/api/financeiro/anos-disponiveis", {
      headers: { "x-empresa-id": String(empresa.id) },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.length > 0) {
          setAnosDisponiveis(json.data);
          if (!json.data.includes(ano)) setAno(json.data[0]);
        }
      })
      .catch(() => {});
  }, [empresa?.id]);

  useEffect(() => {
    if (!empresa?.id) return;

    const carregarDre = async () => {
      try {
        setCarregando(true);
        const params = new URLSearchParams();
        params.set("visao", visao);
        params.set("ano", String(ano));

        const resposta = await fetch(`/api/financeiro/dre?${params.toString()}`, {
          headers: { "x-empresa-id": String(empresa.id) },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            setLinhas(dados.data ?? []);
            setPeriodos(dados.periodos ?? []);
          }
        }
      } catch (erro) {
        console.error("Erro ao buscar DRE:", erro);
      } finally {
        setCarregando(false);
      }
    };

    carregarDre();
  }, [empresa?.id, visao, ano]);

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
              <div className="form-group" style={{ flex: "0 0 120px" }}>
                <label htmlFor="dre-ano">Ano</label>
                <select
                  id="dre-ano"
                  className="form-input"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                >
                  {anosDisponiveis.map((a) => (
                    <option key={a} value={a}>{a}</option>
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
                  <table className="data-table" style={{ tableLayout: "auto", minWidth: periodos.length > 4 ? "900px" : "auto" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Conta DRE</th>
                        {periodos.map((p) => (
                          <th key={p.chave} style={{ textAlign: "right", whiteSpace: "nowrap" }}>{p.label}</th>
                        ))}
                        <th style={{ textAlign: "right" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((linha) => (
                        <DreLinhaRow key={linha.id} node={linha} periodos={periodos} nivel={0} />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
                        <td style={{ paddingLeft: 8 }}>RESULTADO DO EXERCICIO</td>
                        {periodos.map((p) => {
                          const val = resultadoPorPeriodo[p.chave] ?? 0;
                          return (
                            <td key={p.chave} style={{ textAlign: "right", color: val >= 0 ? "#059669" : "#dc2626" }}>
                              {val >= 0 ? "+" : "-"}{formatarValor(val)}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "right", color: totalResultado >= 0 ? "#059669" : "#dc2626" }}>
                          {totalResultado >= 0 ? "+" : "-"}{formatarValor(totalResultado)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile: Card view */}
                <div className="dre-mobile-cards">
                  {linhas.map((linha) => (
                    <DreLinhaCard key={linha.id} node={linha} periodos={periodos} nivel={0} />
                  ))}

                  {/* Resultado do exercicio */}
                  <div className="dre-card-resultado">
                    <div className="dre-card-header">
                      <div className="dre-card-title">RESULTADO DO EXERCICIO</div>
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
