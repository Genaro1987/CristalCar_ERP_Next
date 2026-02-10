"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import React, { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

type TipoVisao = "agrupado" | "detalhado" | "diario";

const formatMoney = (val: number) =>
  val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

  useEffect(() => {
    if (!empresa?.id) return;

    const carregar = async () => {
      setCarregando(true);
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

  const visaoOpcoes: { valor: TipoVisao; label: string }[] = [
    { valor: "agrupado", label: "Agrupado" },
    { valor: "detalhado", label: "Detalhado" },
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
                    <td style={{ paddingLeft: 8 }}>{g.grupo}</td>
                    <td style={{ textAlign: "right", color: "#059669" }}>{formatMoney(g.receitas)}</td>
                    <td style={{ textAlign: "right", color: "#dc2626" }}>{formatMoney(g.despesas)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: g.saldo >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(g.saldo)}</td>
                    <td style={{ textAlign: "right" }}></td>
                  </tr>
                )}
                {g.contas.map((c) => (
                  <tr key={c.contaId}>
                    <td data-label="Conta" style={{ paddingLeft: g.contas.length > 1 ? 24 : 8 }}>
                      {c.contaCodigo} {c.contaNome}
                    </td>
                    <td data-label="Receitas" style={{ textAlign: "right", color: "#059669" }}>{formatMoney(c.receitas)}</td>
                    <td data-label="Despesas" style={{ textAlign: "right", color: "#dc2626" }}>{formatMoney(c.despesas)}</td>
                    <td data-label="Saldo" style={{ textAlign: "right", color: c.saldo >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(c.saldo)}</td>
                    <td data-label="Qtd" style={{ textAlign: "right" }}>{c.qtd}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
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

  function renderDetalhado() {
    if (!dados?.lancamentos) return null;
    const lancamentos = dados.lancamentos as LancamentoDetalhe[];

    return (
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
            </tr>
          </thead>
          <tbody>
            {lancamentos.map((l) => (
              <tr key={l.id}>
                <td data-label="Data">{l.data}</td>
                <td data-label="Descricao" style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descricao}</td>
                <td data-label="Conta" style={{ fontSize: "0.82rem" }}>{l.contaCodigo} {l.contaNome}</td>
                <td data-label="Pessoa">{l.pessoaNome || "-"}</td>
                <td data-label="Placa">{l.placa || "-"}</td>
                <td data-label="Valor" style={{ textAlign: "right", color: l.valor >= 0 ? "#059669" : "#dc2626", fontWeight: 600 }}>
                  {l.valor >= 0 ? "+" : "-"}{formatMoney(Math.abs(l.valor))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
              <td colSpan={5}>
                TOTAL ({lancamentos.length} lancamentos)
              </td>
              <td style={{ textAlign: "right", color: dados.saldoTotal >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(dados.saldoTotal)}</td>
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
              return (
                <tr key={d.data}>
                  <td data-label="Data">{d.data}</td>
                  <td data-label="Receitas" style={{ textAlign: "right", color: "#059669" }}>{formatMoney(d.receitas)}</td>
                  <td data-label="Despesas" style={{ textAlign: "right", color: "#dc2626" }}>{formatMoney(d.despesas)}</td>
                  <td data-label="Saldo" style={{ textAlign: "right", color: d.saldo >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(d.saldo)}</td>
                  <td data-label="Acumulado" style={{ textAlign: "right", fontWeight: 600, color: saldoAcumulado >= 0 ? "#059669" : "#dc2626" }}>{formatMoney(saldoAcumulado)}</td>
                  <td data-label="Movimentos" style={{ textAlign: "right" }}>{d.qtd}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
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
            ) : visao === "detalhado" ? (
              renderDetalhado()
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
