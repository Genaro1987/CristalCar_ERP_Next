"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import React, { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

type ResumoCarteira = {
  empresa: string;
  saldo: number;
  entradas: number;
  saidas: number;
};

type Indicador = {
  titulo: string;
  valor: string;
  descricao: string;
};

type Alertas = {
  entradasPeriodo: number;
  saidasPeriodo: number;
  vencidos: number;
};

type RhDados = {
  funcionariosAtivos: number;
  departamentos: number;
};

export default function FinanceiroDashboardPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/dashboard";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_DASHBOARD";
  const nomeTela = tela?.NOME_TELA ?? "Dashboard Executivo";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [periodo, setPeriodo] = useState("");
  const [carteira, setCarteira] = useState<ResumoCarteira[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [alertas, setAlertas] = useState<Alertas>({
    entradasPeriodo: 0,
    saidasPeriodo: 0,
    vencidos: 0,
  });
  const [rhData, setRhData] = useState<RhDados>({ funcionariosAtivos: 0, departamentos: 0 });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!empresa?.id) return;

    const buscarDashboard = async () => {
      try {
        setCarregando(true);
        let url = "/api/financeiro/dashboard";
        if (periodo) {
          url += `?periodo=${periodo}`;
        }

        const resposta = await fetch(url, {
          headers: { "x-empresa-id": String(empresa.id) },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            setCarteira(dados.data.carteira);
            setIndicadores(dados.data.indicadores);
            setAlertas(dados.data.alertas);
            if (dados.data.rh) {
              setRhData(dados.data.rh);
            }
          }
        }
      } catch (erro) {
        console.error("Erro ao buscar dados do dashboard:", erro);
      } finally {
        setCarregando(false);
      }
    };

    buscarDashboard();
  }, [empresa?.id, periodo]);

  const carteiraSelecionada = useMemo(
    () => carteira[0] || { empresa: "", saldo: 0, entradas: 0, saidas: 0 },
    [carteira]
  );
  const nomeEmpresa = empresa?.nomeFantasia || empresa?.cnpj || "Carregando...";
  const periodoLabel = periodo ? periodo.replace("-", "/") : "Mês Atual";

  const formatMoney = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <LayoutShell>
      <div className="page-container financeiro-page">
        <HeaderBar
          nomeTela={nomeTela}
          codigoTela={codigoTela}
          caminhoRota={caminhoTela}
          modulo={moduloTela}
        />

        <main className="page-content-card" style={{ background: "transparent", boxShadow: "none", padding: 0 }}>
          {/* Header + Filtro */}
          <section className="panel">
            <div className="form-section-header">
              <div>
                <h2>Visão Geral</h2>
                <p>Acompanhe os principais indicadores de {nomeEmpresa}</p>
              </div>
              <div className="form-group" style={{ minWidth: 160 }}>
                <label htmlFor="dashboard-periodo">Competência</label>
                <input
                  id="dashboard-periodo"
                  type="month"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </section>

          {/* KPI Cards */}
          <section className="summary-cards" style={{ marginTop: 16 }}>
            <div className="summary-card" style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)", color: "#fff" }}>
              <span className="summary-label" style={{ color: "#94a3b8" }}>Saldo em Caixa</span>
              <strong className="summary-value" style={{ color: "#fff" }}>{formatMoney(carteiraSelecionada.saldo)}</strong>
              <span style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 4 }}>Atualizado agora</span>
            </div>

            <div className="summary-card">
              <span className="summary-label">Entradas</span>
              <strong className="summary-value" style={{ color: "#059669" }}>{formatMoney(carteiraSelecionada.entradas)}</strong>
              <span style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 4 }}>Receitas ({periodoLabel})</span>
            </div>

            <div className="summary-card">
              <span className="summary-label">Saídas</span>
              <strong className="summary-value" style={{ color: "#dc2626" }}>{formatMoney(carteiraSelecionada.saidas)}</strong>
              <span style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 4 }}>Despesas ({periodoLabel})</span>
            </div>

            <div className="summary-card">
              <span className="summary-label">Pessoal Ativo</span>
              <strong className="summary-value">{rhData.funcionariosAtivos}</strong>
              <span style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 4 }}>{rhData.departamentos} departamentos</span>
            </div>
          </section>

          {/* Main Content - 2 columns */}
          <div className="split-view" style={{ marginTop: 16 }}>
            {/* Left Column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Indicadores */}
              <div className="panel">
                <div className="form-section-header">
                  <h2>Indicadores de Performance</h2>
                </div>
                <div className="summary-cards" style={{ marginTop: 12 }}>
                  {carregando ? (
                    <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>Calculando métricas...</p>
                  ) : (
                    indicadores.map((ind, idx) => (
                      <div key={idx} className="detail-card" style={{ padding: "12px 16px" }}>
                        <span className="detail-label">{ind.titulo}</span>
                        <strong style={{ fontSize: "1.15rem", color: "#111827" }}>{ind.valor}</strong>
                        <span style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 4 }}>{ind.descricao}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Movimentação por Empresa */}
              <div className="panel">
                <div className="form-section-header">
                  <h2>Movimentação por Empresa</h2>
                </div>
                <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ marginTop: 12, minWidth: 400 }}>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th style={{ textAlign: "right" }}>Entradas</th>
                      <th style={{ textAlign: "right" }}>Saídas</th>
                      <th style={{ textAlign: "right" }}>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carteira.map((c, i) => (
                      <tr key={i}>
                        <td>{c.empresa}</td>
                        <td style={{ textAlign: "right", color: "#059669" }}>{formatMoney(c.entradas)}</td>
                        <td style={{ textAlign: "right", color: "#dc2626" }}>{formatMoney(c.saidas)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(c.entradas - c.saidas)}</td>
                      </tr>
                    ))}
                    {carteira.length === 0 && !carregando && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>
                          Nenhum movimento registrado no período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            {/* Right Column - Alertas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="panel">
                <div className="form-section-header">
                  <h2>Atenção Necessária</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                  <div className="detail-card" style={{ borderLeft: "4px solid #dc2626", padding: "12px 16px" }}>
                    <span className="detail-label" style={{ color: "#dc2626" }}>Contas Vencidas</span>
                    <strong style={{ fontSize: "1.15rem", color: "#991b1b" }}>{formatMoney(alertas.vencidos)}</strong>
                  </div>
                  <div className="detail-card" style={{ borderLeft: "4px solid #f59e0b", padding: "12px 16px" }}>
                    <span className="detail-label" style={{ color: "#d97706" }}>Saídas Previstas</span>
                    <strong style={{ fontSize: "1.15rem", color: "#92400e" }}>{formatMoney(alertas.saidasPeriodo)}</strong>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="form-section-header">
                  <h2>Links Rápidos</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  <a href="/financeiro/lancamentos" className="button button-secondary" style={{ textAlign: "left", textDecoration: "none" }}>
                    Lançamentos Financeiros
                  </a>
                  <a href="/financeiro/dre" className="button button-secondary" style={{ textAlign: "left", textDecoration: "none" }}>
                    Relatório DRE
                  </a>
                  <a href="/financeiro/objetivos" className="button button-secondary" style={{ textAlign: "left", textDecoration: "none" }}>
                    Objetivos Financeiros
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </LayoutShell>
  );
}
