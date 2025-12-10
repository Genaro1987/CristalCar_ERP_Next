"use client";

import { useEffect, useMemo, useState } from "react";

import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { ModalExportacao, type OpcoesExportacao } from "@/components/ModalExportacao";
import { minutosParaHora } from "@/lib/rhPontoCalculo";
import { exportarPDF, exportarExcel } from "@/lib/exportarBancoHoras";
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
            (r.horasPagar50Min / 60) * valorHora * 1.5 +
            (r.horasPagar100Min / 60) * valorHora * 2;
          const valorDescontar = (r.horasDescontarMin / 60) * valorHora;

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

          {resumo && (
            <>
              <div className="form-section-header" style={{ marginTop: "32px" }}>
                <h2>{resumo.funcionario.nome}</h2>
                <p>Competência: {String(resumo.competencia.mes).padStart(2, "0")}/{resumo.competencia.ano} |
                   Departamento: {resumo.funcionario.nomeDepartamento ?? "-"}</p>
              </div>

              <div className="form-grid three-columns">
                <div className="form-group">
                  <label>Horas Extras 50%</label>
                  <div className="form-input" style={{ backgroundColor: "#f0fdf4", color: "#059669", fontWeight: 600 }}>
                    {minutosParaHora(resumo.horasPagar50Min)} = {formatarMoeda((resumo.horasPagar50Min / 60) * resumo.funcionario.valorHora * 1.5)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Horas Extras 100%</label>
                  <div className="form-input" style={{ backgroundColor: "#f0fdf4", color: "#059669", fontWeight: 600 }}>
                    {minutosParaHora(resumo.horasPagar100Min)} = {formatarMoeda((resumo.horasPagar100Min / 60) * resumo.funcionario.valorHora * 2)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Horas Devidas</label>
                  <div className="form-input" style={{ backgroundColor: "#fef2f2", color: "#dc2626", fontWeight: 600 }}>
                    {minutosParaHora(resumo.horasDescontarMin)} = {formatarMoeda((resumo.horasDescontarMin / 60) * resumo.funcionario.valorHora)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Saldo Anterior</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                    {minutosParaHora(resumo.saldoAnteriorMin)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Ajustes e Fechamentos</label>
                  <div className="form-input" style={{ backgroundColor: "#f9fafb" }}>
                    {minutosParaHora(resumo.ajustesManuaisMin + resumo.fechamentosMin)}
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
                <h2>Detalhamento Diário</h2>
                <p>Jornada de Trabalho: {minutosParaHora(resumo.dias[0]?.jornadaPrevistaMin || 0)}</p>
              </div>

              <div className="departamento-tabela-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th>Trabalhado</th>
                      <th>Diferença</th>
                      <th>Classificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.dias.map((dia) => {
                      let classificacao = dia.classificacao;
                      if (classificacao === "EXTRA_UTIL") classificacao = "HORA CRÉDITO";
                      else if (classificacao === "EXTRA_100") classificacao = "HORA CRÉDITO";
                      else if (classificacao === "DEVEDOR") classificacao = "HORA DÉBITO";
                      else if (classificacao.includes("FALTA")) classificacao = "FALTA";

                      return (
                        <tr key={dia.data}>
                          <td className="whitespace-nowrap">{dia.data} - {dia.diaSemana}</td>
                          <td>{minutosParaHora(dia.trabalhadoMin)}</td>
                          <td style={{ color: dia.diferencaMin > 0 ? "#059669" : dia.diferencaMin < 0 ? "#dc2626" : "inherit" }}>
                            {minutosParaHora(dia.diferencaMin)}
                          </td>
                          <td>
                            <span className={
                              classificacao === "HORA CRÉDITO"
                                ? "badge badge-success"
                                : classificacao === "HORA DÉBITO" || classificacao === "FALTA"
                                ? "badge badge-danger"
                                : "badge"
                            }>
                              {classificacao}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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
