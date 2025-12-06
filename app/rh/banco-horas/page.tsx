"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [situacaoPeriodo, setSituacaoPeriodo] = useState<string>("");
  const [modalFechamentoAberto, setModalFechamentoAberto] = useState(false);
  const [modalReaberturaAberto, setModalReaberturaAberto] = useState(false);
  const [usuarioMaster, setUsuarioMaster] = useState("");
  const [senhaMaster, setSenhaMaster] = useState("");
  const [motivoReabertura, setMotivoReabertura] = useState("");

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
    const situacaoSelecionada = periodosDisponiveis.find((p) => p.valor === mes)?.situacao ?? "";
    setSituacaoPeriodo(situacaoSelecionada);
  }, [mes, periodosDisponiveis]);

  const saldoAnteriorHoras = resumo?.saldoAnteriorMin ?? 0;
  const extras50Horas = resumo?.extrasUteisMin ?? 0;
  const extras100Horas = resumo?.extras100Min ?? 0;
  const horasDevidas = resumo?.devidasMin ?? 0;
  const valorHora = resumo?.funcionario.valorHora ?? 0;

  const saldoMesHoras = saldoAnteriorHoras + extras50Horas + extras100Horas - horasDevidas;
  const saldoMesValor =
    saldoAnteriorHoras * (valorHora / 60) +
    (extras50Horas / 60) * valorHora * 1.5 +
    (extras100Horas / 60) * valorHora * 2 -
    (horasDevidas / 60) * valorHora;

  const horasMovimentacao = parseHoraParaMinutos(horasBancoQuantidade) ?? 0;

  const { saldoFinalParaPagarHoras, saldoBancoFinalHoras } = useMemo(() => {
    let saldoFinal = saldoMesHoras;
    let saldoBanco = saldoAnteriorHoras;

    if (tipoOperacaoBanco && horasMovimentacao > 0) {
      if (tipoOperacaoBanco === "ENVIAR_HORAS_PARA_BANCO") {
        saldoFinal = saldoMesHoras - horasMovimentacao;
        saldoBanco = saldoAnteriorHoras + horasMovimentacao;
      } else {
        saldoFinal = saldoMesHoras + horasMovimentacao;
        saldoBanco = saldoAnteriorHoras - horasMovimentacao;
      }
    }

    if (zerarBancoAoFinal && saldoBanco !== 0) {
      saldoFinal += saldoBanco;
      saldoBanco = 0;
    }

    return { saldoFinalParaPagarHoras: saldoFinal, saldoBancoFinalHoras: saldoBanco };
  }, [horasMovimentacao, saldoAnteriorHoras, saldoMesHoras, tipoOperacaoBanco, zerarBancoAoFinal]);

  const periodoSelecionado = Boolean(
    idFuncionario && mes && periodosDisponiveis.some((p) => p.valor === mes)
  );
  const periodoFechado = situacaoPeriodo === "FECHADO";
  const bloqueioEdicao = periodoFechado;

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

    if (bloqueioEdicao) {
      setNotification({ type: "info", message: "Período fechado. Reabra para editar." });
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

  const fecharPeriodo = async () => {
    if (!resumo || !periodoSelecionado || periodoFechado) {
      setNotification({ type: "info", message: "Selecione um período aberto para fechar." });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch("/api/rh/banco-horas/fechamento/fechar-periodo", {
        method: "POST",
        headers: headersPadrao,
        body: JSON.stringify({
          idFuncionario,
          anoReferencia: ano,
          mesReferencia: Number(mes),
          saldoAnteriorMinutos: saldoAnteriorHoras,
          horasExtras50Minutos: extras50Horas,
          horasExtras100Minutos: extras100Horas,
          horasDevidasMinutos: horasDevidas,
          ajustesMinutos: resumo.ajustesManuaisMin,
          fechamentosMinutos: resumo.fechamentosMin,
          saldoFinalBancoMinutos: saldoBancoFinalHoras,
          saldoFinalParaPagarMinutos: saldoFinalParaPagarHoras,
          valorHora,
          zerouBanco: zerarBancoAoFinal,
        }),
      });

      const json = await resp.json();
      if (json?.success) {
        setSituacaoPeriodo(json?.data?.situacaoPeriodo ?? "FECHADO");
        setPeriodosDisponiveis((prev) =>
          prev.map((p) => (p.valor === mes ? { ...p, situacao: json?.data?.situacaoPeriodo ?? "FECHADO" } : p))
        );
        setNotification({ type: "success", message: "Período fechado com sucesso." });
      } else {
        setNotification({ type: "error", message: "Não foi possível fechar o período." });
      }
    } catch (error) {
      console.error(error);
      setNotification({ type: "error", message: "Erro ao fechar período" });
    } finally {
      setLoading(false);
      setModalFechamentoAberto(false);
    }
  };

  const reabrirPeriodo = async () => {
    if (!periodoSelecionado || !periodoFechado) {
      setNotification({ type: "info", message: "Selecione um período fechado para reabrir." });
      return;
    }

    if (!usuarioMaster || !senhaMaster) {
      setNotification({ type: "info", message: "Informe usuário master e senha para reabrir." });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch("/api/rh/banco-horas/fechamento/reabrir-periodo", {
        method: "POST",
        headers: headersPadrao,
        body: JSON.stringify({
          idFuncionario,
          anoReferencia: ano,
          mesReferencia: Number(mes),
          usuarioMaster,
          senhaMaster,
          motivoLiberacao: motivoReabertura,
        }),
      });
      const json = await resp.json();
      if (json?.success) {
        setSituacaoPeriodo(json?.data?.situacaoPeriodo ?? "REABERTO");
        setPeriodosDisponiveis((prev) =>
          prev.map((p) => (p.valor === mes ? { ...p, situacao: json?.data?.situacaoPeriodo ?? "REABERTO" } : p))
        );
        const usuarioMasterLiberador = json?.data?.usuarioMaster ? ` por ${json?.data?.usuarioMaster}` : "";
        setNotification({
          type: "success",
          message: `Período reaberto para edição${usuarioMasterLiberador}.`,
        });
      } else {
        setNotification({ type: "error", message: "Não foi possível reabrir o período." });
      }
    } catch (error) {
      console.error(error);
      setNotification({ type: "error", message: "Erro ao reabrir período" });
    } finally {
      setLoading(false);
      setModalReaberturaAberto(false);
      setSenhaMaster("");
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
                <p style={{ fontWeight: 600, color: "#4b5563" }}>
                  Status do período: {situacaoPeriodo || "N/D"}
                </p>
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
                          {formatarMoeda((extras50Horas / 60) * valorHora * 1.5)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>EXTRAS 100% (VALOR)</label>
                        <div className="form-input" style={{ backgroundColor: "#f0fdf4", color: "#059669" }}>
                          {formatarMoeda((extras100Horas / 60) * valorHora * 2)}
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
                        <label>SALDO MES HORAS</label>
                        <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                          {minutosParaHora(saldoMesHoras)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>SALDO BANCO ANTERIOR</label>
                        <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                          {minutosParaHora(saldoAnteriorHoras)}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>TIPO DE OPERACAO</label>
                        <select
                          value={tipoOperacaoBanco}
                          onChange={(e) =>
                            setTipoOperacaoBanco(
                              e.target.value as "ENVIAR_HORAS_PARA_BANCO" | "USAR_HORAS_DO_BANCO" | ""
                            )
                          }
                          className="form-input"
                          disabled={bloqueioEdicao}
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
                          disabled={bloqueioEdicao}
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
                          disabled={bloqueioEdicao}
                        >
                          {zerarBancoAoFinal ? "Desfazer zerar banco" : "Zerar banco ao final do mes"}
                        </button>
                      </div>
                      <div className="form-group">
                        <label>HORAS A PAGAR 100% (REFERENCIA)</label>
                        <div className="form-input" style={{ backgroundColor: "#f3f4f6" }}>
                          {minutosParaHora(resumo.horasPagar100Min)}
                        </div>
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
                        className="form-input"
                        disabled={bloqueioEdicao}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="ajusteTipo">TIPO</label>
                      <select
                        id="ajusteTipo"
                        value={ajusteTipo}
                        onChange={(e) => setAjusteTipo(e.target.value as "CREDITO" | "DEBITO")}
                        className="form-input"
                        disabled={bloqueioEdicao}
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
                        disabled={bloqueioEdicao}
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
                      disabled={bloqueioEdicao}
                    />
                  </div>

                  <div className="form-actions">
                    <div className="button-row">
                      <button
                        onClick={incluirAjuste}
                        className="button button-primary"
                        disabled={loading || bloqueioEdicao}
                        style={{ backgroundColor: "#f97316", borderColor: "#ea580c" }}
                      >
                        Incluir Ajuste Manual
                      </button>
                    </div>
                  </div>
                </section>

                <CardDivider />

                <section className="panel banco-horas-panel">
                  <header className="form-section-header">
                    <h2>FECHAMENTO DO PERIODO</h2>
                    <p>Finalize ou libere a edição do período selecionado.</p>
                  </header>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
                    {periodoFechado && (
                      <button
                        type="button"
                        className="button"
                        style={{ borderColor: "#f97316", color: "#f97316", backgroundColor: "white" }}
                        onClick={() => setModalReaberturaAberto(true)}
                        disabled={!periodoSelecionado || loading}
                      >
                        Reabrir período
                      </button>
                    )}

                    <button
                      type="button"
                      className="button button-primary"
                      style={{ backgroundColor: "#f97316", borderColor: "#ea580c" }}
                      onClick={() => setModalFechamentoAberto(true)}
                      disabled={!periodoSelecionado || !resumo || periodoFechado || loading}
                    >
                      Fechar período
                    </button>
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {modalFechamentoAberto && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Confirmar fechamento do período?</h3>
            <p style={{ color: "#4b5563", marginBottom: "16px" }}>
              Após o fechamento, a edição ficará bloqueada e apenas um usuário master poderá reabrir o período.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button className="button" onClick={() => setModalFechamentoAberto(false)}>
                Cancelar
              </button>
              <button
                className="button button-primary"
                style={{ backgroundColor: "#f97316", borderColor: "#ea580c" }}
                onClick={fecharPeriodo}
                disabled={loading}
              >
                Confirmar fechamento
              </button>
            </div>
          </div>
        </div>
      )}

      {modalReaberturaAberto && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Liberação master para reabertura</h3>
            <p style={{ color: "#4b5563", marginBottom: "16px" }}>
              Informe as credenciais do usuário master para reabrir o período fechado.
            </p>

            <div className="form-group">
              <label>Usuário master</label>
              <input
                type="text"
                className="form-input"
                value={usuarioMaster}
                onChange={(e) => setUsuarioMaster(e.target.value)}
                placeholder="Login do usuário master"
              />
            </div>

            <div className="form-group">
              <label>Senha</label>
              <input
                type="password"
                className="form-input"
                value={senhaMaster}
                onChange={(e) => setSenhaMaster(e.target.value)}
                placeholder="Senha de liberação"
              />
            </div>

            <div className="form-group">
              <label>Motivo da reabertura</label>
              <input
                type="text"
                className="form-input"
                value={motivoReabertura}
                onChange={(e) => setMotivoReabertura(e.target.value)}
                placeholder="Opcional, descreva o motivo"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
              <button className="button" onClick={() => setModalReaberturaAberto(false)}>
                Cancelar
              </button>
              <button
                className="button button-primary"
                style={{ backgroundColor: "#f97316", borderColor: "#ea580c" }}
                onClick={reabrirPeriodo}
                disabled={loading}
              >
                Reabrir período
              </button>
            </div>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
