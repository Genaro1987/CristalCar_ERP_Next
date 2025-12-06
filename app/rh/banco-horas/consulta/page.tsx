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

const meses = [
  { valor: "01", nome: "Janeiro" },
  { valor: "02", nome: "Fevereiro" },
  { valor: "03", nome: "Março" },
  { valor: "04", nome: "Abril" },
  { valor: "05", nome: "Maio" },
  { valor: "06", nome: "Junho" },
  { valor: "07", nome: "Julho" },
  { valor: "08", nome: "Agosto" },
  { valor: "09", nome: "Setembro" },
  { valor: "10", nome: "Outubro" },
  { valor: "11", nome: "Novembro" },
  { valor: "12", nome: "Dezembro" },
];

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

  const pesquisar = async () => {
    if (!idFuncionario) {
      setNotification({ type: "info", message: "Selecione um funcionário" });
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

    for (const funcId of opcoes.funcionariosSelecionados) {
      try {
        const resp = await fetch(
          `/api/rh/banco-horas/resumo?idFuncionario=${funcId}&ano=${ano}&mes=${mes}&politicaFaltas=COMPENSAR_COM_HORAS_EXTRAS&zerarBancoNoMes=true`,
          { headers: headersPadrao }
        );
        const json = await resp.json();
        if (json?.success) {
          dadosParaExportar.push({
            resumo: json.data,
            empresa: {
              nome: empresa?.nomeFantasia || "Empresa",
              cnpj: empresa?.cnpj,
            },
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
      dadosParaExportar.forEach((dados) => exportarPDF(dados));
    }

    if (opcoes.exportarExcel) {
      exportarExcel(dadosParaExportar);
    }

    setNotification({
      type: "success",
      message: `Exportação concluída com sucesso! ${dadosParaExportar.length} registro(s) exportado(s).`,
    });
  };

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="CONS001_RH_BANCO_HORAS"
          nomeTela="CONSULTA BANCO DE HORAS"
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
                    {meses.map((m) => (
                      <option key={m.valor} value={m.valor}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: "0 0 auto", display: "flex", gap: "8px" }}>
                  <button
                    onClick={pesquisar}
                    disabled={loading}
                    className="button button-primary"
                  >
                    {loading ? "Buscando..." : "Pesquisar"}
                  </button>
                  <button
                    onClick={() => setModalExportacaoAberto(true)}
                    className="button"
                    style={{
                      backgroundColor: "#059669",
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
