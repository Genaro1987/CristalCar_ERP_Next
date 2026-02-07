"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import React, { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

type TipoVisao = "mensal" | "trimestral" | "semestral" | "anual";

interface DreLinha {
  id: number;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "OUTROS";
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

export default function DrePage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/dre";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_DRE";
  const nomeTela = tela?.NOME_TELA ?? "Relatório DRE";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [visao, setVisao] = useState<TipoVisao>("mensal");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [linhas, setLinhas] = useState<DreLinha[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoInfo[]>([]);
  const [carregando, setCarregando] = useState(true);

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

        <main className="page-content-card">
          <section className="panel">
            <div className="form-section-header">
              <div>
                <h2>DRE - Demonstrativo de Resultado</h2>
                <p>Visualize receitas, despesas e resultado por período</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
              <div className="form-group" style={{ flex: "0 0 120px" }}>
                <label htmlFor="dre-ano">Ano</label>
                <input
                  id="dre-ano"
                  type="number"
                  className="form-input"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                />
              </div>

              <div className="form-group" style={{ flex: "0 0 auto" }}>
                <label>Visão</label>
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

          <section className="panel" style={{ marginTop: 16 }}>
            {carregando ? (
              <div className="empty-state">Carregando dados do DRE...</div>
            ) : linhas.length === 0 ? (
              <div className="empty-state">Nenhum dado disponível. Cadastre a estrutura de DRE e vincule contas do plano.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
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
                      <td style={{ paddingLeft: 8 }}>RESULTADO DO EXERCÍCIO</td>
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
            )}
          </section>
        </main>
      </div>
    </LayoutShell>
  );
}
