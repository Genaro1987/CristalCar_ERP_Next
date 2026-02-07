"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import React, { useEffect, useMemo, useState } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

type EvolucaoMes = {
  competencia: string;
  extras50Min: number;
  extras100Min: number;
  devidasMin: number;
  saldoMin: number;
};

type ResumoFuncionario = {
  id: string;
  nome: string;
  departamento: string;
  jornada: string;
  dataAdmissao: string;
  salarioBase: number;
  diasTrabalhados: number;
  feriasCount: number;
  faltasJustificadas: number;
  faltasNaoJustificadas: number;
  extras50Min: number;
  extras100Min: number;
  devidasMin: number;
  valorPagar: number;
  valorDescontar: number;
  saldoUltimoMes: number;
  evolucao: EvolucaoMes[];
};

const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function minParaHora(min: number): string {
  const sinal = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sinal}${h}h${String(m).padStart(2, "0")}`;
}

function formatMoney(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ResumoFuncionariosPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/rh/resumo";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "RH_RESUMO";
  const nomeTela = tela?.NOME_TELA ?? "Resumo de Funcionários";
  const moduloTela = tela?.MODULO ?? "RH";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;

  const [ano, setAno] = useState(anoAtual);
  const [mesInicio, setMesInicio] = useState(1);
  const [mesFim, setMesFim] = useState(mesAtual);
  const [dados, setDados] = useState<ResumoFuncionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!empresa?.id) return;

    const carregar = async () => {
      setCarregando(true);
      try {
        const params = new URLSearchParams({
          ano: String(ano),
          mesInicio: String(mesInicio),
          mesFim: String(mesFim),
        });
        const resp = await fetch(`/api/rh/resumo?${params}`, {
          headers: { "x-empresa-id": String(empresa.id) },
        });
        const json = await resp.json();
        if (json.success) {
          setDados(json.data ?? []);
        }
      } catch (err) {
        console.error("Erro ao carregar resumo:", err);
      } finally {
        setCarregando(false);
      }
    };

    carregar();
  }, [empresa?.id, ano, mesInicio, mesFim]);

  const dadosFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return dados;
    return dados.filter(
      (f) =>
        f.nome.toLowerCase().includes(b) ||
        f.departamento.toLowerCase().includes(b)
    );
  }, [dados, busca]);

  // Totals
  const totais = useMemo(() => {
    return dadosFiltrados.reduce(
      (acc, f) => ({
        extras50: acc.extras50 + f.extras50Min,
        extras100: acc.extras100 + f.extras100Min,
        devidas: acc.devidas + f.devidasMin,
        pagar: acc.pagar + f.valorPagar,
        descontar: acc.descontar + f.valorDescontar,
        faltas: acc.faltas + f.faltasJustificadas + f.faltasNaoJustificadas,
        ferias: acc.ferias + f.feriasCount,
      }),
      { extras50: 0, extras100: 0, devidas: 0, pagar: 0, descontar: 0, faltas: 0, ferias: 0 }
    );
  }, [dadosFiltrados]);

  const periodoLabel = mesInicio === mesFim
    ? `${MESES_LABELS[mesInicio - 1]}/${ano}`
    : `${MESES_LABELS[mesInicio - 1]} a ${MESES_LABELS[mesFim - 1]}/${ano}`;

  return (
    <LayoutShell>
      <div className="page-container rh-page">
        <HeaderBar
          nomeTela={nomeTela}
          codigoTela={codigoTela}
          caminhoRota={caminhoTela}
          modulo={moduloTela}
        />

        <main className="page-content-card">
          {/* Filters */}
          <section className="panel">
            <div className="form-section-header">
              <div>
                <h2>Resumo de Funcionários</h2>
                <p>Visão consolidada de horas extras, faltas e evolução mensal de cada colaborador.</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
              <div className="form-group" style={{ flex: "0 0 90px" }}>
                <label htmlFor="resumo-ano">Ano</label>
                <input
                  id="resumo-ano"
                  type="number"
                  className="form-input"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                />
              </div>
              <div className="form-group" style={{ flex: "0 0 130px" }}>
                <label htmlFor="resumo-mes-ini">Mês início</label>
                <select
                  id="resumo-mes-ini"
                  className="form-input"
                  value={mesInicio}
                  onChange={(e) => setMesInicio(Number(e.target.value))}
                >
                  {MESES_LABELS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: "0 0 130px" }}>
                <label htmlFor="resumo-mes-fim">Mês fim</label>
                <select
                  id="resumo-mes-fim"
                  className="form-input"
                  value={mesFim}
                  onChange={(e) => setMesFim(Number(e.target.value))}
                >
                  {MESES_LABELS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: "1 1 180px" }}>
                <label htmlFor="resumo-busca">Buscar</label>
                <input
                  id="resumo-busca"
                  type="text"
                  className="form-input"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome ou departamento"
                />
              </div>
            </div>
          </section>

          {/* Summary cards */}
          <section className="summary-cards" style={{ marginTop: 16 }}>
            <div className="summary-card">
              <span className="summary-label">Funcionários</span>
              <strong className="summary-value">{dadosFiltrados.length}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Extras 50%</span>
              <strong className="summary-value" style={{ color: "#059669" }}>{minParaHora(totais.extras50)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Extras 100%</span>
              <strong className="summary-value" style={{ color: "#059669" }}>{minParaHora(totais.extras100)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Horas Devidas</span>
              <strong className="summary-value" style={{ color: "#dc2626" }}>{minParaHora(totais.devidas)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Faltas</span>
              <strong className="summary-value" style={{ color: "#dc2626" }}>{totais.faltas}</strong>
              <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{totais.ferias} dias férias</span>
            </div>
          </section>

          {/* Employee list */}
          <section className="panel" style={{ marginTop: 16 }}>
            {carregando ? (
              <div className="empty-state">Carregando resumo...</div>
            ) : dadosFiltrados.length === 0 ? (
              <div className="empty-state">
                Nenhum funcionário encontrado para o período selecionado.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dadosFiltrados.map((func) => {
                  const isExpanded = expandido === func.id;
                  const totalFaltas = func.faltasJustificadas + func.faltasNaoJustificadas;

                  return (
                    <div
                      key={func.id}
                      className="detail-card"
                      style={{
                        padding: 0,
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        overflow: "hidden",
                      }}
                    >
                      {/* Employee header row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 16px",
                          cursor: "pointer",
                          flexWrap: "wrap",
                        }}
                        onClick={() => setExpandido(isExpanded ? null : func.id)}
                      >
                        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                          <strong style={{ fontSize: "0.92rem", color: "#111827", display: "block" }}>
                            {func.nome}
                          </strong>
                          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                            {func.departamento} &middot; {func.jornada}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", fontSize: "0.82rem" }}>
                          <div style={{ textAlign: "center" }}>
                            <span style={{ display: "block", fontSize: "0.68rem", color: "#6b7280", textTransform: "uppercase" }}>Extras 50%</span>
                            <strong style={{ color: func.extras50Min > 0 ? "#059669" : "#374151" }}>
                              {minParaHora(func.extras50Min)}
                            </strong>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <span style={{ display: "block", fontSize: "0.68rem", color: "#6b7280", textTransform: "uppercase" }}>Extras 100%</span>
                            <strong style={{ color: func.extras100Min > 0 ? "#059669" : "#374151" }}>
                              {minParaHora(func.extras100Min)}
                            </strong>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <span style={{ display: "block", fontSize: "0.68rem", color: "#6b7280", textTransform: "uppercase" }}>Devidas</span>
                            <strong style={{ color: func.devidasMin < 0 ? "#dc2626" : "#374151" }}>
                              {minParaHora(func.devidasMin)}
                            </strong>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <span style={{ display: "block", fontSize: "0.68rem", color: "#6b7280", textTransform: "uppercase" }}>Faltas</span>
                            <strong style={{ color: totalFaltas > 0 ? "#dc2626" : "#374151" }}>
                              {totalFaltas}
                            </strong>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <span style={{ display: "block", fontSize: "0.68rem", color: "#6b7280", textTransform: "uppercase" }}>Saldo</span>
                            <strong style={{ color: func.saldoUltimoMes >= 0 ? "#059669" : "#dc2626" }}>
                              {minParaHora(func.saldoUltimoMes)}
                            </strong>
                          </div>
                        </div>

                        <span style={{ fontSize: "0.8rem", color: "#9ca3af", flexShrink: 0 }}>
                          {isExpanded ? "\u25B2" : "\u25BC"}
                        </span>
                      </div>

                      {/* Expanded: monthly evolution */}
                      {isExpanded && (
                        <div style={{ borderTop: "1px solid #e5e7eb", padding: "12px 16px", background: "#f9fafb" }}>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: "0.82rem" }}>
                            <span><strong>Dias trabalhados:</strong> {func.diasTrabalhados}</span>
                            <span><strong>Férias:</strong> {func.feriasCount} dias</span>
                            <span><strong>Faltas just.:</strong> {func.faltasJustificadas}</span>
                            <span><strong>Faltas n/just.:</strong> {func.faltasNaoJustificadas}</span>
                            {func.valorPagar > 0 && (
                              <span style={{ color: "#059669" }}><strong>A pagar:</strong> {formatMoney(func.valorPagar)}</span>
                            )}
                            {func.valorDescontar > 0 && (
                              <span style={{ color: "#dc2626" }}><strong>A descontar:</strong> {formatMoney(func.valorDescontar)}</span>
                            )}
                          </div>

                          {func.evolucao.length > 0 && (
                            <>
                              <h4 style={{ fontSize: "0.82rem", color: "#374151", marginBottom: 8 }}>
                                Evolução mensal ({periodoLabel})
                              </h4>
                              <table className="data-table mobile-cards" style={{ fontSize: "0.82rem" }}>
                                <thead>
                                  <tr>
                                    <th>Mês</th>
                                    <th style={{ textAlign: "right" }}>Extras 50%</th>
                                    <th style={{ textAlign: "right" }}>Extras 100%</th>
                                    <th style={{ textAlign: "right" }}>Devidas</th>
                                    <th style={{ textAlign: "right" }}>Saldo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {func.evolucao.map((ev) => {
                                    const mesIdx = Number(ev.competencia.split("-")[1]) - 1;
                                    return (
                                      <tr key={ev.competencia}>
                                        <td data-label="Mês" style={{ fontWeight: 600 }}>{MESES_LABELS[mesIdx]}</td>
                                        <td data-label="Extras 50%" style={{ color: ev.extras50Min > 0 ? "#059669" : "#374151" }}>
                                          {minParaHora(ev.extras50Min)}
                                        </td>
                                        <td data-label="Extras 100%" style={{ color: ev.extras100Min > 0 ? "#059669" : "#374151" }}>
                                          {minParaHora(ev.extras100Min)}
                                        </td>
                                        <td data-label="Devidas" style={{ color: ev.devidasMin < 0 ? "#dc2626" : "#374151" }}>
                                          {minParaHora(ev.devidasMin)}
                                        </td>
                                        <td data-label="Saldo" style={{ fontWeight: 600, color: ev.saldoMin >= 0 ? "#059669" : "#dc2626" }}>
                                          {minParaHora(ev.saldoMin)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </LayoutShell>
  );
}
