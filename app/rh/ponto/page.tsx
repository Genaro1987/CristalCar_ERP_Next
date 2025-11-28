"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useEffect, useMemo, useState } from "react";
import {
  calcularMinutosJornadaDiaria,
  calcularMinutosTrabalhados,
  calcularSaldoDia,
  competenciaAtual,
  determinarTipoDia,
  minutosParaHora,
  normalizarToleranciaMinutos,
  TipoDia,
} from "@/lib/rhPontoCalculo";

interface Funcionario {
  ID_FUNCIONARIO: string;
  NOME_COMPLETO: string;
  ID_JORNADA?: string | null;
}

interface Jornada {
  ID_JORNADA: string;
  NOME_JORNADA: string;
  HORA_ENTRADA_MANHA?: string | null;
  HORA_SAIDA_MANHA?: string | null;
  HORA_ENTRADA_TARDE?: string | null;
  HORA_SAIDA_TARDE?: string | null;
  HORA_ENTRADA_INTERVALO?: string | null;
  HORA_SAIDA_INTERVALO?: string | null;
  HORA_ENTRADA_EXTRA?: string | null;
  HORA_SAIDA_EXTRA?: string | null;
  TOLERANCIA_MINUTOS?: number | null;
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
  tipoOcorrencia?: string;
  idMotivoFalta?: number | null;
  obsFalta?: string | null;
  observacao?: string | null;
  minutosTrabalhados?: number | null;
  minutosExtras?: number | null;
  saldoBancoMinutos?: number | null;
  minutosPagosFeriadoFds?: number | null;
  eFeriado?: "S" | "N";
  tipoDia?: TipoDia;
}

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function criarDataLocal(dataReferencia: string) {
  const [anoStr, mesStr, diaStr] = dataReferencia.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr) - 1;
  const dia = Number(diaStr);

  return new Date(ano, mes, dia);
}

function formatarDia(dataReferencia: string) {
  const data = criarDataLocal(dataReferencia);
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
      tipoOcorrencia: "NORMAL",
      statusDia: "NORMAL",
      eFeriado: "N",
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

function recalcularTotaisDia(
  dia: LancamentoDia,
  minutosJornadaDia?: number | null,
  toleranciaMinutos?: number | null
): LancamentoDia {
  const tipoDia = determinarTipoDia(dia.dataReferencia, dia.eFeriado);
  const minutosTrabalhados =
    dia.tipoOcorrencia && dia.tipoOcorrencia !== "NORMAL"
      ? 0
      : calcularMinutosTrabalhados(dia);

  const { saldoBancoMinutos, minutosPagosFeriadoFds, minutosExtrasExibicao } =
    calcularSaldoDia(tipoDia, minutosTrabalhados, minutosJornadaDia ?? null, toleranciaMinutos ?? 0);

  return {
    ...dia,
    tipoDia,
    minutosTrabalhados,
    minutosExtras: minutosExtrasExibicao,
    saldoBancoMinutos,
    minutosPagosFeriadoFds,
  };
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
  const [motivosFalta, setMotivosFalta] = useState<
    { ID_MOTIVO: number; DESCRICAO: string }[]
  >([]);
  const [indiceFaltaSelecionado, setIndiceFaltaSelecionado] = useState<number | null>(
    null
  );
  const [tipoFaltaSelecionada, setTipoFaltaSelecionada] = useState<
    "FALTA_JUSTIFICADA" | "FALTA_NAO_JUSTIFICADA"
  >("FALTA_JUSTIFICADA");
  const [motivoFaltaSelecionado, setMotivoFaltaSelecionado] = useState("");
  const [observacaoFalta, setObservacaoFalta] = useState("");
  const [modalFaltaAberto, setModalFaltaAberto] = useState(false);

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

  const toleranciaMinutosJornada = useMemo(
    () => normalizarToleranciaMinutos(jornadaFuncionario?.TOLERANCIA_MINUTOS),
    [jornadaFuncionario?.TOLERANCIA_MINUTOS]
  );

  const timeInputClasses = "form-input time-input text-center px-1 py-1 text-sm w-20";

  const montarHorariosJornadaParaDia = (
    diaAtual: LancamentoDia,
    jornada?: Jornada | null
  ): LancamentoDia => {
    if (!jornada) return diaAtual;

    return {
      ...diaAtual,
      entradaManha: jornada.HORA_ENTRADA_MANHA ?? diaAtual.entradaManha,
      saidaManha: jornada.HORA_SAIDA_MANHA ?? diaAtual.saidaManha,
      entradaTarde: jornada.HORA_ENTRADA_TARDE ?? diaAtual.entradaTarde,
      saidaTarde: jornada.HORA_SAIDA_TARDE ?? diaAtual.saidaTarde,
      entradaExtra:
        jornada.HORA_ENTRADA_INTERVALO ?? jornada.HORA_ENTRADA_EXTRA ?? diaAtual.entradaExtra,
      saidaExtra:
        jornada.HORA_SAIDA_INTERVALO ?? jornada.HORA_SAIDA_EXTRA ?? diaAtual.saidaExtra,
    };
  };

  const aplicarJornadaNoDia = (indexDia: number) => {
    if (!jornadaFuncionario) return;

    setDiasPonto((diasAnteriores) => {
      const copia = [...diasAnteriores];
      const diaAtual = copia[indexDia];

      if (diaAtual.tipoOcorrencia && diaAtual.tipoOcorrencia !== "NORMAL") {
        return copia;
      }

      const comJornada = montarHorariosJornadaParaDia(diaAtual, jornadaFuncionario);
      copia[indexDia] = recalcularTotaisDia(
        comJornada,
        minutosJornadaDia,
        toleranciaMinutosJornada
      );
      return copia;
    });
  };

  const abrirFaltaParaDia = (indexDia: number) => {
    const diaAtual = diasPonto[indexDia];
    setIndiceFaltaSelecionado(indexDia);
    setTipoFaltaSelecionada(
      diaAtual?.tipoOcorrencia === "FALTA_NAO_JUSTIFICADA"
        ? "FALTA_NAO_JUSTIFICADA"
        : "FALTA_JUSTIFICADA"
    );
    setMotivoFaltaSelecionado(
      diaAtual?.idMotivoFalta ? String(diaAtual.idMotivoFalta) : ""
    );
    setObservacaoFalta(diaAtual?.obsFalta ?? "");
    setModalFaltaAberto(true);
  };

  const confirmarFaltaDia = () => {
    if (indiceFaltaSelecionado === null) return;

    setDiasPonto((diasAnteriores) => {
      const copia = [...diasAnteriores];
      const diaAtual = copia[indiceFaltaSelecionado];

      const tipoOcorrencia = tipoFaltaSelecionada;
      const idMotivo =
        tipoOcorrencia === "FALTA_JUSTIFICADA" && motivoFaltaSelecionado
          ? Number(motivoFaltaSelecionado)
          : null;

      const atualizado: LancamentoDia = {
        ...diaAtual,
        tipoOcorrencia,
        idMotivoFalta: Number.isFinite(idMotivo) ? idMotivo : null,
        obsFalta:
          tipoOcorrencia === "FALTA_JUSTIFICADA"
            ? observacaoFalta || null
            : observacaoFalta || null,
        statusDia: tipoOcorrencia,
        entradaManha: null,
        saidaManha: null,
        entradaTarde: null,
        saidaTarde: null,
        entradaExtra: null,
        saidaExtra: null,
        minutosExtras: 0,
        minutosTrabalhados: 0,
      };

      copia[indiceFaltaSelecionado] = recalcularTotaisDia(
        atualizado,
        minutosJornadaDia,
        toleranciaMinutosJornada
      );
      return copia;
    });

    setModalFaltaAberto(false);
    setIndiceFaltaSelecionado(null);
  };

  const fecharModalFalta = () => {
    setModalFaltaAberto(false);
    setIndiceFaltaSelecionado(null);
  };

  const limparDia = (indexDia: number) => {
    setDiasPonto((diasAnteriores) => {
      const copia = [...diasAnteriores];
      const diaAtual = copia[indexDia];

      const normalizado: LancamentoDia = {
        ...diaAtual,
        tipoOcorrencia: "NORMAL",
        idMotivoFalta: null,
        obsFalta: null,
        statusDia: "NORMAL",
        entradaManha: null,
        saidaManha: null,
        entradaTarde: null,
        saidaTarde: null,
        entradaExtra: null,
        saidaExtra: null,
        minutosExtras: 0,
        minutosTrabalhados: 0,
      };

      copia[indexDia] = recalcularTotaisDia(
        normalizado,
        minutosJornadaDia,
        toleranciaMinutosJornada
      );
      return copia;
    });
    setIndiceFaltaSelecionado(null);
    setModalFaltaAberto(false);
  };

  const handleChangeHora = (indexDia: number, campo: keyof LancamentoDia, valor: string) => {
    setDiasPonto((diasAnteriores) => {
      const copia = [...diasAnteriores];
      const atualizado: LancamentoDia = {
        ...copia[indexDia],
        [campo]: valor,
      };
      copia[indexDia] = recalcularTotaisDia(
        atualizado,
        minutosJornadaDia,
        toleranciaMinutosJornada
      );
      return copia;
    });
  };

  const alternarFeriado = (indexDia: number) => {
    setDiasPonto((diasAnteriores) => {
      const copia = [...diasAnteriores];
      const atual = copia[indexDia];
      const novoValor = atual.eFeriado === "S" ? "N" : "S";

      const normalizado: LancamentoDia = {
        ...atual,
        eFeriado: novoValor,
        tipoOcorrencia: novoValor === "S" ? "NORMAL" : atual.tipoOcorrencia ?? "NORMAL",
        statusDia: novoValor === "S" ? "NORMAL" : atual.statusDia ?? "NORMAL",
        idMotivoFalta: novoValor === "S" ? null : atual.idMotivoFalta ?? null,
        obsFalta: novoValor === "S" ? null : atual.obsFalta ?? null,
      };

      copia[indexDia] = recalcularTotaisDia(
        normalizado,
        minutosJornadaDia,
        toleranciaMinutosJornada
      );
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

  const carregarMotivosFalta = async () => {
    try {
      const resposta = await fetch(`/api/rh/faltas/motivos`);
      const json = await resposta.json();

      if (json?.success) {
        setMotivosFalta(json.data ?? []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (carregando) return;
    carregarFuncionarios();
    carregarJornadas();
    carregarMotivosFalta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, empresaId]);

  useEffect(() => {
    if (!diasPonto.length) return;

    setDiasPonto((dias) =>
      dias.map((dia) => recalcularTotaisDia(dia, minutosJornadaDia, toleranciaMinutosJornada))
    );
  }, [diasPonto.length, minutosJornadaDia, toleranciaMinutosJornada]);

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

    const [anoComp, mesComp] = competencia.split("-").map(Number);

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
        const baseGrade = gerarGradeVazia(competencia);
        const diasApi = new Map(
          (json.data ?? [])
            .filter((dia: LancamentoDia) => {
              if (typeof dia?.dataReferencia !== "string") return false;

              const dataLancamento = criarDataLocal(dia.dataReferencia);
              return (
                dataLancamento.getFullYear() === anoComp && dataLancamento.getMonth() + 1 === mesComp
              );
            })
            .map((dia: LancamentoDia) => [dia.dataReferencia, dia])
        );

        const dados: LancamentoDia[] = baseGrade.map((diaBase) => {
          const diaApi = diasApi.get(diaBase.dataReferencia);
          const combinado = diaApi
            ? {
                ...diaBase,
                ...diaApi,
                eFeriado: diaApi.eFeriado === "S" ? "S" : diaBase.eFeriado ?? "N",
              }
            : diaBase;

          return recalcularTotaisDia(
            {
              ...combinado,
              dataReferencia: diaBase.dataReferencia,
              entradaManha: combinado.entradaManha ?? "",
              saidaManha: combinado.saidaManha ?? "",
              entradaTarde: combinado.entradaTarde ?? "",
              saidaTarde: combinado.saidaTarde ?? "",
              entradaExtra: combinado.entradaExtra ?? "",
              saidaExtra: combinado.saidaExtra ?? "",
              statusDia: combinado.statusDia ?? combinado.tipoOcorrencia ?? "NORMAL",
              tipoOcorrencia: combinado.tipoOcorrencia ?? "NORMAL",
              idMotivoFalta: combinado.idMotivoFalta ?? null,
              obsFalta: combinado.obsFalta ?? null,
              observacao: combinado.observacao ?? "",
              eFeriado: combinado.eFeriado === "S" ? "S" : "N",
            },
            minutosJornadaDia,
            toleranciaMinutosJornada
          );
        });

        setDiasPonto(dados);
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
        const data = criarDataLocal(dia.dataReferencia);
        const ehFimDeSemana = data.getDay() === 0 || data.getDay() === 6;
        const ehFeriado = dia.eFeriado === "S";

        if (
          ehFimDeSemana ||
          ehFeriado ||
          !camposVazios(dia) ||
          (dia.tipoOcorrencia && dia.tipoOcorrencia !== "NORMAL")
        ) {
          return dia;
        }

        const comHorarios = montarHorariosJornadaParaDia(dia, jornada);

        return recalcularTotaisDia(
          comHorarios,
          minutosJornadaDia,
          toleranciaMinutosJornada
        );
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
      tipoOcorrencia: dia.tipoOcorrencia || "NORMAL",
      idMotivoFalta: dia.idMotivoFalta ?? null,
      obsFalta: dia.obsFalta || null,
      observacao: dia.observacao || null,
      eFeriado: dia.eFeriado === "S" ? "S" : "N",
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
    setIndiceFaltaSelecionado(null);
    setMotivoFaltaSelecionado("");
    setObservacaoFalta("");
    setTipoFaltaSelecionada("FALTA_JUSTIFICADA");
    setModalFaltaAberto(false);
  };

  const diaSelecionadoParaFalta =
    indiceFaltaSelecionado != null ? diasPonto[indiceFaltaSelecionado] : null;

  return (
    <>
      <LayoutShell>
        <div className="page-container">
          <HeaderBar
            codigoTela="LAN001_RH_PONTO"
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
                      <option value="">Selecione um funcionário</option>
                      {funcionarios.map((funcionario) => (
                        <option key={funcionario.ID_FUNCIONARIO} value={funcionario.ID_FUNCIONARIO}>
                          {funcionario.NOME_COMPLETO}
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
                <div className="departamento-tabela-wrapper ponto-tabela">
                  <table className="w-full table-fixed border-collapse data-table">
                    <thead>
                      <tr>
                        <th className="w-32 px-4 py-2 text-left">Dia</th>
                        <th className="px-4 py-2 text-center">Horários</th>
                        <th className="w-40 px-4 py-2 text-center">Intervalo</th>
                        <th className="w-32 px-4 py-2 text-center">Tempo trabalhado</th>
                        <th className="w-32 px-4 py-2 text-center">Horas extras</th>
                        <th className="w-40 px-4 py-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diasPonto.map((dia, index) => {
                        const data = criarDataLocal(dia.dataReferencia);
                        const tipoDia = dia.tipoDia ?? determinarTipoDia(dia.dataReferencia, dia.eFeriado);
                        const ehFimDeSemana = tipoDia === "FIM_DE_SEMANA";
                        const ehFeriado = tipoDia === "FERIADO";
                        const estiloLinha: Record<string, string> = {};

                        if (ehFimDeSemana) {
                          estiloLinha.color = "#6b7280";
                        }

                        if (ehFeriado) {
                          estiloLinha.backgroundColor = "#fff7ed";
                        }
                        const tipoOcorrencia = dia.tipoOcorrencia ?? "NORMAL";
                        const isFalta = tipoOcorrencia !== "NORMAL";
                        const motivoDescricao =
                          isFalta && dia.idMotivoFalta
                            ? motivosFalta.find((m) => m.ID_MOTIVO === dia.idMotivoFalta)?.DESCRICAO
                            : "";
                        const falta = isFalta
                          ? {
                              tipo:
                                tipoOcorrencia === "FALTA_JUSTIFICADA"
                                  ? "JUSTIFICADA"
                                  : "NAO_JUSTIFICADA",
                              motivoDescricao,
                              observacao: dia.obsFalta,
                            }
                          : null;

                        return (
                          <tr
                            key={dia.dataReferencia}
                            style={Object.keys(estiloLinha).length ? estiloLinha : undefined}
                          >
                            <td className="w-32 px-4 py-2 text-left whitespace-nowrap">
                              {formatarDia(dia.dataReferencia)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {falta ? (
                                <div className="inline-flex flex-col gap-1">
                                  <span
                                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                      falta.tipo === "JUSTIFICADA"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {falta.tipo === "JUSTIFICADA"
                                      ? "FALTA JUSTIFICADA"
                                      : "FALTA NÃO JUSTIFICADA"}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                  <input
                                    className={timeInputClasses}
                                    type="time"
                                    value={dia.entradaManha ?? ""}
                                    onChange={(e) => handleChangeHora(index, "entradaManha", e.target.value)}
                                    disabled={isFalta}
                                  />
                                  <span>-</span>
                                  <input
                                    className={timeInputClasses}
                                    type="time"
                                    value={dia.saidaManha ?? ""}
                                    onChange={(e) => handleChangeHora(index, "saidaManha", e.target.value)}
                                    disabled={isFalta}
                                  />
                                  <span>/</span>
                                  <input
                                    className={timeInputClasses}
                                    type="time"
                                    value={dia.entradaTarde ?? ""}
                                    onChange={(e) => handleChangeHora(index, "entradaTarde", e.target.value)}
                                    disabled={isFalta}
                                  />
                                  <span>-</span>
                                  <input
                                    className={timeInputClasses}
                                    type="time"
                                    value={dia.saidaTarde ?? ""}
                                    onChange={(e) => handleChangeHora(index, "saidaTarde", e.target.value)}
                                    disabled={isFalta}
                                  />
                                </div>
                              )}
                            </td>
                            <td className="w-40 px-4 py-2 align-top">
                              {falta ? (
                                <div className="flex flex-col gap-1 text-sm text-gray-700">
                                  <div className="font-medium">
                                    {falta.motivoDescricao ?? "SEM MOTIVO CADASTRADO"}
                                  </div>
                                  {falta.observacao && (
                                    <div className="text-xs text-gray-600">Obs.: {falta.observacao}</div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                  <input
                                    className={timeInputClasses}
                                    type="time"
                                    value={dia.entradaExtra ?? ""}
                                    onChange={(e) => handleChangeHora(index, "entradaExtra", e.target.value)}
                                    disabled={isFalta}
                                  />
                                  <span>-</span>
                                  <input
                                    className={timeInputClasses}
                                    type="time"
                                    value={dia.saidaExtra ?? ""}
                                    onChange={(e) => handleChangeHora(index, "saidaExtra", e.target.value)}
                                    disabled={isFalta}
                                  />
                                </div>
                              )}
                            </td>
                            <td className="w-32 px-4 py-2 text-center text-sm">
                              {dia.minutosTrabalhados != null
                                ? minutosParaHora(dia.minutosTrabalhados)
                                : "--:--"}
                            </td>
                            <td className="w-32 px-4 py-2 text-center text-sm">
                              {dia.minutosExtras != null ? minutosParaHora(dia.minutosExtras) : "--:--"}
                            </td>
                            <td className="w-40 px-4 py-2 text-center whitespace-nowrap">
                              <div className="acoes-dia flex flex-row justify-center gap-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  className="button button-secondary button-compact"
                                  onClick={() => aplicarJornadaNoDia(index)}
                                  disabled={!jornadaFuncionario || isFalta}
                                >
                                  Jornada
                                </button>
                                <button
                                  type="button"
                                  className={`button button-compact ${
                                    ehFeriado ? "button-primary" : "button-secondary"
                                  }`}
                                  onClick={() => alternarFeriado(index)}
                                >
                                  {ehFeriado ? "Feriado Ativo" : "Feriado"}
                                </button>
                                <button
                                  type="button"
                                  className="button button-secondary button-compact"
                                  onClick={() => abrirFaltaParaDia(index)}
                                >
                                  Falta
                                </button>
                                <button
                                  type="button"
                                  className="button button-secondary button-compact"
                                  onClick={() => limparDia(index)}
                                >
                                  Limpar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="form-actions departamentos-actions ponto-actions">
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

      {modalFaltaAberto && diaSelecionadoParaFalta && (
        <div className="modal-overlay">
          <div className="modal-card">
            <header className="form-section-header">
              <div>
                <h3>Registrar falta</h3>
                <p>{formatarDia(diaSelecionadoParaFalta.dataReferencia)}</p>
              </div>
            </header>

            <div className="falta-modal-opcoes">
              <label className="checkbox-row">
                <input
                  type="radio"
                  name="tipoFaltaSelecionada"
                  checked={tipoFaltaSelecionada === "FALTA_JUSTIFICADA"}
                  onChange={() => setTipoFaltaSelecionada("FALTA_JUSTIFICADA")}
                />
                <span>Falta justificada</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="radio"
                  name="tipoFaltaSelecionada"
                  checked={tipoFaltaSelecionada === "FALTA_NAO_JUSTIFICADA"}
                  onChange={() => setTipoFaltaSelecionada("FALTA_NAO_JUSTIFICADA")}
                />
                <span>Falta não justificada</span>
              </label>
            </div>

            {tipoFaltaSelecionada === "FALTA_JUSTIFICADA" && (
              <div className="form-grid two-columns">
                <div className="form-group">
                  <label htmlFor="motivoFalta">Motivo</label>
                  <select
                    id="motivoFalta"
                    className="form-input"
                    value={motivoFaltaSelecionado}
                    onChange={(e) => setMotivoFaltaSelecionado(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {motivosFalta.map((motivo) => (
                      <option key={motivo.ID_MOTIVO} value={motivo.ID_MOTIVO}>
                        {motivo.DESCRICAO}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="observacaoFalta">Observação</label>
                  <textarea
                    id="observacaoFalta"
                    className="form-input"
                    value={observacaoFalta}
                    onChange={(e) => setObservacaoFalta(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}

            {tipoFaltaSelecionada === "FALTA_NAO_JUSTIFICADA" && (
              <div className="form-grid single-column">
                <div className="form-group">
                  <label htmlFor="observacaoFalta">Observação</label>
                  <textarea
                    id="observacaoFalta"
                    className="form-input"
                    value={observacaoFalta}
                    onChange={(e) => setObservacaoFalta(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="button button-primary" onClick={confirmarFaltaDia}>
                Confirmar
              </button>
              <button type="button" className="button button-secondary" onClick={fecharModalFalta}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
