"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

interface PlanoContaOption {
  id: number;
  label: string;
  natureza: "RECEITA" | "DESPESA";
}

interface ExtratoLinha {
  semana: string;
  inicio: string;
  fim: string;
  receitaSemanaAnterior: number;
  credito: number;
  despesa: number;
  saldo: number;
  saldoAcumulado: number;
}

interface ExtratoData {
  configurado: boolean;
  config: { percentual: number; saldoInicial: number } | null;
  extrato: ExtratoLinha[];
}

interface ConfigAtual {
  percentual: number;
  saldoInicial: number;
  dataInicio: string;
  contasReceitaExcluidas: number[];
  contasDespesaProlabore: number[];
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function mesAtualInicio(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function mesAtualFim(): string {
  const d = new Date();
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, "0")}-${String(ultimo.getDate()).padStart(2, "0")}`;
}

export default function ExtratoProlaborePage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/extrato-prolabore";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_PROLABORE";
  const nomeTela = tela?.NOME_TELA ?? "EXTRATO PRO-LABORE";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [dataInicio, setDataInicio] = useState(mesAtualInicio);
  const [dataFim, setDataFim] = useState(mesAtualFim);
  const [extrato, setExtrato] = useState<ExtratoData | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Config state
  const [mostraConfig, setMostraConfig] = useState(false);
  const [planoContas, setPlanoContas] = useState<PlanoContaOption[]>([]);
  const [cfgPercentual, setCfgPercentual] = useState("12.5");
  const [cfgSaldoInicial, setCfgSaldoInicial] = useState("0");
  const [cfgDataInicio, setCfgDataInicio] = useState("");
  const [cfgExcluidas, setCfgExcluidas] = useState<number[]>([]);
  const [cfgDespesas, setCfgDespesas] = useState<number[]>([]);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const headersPadrao = useMemo<HeadersInit>(() => {
    const h: Record<string, string> = {};
    if (empresa?.id) h["x-empresa-id"] = String(empresa.id);
    return h;
  }, [empresa?.id]);

  // Carregar plano de contas
  useEffect(() => {
    if (!empresa?.id) return;
    const carregar = async () => {
      try {
        const res = await fetch("/api/financeiro/plano-contas", { headers: headersPadrao });
        const json = await res.json();
        if (json.success) {
          setPlanoContas(
            (json.data ?? []).map((item: any) => ({
              id: item.FIN_PLANO_CONTA_ID,
              label: `${item.FIN_PLANO_CONTA_CODIGO} ${item.FIN_PLANO_CONTA_NOME}`,
              natureza: item.FIN_PLANO_CONTA_NATUREZA,
            }))
          );
        }
      } catch (e) {
        console.error("Erro ao carregar plano de contas:", e);
      }
    };
    carregar();
  }, [empresa?.id, headersPadrao]);

  // Buscar extrato
  const buscarExtrato = useCallback(async () => {
    if (!empresa?.id) return;
    setCarregando(true);
    setErro(null);
    try {
      const url = `/api/financeiro/prolabore?dataInicio=${dataInicio}&dataFim=${dataFim}`;
      const res = await fetch(url, { headers: headersPadrao });
      const json = await res.json();
      if (res.ok && json.success) {
        setExtrato(json.data);
        if (json.data?.config) {
          setCfgPercentual(String(json.data.config.percentual));
          setCfgSaldoInicial(String(json.data.config.saldoInicial));
        }
      } else {
        setErro(json.error || "Erro ao buscar extrato");
      }
    } catch (e) {
      setErro("Erro de conexão ao buscar extrato");
    } finally {
      setCarregando(false);
    }
  }, [empresa?.id, dataInicio, dataFim, headersPadrao]);

  useEffect(() => {
    buscarExtrato();
  }, [buscarExtrato]);

  // Salvar config
  const salvarConfig = async () => {
    if (!empresa?.id) return;
    setSalvandoConfig(true);
    try {
      const res = await fetch("/api/financeiro/prolabore", {
        method: "POST",
        headers: { ...headersPadrao, "Content-Type": "application/json" },
        body: JSON.stringify({
          percentual: Number(cfgPercentual) || 12.5,
          saldoInicial: Number(cfgSaldoInicial) || 0,
          dataInicio: cfgDataInicio,
          contasReceitaExcluidas: cfgExcluidas,
          contasDespesaProlabore: cfgDespesas,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotification({ type: "success", message: "Configuração salva com sucesso" });
        setMostraConfig(false);
        buscarExtrato();
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao salvar" });
      }
    } catch (e) {
      setNotification({ type: "error", message: "Erro de conexão" });
    } finally {
      setSalvandoConfig(false);
    }
  };

  const toggleConta = (contaId: number, lista: number[], setLista: (v: number[]) => void) => {
    if (lista.includes(contaId)) {
      setLista(lista.filter((id) => id !== contaId));
    } else {
      setLista([...lista, contaId]);
    }
  };

  const contasReceita = planoContas.filter((c) => c.natureza === "RECEITA");
  const contasDespesa = planoContas.filter((c) => c.natureza === "DESPESA");

  const totais = useMemo(() => {
    if (!extrato?.extrato?.length) return { credito: 0, despesa: 0, saldo: 0 };
    return extrato.extrato.reduce(
      (acc, l) => ({
        credito: acc.credito + l.credito,
        despesa: acc.despesa + l.despesa,
        saldo: acc.saldo + l.saldo,
      }),
      { credito: 0, despesa: 0, saldo: 0 }
    );
  }, [extrato]);

  return (
    <LayoutShell>
      <div className="page-container financeiro-page">
        <HeaderBar
          codigoTela={codigoTela}
          nomeTela={nomeTela}
          caminhoRota={caminhoTela}
          modulo={moduloTela}
        />

        <PaginaProtegida codigoTela={codigoTela}>
        <main className="page-content-card">
          {notification && (
            <NotificationBar
              type={notification.type}
              message={notification.message}
            />
          )}

          <div className="departamentos-page">
            {/* Filtros e resumo */}
            <section className="panel">
              <div className="section-header">
                <div>
                  <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>
                    Credito: {cfgPercentual}% das receitas (semana anterior).
                    Debito: despesas pro-labore (semana atual).
                    Periodo sabado a sexta.
                  </p>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setMostraConfig(!mostraConfig)}
                  >
                    {mostraConfig ? "Fechar config" : "Configurar"}
                  </button>
                </div>
              </div>

              <div className="form-grid two-columns">
                <div className="form-group">
                  <label htmlFor="pl-data-inicio">Data início</label>
                  <input
                    id="pl-data-inicio"
                    type="date"
                    className="form-input"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="pl-data-fim">Data fim</label>
                  <input
                    id="pl-data-fim"
                    type="date"
                    className="form-input"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
              </div>

              {extrato?.configurado && (
                <div className="summary-cards" style={{ marginTop: 16 }}>
                  <div className="summary-card">
                    <p className="summary-card-label">Total créditos</p>
                    <p className="summary-card-value positive">
                      {formatarMoeda(totais.credito)}
                    </p>
                    <p className="summary-card-hint">{cfgPercentual}% das receitas</p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-card-label">Total débitos</p>
                    <p className="summary-card-value negative">
                      {formatarMoeda(totais.despesa)}
                    </p>
                    <p className="summary-card-hint">Despesas pró-labore</p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-card-label">Resultado período</p>
                    <p className={`summary-card-value ${totais.saldo >= 0 ? "positive" : "negative"}`}>
                      {formatarMoeda(totais.saldo)}
                    </p>
                    <p className="summary-card-hint">Créditos - Débitos</p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-card-label">Saldo acumulado</p>
                    <p
                      className={`summary-card-value ${
                        (extrato.extrato[extrato.extrato.length - 1]?.saldoAcumulado ?? 0) >= 0
                          ? "positive"
                          : "negative"
                      }`}
                    >
                      {formatarMoeda(
                        extrato.extrato[extrato.extrato.length - 1]?.saldoAcumulado ?? extrato.config?.saldoInicial ?? 0
                      )}
                    </p>
                    <p className="summary-card-hint">
                      Saldo inicial: {formatarMoeda(extrato.config?.saldoInicial ?? 0)}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Painel de configuração */}
            {mostraConfig && (
              <section className="panel">
                <div className="section-header">
                  <div>
                    <h2>Configuração do Pró-labore</h2>
                    <p>Defina percentual, saldo inicial e contas envolvidas no cálculo.</p>
                  </div>
                </div>

                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    salvarConfig();
                  }}
                >
                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label htmlFor="cfg-percentual">Percentual sobre receitas (%)</label>
                      <input
                        id="cfg-percentual"
                        type="number"
                        step="0.1"
                        className="form-input"
                        value={cfgPercentual}
                        onChange={(e) => setCfgPercentual(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="cfg-saldo-inicial">Saldo inicial (R$)</label>
                      <input
                        id="cfg-saldo-inicial"
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={cfgSaldoInicial}
                        onChange={(e) => setCfgSaldoInicial(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="cfg-data-inicio">Data início do cálculo</label>
                      <input
                        id="cfg-data-inicio"
                        type="date"
                        className="form-input"
                        value={cfgDataInicio}
                        onChange={(e) => setCfgDataInicio(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-grid two-columns">
                    <div className="form-group">
                      <label>Contas de receita EXCLUÍDAS do cálculo</label>
                      <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                        {contasReceita.length === 0 ? (
                          <p className="helper-text">Nenhuma conta de receita cadastrada</p>
                        ) : (
                          contasReceita.map((c) => (
                            <label key={c.id} className="checkbox-row" style={{ marginBottom: 4 }}>
                              <input
                                type="checkbox"
                                checked={cfgExcluidas.includes(c.id)}
                                onChange={() => toggleConta(c.id, cfgExcluidas, setCfgExcluidas)}
                              />
                              <span style={{ fontSize: "0.85rem" }}>{c.label}</span>
                            </label>
                          ))
                        )}
                      </div>
                      <p className="helper-text">
                        Marque as contas que NÃO devem entrar no cálculo (ex: conta reserva, outras receitas)
                      </p>
                    </div>
                    <div className="form-group">
                      <label>Contas de despesa pró-labore</label>
                      <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                        {contasDespesa.length === 0 ? (
                          <p className="helper-text">Nenhuma conta de despesa cadastrada</p>
                        ) : (
                          contasDespesa.map((c) => (
                            <label key={c.id} className="checkbox-row" style={{ marginBottom: 4 }}>
                              <input
                                type="checkbox"
                                checked={cfgDespesas.includes(c.id)}
                                onChange={() => toggleConta(c.id, cfgDespesas, setCfgDespesas)}
                              />
                              <span style={{ fontSize: "0.85rem" }}>{c.label}</span>
                            </label>
                          ))
                        )}
                      </div>
                      <p className="helper-text">
                        Marque as contas cujas despesas são debitadas do pró-labore
                      </p>
                    </div>
                  </div>

                  <div className="form-actions">
                    <div className="button-row">
                      <button
                        type="submit"
                        className="button button-primary"
                        disabled={salvandoConfig}
                      >
                        {salvandoConfig ? "Salvando..." : "Salvar configuração"}
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setMostraConfig(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {/* Extrato */}
            <section className="panel">
              <div className="section-header">
                <div>
                  <h2>Extrato semanal</h2>
                  <p>Períodos de sábado a sexta. Crédito da semana anterior, débito da semana atual.</p>
                </div>
                {extrato?.extrato && (
                  <span className="badge-count">
                    {extrato.extrato.length} semanas
                  </span>
                )}
              </div>

              {erro && <p className="error-text">{erro}</p>}

              {carregando ? (
                <div className="empty-state">
                  <p>Carregando extrato...</p>
                </div>
              ) : !extrato?.configurado ? (
                <div className="empty-state">
                  <strong>Pró-labore não configurado</strong>
                  <p>
                    Clique em &quot;Configurar&quot; para definir o percentual, saldo inicial e
                    quais contas participam do cálculo.
                  </p>
                </div>
              ) : extrato.extrato.length === 0 ? (
                <div className="empty-state">
                  <strong>Nenhuma semana no período</strong>
                  <p>Ajuste as datas de início e fim para visualizar o extrato.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="extrato-table">
                    <thead>
                      <tr>
                        <th>Semana</th>
                        <th className="text-right">Receita (sem. anterior)</th>
                        <th className="text-right">Crédito ({cfgPercentual}%)</th>
                        <th className="text-right">Débito (pró-labore)</th>
                        <th className="text-right">Saldo semana</th>
                        <th className="text-right">Saldo acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extrato.extrato.map((linha, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{linha.semana}</strong>
                          </td>
                          <td className="text-right">
                            {formatarMoeda(linha.receitaSemanaAnterior)}
                          </td>
                          <td className="text-right credit">
                            +{formatarMoeda(linha.credito)}
                          </td>
                          <td className="text-right debit">
                            -{formatarMoeda(linha.despesa)}
                          </td>
                          <td
                            className={`text-right ${linha.saldo >= 0 ? "credit" : "debit"}`}
                          >
                            {formatarMoeda(linha.saldo)}
                          </td>
                          <td
                            className={`text-right ${linha.saldoAcumulado >= 0 ? "credit" : "debit"}`}
                            style={{ fontWeight: 700 }}
                          >
                            {formatarMoeda(linha.saldoAcumulado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #e5e7eb", fontWeight: 700 }}>
                        <td>TOTAL</td>
                        <td className="text-right">-</td>
                        <td className="text-right credit">
                          +{formatarMoeda(totais.credito)}
                        </td>
                        <td className="text-right debit">
                          -{formatarMoeda(totais.despesa)}
                        </td>
                        <td
                          className={`text-right ${totais.saldo >= 0 ? "credit" : "debit"}`}
                        >
                          {formatarMoeda(totais.saldo)}
                        </td>
                        <td
                          className={`text-right ${
                            (extrato.extrato[extrato.extrato.length - 1]?.saldoAcumulado ?? 0) >= 0
                              ? "credit"
                              : "debit"
                          }`}
                        >
                          {formatarMoeda(
                            extrato.extrato[extrato.extrato.length - 1]?.saldoAcumulado ?? 0
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}
