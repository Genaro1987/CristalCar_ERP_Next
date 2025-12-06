"use client";

import { useEffect, useMemo, useState } from "react";

import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { minutosParaHora } from "@/lib/rhPontoCalculo";
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

function horaParaMinutos(horaStr: string): number {
  const partes = horaStr.split(":");
  if (partes.length !== 2) return 0;
  const horas = parseInt(partes[0]) || 0;
  const minutos = parseInt(partes[1]) || 0;
  return horas * 60 + minutos;
}

function mesParaTexto(mesNumero: number): string {
  return nomesMeses[mesNumero] ?? mesNumero.toString();
}

function mesParaValor(mesNumero: number): string {
  return mesNumero.toString().padStart(2, "0");
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
  const [politica, setPolitica] = useState<"COMPENSAR_COM_HORAS_EXTRAS" | "DESCONTAR_EM_FOLHA">(
    "COMPENSAR_COM_HORAS_EXTRAS"
  );
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<PeriodoOption[]>([]);
  const [zerarBanco, setZerarBanco] = useState(false);
  const [ajusteHoras, setAjusteHoras] = useState("");
  const [ajusteData, setAjusteData] = useState("");
  const [ajusteTipo, setAjusteTipo] = useState<"CREDITO" | "DEBITO">("CREDITO");
  const [ajusteObs, setAjusteObs] = useState("");

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
        `/api/rh/banco-horas/resumo?idFuncionario=${idFuncionario}&ano=${ano}&mes=${mes}&politicaFaltas=${politica}&zerarBancoNoMes=${zerarBanco}`,
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

    const minutosCalc = horaParaMinutos(ajusteHoras);
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

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="REL001_RH_BANCO_HORAS"
          nomeTela="BANCO DE HORAS"
          caminhoRota="/rh/banco-horas"
          modulo="RH"
        />

        <main className="page-content-card">
          {notification && <NotificationBar type={notification.type} message={notification.message} />}

          <div className="panel" style={{ maxWidth: "none" }}>

          <div className="form-section-header">
            <h2>Filtros</h2>
            <p>Selecione o funcionário e competência para calcular o banco de horas</p>
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

              <div style={{ flex: "0 0 auto" }}>
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
                >
                  {loading ? "Calculando..." : "Calcular"}
                </button>
              </div>
            </div>
          </div>

          {resumo && (
            <>
              <div className="form-section-header" style={{ marginTop: "32px" }}>
                <h2>Dados do Funcionário</h2>
              </div>

              <div className="form-grid three-columns">
                <div className="form-group">
                  <label>Nome</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                    {resumo.funcionario.nome}
                  </div>
                </div>

                <div className="form-group">
                  <label>Departamento</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                    {resumo.funcionario.nomeDepartamento ?? "-"}
                  </div>
                </div>

                <div className="form-group">
                  <label>Valor Hora</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                    {formatarMoeda(resumo.funcionario.valorHora)}
                  </div>
                </div>
              </div>

              <div className="form-section-header" style={{ marginTop: "32px" }}>
                <h2>Resumo do Mês</h2>
                <p>Competência: {String(mes).padStart(2, "0")}/{ano}</p>
              </div>

              <div className="form-grid three-columns">
                <div className="form-group">
                  <label>Saldo Anterior</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                    {minutosParaHora(resumo.saldoAnteriorMin)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Extras Úteis (50%)</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb", color: "#059669" }}>
                    {minutosParaHora(resumo.extrasUteisMin)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Extras 100%</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb", color: "#059669" }}>
                    {minutosParaHora(resumo.extras100Min)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Horas Devidas</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb", color: "#dc2626" }}>
                    {minutosParaHora(resumo.devidasMin)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Ajustes Manuais</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                    {minutosParaHora(resumo.ajustesManuaisMin)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Fechamentos</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                    {minutosParaHora(resumo.fechamentosMin)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Saldo Técnico</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb", fontWeight: 700 }}>
                    {minutosParaHora(resumo.saldoTecnicoMin)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Saldo Final</label>
                  <div className="form-input" style={{ backgroundColor: "#fff3cd", fontWeight: 700 }}>
                    {minutosParaHora(resumo.saldoFinalBancoMin)}
                  </div>
                </div>
              </div>

              <div className="form-section-header" style={{ marginTop: "32px" }}>
                <h2>Ações Finais</h2>
                <p>Defina a política de faltas e se deseja zerar o banco ao final do mês</p>
              </div>

              <div className="form">
                <div style={{ display: "flex", gap: "32px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <span style={{ marginRight: "8px", fontWeight: 500 }}>Política de faltas:</span>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      <input
                        type="radio"
                        checked={politica === "COMPENSAR_COM_HORAS_EXTRAS"}
                        onChange={() => setPolitica("COMPENSAR_COM_HORAS_EXTRAS")}
                      />
                      <span>Compensar com horas extras</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "16px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      <input
                        type="radio"
                        checked={politica === "DESCONTAR_EM_FOLHA"}
                        onChange={() => setPolitica("DESCONTAR_EM_FOLHA")}
                      />
                      <span>Descontar em folha</span>
                    </label>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input
                      type="checkbox"
                      checked={zerarBanco}
                      onChange={(e) => setZerarBanco(e.target.checked)}
                    />
                    <span>Zerar banco ao final do mês</span>
                  </label>
                </div>
              </div>

              <div className="form-section-header" style={{ marginTop: "32px" }}>
                <h2>Valores a Pagar/Descontar</h2>
              </div>

              <div className="form-grid three-columns">
                <div className="form-group">
                  <label>Horas a Pagar 50%</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                    {minutosParaHora(resumo.horasPagar50Min)} = {formatarMoeda((resumo.horasPagar50Min / 60) * resumo.funcionario.valorHora * 1.5)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Horas a Pagar 100%</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                    {minutosParaHora(resumo.horasPagar100Min)} = {formatarMoeda((resumo.horasPagar100Min / 60) * resumo.funcionario.valorHora * 2)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Horas a Descontar</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb", color: "#dc2626" }}>
                    {minutosParaHora(resumo.horasDescontarMin)} = {formatarMoeda((resumo.horasDescontarMin / 60) * resumo.funcionario.valorHora)}
                  </div>
                </div>
              </div>

              <div className="form-section-header" style={{ marginTop: "32px" }}>
                <h2>Detalhamento Diário</h2>
              </div>

              <div className="departamento-tabela-wrapper">
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
                          <span className={
                            dia.classificacao === "EXTRA_UTIL" || dia.classificacao === "EXTRA_100"
                              ? "badge badge-success"
                              : dia.classificacao === "DEVEDOR" || dia.classificacao.includes("FALTA")
                              ? "badge badge-danger"
                              : "badge"
                          }>
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

              {resumo.movimentos.length > 0 && (
                <>
                  <div className="form-section-header" style={{ marginTop: "32px" }}>
                    <h2>Movimentos de Banco de Horas</h2>
                  </div>

                  <div className="departamento-tabela-wrapper">
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
                </>
              )}

              <div className="form-section-header" style={{ marginTop: "32px" }}>
                <h2>Incluir Ajuste Manual</h2>
              </div>

              <div className="form-grid three-columns">
                <div className="form-group">
                  <label htmlFor="ajusteData">Data</label>
                  <input
                    id="ajusteData"
                    type="date"
                    value={ajusteData}
                    onChange={(e) => setAjusteData(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="ajusteTipo">Tipo</label>
                  <select
                    id="ajusteTipo"
                    value={ajusteTipo}
                    onChange={(e) => setAjusteTipo(e.target.value as "CREDITO" | "DEBITO")}
                    className="form-input"
                  >
                    <option value="CREDITO">Crédito</option>
                    <option value="DEBITO">Débito</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="ajusteHoras">Horas (HH:MM)</label>
                  <input
                    id="ajusteHoras"
                    type="text"
                    value={ajusteHoras}
                    onChange={(e) => setAjusteHoras(e.target.value)}
                    className="form-input"
                    placeholder="Ex: 02:30"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="ajusteObs">Observação</label>
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
                  >
                    Incluir Ajuste Manual
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        </main>
      </div>
    </LayoutShell>
  );
}
