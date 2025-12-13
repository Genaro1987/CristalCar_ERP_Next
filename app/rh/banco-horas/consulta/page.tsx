"use client";

import { useEffect, useMemo, useState } from "react";

import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { ModalExportacao, type OpcoesExportacao } from "@/components/ModalExportacao";
import { minutesToDecimal, minutosParaHora } from "@/lib/rhPontoCalculo";
import { exportarPDF, exportarExcel } from "@/lib/exportarBancoHoras";
import type { ResumoBancoHorasMes } from "@/db/rhBancoHoras";
import { mapearClassificacaoParaExibicao, resumirTotaisDias } from "@/lib/bancoHorasHelpers";

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
        const valorExtra50 = minutesToDecimal(horasExtra50) * resumo.funcionario.valorHora * 1.5;
        const valorExtra100 = minutesToDecimal(horasExtra100) * resumo.funcionario.valorHora * 2;
        const valorDevido = minutesToDecimal(Math.abs(horasDevidas)) * resumo.funcionario.valorHora;

        return {
          horasExtra50,
          horasExtra100,
          horasDevidas,
          valorExtra50,
          valorExtra100,
          valorDevido,
          saldoAjustes: resumo.ajustesManuaisMin + resumo.fechamentosMin,
          jornadaInfo: construirLinhaJornada(resumo.jornada),
        };
      })()
    : null;

  const saldoFinalCalculado = resumo && resumoValores
    ? resumo.saldoAnteriorMin +
      resumoValores.horasExtra50 +
      resumoValores.horasExtra100 +
      resumoValores.horasDevidas +
      resumo.ajustesManuaisMin +
      resumo.fechamentosMin
    : 0;

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="CONS001_RH_BANCO_HORAS"
          nomeTela="CONSULTA DE BANCO DE HORAS"
          caminhoRota="/rh/banco-horas/consulta"
          modulo="RH"
        />

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
                  <input
                    id="ano"
                    type="number"
                    value={ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                    className="form-input"
                  />
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

                <div style={{ flex: "0 0 auto", display: "flex", gap: "8px" }}>
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

              <div className="banco-horas-resumo-grid">
                <div className="banco-horas-card card-success">
                  <p className="card-label">Horas Extras 50%</p>
                  <p className="card-value">
                    {minutosParaHora(resumoValores.horasExtra50)}
                    <span className="card-sub">= {formatarMoeda(resumoValores.valorExtra50)}</span>
                  </p>
                </div>

                <div className="banco-horas-card card-success">
                  <p className="card-label">Horas Extras 100%</p>
                  <p className="card-value">
                    {minutosParaHora(resumoValores.horasExtra100)}
                    <span className="card-sub">= {formatarMoeda(resumoValores.valorExtra100)}</span>
                  </p>
                </div>

                <div className="banco-horas-card card-danger">
                  <p className="card-label">Horas Devidas</p>
                  <p className="card-value">
                    {minutosParaHora(resumoValores.horasDevidas * -1)}
                    <span className="card-sub">= -{formatarMoeda(resumoValores.valorDevido)}</span>
                  </p>
                </div>

                <div className="banco-horas-card card-highlight">
                  <p className="card-label">Saldo Final</p>
                  <p className="card-value">{minutosParaHora(saldoFinalCalculado)}</p>
                </div>

                <div className="banco-horas-card card-neutral">
                  <p className="card-label">Saldo Anterior</p>
                  <p className="card-value">{minutosParaHora(resumo.saldoAnteriorMin)}</p>
                </div>

                <div className="banco-horas-card card-neutral">
                  <p className="card-label">Ajustes e Fechamentos</p>
                  <p className="card-value">{minutosParaHora(resumoValores.saldoAjustes)}</p>
                </div>
              </div>

              <div className="banco-horas-card banco-horas-card-full saldo-bloco">
                <p className="card-label saldo-titulo">Saldo por hora extra ou falta</p>
                <div className="saldo-valores">
                  <span>{`Pagar 50%: ${formatarMoeda(resumoValores.valorExtra50)}`}</span>
                  <span>{`Pagar 100%: ${formatarMoeda(resumoValores.valorExtra100)}`}</span>
                  <span>{`Descontar: ${formatarMoeda(resumoValores.valorDevido)}`}</span>
                  <span>
                    {`Subtotal: ${formatarMoeda(
                      resumoValores.valorExtra50 + resumoValores.valorExtra100 - resumoValores.valorDevido
                    )}`}
                  </span>
                </div>
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

              <div className="departamento-tabela-wrapper banco-horas-detalhamento-wrapper">
                <table className="data-table banco-horas-detalhamento-table">
                  <colgroup>
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "20%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th>Tipo</th>
                      <th>Trabalhado</th>
                      <th>Diferença</th>
                      <th>Classificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.dias.map((dia) => (
                      <tr key={dia.data}>
                        <td>
                          <div className="dia-cell">
                            <span className="dia-data">{dia.data}</span>
                            <span className="dia-semana">{dia.diaSemana}</span>
                          </div>
                        </td>
                        <td>{dia.tipoDia}</td>
                        <td>{minutosParaHora(dia.trabalhadoMin)}</td>
                        <td style={{ color: dia.diferencaMin > 0 ? "#059669" : dia.diferencaMin < 0 ? "#dc2626" : "inherit" }}>
                          {minutosParaHora(dia.diferencaMin)}
                        </td>
                        <td>
                          <span
                            className={
                              mapearClassificacaoParaExibicao(dia.classificacao) === "Hora Extra"
                                ? "badge badge-success"
                                : mapearClassificacaoParaExibicao(dia.classificacao) === "Devedor"
                                ? "badge badge-danger"
                                : "badge"
                            }
                          >
                            {mapearClassificacaoParaExibicao(dia.classificacao)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </div>
        </main>

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
