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

export default function BancoHorasConsultaPage() {
  useRequerEmpresaSelecionada({ ativo: true });
  const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);
  const [resumo, setResumo] = useState<ResumoBancoHorasMes | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const compAtual = useMemo(() => competenciaAtual(), []);
  const [idFuncionario, setIdFuncionario] = useState("");
  const [ano, setAno] = useState(compAtual.ano);
  const [mes, setMes] = useState(compAtual.mes.toString().padStart(2, "0"));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/rh/funcionarios")
      .then((r) => r.json())
      .then((json) => setFuncionarios(json?.data ?? []))
      .catch(() => setFuncionarios([]));
  }, []);

  const pesquisar = async () => {
    if (!idFuncionario) {
      setNotification("Selecione um funcionário");
      return;
    }
    setNotification(null);
    setLoading(true);
    try {
      const resp = await fetch(
        `/api/rh/banco-horas/resumo?idFuncionario=${idFuncionario}&ano=${ano}&mes=${mes}&politicaFaltas=COMPENSAR_COM_HORAS_EXTRAS&zerarBancoNoMes=true`
      );
      const json = await resp.json();
      if (json?.success) {
        setResumo(json.data);
      } else {
        setNotification("Não foi possível carregar o resumo");
      }
    } catch (error) {
      console.error(error);
      setNotification("Erro ao consultar banco de horas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutShell>
      <HeaderBar title="CONS001_RH_BANCO_HORAS" />
      <div className="p-4 space-y-4">
        {notification && <NotificationBar type="warning" message={notification} />}
        <div className="bg-white shadow rounded p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <label className="flex flex-col">
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
          <label className="flex flex-col">
            Ano
            <input
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="border rounded px-2 py-1"
            />
          </label>
          <label className="flex flex-col">
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
          <div className="flex items-end">
            <button
              onClick={pesquisar}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              {loading ? "Buscando..." : "Pesquisar"}
            </button>
          </div>
        </div>

        {resumo && (
          <div className="bg-white shadow rounded p-4 text-sm space-y-2">
            <div className="font-semibold">{resumo.funcionario.nome}</div>
            <div className="text-gray-600">Competência: {String(resumo.competencia.mes).padStart(2, "0")}/{resumo.competencia.ano}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <div>HE 50%</div>
                <div className="font-semibold">{minutosParaHora(resumo.horasPagar50Min)}</div>
              </div>
              <div>
                <div>HE 100%</div>
                <div className="font-semibold">{minutosParaHora(resumo.horasPagar100Min)}</div>
              </div>
              <div>
                <div>Horas devidas</div>
                <div className="font-semibold">{minutosParaHora(resumo.horasDescontarMin)}</div>
              </div>
              <div>
                <div>Saldo final banco</div>
                <div className="font-semibold">{minutosParaHora(resumo.saldoFinalBancoMin)}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs mt-2">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-2">Dia</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Jornada</th>
                    <th className="p-2">Trabalhado</th>
                    <th className="p-2">Diferença</th>
                    <th className="p-2">Classificação</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
