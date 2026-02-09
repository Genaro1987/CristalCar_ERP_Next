"use client";

import { useEffect, useMemo, useState } from "react";

import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { ModalExportacao, type OpcoesExportacao } from "@/components/ModalExportacao";
import { minutesToDecimal, minutosParaHora } from "@/lib/rhPontoCalculo";
import { exportarPDF, exportarExcel } from "@/lib/exportarBancoHoras";
import type { ResumoBancoHorasMes } from "@/db/rhBancoHoras";
import {
  formatarTipoDiaParaExibicao,
  formatarObservacaoParaExibicao,
  mapearClassificacaoParaExibicao,
  resumirTotaisDias,
} from "@/lib/bancoHorasHelpers";

interface FuncionarioOption {
  ID_FUNCIONARIO: string;
  NOME_COMPLETO: string;
}

interface PeriodoOption {
  valor: string;
  nome: string;
  situacao: string;
}

const nomesMeses: Record<number, string> = {
  1: "Janeiro",
  2: "Fevereiro",
  3: "Março",
  4: "Abril",
  5: "Maio",
  6: "Junho",
  7: "Julho",
  8: "Agosto",
  9: "Setembro",
  10: "Outubro",
  11: "Novembro",
  12: "Dezembro",
};

function competenciaAtual() {
  const hoje = new Date();
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function mesParaTexto(mesNumero: number): string {
  return nomesMeses[mesNumero] ?? mesNumero.toString();
}

function mesParaValor(mesNumero: number): string {
  return mesNumero.toString().padStart(2, "0");
}

function formatarFaixaHorario(inicio?: string | null, fim?: string | null) {
  if (!inicio && !fim) return null;
  if (!inicio || !fim) return inicio ?? fim ?? null;
  return `${inicio} - ${fim}`;
}

function construirLinhaJornada(jornada: ResumoBancoHorasMes["jornada"] | null | undefined) {
  if (!jornada) return null;

  const turnos = [
    formatarFaixaHorario(jornada.entradaManha, jornada.saidaManha),
    formatarFaixaHorario(jornada.entradaTarde, jornada.saidaTarde),
  ].filter(Boolean);

  return {
    horario: turnos.join(" | ") || "Horários não informados",
    tolerancia: minutosParaHora(jornada.toleranciaMinutos),
    cargaPrevista: minutosParaHora(jornada.minutosPrevistos),
  };
}

export default function BancoHorasConsultaPage() {
  useRequerEmpresaSelecionada({ ativo: true });
  const { empresa } = useEmpresaSelecionada();
  const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);
  const [resumo, setResumo] = useState<ResumoBancoHorasMes | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const compAtual = useMemo(() => competenciaAtual(), []);
  const [idFuncionario, setIdFuncionario] = useState("");
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([compAtual.ano]);
  const [ano, setAno] = useState(compAtual.ano);
  const [mes, setMes] = useState(compAtual.mes.toString().padStart(2, "0"));
  const [loading, setLoading] = useState(false);
  const [modalExportacaoAberto, setModalExportacaoAberto] = useState(false);
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<PeriodoOption[]>([]);

  const periodoSelecionado = useMemo(
    () => periodosDisponiveis.find((p) => p.valor === mes) ?? null,
    [mes, periodosDisponiveis]
  );

  const pesquisaHabilitada =
    !loading && !!idFuncionario && Number.isFinite(ano) && Boolean(mes) && Boolean(periodoSelecionado);

  const exportacaoHabilitada = pesquisaHabilitada && periodoSelecionado?.situacao === "FECHADO";

  const empresaId = empresa?.id ?? null;

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (empresaId) {
      headers["x-empresa-id"] = String(empresaId);
    }
    return headers;
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    fetch("/api/rh/funcionarios", { headers: headersPadrao })
      .then((r) => r.json())
      .then((json) => setFuncionarios(json?.data ?? []))
      .catch(() => setFuncionarios([]));

    fetch("/api/rh/anos-disponiveis", { headers: headersPadrao })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.length > 0) {
          setAnosDisponiveis(json.data);
          if (!json.data.includes(ano)) setAno(json.data[0]);
        }
      })
      .catch(() => {});
  }, [empresaId, headersPadrao]);

  useEffect(() => {
    if (!empresaId || !idFuncionario) {
      setPeriodosDisponiveis([]);
      return;
    }

    const controller = new AbortController();

    fetch(
      `/api/rh/banco-horas/periodos?funcionarioId=${idFuncionario}&ano=${ano}&situacoes=CALCULADO,FECHADO`,
      { headers: headersPadrao, signal: controller.signal }
    )
      .then((r) => r.json())
      .then((json) => {
        const periodos = (json?.data ?? []).map((p: { MES_REFERENCIA: number; SITUACAO_PERIODO: string }) => ({
          valor: mesParaValor(p.MES_REFERENCIA),
          nome: mesParaTexto(p.MES_REFERENCIA),
          situacao: p.SITUACAO_PERIODO,
        }));
        setPeriodosDisponiveis(periodos);
      })
      .catch(() => setPeriodosDisponiveis([]));

    return () => controller.abort();
  }, [empresaId, headersPadrao, idFuncionario, ano]);

  useEffect(() => {
    if (periodosDisponiveis.length === 0) return;
    const mesDisponivel = periodosDisponiveis.some((p) => p.valor === mes);
    if (!mesDisponivel) {
      setMes(periodosDisponiveis[0].valor);
    }
  }, [mes, periodosDisponiveis]);

  const pesquisar = async () => {
    if (!idFuncionario) {
      setNotification({ type: "info", message: "Selecione um funcionário" });
      return;
    }
    if (!mes || !periodoSelecionado) {
      setNotification({ type: "info", message: "Selecione um período completo (ano e mês)" });
      return;
    }
    setNotification(null);
    setLoading(true);
    try {
      const resp = await fetch(
        `/api/rh/banco-horas/resumo?idFuncionario=${idFuncionario}&ano=${ano}&mes=${mes}&politicaFaltas=COMPENSAR_COM_HORAS_EXTRAS&zerarBancoNoMes=true`,
        { headers: headersPadrao }
      );
      const json = await resp.json();
      if (json?.success) {
        setResumo(json.data);
      } else {
        setNotification({ type: "error", message: "Não foi possível carregar o resumo" });
      }
    } catch (error) {
      console.error(error);
      setNotification({ type: "error", message: "Erro ao consultar banco de horas" });
    } finally {
      setLoading(false);
    }
  };

  const handleExportar = async (opcoes: OpcoesExportacao) => {
    const dadosParaExportar = [];

    // Busca dados completos da empresa
    let dadosEmpresa = {
      nome: empresa?.nomeFantasia || "Empresa",
      cnpj: empresa?.cnpj,
      razaoSocial: "",
    };

    if (empresaId) {
      try {
        const respEmp = await fetch(`/api/empresas/${empresaId}`, { headers: headersPadrao });
        const jsonEmp = await respEmp.json();
        if (jsonEmp?.success && jsonEmp?.empresa) {
          dadosEmpresa = {
            nome: jsonEmp.empresa.NOME_FANTASIA || "Empresa",
            cnpj: jsonEmp.empresa.CNPJ,
            razaoSocial: jsonEmp.empresa.RAZAO_SOCIAL || "",
          };
        }
      } catch (error) {
        console.error("Erro ao buscar dados da empresa:", error);
      }
    }

    for (const funcId of opcoes.funcionariosSelecionados) {
      try {
        const resp = await fetch(
          `/api/rh/banco-horas/resumo?idFuncionario=${funcId}&ano=${ano}&mes=${mes}&politicaFaltas=COMPENSAR_COM_HORAS_EXTRAS&zerarBancoNoMes=false`,
          { headers: headersPadrao }
        );
        const json = await resp.json();
        if (json?.success) {
          dadosParaExportar.push({
            resumo: json.data,
            empresa: dadosEmpresa,
            politica: "COMPENSAR_COM_HORAS_EXTRAS" as const,
            zerarBanco: false,
          });
        }
      } catch (error) {
        console.error(`Erro ao buscar dados do funcionário ${funcId}:`, error);
      }
    }

    if (dadosParaExportar.length === 0) {
      setNotification({ type: "error", message: "Nenhum dado disponível para exportação" });
      return;
    }

    if (opcoes.exportarPDF) {
      // Exporta PDF
      dadosParaExportar.forEach((dados) => exportarPDF(dados));

      // Finaliza/fecha os meses após exportar PDF
      for (const dados of dadosParaExportar) {
        const r = dados.resumo;
        try {
          const valorHora = r.funcionario.valorHora;
          const valorPagar =
            minutesToDecimal(r.horasPagar50Min) * valorHora * 1.5 +
            minutesToDecimal(r.horasPagar100Min) * valorHora * 2;
          const valorDescontar = minutesToDecimal(r.horasDescontarMin) * valorHora;

          await fetch("/api/rh/banco-horas/finalizar", {
            method: "POST",
            headers: headersPadrao,
            body: JSON.stringify({
              idFuncionario: r.funcionario.id,
              ano: r.competencia.ano,
              mes: r.competencia.mes,
              saldoAnteriorMinutos: r.saldoAnteriorMin,
              horasExtras50Minutos: r.extrasUteisMin,
              horasExtras100Minutos: r.extras100Min,
              horasDevidasMinutos: r.devidasMin,
              ajustesMinutos: r.ajustesManuaisMin,
              saldoFinalMinutos: r.saldoFinalBancoMin,
              politicaFaltas: dados.politica,
              zerouBanco: dados.zerarBanco,
              valorPagar,
              valorDescontar,
            }),
          });
        } catch (error) {
          console.error("Erro ao finalizar mês:", error);
        }
      }
    }

    if (opcoes.exportarExcel) {
      exportarExcel(dadosParaExportar);
    }

    setNotification({
      type: "success",
      message: `Exportação concluída com sucesso! ${dadosParaExportar.length} registro(s) exportado(s).${opcoes.exportarPDF ? " Períodos finalizados." : ""}`,
    });
  };
  const resumoValores = resumo
    ? (() => {
        const totais = resumirTotaisDias(resumo.dias);
        const horasExtra50 = Math.max(0, totais.extras50Min);
        const horasExtra100 = Math.max(0, totais.extras100Min);
        const horasDevidas = Math.min(0, totais.devidasMin);
        const vh = resumo.funcionario.valorHora;

        // Valores na base (sem multiplicador) para comparação justa
        const valorExtra50Base = (horasExtra50 / 60) * vh;
        const valorExtra100Base = (horasExtra100 / 60) * vh;
        const valorDevidoBase = (horasDevidas / 60) * vh; // já negativo

        // Saldo do mês (apenas movimentação do período)
        const saldoPeriodoMin = horasExtra50 + horasExtra100 + horasDevidas;
        const valorSaldoPeriodo = (saldoPeriodoMin / 60) * vh;

        // Saldo anterior
        const saldoAnteriorMin = resumo.saldoAnteriorMin;
        const valorSaldoAnterior = (saldoAnteriorMin / 60) * vh;

        // Ajustes e fechamentos
        const saldoAjustes = resumo.ajustesManuaisMin + resumo.fechamentosMin;

        // Saldo total = anterior + período + ajustes
        const saldoTotalMin = saldoAnteriorMin + saldoPeriodoMin + saldoAjustes;
        const valorSaldoTotal = (saldoTotalMin / 60) * vh;

        return {
          horasExtra50,
          horasExtra100,
          horasDevidas,
          valorExtra50Base,
          valorExtra100Base,
          valorDevidoBase,
          saldoPeriodoMin,
          valorSaldoPeriodo,
          saldoAnteriorMin,
          valorSaldoAnterior,
          saldoAjustes,
          saldoTotalMin,
          valorSaldoTotal,
          jornadaInfo: construirLinhaJornada(resumo.jornada),
        };
      })()
    : null;

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="CONS001_RH_BANCO_HORAS"
          nomeTela="CONSULTA PONTO"
          caminhoRota="/rh/banco-horas/consulta"
          modulo="RECURSOS HUMANOS"
        />

        <PaginaProtegida codigoTela="CONS001_RH_BANCO_HORAS">
        <main className="page-content-card">
          {notification && <NotificationBar type={notification.type} message={notification.message} />}

          <div className="panel" style={{ maxWidth: "none" }}>
            <div className="form-section-header">
              <h2>Filtros</h2>
              <p>Selecione o funcionário e competência para consultar o banco de horas</p>
            </div>

            <div className="form">
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="form-group" style={{ flex: "2", minWidth: "250px" }}>
                  <label htmlFor="funcionario">Funcionário</label>
                  <select
                    id="funcionario"
                    value={idFuncionario}
                    onChange={(e) => setIdFuncionario(e.target.value)}
                    className="form-input"
                  >
                    <option value="">Selecione</option>
                    {funcionarios.map((f) => (
                      <option key={f.ID_FUNCIONARIO} value={f.ID_FUNCIONARIO}>
                        {f.NOME_COMPLETO}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: "0 0 120px" }}>
                  <label htmlFor="ano">Ano</label>
                  <select
                    id="ano"
                    value={ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                    className="form-input"
                  >
                    {anosDisponiveis.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: "1", minWidth: "150px" }}>
                  <label htmlFor="mes">Mês</label>
                  <select
                  id="mes"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="form-input"
                >
                  <option value="">Selecione</option>
                  {periodosDisponiveis.map((m) => (
                    <option key={`${m.valor}-${m.situacao}`} value={m.valor}>
                      {m.nome} ({m.situacao})
                    </option>
                  ))}
                </select>
              </div>

                <div style={{ flex: "0 0 auto", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={pesquisar}
                    disabled={!pesquisaHabilitada}
                    className="button button-primary"
                  >
                    {loading ? "Buscando..." : "Pesquisar"}
                  </button>
                  <button
                    onClick={() => setModalExportacaoAberto(true)}
                    className="button"
                    disabled={!exportacaoHabilitada}
                    style={{
                      backgroundColor: exportacaoHabilitada ? "#059669" : "#9ca3af",
                      color: "white",
                    }}
                  >
                    Exportar Arquivos
                  </button>
                </div>
              </div>
            </div>

          {resumo && resumoValores && (
            <>
              <div className="form-section-header" style={{ marginTop: "32px" }}>
                <h2>{resumo.funcionario.nome}</h2>
                <p>
                  Competência: {String(resumo.competencia.mes).padStart(2, "0")}/{resumo.competencia.ano}
                </p>
              </div>

              {/* RESUMO DO MES */}
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#374151", marginBottom: 8 }}>RESUMO DO MES</h3>
                <div className="banco-horas-summary-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                  <div className="form-group">
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}>EXTRAS 50%</label>
                    <div className="form-input" style={{ backgroundColor: "#f0fdf4", color: "#059669" }}>
                      {minutosParaHora(resumoValores.horasExtra50)}
                    </div>
                    <small style={{ color: "#6b7280", fontSize: "0.75rem" }}>{formatarMoeda(resumoValores.valorExtra50Base)}</small>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}>EXTRAS 100%</label>
                    <div className="form-input" style={{ backgroundColor: "#f0fdf4", color: "#059669" }}>
                      {minutosParaHora(resumoValores.horasExtra100)}
                    </div>
                    <small style={{ color: "#6b7280", fontSize: "0.75rem" }}>{formatarMoeda(resumoValores.valorExtra100Base)}</small>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}>HORAS DEVIDAS</label>
                    <div className="form-input" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
                      {minutosParaHora(resumoValores.horasDevidas)}
                    </div>
                    <small style={{ color: "#6b7280", fontSize: "0.75rem" }}>{formatarMoeda(resumoValores.valorDevidoBase)}</small>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}>SALDO DO MES</label>
                    <div className="form-input" style={{ backgroundColor: "#fff3cd", fontWeight: 700 }}>
                      {minutosParaHora(resumoValores.saldoPeriodoMin)}
                    </div>
                    <small style={{ color: "#6b7280", fontSize: "0.75rem" }}>{formatarMoeda(resumoValores.valorSaldoPeriodo)}</small>
                  </div>
                </div>
              </div>

              {/* COMPOSICAO DO SALDO */}
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#374151", marginBottom: 8 }}>COMPOSICAO DO SALDO</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: 8, alignItems: "start" }}>
                  <div className="form-group">
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}>SALDO ANTERIOR</label>
                    <div className="form-input" style={{ backgroundColor: "#f3f4f6" }}>
                      {minutosParaHora(resumoValores.saldoAnteriorMin)}
                    </div>
                    <small style={{ color: "#6b7280", fontSize: "0.75rem" }}>{formatarMoeda(resumoValores.valorSaldoAnterior)}</small>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", paddingTop: 22, fontWeight: 700, fontSize: "1.2rem", color: "#6b7280" }}>+</div>
                  <div className="form-group">
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}>SALDO DO MES</label>
                    <div className="form-input" style={{ backgroundColor: resumoValores.saldoPeriodoMin >= 0 ? "#f0fdf4" : "#fef2f2", color: resumoValores.saldoPeriodoMin >= 0 ? "#059669" : "#dc2626" }}>
                      {minutosParaHora(resumoValores.saldoPeriodoMin)}
                    </div>
                    <small style={{ color: "#6b7280", fontSize: "0.75rem" }}>{formatarMoeda(resumoValores.valorSaldoPeriodo)}</small>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", paddingTop: 22, fontWeight: 700, fontSize: "1.2rem", color: "#6b7280" }}>=</div>
                  <div className="form-group">
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}>SALDO TOTAL</label>
                    <div className="form-input" style={{ backgroundColor: "#fff3cd", fontWeight: 700 }}>
                      {minutosParaHora(resumoValores.saldoTotalMin)}
                    </div>
                    <small style={{ color: "#6b7280", fontSize: "0.75rem" }}>{formatarMoeda(resumoValores.valorSaldoTotal)}</small>
                  </div>
                </div>

                {resumoValores.saldoAjustes !== 0 && (
                  <div style={{ marginTop: 8, fontSize: "0.82rem", color: "#6b7280" }}>
                    Ajustes e Fechamentos: {minutosParaHora(resumoValores.saldoAjustes)} = {formatarMoeda((resumoValores.saldoAjustes / 60) * resumo.funcionario.valorHora)}
                  </div>
                )}
              </div>

              <div className="form-section-header" style={{ marginTop: "40px" }}>
                <h2>Detalhamento Diário</h2>
              </div>

              {resumoValores.jornadaInfo && (
                <div className="jornada-info-line">
                  <strong>Jornada diária:</strong>
                  <span>{resumoValores.jornadaInfo.horario}</span>
                  <span>• Prevista: {resumoValores.jornadaInfo.cargaPrevista}</span>
                  <span>• Tolerância: {resumoValores.jornadaInfo.tolerancia}</span>
                </div>
              )}

                <table className="data-table mobile-cards banco-horas-detalhamento-table">
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th>Tipo</th>
                      <th>Ocorrência</th>
                      <th>Trabalhado</th>
                      <th>Diferença</th>
                      <th>Classificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.dias.map((dia) => {
                      const obs = formatarObservacaoParaExibicao(dia.observacao);
                      const isFeriado = dia.tipoDia === "FERIADO";
                      const isFerias = (dia.observacao ?? "").toUpperCase() === "FERIAS";
                      const rowStyle: React.CSSProperties = isFeriado
                        ? { backgroundColor: "#fef3c7" }
                        : isFerias
                        ? { backgroundColor: "#dbeafe" }
                        : {};
                      return (
                        <tr key={dia.data} style={rowStyle}>
                          <td data-label="Dia">
                            <div className="dia-cell">
                              <span className="dia-data">{dia.data}</span>
                              <span className="dia-semana">{dia.diaSemana}</span>
                            </div>
                          </td>
                          <td data-label="Tipo">
                            {isFeriado ? (
                              <span className="badge" style={{ backgroundColor: "#fbbf24", color: "#78350f" }}>FERIADO</span>
                            ) : (
                              formatarTipoDiaParaExibicao(dia.tipoDia)
                            )}
                          </td>
                          <td data-label="Ocorrência">
                            {isFerias ? (
                              <span className="badge" style={{ backgroundColor: "#93c5fd", color: "#1e3a5f" }}>Férias</span>
                            ) : obs ? (
                              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{obs}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td data-label="Trabalhado">{minutosParaHora(dia.trabalhadoMin)}</td>
                          <td data-label="Diferença" style={{ color: dia.diferencaMin > 0 ? "#059669" : dia.diferencaMin < 0 ? "#dc2626" : "inherit" }}>
                            {minutosParaHora(dia.diferencaMin)}
                          </td>
                          <td data-label="Classif.">
                            <span
                              className={
                                (() => {
                                  const c = mapearClassificacaoParaExibicao(dia.classificacao, dia.observacao, dia.tipoDia);
                                  if (c === "Hora Extra") return "badge badge-success";
                                  if (c === "Devedor") return "badge badge-danger";
                                  if (c === "Férias") return "badge";
                                  if (c === "Feriado") return "badge";
                                  return "badge";
                                })()
                              }
                              style={
                                (() => {
                                  const c = mapearClassificacaoParaExibicao(dia.classificacao, dia.observacao, dia.tipoDia);
                                  if (c === "Férias") return { backgroundColor: "#dbeafe", color: "#1e40af" };
                                  if (c === "Feriado") return { backgroundColor: "#fef3c7", color: "#92400e" };
                                  return undefined;
                                })()
                              }
                            >
                              {mapearClassificacaoParaExibicao(dia.classificacao, dia.observacao, dia.tipoDia)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </>
          )}
          </div>
        </main>
        </PaginaProtegida>

        <ModalExportacao
          isOpen={modalExportacaoAberto}
          onClose={() => setModalExportacaoAberto(false)}
          funcionarios={funcionarios}
          onExportar={handleExportar}
        />
      </div>
    </LayoutShell>
  );
}
