"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useEffect, useMemo, useState } from "react";

interface Funcionario {
  ID_FUNCIONARIO: string;
  NOME_COMPLETO: string;
  ID_JORNADA?: string | null;
}

interface Jornada {
  ID_JORNADA: string;
  NOME_JORNADA: string;
  HORA_ENTRADA_1?: string | null;
  HORA_SAIDA_1?: string | null;
  HORA_ENTRADA_2?: string | null;
  HORA_SAIDA_2?: string | null;
  HORA_ENTRADA_3?: string | null;
  HORA_SAIDA_3?: string | null;
  HORA_ENTRADA_EXTRA?: string | null;
  HORA_SAIDA_EXTRA?: string | null;
}

interface LancamentoDia {
  dataReferencia: string;
  entradaManha?: string | null;
  saidaManha?: string | null;
  entradaTarde?: string | null;
  saidaTarde?: string | null;
  entradaExtra?: string | null;
  saidaExtra?: string | null;
  statusDia?: string;
  observacao?: string | null;
  minutosTrabalhados?: number | null;
  minutosExtras?: number | null;
}

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function formatarDia(dataReferencia: string) {
  const data = new Date(dataReferencia);
  const numeroDia = String(data.getDate()).padStart(2, "0");
  const nomeDia = diasSemana[data.getDay()] ?? "";
  return `${numeroDia} - ${nomeDia}`;
}

function gerarGradeVazia(competencia: string): LancamentoDia[] {
  const [anoStr, mesStr] = competencia.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dias: LancamentoDia[] = [];

  for (let dia = 1; dia <= ultimoDia; dia++) {
    dias.push({
      dataReferencia: `${competencia}-${String(dia).padStart(2, "0")}`,
      statusDia: "NORMAL",
    });
  }

  return dias;
}

function camposVazios(dia: LancamentoDia) {
  return !(
    dia.entradaManha ||
    dia.saidaManha ||
    dia.entradaTarde ||
    dia.saidaTarde ||
    dia.entradaExtra ||
    dia.saidaExtra
  );
}

function parseHoraParaMinutos(hora?: string | null): number | null {
  if (!hora || !hora.includes(":")) return null;
  const [h, m] = hora.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minutosParaHora(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "00:00";
  const horas = Math.floor(min / 60);
  const minutos = min % 60;
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

function recalcularTotaisDia(dia: LancamentoDia, minutosJornadaDia?: number | null): LancamentoDia {
  const em = parseHoraParaMinutos(dia.entradaManha);
  const sm = parseHoraParaMinutos(dia.saidaManha);
  const et = parseHoraParaMinutos(dia.entradaTarde);
  const st = parseHoraParaMinutos(dia.saidaTarde);
  const ei = parseHoraParaMinutos(dia.entradaExtra);
  const si = parseHoraParaMinutos(dia.saidaExtra);

  const diff = (inicio: number | null, fim: number | null) =>
    inicio != null && fim != null && fim > inicio ? fim - inicio : 0;

  const minutosTrabalhados = diff(em, sm) + diff(et, st) - diff(ei, si);
  const minutosJornada = minutosJornadaDia ?? 0;
  const minutosExtras = minutosJornada > 0 ? Math.max(0, minutosTrabalhados - minutosJornada) : 0;

  return {
    ...dia,
    minutosTrabalhados,
    minutosExtras,
  };
}

function calcularMinutosJornadaDiaria(jornada?: {
  HORA_ENTRADA_1?: string | null;
  HORA_SAIDA_1?: string | null;
  HORA_ENTRADA_2?: string | null;
  HORA_SAIDA_2?: string | null;
  HORA_ENTRADA_3?: string | null;
  HORA_SAIDA_3?: string | null;
  HORA_ENTRADA_EXTRA?: string | null;
  HORA_SAIDA_EXTRA?: string | null;
}): number | null {
  if (!jornada) return null;

  const em = parseHoraParaMinutos(jornada.HORA_ENTRADA_1);
  const sm = parseHoraParaMinutos(jornada.HORA_SAIDA_1);
  const et = parseHoraParaMinutos(jornada.HORA_ENTRADA_2);
  const st = parseHoraParaMinutos(jornada.HORA_SAIDA_2);
  const ei = parseHoraParaMinutos(jornada.HORA_ENTRADA_EXTRA ?? jornada.HORA_ENTRADA_3);
  const si = parseHoraParaMinutos(jornada.HORA_SAIDA_EXTRA ?? jornada.HORA_SAIDA_3);

  const diff = (inicio: number | null, fim: number | null) =>
    inicio != null && fim != null && fim > inicio ? fim - inicio : 0;

  return diff(em, sm) + diff(et, st) - diff(ei, si);
}

export default function PontoPage() {
  useRequerEmpresaSelecionada({ ativo: true });

  const { empresa, carregando } = useEmpresaSelecionada();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState("");
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [diasPonto, setDiasPonto] = useState<LancamentoDia[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [carregandoGrade, setCarregandoGrade] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const empresaId = empresa?.id ?? null;

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = {};

    if (empresaId) {
      headers["x-empresa-id"] = String(empresaId);
    }

    return headers;
  }, [empresaId]);

  const funcionarioAtual = useMemo(
    () => funcionarios.find((f) => f.ID_FUNCIONARIO === funcionarioSelecionado),
    [funcionarios, funcionarioSelecionado]
  );

  const jornadaFuncionario = useMemo(
    () =>
      funcionarioAtual?.ID_JORNADA
        ? jornadas.find((j) => j.ID_JORNADA === funcionarioAtual.ID_JORNADA) ?? null
        : null,
    [funcionarioAtual, jornadas]
  );

  const minutosJornadaDia = useMemo(
    () => calcularMinutosJornadaDiaria(jornadaFuncionario ?? undefined),
    [jornadaFuncionario]
  );

  const timeInputClasses = "form-input w-20 text-center px-1 py-1 text-sm";

  const montarHorariosJornadaParaDia = (
    diaAtual: LancamentoDia,
    jornada?: Jornada | null
  ): LancamentoDia => {
    if (!jornada) return diaAtual;

    return {
      ...diaAtual,
      entradaManha: jornada.HORA_ENTRADA_1 ?? diaAtual.entradaManha,
      saidaManha: jornada.HORA_SAIDA_1 ?? diaAtual.saidaManha,
      entradaTarde: jornada.HORA_ENTRADA_2 ?? diaAtual.entradaTarde,
      saidaTarde: jornada.HORA_SAIDA_2 ?? diaAtual.saidaTarde,
      entradaExtra: jornada.HORA_ENTRADA_3 ?? jornada.HORA_ENTRADA_EXTRA ?? diaAtual.entradaExtra,
      saidaExtra: jornada.HORA_SAIDA_3 ?? jornada.HORA_SAIDA_EXTRA ?? diaAtual.saidaExtra,
    };
  };

  const aplicarJornadaNoDia = (indexDia: number) => {
    if (!jornadaFuncionario) return;

    setDiasPonto((diasAnteriores) => {
      const copia = [...diasAnteriores];
      const diaAtual = copia[indexDia];
      const comJornada = montarHorariosJornadaParaDia(diaAtual, jornadaFuncionario);
      copia[indexDia] = recalcularTotaisDia(comJornada, minutosJornadaDia);
      return copia;
    });
  };

  const handleChangeHora = (indexDia: number, campo: keyof LancamentoDia, valor: string) => {
    setDiasPonto((diasAnteriores) => {
      const copia = [...diasAnteriores];
      const atualizado: LancamentoDia = {
        ...copia[indexDia],
        [campo]: valor,
      };
      copia[indexDia] = recalcularTotaisDia(atualizado, minutosJornadaDia);
      return copia;
    });
  };

  const carregarFuncionarios = async () => {
    if (!empresaId) return;
    setCarregandoLista(true);
    setErroFormulario(null);

    try {
      const resposta = await fetch(
        `/api/rh/funcionarios?apenasAtivos=true${empresaId ? `&empresaId=${empresaId}` : ""}`,
        { headers: headersPadrao }
      );
      const json = await resposta.json();

      if (json?.success) {
        setFuncionarios(json.data ?? []);
      } else {
        setErroFormulario("Não foi possível carregar os funcionários.");
      }
    } catch (error) {
      console.error(error);
      setErroFormulario("Erro ao buscar funcionários.");
    } finally {
      setCarregandoLista(false);
    }
  };

  const carregarJornadas = async (): Promise<Jornada[]> => {
    if (!empresaId) return [];

    try {
      const resposta = await fetch(`/api/rh/jornadas`, { headers: headersPadrao });
      const json = await resposta.json();

      if (json?.success) {
        setJornadas(json.data ?? []);
        return json.data ?? [];
      }
    } catch (error) {
      console.error(error);
    }

    return [];
  };

  useEffect(() => {
    if (carregando) return;
    carregarFuncionarios();
    carregarJornadas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, empresaId]);

  useEffect(() => {
    if (!diasPonto.length) return;

    setDiasPonto((dias) => dias.map((dia) => recalcularTotaisDia(dia, minutosJornadaDia)));
  }, [diasPonto.length, minutosJornadaDia]);

  const carregarPonto = async () => {
    setErroFormulario(null);
    setNotification(null);

    if (!empresaId) {
      setErroFormulario("Selecione uma empresa antes de continuar.");
      return;
    }

    if (!funcionarioSelecionado) {
      setErroFormulario("Selecione um funcionário.");
      return;
    }

    if (!competencia) {
      setErroFormulario("Informe a competência (mês/ano).");
      return;
    }

    setCarregandoGrade(true);

    try {
      const resposta = await fetch(
        `/api/ponto?funcionarioId=${encodeURIComponent(funcionarioSelecionado)}&competencia=${competencia}${
          empresaId ? `&empresaId=${empresaId}` : ""
        }`,
        { headers: headersPadrao }
      );
      const json = await resposta.json();

      if (resposta.ok && json?.success) {
        const dados: LancamentoDia[] = (json.data ?? []).map((dia: LancamentoDia) =>
          recalcularTotaisDia(
            {
              dataReferencia: dia.dataReferencia,
              entradaManha: dia.entradaManha ?? "",
              saidaManha: dia.saidaManha ?? "",
              entradaTarde: dia.entradaTarde ?? "",
              saidaTarde: dia.saidaTarde ?? "",
              entradaExtra: dia.entradaExtra ?? "",
              saidaExtra: dia.saidaExtra ?? "",
              statusDia: dia.statusDia ?? "NORMAL",
              observacao: dia.observacao ?? "",
            },
            minutosJornadaDia
          )
        );

        if (dados.length === 0) {
          setDiasPonto(gerarGradeVazia(competencia));
        } else {
          setDiasPonto(dados);
        }
      } else {
        setErroFormulario("Não foi possível carregar o ponto do mês.");
      }
    } catch (error) {
      console.error(error);
      setErroFormulario("Erro ao carregar o ponto.");
    } finally {
      setCarregandoGrade(false);
    }
  };

  const aplicarJornada = async () => {
    setNotification(null);
    setErroFormulario(null);

    if (!funcionarioAtual) {
      setErroFormulario("Selecione um funcionário para aplicar a jornada.");
      return;
    }

    if (!funcionarioAtual.ID_JORNADA) {
      setErroFormulario("O funcionário não possui jornada vinculada.");
      return;
    }

    if (!diasPonto.length) {
      setErroFormulario("Carregue o ponto antes de aplicar a jornada.");
      return;
    }

    let jornada = jornadas.find((j) => j.ID_JORNADA === funcionarioAtual.ID_JORNADA);

    if (!jornada) {
      const novasJornadas = await carregarJornadas();
      jornada = novasJornadas.find((j) => j.ID_JORNADA === funcionarioAtual.ID_JORNADA);
    }

    if (!jornada) {
      setErroFormulario("Jornada não encontrada para o funcionário.");
      return;
    }

    setDiasPonto((dias) =>
      dias.map((dia) => {
        const data = new Date(dia.dataReferencia);
        const ehFimDeSemana = data.getDay() === 0 || data.getDay() === 6;

        if (ehFimDeSemana || !camposVazios(dia)) {
          return dia;
        }

        const comHorarios = montarHorariosJornadaParaDia(dia, jornada);

        return recalcularTotaisDia(comHorarios, minutosJornadaDia);
      })
    );

    setNotification({ type: "info", message: "Jornada aplicada nos dias úteis vazios." });
  };

  const salvarPonto = async () => {
    setNotification(null);
    setErroFormulario(null);

    if (!empresaId) {
      setErroFormulario("Selecione uma empresa antes de salvar.");
      return;
    }

    if (!funcionarioSelecionado) {
      setErroFormulario("Selecione um funcionário.");
      return;
    }

    if (!competencia) {
      setErroFormulario("Informe a competência (mês/ano).");
      return;
    }

    setSalvando(true);

    const diasParaEnviar = diasPonto.map((dia) => ({
      dataReferencia: dia.dataReferencia,
      entradaManha: dia.entradaManha || null,
      saidaManha: dia.saidaManha || null,
      entradaTarde: dia.entradaTarde || null,
      saidaTarde: dia.saidaTarde || null,
      entradaExtra: dia.entradaExtra || null,
      saidaExtra: dia.saidaExtra || null,
      statusDia: dia.statusDia || "NORMAL",
      observacao: dia.observacao || null,
    }));

    try {
      const resposta = await fetch(
        `/api/ponto?funcionarioId=${encodeURIComponent(funcionarioSelecionado)}&competencia=${competencia}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...headersPadrao,
          },
          body: JSON.stringify({
            empresaId,
            funcionarioId: funcionarioSelecionado,
            competencia,
            dias: diasParaEnviar,
          }),
        }
      );

      const json = await resposta.json();

      if (resposta.ok && json?.success) {
        setNotification({ type: "success", message: "Ponto salvo com sucesso." });
      } else if (resposta.status === 400 && json?.error === "HORARIO_INVALIDO") {
        setErroFormulario("Horários devem estar no formato HH:MM.");
      } else {
        setErroFormulario("Não foi possível salvar o ponto.");
      }
    } catch (error) {
      console.error(error);
      setErroFormulario("Erro ao salvar o ponto.");
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = () => {
    setFuncionarioSelecionado("");
    setCompetencia(competenciaAtual());
    setDiasPonto([]);
    setErroFormulario(null);
    setNotification(null);
  };

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="CAD007_RH_PONTO"
          nomeTela="LANCAMENTO DE PONTO"
          caminhoRota="/rh/ponto"
          modulo="RH"
        />

        <main className="page-content-card">
          {notification && <NotificationBar type={notification.type} message={notification.message} />}

          <div className="departamentos-page">
            <section className="panel">
              <header className="form-section-header">
                <h2>Lançamento de ponto</h2>
                <p>Carregue os dias do mês, ajuste os horários e salve o ponto do funcionário.</p>
              </header>

              {erroFormulario && <p className="error-text">{erroFormulario}</p>}

              <div className="form-grid three-columns">
                <div className="form-group">
                  <label htmlFor="funcionario">Funcionário *</label>
                  <select
                    id="funcionario"
                    name="funcionario"
                    className="form-input"
                    value={funcionarioSelecionado}
                    onChange={(e) => setFuncionarioSelecionado(e.target.value)}
                    disabled={carregandoLista}
                    required
                  >
                    <option value="">Selecione</option>
                    {funcionarios.map((funcionario) => (
                      <option key={funcionario.ID_FUNCIONARIO} value={funcionario.ID_FUNCIONARIO}>
                        {funcionario.ID_FUNCIONARIO} - {funcionario.NOME_COMPLETO}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="competencia">Competência *</label>
                  <input
                    id="competencia"
                    name="competencia"
                    className="form-input"
                    type="month"
                    value={competencia}
                    onChange={(e) => setCompetencia(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group form-actions" style={{ alignItems: "flex-end" }}>
                  <div className="button-row">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={carregarPonto}
                      disabled={carregandoGrade || carregandoLista}
                    >
                      {carregandoGrade ? "Carregando..." : "Carregar ponto"}
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={aplicarJornada}
                      disabled={carregandoGrade || !diasPonto.length}
                    >
                      Aplicar jornada nos dias úteis
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <header className="form-section-header">
                <h2>Grade de dias</h2>
                <p>Preencha ou ajuste os horários para cada dia da competência selecionada.</p>
              </header>

              {diasPonto.length === 0 && (
                <p className="helper-text">Carregue um funcionário e uma competência para montar a grade.</p>
              )}

              {diasPonto.length > 0 && (
                <div className="departamento-tabela-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Dia</th>
                        <th>Entrada manhã</th>
                        <th>Saída manhã</th>
                        <th>Entrada tarde</th>
                        <th>Saída tarde</th>
                        <th>Entrada intervalo</th>
                        <th>Saída intervalo</th>
                        <th className="text-right">Tempo trabalhado</th>
                        <th className="text-right">Horas extras</th>
                        <th className="text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diasPonto.map((dia, index) => {
                        const data = new Date(dia.dataReferencia);
                        const ehFimDeSemana = data.getDay() === 0 || data.getDay() === 6;

                        return (
                          <tr
                            key={dia.dataReferencia}
                            style={ehFimDeSemana ? { color: "#6b7280" } : undefined}
                          >
                            <td>{formatarDia(dia.dataReferencia)}</td>
                            <td>
                              <input
                                className={timeInputClasses}
                                type="time"
                                value={dia.entradaManha ?? ""}
                                onChange={(e) => handleChangeHora(index, "entradaManha", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className={timeInputClasses}
                                type="time"
                                value={dia.saidaManha ?? ""}
                                onChange={(e) => handleChangeHora(index, "saidaManha", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className={timeInputClasses}
                                type="time"
                                value={dia.entradaTarde ?? ""}
                                onChange={(e) => handleChangeHora(index, "entradaTarde", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className={timeInputClasses}
                                type="time"
                                value={dia.saidaTarde ?? ""}
                                onChange={(e) => handleChangeHora(index, "saidaTarde", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className={timeInputClasses}
                                type="time"
                                value={dia.entradaExtra ?? ""}
                                onChange={(e) => handleChangeHora(index, "entradaExtra", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className={timeInputClasses}
                                type="time"
                                value={dia.saidaExtra ?? ""}
                                onChange={(e) => handleChangeHora(index, "saidaExtra", e.target.value)}
                              />
                            </td>
                            <td className="text-right text-sm">
                              {dia.minutosTrabalhados != null
                                ? minutosParaHora(dia.minutosTrabalhados)
                                : "--:--"}
                            </td>
                            <td className="text-right text-sm">
                              {dia.minutosExtras != null ? minutosParaHora(dia.minutosExtras) : "--:--"}
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="text-xs text-orange-600 hover:underline"
                                onClick={() => aplicarJornadaNoDia(index)}
                                disabled={!jornadaFuncionario}
                              >
                                Aplicar jornada
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="form-actions departamentos-actions">
                <div className="button-row">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={salvarPonto}
                    disabled={salvando || !diasPonto.length}
                  >
                    {salvando ? "Salvando..." : "Salvar ponto"}
                  </button>
                  <button type="button" className="button button-secondary" onClick={cancelar}>
                    Cancelar
                  </button>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </LayoutShell>
  );
}
