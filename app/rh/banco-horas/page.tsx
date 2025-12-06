"use client";

import { useEffect, useMemo, useState } from "react";

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

const meses = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

function competenciaAtual() {
  const hoje = new Date();
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
}

export default function BancoHorasPage() {
  useRequerEmpresaSelecionada({ ativo: true });
  const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);
  const [resumo, setResumo] = useState<ResumoBancoHorasMes | null>(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const compAtual = useMemo(() => competenciaAtual(), []);
  const [idFuncionario, setIdFuncionario] = useState("");
  const [ano, setAno] = useState(compAtual.ano);
  const [mes, setMes] = useState(compAtual.mes.toString().padStart(2, "0"));
  const [politica, setPolitica] = useState<"COMPENSAR_COM_HORAS_EXTRAS" | "DESCONTAR_EM_FOLHA">(
    "COMPENSAR_COM_HORAS_EXTRAS"
  );
  const [zerarBanco, setZerarBanco] = useState(true);
  const [ajusteMinutos, setAjusteMinutos] = useState(0);
  const [ajusteData, setAjusteData] = useState("");
  const [ajusteTipo, setAjusteTipo] = useState<"CREDITO" | "DEBITO">("CREDITO");
  const [ajusteObs, setAjusteObs] = useState("");

  useEffect(() => {
    fetch("/api/rh/funcionarios")
      .then((r) => r.json())
      .then((json) => setFuncionarios(json?.data ?? []))
      .catch(() => setFuncionarios([]));
  }, []);

  const carregarResumo = async () => {
    if (!idFuncionario) {
      setNotification("Selecione um funcionário");
      return;
    }
    setLoading(true);
    setNotification(null);
    try {
      const resp = await fetch(
        `/api/rh/banco-horas/resumo?idFuncionario=${idFuncionario}&ano=${ano}&mes=${mes}&politicaFaltas=${politica}&zerarBancoNoMes=${zerarBanco}`
      );
      const json = await resp.json();
      if (json?.success) {
        setResumo(json.data);
      } else {
        setNotification("Não foi possível calcular o banco de horas.");
      }
    } catch (error) {
      console.error(error);
      setNotification("Erro ao consultar banco de horas");
    } finally {
      setLoading(false);
    }
  };

  const incluirAjuste = async () => {
    if (!idFuncionario || !ajusteData) {
      setNotification("Informe funcionário e data para o ajuste");
      return;
    }

    const minutos = ajusteTipo === "CREDITO" ? Math.abs(ajusteMinutos) : -Math.abs(ajusteMinutos);

    try {
      setLoading(true);
      const resp = await fetch("/api/rh/banco-horas/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idFuncionario,
          data: ajusteData,
          tipo: "AJUSTE_MANUAL",
          minutos,
          observacao: ajusteObs,
        }),
      });
      const json = await resp.json();
      if (!json?.success) {
        setNotification("Não foi possível incluir o ajuste.");
      }
      await carregarResumo();
    } catch (error) {
      console.error(error);
      setNotification("Erro ao incluir ajuste");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutShell>
      <HeaderBar title="REL001_RH_BANCO_HORAS" />
      <div className="p-4 space-y-4">
        {notification && <NotificationBar type="warning" message={notification} />}
        <div className="bg-white shadow rounded p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="flex flex-col text-sm">
              Funcionário
              <select
                value={idFuncionario}
                onChange={(e) => setIdFuncionario(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="">Selecione</option>
                {funcionarios.map((f) => (
                  <option key={f.ID_FUNCIONARIO} value={f.ID_FUNCIONARIO}>
                    {f.NOME_COMPLETO}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              Ano
              <input
                type="number"
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm">
              Mês
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="border rounded px-2 py-1"
              >
                {meses.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col text-sm">
              Política de faltas
              <div className="flex gap-2">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={politica === "COMPENSAR_COM_HORAS_EXTRAS"}
                    onChange={() => setPolitica("COMPENSAR_COM_HORAS_EXTRAS")}
                  />
                  Compensar
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={politica === "DESCONTAR_EM_FOLHA"}
                    onChange={() => setPolitica("DESCONTAR_EM_FOLHA")}
                  />
                  Descontar
                </label>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={zerarBanco}
                onChange={(e) => setZerarBanco(e.target.checked)}
              />
              Zerar banco ao final do mês
            </label>
          </div>
          <div className="flex gap-3">
            <button
              onClick={carregarResumo}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              {loading ? "Calculando..." : "Calcular"}
            </button>
          </div>
        </div>

        {resumo && (
          <div className="space-y-4">
            <div className="bg-white shadow rounded p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="font-semibold">Dados do funcionário</div>
                <div>{resumo.funcionario.nome}</div>
                <div className="text-gray-600">{resumo.funcionario.nomeDepartamento ?? "-"}</div>
              </div>
              <div>
                <div>Salário base</div>
                <div className="font-semibold">
                  {resumo.funcionario.salarioBase.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </div>
                <div>Carga mensal: {resumo.funcionario.cargaHorariaMensalHoras}h</div>
              </div>
              <div>
                <div>Valor hora</div>
                <div className="font-semibold">
                  {resumo.funcionario.valorHora.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-gray-600">Saldo anterior</div>
                <div className="font-semibold">{minutosParaHora(resumo.saldoAnteriorMin)}</div>
              </div>
              <div>
                <div className="text-gray-600">Extras úteis</div>
                <div className="font-semibold">{minutosParaHora(resumo.extrasUteisMin)}</div>
              </div>
              <div>
                <div className="text-gray-600">Extras 100%</div>
                <div className="font-semibold">{minutosParaHora(resumo.extras100Min)}</div>
              </div>
              <div>
                <div className="text-gray-600">Horas devidas</div>
                <div className="font-semibold text-red-600">{minutosParaHora(resumo.devidasMin)}</div>
              </div>
              <div>
                <div className="text-gray-600">Ajustes manuais</div>
                <div className="font-semibold">{minutosParaHora(resumo.ajustesManuaisMin)}</div>
              </div>
              <div>
                <div className="text-gray-600">Fechamentos</div>
                <div className="font-semibold">{minutosParaHora(resumo.fechamentosMin)}</div>
              </div>
              <div>
                <div className="text-gray-600">Saldo técnico</div>
                <div className="font-semibold">{minutosParaHora(resumo.saldoTecnicoMin)}</div>
              </div>
              <div>
                <div className="text-gray-600">Saldo final</div>
                <div className="font-semibold">{minutosParaHora(resumo.saldoFinalBancoMin)}</div>
              </div>
            </div>

            <div className="bg-white shadow rounded p-4 text-sm">
              <div className="font-semibold mb-2">Dias da competência</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="p-2">Dia</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Jornada</th>
                      <th className="p-2">Trabalhado</th>
                      <th className="p-2">Diferença</th>
                      <th className="p-2">Classificação</th>
                      <th className="p-2">Impacto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.dias.map((dia) => (
                      <tr key={dia.data} className="border-b">
                        <td className="p-2 whitespace-nowrap">{dia.data} - {dia.diaSemana}</td>
                        <td className="p-2">{dia.tipoDia}</td>
                        <td className="p-2">{minutosParaHora(dia.jornadaPrevistaMin)}</td>
                        <td className="p-2">{minutosParaHora(dia.trabalhadoMin)}</td>
                        <td className="p-2">{minutosParaHora(dia.diferencaMin)}</td>
                        <td className="p-2">{dia.classificacao}</td>
                        <td className="p-2">{minutosParaHora(dia.impactoBancoMin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white shadow rounded p-4 text-sm">
              <div className="font-semibold mb-2">Movimentos</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="p-2">Data</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Minutos</th>
                      <th className="p-2">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.movimentos.map((mov) => (
                      <tr key={mov.id} className="border-b">
                        <td className="p-2">{mov.data}</td>
                        <td className="p-2">{mov.tipo}</td>
                        <td className="p-2">{minutosParaHora(mov.minutos)}</td>
                        <td className="p-2">{mov.observacao ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white shadow rounded p-4 text-sm space-y-3">
              <div className="font-semibold">Ajuste manual</div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <label className="flex flex-col">
                  Data
                  <input
                    type="date"
                    value={ajusteData}
                    onChange={(e) => setAjusteData(e.target.value)}
                    className="border rounded px-2 py-1"
                  />
                </label>
                <label className="flex flex-col">
                  Tipo
                  <select
                    value={ajusteTipo}
                    onChange={(e) => setAjusteTipo(e.target.value as "CREDITO" | "DEBITO")}
                    className="border rounded px-2 py-1"
                  >
                    <option value="CREDITO">Crédito</option>
                    <option value="DEBITO">Débito</option>
                  </select>
                </label>
                <label className="flex flex-col">
                  Minutos
                  <input
                    type="number"
                    value={ajusteMinutos}
                    onChange={(e) => setAjusteMinutos(Number(e.target.value))}
                    className="border rounded px-2 py-1"
                  />
                </label>
                <label className="flex flex-col col-span-2">
                  Observação
                  <input
                    type="text"
                    value={ajusteObs}
                    onChange={(e) => setAjusteObs(e.target.value)}
                    className="border rounded px-2 py-1"
                  />
                </label>
                <button
                  onClick={incluirAjuste}
                  className="bg-green-600 text-white px-4 py-2 rounded"
                  disabled={loading}
                >
                  Incluir ajuste manual
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
