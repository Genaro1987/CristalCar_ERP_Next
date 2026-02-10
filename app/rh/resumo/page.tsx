"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
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
  ajustesMin: number;
};

type ResumoFuncionario = {
  id: string;
  nome: string;
  departamento: string;
  jornada: string;
  dataAdmissao: string;
  salarioBase: number;
  diasTrabalhados: number;
  temPonto: boolean;
  ajustesMin: number;
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
  const nomeTela = tela?.NOME_TELA ?? "DASHBOARD RH";
  const moduloTela = tela?.MODULO ?? "RECURSOS HUMANOS";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const mesAtual = new Date().getMonth() + 1;

  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mesInicio, setMesInicio] = useState(mesAtual);
  const [mesFim, setMesFim] = useState(mesAtual);
  const [dados, setDados] = useState<ResumoFuncionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // Fetch available years
  useEffect(() => {
    if (!empresa?.id) return;
    fetch("/api/rh/anos-disponiveis", {
      headers: { "x-empresa-id": String(empresa.id) },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.length > 0) {
          setAnosDisponiveis(json.data);
          if (!json.data.includes(ano)) {
            setAno(json.data[0]);
          }
        } else {
          setAnosDisponiveis([new Date().getFullYear()]);
        }
      })
      .catch(() => setAnosDisponiveis([new Date().getFullYear()]));
  }, [empresa?.id]);

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

  // Separate employees with and without ponto entries
  const { funcionariosComPonto, funcionariosSemPonto } = useMemo(() => {
    const comPonto: ResumoFuncionario[] = [];
    const semPonto: ResumoFuncionario[] = [];
    for (const f of dadosFiltrados) {
      if (f.temPonto) comPonto.push(f);
      else semPonto.push(f);
    }
    return { funcionariosComPonto: comPonto, funcionariosSemPonto: semPonto };
  }, [dadosFiltrados]);

  const totais = useMemo(() => {
    let extras50 = 0, extras100 = 0, devidas = 0, faltas = 0, ferias = 0, ajustes = 0;
    let comExtras = 0, comDevidas = 0, emFerias = 0, comAjustes = 0;

    for (const f of dadosFiltrados) {
      const totalExtras = f.extras50Min + f.extras100Min;
      extras50 += f.extras50Min;
      extras100 += f.extras100Min;
      devidas += f.devidasMin;
      ajustes += f.ajustesMin;
      faltas += f.faltasJustificadas + f.faltasNaoJustificadas;
      ferias += f.feriasCount;
      if (totalExtras > 0) comExtras++;
      if (f.devidasMin < 0) comDevidas++;
      if (f.feriasCount > 0) emFerias++;
      if (f.ajustesMin !== 0) comAjustes++;
    }

    const saldoGeral = extras50 + extras100 + devidas;
    return { extras50, extras100, devidas, faltas, ferias, ajustes, comExtras, comDevidas, emFerias, comAjustes, saldoGeral };
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

        <PaginaProtegida codigoTela={codigoTela}>
        <main className="page-content-card" style={{ padding: 0 }}>
          {/* Filters - compact inline */}
          <div className="resumo-filtros">
            <div className="resumo-filtro-item">
              <label htmlFor="resumo-ano">Ano</label>
              <select id="resumo-ano" className="form-input" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
                {anosDisponiveis.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="resumo-filtro-item">
              <label htmlFor="resumo-mes-ini">De</label>
              <select id="resumo-mes-ini" className="form-input" value={mesInicio} onChange={(e) => setMesInicio(Number(e.target.value))}>
                {MESES_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="resumo-filtro-item">
              <label htmlFor="resumo-mes-fim">Até</label>
              <select id="resumo-mes-fim" className="form-input" value={mesFim} onChange={(e) => setMesFim(Number(e.target.value))}>
                {MESES_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="resumo-filtro-item resumo-filtro-busca">
              <label htmlFor="resumo-busca">Buscar</label>
              <input id="resumo-busca" type="text" className="form-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou departamento" />
            </div>
          </div>

          {/* KPI Cards */}
          <div className="resumo-kpis">
            <div className="resumo-kpi">
              <div className="resumo-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <div className="resumo-kpi-body">
                <span className="resumo-kpi-value">{dadosFiltrados.length}</span>
                <span className="resumo-kpi-label">Funcionários</span>
                <span className="resumo-kpi-detail">{funcionariosComPonto.length} com ponto</span>
              </div>
            </div>

            <div className="resumo-kpi">
              <div className="resumo-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
              </div>
              <div className="resumo-kpi-body">
                <span className="resumo-kpi-value" style={{ color: "#059669" }}>{minParaHora(totais.extras50 + totais.extras100)}</span>
                <span className="resumo-kpi-label">Horas extras total</span>
                <span className="resumo-kpi-detail">{totais.comExtras} funcionário{totais.comExtras !== 1 ? "s" : ""} com extras</span>
              </div>
            </div>

            <div className="resumo-kpi">
              <div className="resumo-kpi-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/><line x1="4" y1="4" x2="20" y2="20"/></svg>
              </div>
              <div className="resumo-kpi-body">
                <span className="resumo-kpi-value" style={{ color: "#dc2626" }}>{minParaHora(totais.devidas)}</span>
                <span className="resumo-kpi-label">Horas devidas total</span>
                <span className="resumo-kpi-detail">{totais.comDevidas} funcionário{totais.comDevidas !== 1 ? "s" : ""} com débito</span>
              </div>
            </div>

            <div className="resumo-kpi">
              <div className="resumo-kpi-icon" style={{ background: totais.saldoGeral >= 0 ? "#ecfdf5" : "#fef2f2", color: totais.saldoGeral >= 0 ? "#059669" : "#dc2626" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
              </div>
              <div className="resumo-kpi-body">
                <span className="resumo-kpi-value" style={{ color: totais.saldoGeral >= 0 ? "#059669" : "#dc2626" }}>{minParaHora(totais.saldoGeral)}</span>
                <span className="resumo-kpi-label">Balanço de horas</span>
                <span className="resumo-kpi-detail">Extras - Devidas</span>
              </div>
            </div>

            <div className="resumo-kpi">
              <div className="resumo-kpi-icon" style={{ background: "#fefce8", color: "#ca8a04" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div className="resumo-kpi-body">
                <span className="resumo-kpi-value">{totais.faltas}</span>
                <span className="resumo-kpi-label">Faltas no período</span>
                <span className="resumo-kpi-detail">{totais.emFerias} em férias</span>
              </div>
            </div>
          </div>

          {/* Employee list */}
          <div className="resumo-lista">
            {carregando ? (
              <div className="empty-state" style={{ margin: 20 }}>Carregando resumo...</div>
            ) : dadosFiltrados.length === 0 ? (
              <div className="empty-state" style={{ margin: 20 }}>Nenhum funcionário encontrado para o período selecionado.</div>
            ) : (
              <>
                {/* Employees WITH ponto data */}
                {funcionariosComPonto.map((func) => {
                  const isExpanded = expandido === func.id;
                  const totalFaltas = func.faltasJustificadas + func.faltasNaoJustificadas;
                  const totalExtras = func.extras50Min + func.extras100Min;

                  return (
                    <div key={func.id} className={`resumo-func${isExpanded ? " resumo-func-expanded" : ""}`}>
                      <div className="resumo-func-row" onClick={() => setExpandido(isExpanded ? null : func.id)}>
                        {/* Name + dept */}
                        <div className="resumo-func-info">
                          <strong className="resumo-func-nome">{func.nome}</strong>
                          <span className="resumo-func-dept">{func.departamento}</span>
                        </div>

                        {/* Metrics strip */}
                        <div className="resumo-func-metrics">
                          <div className="resumo-metric">
                            <span className="resumo-metric-val" style={{ color: totalExtras > 0 ? "#059669" : "#9ca3af" }}>
                              {minParaHora(totalExtras)}
                            </span>
                            <span className="resumo-metric-lbl">Extras</span>
                          </div>
                          <div className="resumo-metric">
                            <span className="resumo-metric-val" style={{ color: func.devidasMin < 0 ? "#dc2626" : "#9ca3af" }}>
                              {minParaHora(func.devidasMin)}
                            </span>
                            <span className="resumo-metric-lbl">Devidas</span>
                          </div>
                          <div className="resumo-metric">
                            <span className="resumo-metric-val" style={{ color: func.ajustesMin > 0 ? "#2563eb" : func.ajustesMin < 0 ? "#dc2626" : "#9ca3af" }}>
                              {minParaHora(func.ajustesMin)}
                            </span>
                            <span className="resumo-metric-lbl">Ajustes</span>
                          </div>
                          <div className="resumo-metric">
                            <span className="resumo-metric-val" style={{ color: totalFaltas > 0 ? "#dc2626" : "#9ca3af" }}>
                              {totalFaltas}
                            </span>
                            <span className="resumo-metric-lbl">Faltas</span>
                          </div>
                          <div className="resumo-metric resumo-metric-saldo">
                            <span className="resumo-metric-val" style={{ color: func.saldoUltimoMes >= 0 ? "#059669" : "#dc2626" }}>
                              {minParaHora(func.saldoUltimoMes)}
                            </span>
                            <span className="resumo-metric-lbl">Saldo</span>
                          </div>
                        </div>

                        <span className="resumo-func-chevron">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="resumo-func-detail">
                          {/* Quick stats */}
                          <div className="resumo-func-stats">
                            <div className="resumo-stat">
                              <span className="resumo-stat-num">{func.diasTrabalhados}</span>
                              <span className="resumo-stat-lbl">Dias trab.</span>
                            </div>
                            <div className="resumo-stat">
                              <span className="resumo-stat-num">{func.feriasCount}</span>
                              <span className="resumo-stat-lbl">Dias férias</span>
                            </div>
                            <div className="resumo-stat">
                              <span className="resumo-stat-num" style={{ color: "#059669" }}>{minParaHora(func.extras50Min)}</span>
                              <span className="resumo-stat-lbl">Extra 50%</span>
                            </div>
                            <div className="resumo-stat">
                              <span className="resumo-stat-num" style={{ color: "#059669" }}>{minParaHora(func.extras100Min)}</span>
                              <span className="resumo-stat-lbl">Extra 100%</span>
                            </div>
                            {func.ajustesMin !== 0 && (
                              <div className="resumo-stat">
                                <span className="resumo-stat-num" style={{ color: "#2563eb" }}>{minParaHora(func.ajustesMin)}</span>
                                <span className="resumo-stat-lbl">Ajustes manuais</span>
                              </div>
                            )}
                            {func.valorPagar > 0 && (
                              <div className="resumo-stat">
                                <span className="resumo-stat-num" style={{ color: "#059669" }}>{formatMoney(func.valorPagar)}</span>
                                <span className="resumo-stat-lbl">A pagar</span>
                              </div>
                            )}
                            {func.valorDescontar > 0 && (
                              <div className="resumo-stat">
                                <span className="resumo-stat-num" style={{ color: "#dc2626" }}>{formatMoney(func.valorDescontar)}</span>
                                <span className="resumo-stat-lbl">A descontar</span>
                              </div>
                            )}
                          </div>

                          {/* Monthly evolution */}
                          {func.evolucao.length > 0 && (
                            <div className="resumo-evolucao">
                              <h4 className="resumo-evolucao-title">Evolução mensal ({periodoLabel})</h4>
                              <table className="data-table mobile-cards resumo-evolucao-table">
                                <thead>
                                  <tr>
                                    <th>Mês</th>
                                    <th>Extras 50%</th>
                                    <th>Extras 100%</th>
                                    <th>Devidas</th>
                                    <th>Ajustes</th>
                                    <th>Saldo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {func.evolucao.map((ev) => {
                                    const mesIdx = Number(ev.competencia.split("-")[1]) - 1;
                                    return (
                                      <tr key={ev.competencia}>
                                        <td data-label="Mês"><strong>{MESES_LABELS[mesIdx]}</strong></td>
                                        <td data-label="Extras 50%" style={{ color: ev.extras50Min > 0 ? "#059669" : "#9ca3af" }}>{minParaHora(ev.extras50Min)}</td>
                                        <td data-label="Extras 100%" style={{ color: ev.extras100Min > 0 ? "#059669" : "#9ca3af" }}>{minParaHora(ev.extras100Min)}</td>
                                        <td data-label="Devidas" style={{ color: ev.devidasMin < 0 ? "#dc2626" : "#9ca3af" }}>{minParaHora(ev.devidasMin)}</td>
                                        <td data-label="Ajustes" style={{ color: ev.ajustesMin !== 0 ? "#2563eb" : "#9ca3af" }}>{minParaHora(ev.ajustesMin)}</td>
                                        <td data-label="Saldo" style={{ fontWeight: 700, color: ev.saldoMin >= 0 ? "#059669" : "#dc2626" }}>{minParaHora(ev.saldoMin)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Employees WITHOUT ponto data */}
                {funcionariosSemPonto.length > 0 && (
                  <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Sem lançamento de ponto ({funcionariosSemPonto.length})
                    </span>
                  </div>
                )}
                {funcionariosSemPonto.map((func) => (
                  <div key={func.id} className="resumo-func resumo-func-sem-ponto">
                    <div className="resumo-func-row" style={{ opacity: 0.6 }}>
                      <div className="resumo-func-info">
                        <strong className="resumo-func-nome">{func.nome}</strong>
                        <span className="resumo-func-dept">{func.departamento}</span>
                      </div>
                      <span className="badge" style={{ backgroundColor: "#f3f4f6", color: "#6b7280", fontSize: "0.72rem", padding: "3px 10px", marginLeft: "auto", marginRight: 8 }}>
                        Sem lançamento
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}
