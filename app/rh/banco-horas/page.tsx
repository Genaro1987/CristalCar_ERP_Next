"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { minutosParaHora, parseHoraParaMinutos } from "@/lib/rhPontoCalculo";
import type { ResumoBancoHorasMes } from "@/db/rhBancoHoras";

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

function CardDivider() {
  return <div className="banco-horas-divider" aria-hidden />;
}

export default function BancoHorasPage() {
  useRequerEmpresaSelecionada({ ativo: true });
  const { empresa } = useEmpresaSelecionada();
  const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);
  const [resumo, setResumo] = useState<ResumoBancoHorasMes | null>(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const compAtual = useMemo(() => competenciaAtual(), []);
  const [idFuncionario, setIdFuncionario] = useState("");
  const [ano, setAno] = useState(compAtual.ano);
  const [mes, setMes] = useState("");
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<PeriodoOption[]>([]);
  const [zerarBanco, setZerarBanco] = useState(false);
  const [tipoOperacaoBanco, setTipoOperacaoBanco] = useState<
    "ENVIAR_HORAS_PARA_BANCO" | "USAR_HORAS_DO_BANCO" | ""
  >("");
  const [horasBancoQuantidade, setHorasBancoQuantidade] = useState("");
  const [zerarBancoAoFinal, setZerarBancoAoFinal] = useState(false);
  const [ajusteHoras, setAjusteHoras] = useState("");
  const [ajusteData, setAjusteData] = useState("");
  const [ajusteTipo, setAjusteTipo] = useState<"CREDITO" | "DEBITO">("CREDITO");
  const [ajusteObs, setAjusteObs] = useState("");
  const [situacaoPeriodo, setSituacaoPeriodo] = useState<string | null>(null);
  const [atualizandoPeriodo, setAtualizandoPeriodo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);

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
      setMes("");
      return;
    }

    const controller = new AbortController();

    fetch(
      `/api/rh/banco-horas/periodos?funcionarioId=${idFuncionario}&ano=${ano}`,
      { headers: headersPadrao, signal: controller.signal }
    )
      .then((r) => r.json())
      .then((json) => {
        const periodos = (json?.data ?? [])
          .filter((p: { SITUACAO_PERIODO: string }) => p.SITUACAO_PERIODO !== "NAO_INICIADO")
          .map((p: { MES_REFERENCIA: number; SITUACAO_PERIODO: string }) => ({
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
    if (periodosDisponiveis.length === 0) {
      setMes("");
      return;
    }
    const mesAtualDisponivel = periodosDisponiveis.some((p) => p.valor === mes);
    if (!mesAtualDisponivel) {
      setMes(periodosDisponiveis[0].valor);
    }
  }, [mes, periodosDisponiveis]);

  useEffect(() => {
    buscarSituacaoPeriodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFuncionario, mes, ano]);

  const saldoAnteriorHoras = resumo?.saldoAnteriorMin ?? 0;
  const extras50Horas = resumo?.extrasUteisMin ?? 0;
  const extras100Horas = resumo?.extras100Min ?? 0;
  const horasDevidas = resumo?.devidasMin ?? 0;
  const valorHora = resumo?.funcionario.valorHora ?? 0;

  // horasDevidas já vem como valor negativo, então somamos ao invés de subtrair
  const saldoMesHoras = saldoAnteriorHoras + extras50Horas + extras100Horas + horasDevidas;
  const saldoMesValor =
    saldoAnteriorHoras * (valorHora / 60) +
    (extras50Horas / 60) * valorHora +
    (extras100Horas / 60) * valorHora +
    (horasDevidas / 60) * valorHora;

  const horasMovimentacao = parseHoraParaMinutos(horasBancoQuantidade) ?? 0;

  // Saldo do período (apenas este mês, sem saldo anterior do banco)
  const saldoPeriodoHoras = extras50Horas + extras100Horas + horasDevidas;

  const { saldoFinalParaPagarHoras, saldoBancoFinalHoras } = useMemo(() => {
    // saldoPeriodo = apenas os impactos deste mês (extras - devidas)
    // saldoAnterior = o que já estava no banco de meses anteriores
    let saldoFinal = saldoPeriodoHoras;
    let saldoBanco = saldoAnteriorHoras;

    if (tipoOperacaoBanco && horasMovimentacao > 0) {
      if (tipoOperacaoBanco === "ENVIAR_HORAS_PARA_BANCO") {
        // Envia horas do período para o banco (credita no banco, reduz pagável)
        saldoFinal = saldoPeriodoHoras - horasMovimentacao;
        saldoBanco = saldoAnteriorHoras + horasMovimentacao;
      } else {
        // Usa horas do banco para abater (debita do banco, aumenta pagável)
        saldoFinal = saldoPeriodoHoras + horasMovimentacao;
        saldoBanco = saldoAnteriorHoras - horasMovimentacao;
      }
    }

    if (zerarBancoAoFinal && saldoBanco !== 0) {
      saldoFinal += saldoBanco;
      saldoBanco = 0;
    }

    return { saldoFinalParaPagarHoras: saldoFinal, saldoBancoFinalHoras: saldoBanco };
  }, [horasMovimentacao, saldoAnteriorHoras, saldoPeriodoHoras, tipoOperacaoBanco, zerarBancoAoFinal]);

  const carregarResumo = async () => {
    if (!idFuncionario) {
      setNotification({ type: "info", message: "Selecione um funcionário" });
      return;
    }
    if (!mes) {
      setNotification({ type: "info", message: "Selecione um mês disponível" });
      return;
    }
    if (!periodosDisponiveis.some((p) => p.valor === mes)) {
      setNotification({ type: "info", message: "O mês selecionado não possui período disponível" });
      return;
    }
    setLoading(true);
    setNotification(null);
    try {
      const resp = await fetch(
        `/api/rh/banco-horas/resumo?idFuncionario=${idFuncionario}&ano=${ano}&mes=${mes}&zerarBancoNoMes=${zerarBanco}`,
        { headers: headersPadrao }
      );
      const json = await resp.json();
      if (json?.success) {
        setResumo(json.data);
      } else {
        setNotification({ type: "error", message: "Não foi possível calcular o banco de horas." });
      }
    } catch (error) {
      console.error(error);
      setNotification({ type: "error", message: "Erro ao consultar banco de horas" });
    } finally {
      setLoading(false);
    }
  };

  const incluirAjuste = async () => {
    if (!idFuncionario || !ajusteData || !ajusteHoras) {
      setNotification({ type: "info", message: "Informe funcionário, data e horas para o ajuste" });
      return;
    }

    const minutosCalc = parseHoraParaMinutos(ajusteHoras) ?? 0;
    if (minutosCalc === 0) {
      setNotification({ type: "info", message: "Informe as horas no formato HH:MM (ex: 02:30)" });
      return;
    }

    const minutos = ajusteTipo === "CREDITO" ? Math.abs(minutosCalc) : -Math.abs(minutosCalc);

    try {
      setLoading(true);
      const resp = await fetch("/api/rh/banco-horas/ajustes", {
        method: "POST",
        headers: headersPadrao,
        body: JSON.stringify({
          idFuncionario,
          data: ajusteData,
          tipo: "AJUSTE_MANUAL",
          minutos,
          observacao: ajusteObs,
        }),
      });
      const json = await resp.json();
      if (json?.success) {
        setNotification({ type: "success", message: "Ajuste incluído com sucesso" });
        setAjusteHoras("");
        setAjusteData("");
        setAjusteObs("");
        await carregarResumo();
      } else {
        setNotification({ type: "error", message: "Não foi possível incluir o ajuste." });
      }
    } catch (error) {
      console.error(error);
      setNotification({ type: "error", message: "Erro ao incluir ajuste" });
    } finally {
      setLoading(false);
    }
  };

  const excluirAjuste = async (idAjuste: number) => {
    setConfirmarExclusao(null);

    try {
      setLoading(true);
      const resp = await fetch("/api/rh/banco-horas/ajustes", {
        method: "DELETE",
        headers: headersPadrao,
        body: JSON.stringify({ idAjuste }),
      });
      const json = await resp.json();
      if (json?.success) {
        setNotification({ type: "success", message: "Ajuste excluído com sucesso" });
        await carregarResumo();
      } else {
        setNotification({ type: "error", message: "Não foi possível excluir o ajuste." });
      }
    } catch (error) {
      console.error(error);
      setNotification({ type: "error", message: "Erro ao excluir ajuste" });
    } finally {
      setLoading(false);
    }
  };

  const buscarSituacaoPeriodo = async () => {
    if (!idFuncionario || !mes) {
      setSituacaoPeriodo(null);
      return;
    }

    try {
      const resp = await fetch(
        `/api/rh/banco-horas/periodo?funcionarioId=${idFuncionario}&ano=${ano}&mes=${mes}`,
        { headers: headersPadrao }
      );
      const json = await resp.json();
      if (json?.success) {
        setSituacaoPeriodo(json.situacao);
      }
    } catch (error) {
      console.error(error);
      setSituacaoPeriodo(null);
    }
  };

  const alternarSituacaoPeriodo = async (acao: "fechar" | "reabrir") => {
    if (!idFuncionario || !mes) {
      setNotification({ type: "info", message: "Selecione um funcionário e mês" });
      return;
    }

    setAtualizandoPeriodo(true);
    setNotification(null);

    try {
      const resp = await fetch("/api/rh/banco-horas/periodo", {
        method: "POST",
        headers: headersPadrao,
        body: JSON.stringify({
          funcionarioId: idFuncionario,
          ano,
          mes: Number(mes),
          acao,
        }),
      });

      const json = await resp.json();

      if (json?.success) {
        setNotification({
          type: "success",
          message: acao === "fechar" ? "Período fechado com sucesso" : "Período reaberto com sucesso",
        });
        await buscarSituacaoPeriodo();
      } else {
        setNotification({
          type: "error",
          message: `Não foi possível ${acao === "fechar" ? "fechar" : "reabrir"} o período.`,
        });
      }
    } catch (error) {
      console.error(error);
      setNotification({
        type: "error",
        message: `Erro ao ${acao === "fechar" ? "fechar" : "reabrir"} o período`,
      });
    } finally {
      setAtualizandoPeriodo(false);
    }
  };

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="REL001_RH_BANCO_HORAS"
          nomeTela="BANCO DE HORAS"
          caminhoRota="/rh/banco-horas"
          modulo="RH"
        />

        <main className="page-content-card banco-horas-page">
          {notification && <NotificationBar type={notification.type} message={notification.message} />}

          <div className="banco-horas-cards">
            <section className="panel banco-horas-panel">
              <header className="form-section-header">
                <h2>FILTROS E CALCULAR</h2>
                <p>Selecione EMPRESA/FUNCIONARIO/ANO/MES e acione CALCULAR PERIODO.</p>
              </header>

              <div className="form" style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                <div className="banco-horas-card-grid" style={{ alignItems: "flex-end" }}>
                  <div className="form-group">
                    <label htmlFor="funcionario">FUNCIONARIO</label>
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

                  <div className="form-group">
                    <label htmlFor="ano">ANO</label>
                    <input
                      id="ano"
                      type="number"
                      value={ano}
                      onChange={(e) => setAno(Number(e.target.value))}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="mes">MES</label>
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

                  <div className="form-group" style={{ justifySelf: "flex-start" }}>
                    <label className="sr-only">CALCULAR</label>
                    <button
                      onClick={carregarResumo}
                      disabled={
                        loading ||
                        !idFuncionario ||
                        !ano ||
                        !mes ||
                        !periodosDisponiveis.some((p) => p.valor === mes)
                      }
                      className="button button-primary"
                      style={{ backgroundColor: "#f97316", borderColor: "#ea580c", width: "100%" }}
                    >
                      {loading ? "Calculando..." : "Calcular período"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {resumo && (
              <>
                <CardDivider />

                <section className="panel banco-horas-panel">
                  <header className="form-section-header">
                    <h2>DADOS DO FUNCIONARIO</h2>
                    <p>Informações principais do colaborador.</p>
                  </header>
                  <div className="banco-horas-card-grid" style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                    <div className="form-group">
                      <label>MATRICULA</label>
                      <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                        {resumo.funcionario.id}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>NOME</label>
                      <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                        {resumo.funcionario.nome}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>SETOR</label>
                      <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                        {resumo.funcionario.nomeDepartamento ?? "-"}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>VALOR HORA</label>
                      <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                        {formatarMoeda(resumo.funcionario.valorHora)}
                      </div>
                    </div>
                  </div>
                </section>

                <CardDivider />

                <section className="panel banco-horas-panel">
                  <header className="form-section-header">
                    <h2>STATUS DO PERÍODO</h2>
                    <p>Controle de situação e fechamento do período.</p>
                  </header>
                  <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                    <div className="banco-horas-card-grid">
                      <div className="form-group">
                        <label>SITUAÇÃO ATUAL</label>
                        <div
                          className="form-input"
                          style={{
                            backgroundColor: situacaoPeriodo === "FECHADO" ? "#f0fdf4" : "#fef9e7",
                            color: situacaoPeriodo === "FECHADO" ? "#059669" : "#f59e0b",
                            fontWeight: 600,
                          }}
                        >
                          {situacaoPeriodo === "FECHADO" ? "FECHADO" : situacaoPeriodo === "DIGITADO" ? "DIGITADO (EM ABERTO)" : "NÃO INICIADO"}
                        </div>
                      </div>

                      <div className="form-group">
                        <label>AÇÕES</label>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {situacaoPeriodo !== "FECHADO" ? (
                            <button
                              onClick={() => alternarSituacaoPeriodo("fechar")}
                              disabled={atualizandoPeriodo || situacaoPeriodo !== "DIGITADO"}
                              className="button button-primary"
                              style={{
                                backgroundColor: "#10b981",
                                borderColor: "#059669",
                                flex: 1,
                              }}
                            >
                              {atualizandoPeriodo ? "Processando..." : "Fechar Período"}
                            </button>
                          ) : (
                            <button
                              onClick={() => alternarSituacaoPeriodo("reabrir")}
                              disabled={atualizandoPeriodo}
                              className="button button-secondary"
                              style={{ flex: 1 }}
                            >
                              {atualizandoPeriodo ? "Processando..." : "Reabrir Período"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <CardDivider />

                <section className="panel banco-horas-panel">
                  <header className="form-section-header">
                    <h2>RESUMO DO MES</h2>
                    <p>Sequência em horas e valores para acompanhamento mensal.</p>
                  </header>

                  <div style={{ display: "grid", gap: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                      <div className="form-group">
                        <label>SALDO ANTERIOR</label>
                        <div className="form-input" style={{ backgroundColor: "#f3f4f6" }}>
                          {minutosParaHora(saldoAnteriorHoras)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>EXTRAS 50%</label>
                        <div className="form-input" style={{ backgroundColor: "#f0fdf4", color: "#059669" }}>
                          {minutosParaHora(extras50Horas)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>EXTRAS 100%</label>
                        <div className="form-input" style={{ backgroundColor: "#f0fdf4", color: "#059669" }}>
                          {minutosParaHora(extras100Horas)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>HORAS DEVIDAS</label>
                        <div className="form-input" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
                          {minutosParaHora(horasDevidas)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>SALDO DO MES (HORAS)</label>
                        <div className="form-input" style={{ backgroundColor: "#fff3cd", fontWeight: 700 }}>
                          {minutosParaHora(saldoMesHoras)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                      <div className="form-group">
                        <label>SALDO ANTERIOR (VALOR)</label>
                        <div className="form-input" style={{ backgroundColor: "#f3f4f6" }}>
                          {formatarMoeda((saldoAnteriorHoras / 60) * valorHora)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>EXTRAS 50% (VALOR)</label>
                        <div className="form-input" style={{ backgroundColor: "#f0fdf4", color: "#059669" }}>
                          {formatarMoeda((extras50Horas / 60) * valorHora)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>EXTRAS 100% (VALOR)</label>
                        <div className="form-input" style={{ backgroundColor: "#f0fdf4", color: "#059669" }}>
                          {formatarMoeda((extras100Horas / 60) * valorHora)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>VALOR DEVIDO</label>
                        <div className="form-input" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
                          {formatarMoeda((horasDevidas / 60) * valorHora)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>SALDO DO MES (VALOR)</label>
                        <div className="form-input" style={{ backgroundColor: "#fff3cd", fontWeight: 700 }}>
                          {formatarMoeda(saldoMesValor)}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <CardDivider />

                <section className="panel banco-horas-panel">
                  <header className="form-section-header">
                    <h2>ACOES FINAIS</h2>
                    <p>HORAS PARA BANCO DE HORAS e fechamento técnico.</p>
                  </header>

                  <div className="form" style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                    <div className="banco-horas-card-grid">
                      <div className="form-group">
                        <label>SALDO DO PERÍODO</label>
                        <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                          {minutosParaHora(saldoPeriodoHoras)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>SALDO BANCO ANTERIOR</label>
                        <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                          {minutosParaHora(saldoAnteriorHoras)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>TIPO DE OPERAÇÃO</label>
                        <select
                          value={tipoOperacaoBanco}
                          onChange={(e) =>
                            setTipoOperacaoBanco(
                              e.target.value as "ENVIAR_HORAS_PARA_BANCO" | "USAR_HORAS_DO_BANCO" | ""
                            )
                          }
                          className="form-input"
                        >
                          <option value="">Selecione</option>
                          <option value="ENVIAR_HORAS_PARA_BANCO">Enviar horas para banco (credito)</option>
                          <option value="USAR_HORAS_DO_BANCO">Usar horas do banco (abater)</option>
                        </select>
                      </div>
                    </div>

                    <div className="banco-horas-card-grid">
                      <div className="form-group">
                        <label>HORAS BANCO (HH:MM)</label>
                        <input
                          type="time"
                          value={horasBancoQuantidade}
                          onChange={(e) => setHorasBancoQuantidade(e.target.value)}
                          className="form-input"
                          placeholder="Informe horas para movimento"
                          required={Boolean(tipoOperacaoBanco)}
                          min="00:01"
                          max="23:59"
                          step={60}
                        />
                        {tipoOperacaoBanco && horasMovimentacao <= 0 && (
                          <p className="error-text">Informe um valor de horas maior que zero.</p>
                        )}
                      </div>
                      <div className="form-group">
                        <label>SALDO PARA PAGAR/DESCONTAR</label>
                        <div className="form-input" style={{ backgroundColor: "#fff7ed", fontWeight: 600 }}>
                          {minutosParaHora(saldoFinalParaPagarHoras)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>SALDO FINAL DO BANCO</label>
                        <div className="form-input" style={{ backgroundColor: "#fff7ed", fontWeight: 600 }}>
                          {minutosParaHora(saldoBancoFinalHoras)}
                        </div>
                      </div>
                    </div>

                    <div className="banco-horas-card-grid">
                      <div className="form-group">
                        <label>ZERAR BANCO AO FINAL DO MES</label>
                        <button
                          type="button"
                          className="button button-primary"
                          style={{ backgroundColor: "#f97316", borderColor: "#ea580c" }}
                          onClick={() => {
                            setZerarBancoAoFinal((prev) => !prev);
                            setZerarBanco((prev) => !prev);
                          }}
                        >
                          {zerarBancoAoFinal ? "Cancelar zeragem de banco" : "Zerar banco ao final do mes"}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <CardDivider />

                <section className="panel banco-horas-panel">
                  <header className="form-section-header">
                    <h2>DETALHAMENTO DIARIO</h2>
                    <p>Grade diária com impactos em horas e valores.</p>
                  </header>

                  <div className="departamento-tabela-wrapper" style={{ marginTop: "8px" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Dia</th>
                          <th>Tipo</th>
                          <th>Jornada</th>
                          <th>Trabalhado</th>
                          <th>Diferença</th>
                          <th>Classificação</th>
                          <th>Impacto</th>
                          <th>Obs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumo.dias.map((dia) => (
                          <tr key={dia.data}>
                            <td className="whitespace-nowrap">{dia.data} - {dia.diaSemana}</td>
                            <td>{dia.tipoDia}</td>
                            <td>{minutosParaHora(dia.jornadaPrevistaMin)}</td>
                            <td>{minutosParaHora(dia.trabalhadoMin)}</td>
                            <td style={{ color: dia.diferencaMin > 0 ? "#059669" : dia.diferencaMin < 0 ? "#dc2626" : "inherit" }}>
                              {minutosParaHora(dia.diferencaMin)}
                            </td>
                            <td>
                              <span
                                className={
                                  dia.classificacao === "EXTRA_UTIL" || dia.classificacao === "EXTRA_100"
                                    ? "badge badge-success"
                                    : dia.classificacao === "DEVEDOR" || dia.classificacao.includes("FALTA")
                                      ? "badge badge-danger"
                                      : "badge"
                                }
                              >
                                {dia.classificacao}
                              </span>
                            </td>
                            <td style={{ color: dia.impactoBancoMin > 0 ? "#059669" : dia.impactoBancoMin < 0 ? "#dc2626" : "inherit" }}>
                              {minutosParaHora(dia.impactoBancoMin)}
                            </td>
                            <td>{dia.observacao ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <CardDivider />

                <section className="panel banco-horas-panel">
                  <header className="form-section-header">
                    <h2>MOVIMENTOS DE BANCO DE HORAS</h2>
                    <p>Histórico de movimentações e inclusão de ajustes.</p>
                  </header>

                  {resumo.movimentos.length > 0 && (
                    <div className="departamento-tabela-wrapper" style={{ marginTop: "8px" }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Tipo</th>
                            <th>Minutos</th>
                            <th>Observação</th>
                            <th style={{ width: "50px" }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumo.movimentos.map((mov) => (
                            <tr key={mov.id}>
                              <td>{mov.data}</td>
                              <td>{mov.tipo}</td>
                              <td style={{ color: mov.minutos > 0 ? "#059669" : mov.minutos < 0 ? "#dc2626" : "inherit" }}>
                                {minutosParaHora(mov.minutos)}
                              </td>
                              <td>{mov.observacao ?? "-"}</td>
                              <td>
                                {mov.tipo === "AJUSTE_MANUAL" && (
                                  <button
                                    onClick={() => setConfirmarExclusao(mov.id)}
                                    className="button-icon-only"
                                    style={{ color: "#dc2626" }}
                                    title="Excluir ajuste"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="form-section-header" style={{ marginTop: "16px" }}>
                    <h3>INCLUIR AJUSTE MANUAL</h3>
                  </div>

                  <div className="banco-horas-card-grid">
                    <div className="form-group">
                      <label htmlFor="ajusteData">DATA</label>
                      <input
                        id="ajusteData"
                        type="date"
                        value={ajusteData}
                        onChange={(e) => setAjusteData(e.target.value)}
                        min={mes ? `${ano}-${mes.padStart(2, "0")}-01` : undefined}
                        max={mes ? `${ano}-${mes.padStart(2, "0")}-${String(new Date(ano, Number(mes), 0).getDate()).padStart(2, "0")}` : undefined}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="ajusteTipo">TIPO</label>
                      <select
                        id="ajusteTipo"
                        value={ajusteTipo}
                        onChange={(e) => setAjusteTipo(e.target.value as "CREDITO" | "DEBITO")}
                        className="form-input"
                      >
                        <option value="CREDITO">CREDITO</option>
                        <option value="DEBITO">DEBITO</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="ajusteHoras">HORAS (HH:MM)</label>
                      <input
                        id="ajusteHoras"
                        type="time"
                        value={ajusteHoras}
                        onChange={(e) => setAjusteHoras(e.target.value)}
                        className="form-input"
                        placeholder="Ex: 02:30"
                        step={60}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="ajusteObs">OBSERVACAO</label>
                    <input
                      id="ajusteObs"
                      type="text"
                      value={ajusteObs}
                      onChange={(e) => setAjusteObs(e.target.value)}
                      className="form-input"
                      placeholder="Motivo do ajuste"
                    />
                  </div>

                  <div className="form-actions">
                    <div className="button-row">
                      <button
                        onClick={incluirAjuste}
                        className="button button-primary"
                        disabled={loading}
                        style={{ backgroundColor: "#f97316", borderColor: "#ea580c" }}
                      >
                        Incluir Ajuste Manual
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Modal de confirmação de exclusão de ajuste */}
      {confirmarExclusao !== null && (
        <div className="modal-overlay" onClick={() => setConfirmarExclusao(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", fontWeight: 700 }}>Excluir ajuste</h3>
            <p style={{ margin: "0 0 24px", fontSize: "0.95rem", color: "#374151" }}>
              Tem certeza que deseja excluir este ajuste? Esta ação não pode ser desfeita.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setConfirmarExclusao(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button button-primary"
                style={{ backgroundColor: "#dc2626" }}
                onClick={() => excluirAjuste(confirmarExclusao)}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
