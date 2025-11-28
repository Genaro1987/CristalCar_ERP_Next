"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { HeaderBar } from "@/components/HeaderBar";
import LayoutShell from "@/components/LayoutShell";
import { NotificationBar } from "@/components/NotificationBar";
import {
  competenciaAtual,
  minutosParaHora,
  parseHoraParaMinutos,
} from "@/lib/rhPontoCalculo";
import type { ResumoBancoHorasFuncionario } from "@/db/rhBancoHoras";

interface FuncionarioOption {
  ID_FUNCIONARIO: string;
  NOME_COMPLETO: string;
}

interface DepartamentoOption {
  ID_DEPARTAMENTO: number;
  NOME_DEPARTAMENTO: string;
}

function converterHorarioParaMinutos(texto?: string | null): number | null {
  if (!texto) return 0;

  const valor = texto.toString().trim();
  if (!valor) return 0;

  const sinal = valor.startsWith("-") ? -1 : 1;
  const limpo = valor.replace(/^-/, "");
  const minutos = parseHoraParaMinutos(limpo);

  if (minutos == null) return null;

  return minutos * sinal;
}

export default function BancoHorasPage() {
  useRequerEmpresaSelecionada({ ativo: true });

  const { empresa, carregando } = useEmpresaSelecionada();
  const empresaId = empresa?.id ?? null;

  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [funcionarioFiltro, setFuncionarioFiltro] = useState("");
  const [departamentoFiltro, setDepartamentoFiltro] = useState("");
  const [resumo, setResumo] = useState<ResumoBancoHorasFuncionario[]>([]);
  const [ajustesTela, setAjustesTela] = useState<Record<string, { pagar: string; descontar: string }>>({});
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoOption[]>([]);

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = {};

    if (empresaId) {
      headers["x-empresa-id"] = String(empresaId);
    }

    return headers;
  }, [empresaId]);

  const carregarFuncionarios = useCallback(async () => {
    if (!empresaId) return;

    try {
      const resposta = await fetch(`/api/rh/funcionarios?apenasAtivos=true`, {
        headers: headersPadrao,
      });
      const json = await resposta.json();

      if (json?.success) {
        setFuncionarios(json.data ?? []);
      }
    } catch (error) {
      console.error(error);
    }
  }, [empresaId, headersPadrao]);

  const carregarDepartamentos = useCallback(async () => {
    if (!empresaId) return;

    try {
      const resposta = await fetch(`/api/departamentos`, { headers: headersPadrao });
      const json = await resposta.json();

      if (json?.success) {
        setDepartamentos(json.data ?? []);
      }
    } catch (error) {
      console.error(error);
    }
  }, [empresaId, headersPadrao]);

  const prepararAjustesPadrao = (dados: ResumoBancoHorasFuncionario[]) => {
    const ajustes: Record<string, { pagar: string; descontar: string }> = {};

    dados.forEach((item) => {
      const saldo = item.SALDO_ATUAL_MIN;
      const pagar = saldo > 0 ? minutosParaHora(saldo) : "00:00";
      const descontar = saldo < 0 ? minutosParaHora(Math.abs(saldo)) : "00:00";

      ajustes[item.ID_FUNCIONARIO] = { pagar, descontar };
    });

    setAjustesTela(ajustes);
  };

  const carregarResumo = async () => {
    setErro(null);
    setNotification(null);

    if (!empresaId) {
      setErro("Selecione uma empresa para continuar.");
      return;
    }

    if (!competencia) {
      setErro("Informe a competência.");
      return;
    }

    setCarregandoResumo(true);

    try {
      const params = new URLSearchParams({ competencia });

      if (funcionarioFiltro) params.set("funcionario", funcionarioFiltro);
      if (departamentoFiltro) params.set("departamento", departamentoFiltro);

      const resposta = await fetch(`/api/rh/banco-horas?${params.toString()}`, {
        headers: headersPadrao,
      });
      const json = await resposta.json();

      if (resposta.ok && json?.success) {
        setResumo(json.data ?? []);
        prepararAjustesPadrao(json.data ?? []);
      } else {
        setErro("Não foi possível carregar o banco de horas.");
      }
    } catch (error) {
      console.error(error);
      setErro("Erro ao carregar o banco de horas.");
    } finally {
      setCarregandoResumo(false);
    }
  };

  useEffect(() => {
    if (carregando) return;
    carregarFuncionarios();
    carregarDepartamentos();
  }, [carregando, carregarFuncionarios, carregarDepartamentos]);

  useEffect(() => {
    if (empresaId) {
      carregarResumo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const atualizarAjuste = (idFuncionario: string, campo: "pagar" | "descontar", valor: string) => {
    setAjustesTela((atual) => ({
      ...atual,
      [idFuncionario]: {
        pagar: campo === "pagar" ? valor : atual[idFuncionario]?.pagar ?? "00:00",
        descontar:
          campo === "descontar" ? valor : atual[idFuncionario]?.descontar ?? "00:00",
      },
    }));
  };

  const gerarAjustes = async () => {
    setNotification(null);
    setErro(null);
    let ajustesPayload: {
      idFuncionario: string;
      HORAS_A_PAGAR_MIN: number;
      HORAS_A_DESCONTAR_MIN: number;
      HORAS_A_CARREGAR_MIN: number;
    }[] = [];

    try {
      ajustesPayload = resumo.map((item) => {
        const pagarTexto = ajustesTela[item.ID_FUNCIONARIO]?.pagar ?? "00:00";
        const descontarTexto = ajustesTela[item.ID_FUNCIONARIO]?.descontar ?? "00:00";

        const minutosPagar = converterHorarioParaMinutos(pagarTexto);
        const minutosDescontar = converterHorarioParaMinutos(descontarTexto);

        if (minutosPagar == null || minutosDescontar == null) {
          throw new Error("HORARIO_INVALIDO");
        }

        const saldoCarregar =
          item.SALDO_ATUAL_MIN - Math.max(0, minutosPagar) - Math.max(0, minutosDescontar);

        return {
          idFuncionario: item.ID_FUNCIONARIO,
          HORAS_A_PAGAR_MIN: Math.max(0, minutosPagar),
          HORAS_A_DESCONTAR_MIN: Math.max(0, minutosDescontar),
          HORAS_A_CARREGAR_MIN: saldoCarregar,
        };
      });
    } catch (error) {
      setErro("Informe horários válidos no formato HH:MM.");
      return;
    }

    const ajustesValidos = ajustesPayload.filter(
      (ajuste) =>
        ajuste.HORAS_A_PAGAR_MIN > 0 ||
        ajuste.HORAS_A_DESCONTAR_MIN > 0 ||
        ajuste.HORAS_A_CARREGAR_MIN !== 0
    );

    if (!ajustesValidos.length) {
      setErro("Nenhum ajuste informado para gerar.");
      return;
    }

    setGerando(true);

    try {
      const resposta = await fetch(`/api/rh/banco-horas/fechamento`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headersPadrao,
        },
        body: JSON.stringify({
          competencia,
          ajustes: ajustesValidos,
        }),
      });

      const json = await resposta.json();

      if (resposta.ok && json?.success) {
        setNotification({ type: "success", message: "Ajustes gerados com sucesso." });
        carregarResumo();
      } else if (json?.error === "HORARIO_INVALIDO") {
        setErro("Informe horários válidos no formato HH:MM.");
      } else if (json?.error === "SEM_AJUSTES") {
        setErro("Nenhum ajuste foi informado.");
      } else {
        setErro("Não foi possível gerar os ajustes.");
      }
    } catch (error) {
      console.error(error);
      setErro("Erro ao gerar ajustes.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="BAN001_RH_BANCO_HORAS"
          nomeTela="BANCO DE HORAS"
          caminhoRota="/rh/banco-horas"
          modulo="RH"
        />

        <main className="page-content-card">
          {notification && <NotificationBar type={notification.type} message={notification.message} />}

          <section className="panel">
            <header className="form-section-header">
              <h2>BANCO DE HORAS</h2>
              <p>Consolide os saldos mensais e gere os ajustes de fechamento.</p>
            </header>

            {erro && <p className="error-text">{erro}</p>}

            <div className="form-grid three-columns">
              <div className="form-group">
                <label htmlFor="competencia">COMPETENCIA</label>
                <input
                  id="competencia"
                  type="month"
                  className="form-input"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="funcionarioFiltro">FUNCIONARIO</label>
                <select
                  id="funcionarioFiltro"
                  className="form-input"
                  value={funcionarioFiltro}
                  onChange={(e) => setFuncionarioFiltro(e.target.value)}
                >
                  <option value="">Todos</option>
                  {funcionarios.map((f) => (
                    <option key={f.ID_FUNCIONARIO} value={f.ID_FUNCIONARIO}>
                      {f.ID_FUNCIONARIO} - {f.NOME_COMPLETO}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="departamentoFiltro">DEPARTAMENTO</label>
                <select
                  id="departamentoFiltro"
                  className="form-input"
                  value={departamentoFiltro}
                  onChange={(e) => setDepartamentoFiltro(e.target.value)}
                >
                  <option value="">Todos</option>
                  {departamentos.map((d) => (
                    <option key={d.ID_DEPARTAMENTO} value={d.ID_DEPARTAMENTO}>
                      {d.NOME_DEPARTAMENTO}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="button-row" style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={carregarResumo}
                disabled={carregandoResumo}
              >
                {carregandoResumo ? "Carregando..." : "Atualizar"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="tabela-padrao w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left">FUNCIONARIO</th>
                    <th className="px-4 py-2 text-center">SALDO ANTERIOR</th>
                    <th className="px-4 py-2 text-center">CREDITOS MES</th>
                    <th className="px-4 py-2 text-center">DEBITOS MES</th>
                    <th className="px-4 py-2 text-center">AJUSTES MANUAIS</th>
                    <th className="px-4 py-2 text-center">AJUSTES FECHAMENTO</th>
                    <th className="px-4 py-2 text-center">HORAS FDS/FERIADO</th>
                    <th className="px-4 py-2 text-center">SALDO ATUAL</th>
                    <th className="px-4 py-2 text-center">H. A PAGAR</th>
                    <th className="px-4 py-2 text-center">H. A DESCONTAR</th>
                    <th className="px-4 py-2 text-center">SALDO A CARREGAR</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-3 text-center text-sm text-gray-500">
                        Nenhum registro encontrado para a competência selecionada.
                      </td>
                    </tr>
                  )}

                  {resumo.map((item) => {
                    const pagarTexto = ajustesTela[item.ID_FUNCIONARIO]?.pagar ?? "00:00";
                    const descontarTexto = ajustesTela[item.ID_FUNCIONARIO]?.descontar ?? "00:00";
                    const pagarMin = converterHorarioParaMinutos(pagarTexto) ?? 0;
                    const descontarMin = converterHorarioParaMinutos(descontarTexto) ?? 0;
                    const saldoCarregar =
                      item.SALDO_ATUAL_MIN - Math.max(0, pagarMin) - Math.max(0, descontarMin);

                    return (
                      <tr key={item.ID_FUNCIONARIO}>
                        <td className="px-4 py-2 text-left">
                          <div className="font-semibold">{item.ID_FUNCIONARIO}</div>
                          <div className="text-sm text-gray-700">{item.NOME_FUNCIONARIO}</div>
                        </td>
                        <td className="px-4 py-2 text-center">{minutosParaHora(item.SALDO_ANTERIOR_MIN)}</td>
                        <td className="px-4 py-2 text-center">{minutosParaHora(item.CREDITOS_MES_MIN)}</td>
                        <td className="px-4 py-2 text-center">{minutosParaHora(item.DEBITOS_MES_MIN)}</td>
                        <td className="px-4 py-2 text-center">{minutosParaHora(item.AJUSTES_MANUAIS_MIN)}</td>
                        <td className="px-4 py-2 text-center">{minutosParaHora(item.AJUSTES_FECHAMENTO_MIN)}</td>
                        <td className="px-4 py-2 text-center">{minutosParaHora(item.HORAS_PAGAS_FDS_FERIADO_MIN)}</td>
                        <td className="px-4 py-2 text-center font-semibold">{minutosParaHora(item.SALDO_ATUAL_MIN)}</td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="text"
                            className="form-input text-center"
                            value={pagarTexto}
                            onChange={(e) => atualizarAjuste(item.ID_FUNCIONARIO, "pagar", e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="text"
                            className="form-input text-center"
                            value={descontarTexto}
                            onChange={(e) =>
                              atualizarAjuste(item.ID_FUNCIONARIO, "descontar", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-center font-semibold">
                          {minutosParaHora(saldoCarregar)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="form-actions" style={{ marginTop: "1rem" }}>
              <div className="button-row">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={gerarAjustes}
                  disabled={gerando || !resumo.length}
                >
                  {gerando ? "Gerando..." : "Gerar ajustes"}
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={carregarResumo}
                  disabled={carregandoResumo}
                >
                  Atualizar
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </LayoutShell>
  );
}
