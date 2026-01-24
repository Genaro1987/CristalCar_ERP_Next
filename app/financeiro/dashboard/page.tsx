"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import React, { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";
import { ArrowDownCircle, ArrowUpCircle, Users, Wallet, AlertTriangle } from "lucide-react";

type ResumoCarteira = {
  empresa: string;
  saldo: number;
  entradas: number;
  saidas: number;
};

type Indicador = {
  titulo: string;
  valor: string;
  descricao: string;
};

type Alertas = {
  entradasPeriodo: number;
  saidasPeriodo: number;
  vencidos: number;
};

type RhDados = {
  funcionariosAtivos: number;
  departamentos: number;
};

export default function FinanceiroDashboardPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/dashboard";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_DASHBOARD";
  const nomeTela = tela?.NOME_TELA ?? "Dashboard Executivo";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [periodo, setPeriodo] = useState("");
  const [carteira, setCarteira] = useState<ResumoCarteira[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [alertas, setAlertas] = useState<Alertas>({
    entradasPeriodo: 0,
    saidasPeriodo: 0,
    vencidos: 0,
  });
  const [rhData, setRhData] = useState<RhDados>({ funcionariosAtivos: 0, departamentos: 0 });
  const [carregando, setCarregando] = useState(true);

  // Buscar dados do dashboard da API
  useEffect(() => {
    if (!empresa?.id) return;

    const buscarDashboard = async () => {
      try {
        setCarregando(true);
        let url = "/api/financeiro/dashboard";
        if (periodo) {
          url += `?periodo=${periodo}`;
        }

        const resposta = await fetch(url, {
          headers: {
            "x-empresa-id": String(empresa.id),
          },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            setCarteira(dados.data.carteira);
            setIndicadores(dados.data.indicadores);
            setAlertas(dados.data.alertas);
            if (dados.data.rh) {
              setRhData(dados.data.rh);
            }
          }
        }
      } catch (erro) {
        console.error("Erro ao buscar dados do dashboard:", erro);
      } finally {
        setCarregando(false);
      }
    };

    buscarDashboard();
  }, [empresa?.id, periodo]);

  const carteiraSelecionada = useMemo(
    () => carteira[0] || { empresa: "", saldo: 0, entradas: 0, saidas: 0 },
    [carteira]
  );
  const nomeEmpresa = empresa?.nomeFantasia || empresa?.cnpj || "Carregando...";
  const periodoLabel = periodo ? periodo.replace("-", "/") : "Mês Atual";

  const formatMoney = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <LayoutShell>
      <div className="page-container financeiro-page bg-gray-50/50">
        <HeaderBar
          nomeTela={nomeTela}
          codigoTela={codigoTela}
          caminhoRota={caminhoTela}
          modulo={moduloTela}
        />

        <main className="page-content-card space-y-6 !bg-transparent !p-0 !shadow-none">
          {/* Header Section */}
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Visão Geral</h2>
              <p className="text-sm text-gray-500">
                Acompanhe os principais indicadores de {nomeEmpresa}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <label htmlFor="dashboard-periodo" className="text-xs font-semibold uppercase text-gray-500">
                  Competência
                </label>
                <input
                  id="dashboard-periodo"
                  type="month"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="rounded-md border-gray-300 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>
            </div>
          </section>

          {/* KPI Grid */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white shadow-md transition hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Saldo em Caixa</p>
                  <h3 className="mt-2 text-2xl font-bold">{formatMoney(carteiraSelecionada.saldo)}</h3>
                </div>
                <div className="rounded-lg bg-white/10 p-2 text-white">
                  <Wallet size={24} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-300">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
                Atualizado agora
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Entradas</p>
                  <h3 className="mt-2 text-2xl font-bold text-emerald-600">
                    {formatMoney(carteiraSelecionada.entradas)}
                  </h3>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <ArrowUpCircle size={24} />
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-400">Receitas no período ({periodoLabel})</p>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Saídas</p>
                  <h3 className="mt-2 text-2xl font-bold text-red-600">
                    {formatMoney(carteiraSelecionada.saidas)}
                  </h3>
                </div>
                <div className="rounded-lg bg-red-50 p-2 text-red-600">
                  <ArrowDownCircle size={24} />
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-400">Despesas no período ({periodoLabel})</p>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Pessoal Ativo</p>
                  <h3 className="mt-2 text-2xl font-bold text-gray-900">{rhData.funcionariosAtivos}</h3>
                </div>
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <Users size={24} />
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-400">
                {rhData.departamentos} departamentos com colaboradores
              </p>
            </div>
          </section>

          {/* Main Content Grid */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column: Financial Indicators & Alerts */}
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Indicadores de Performance</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {carregando ? (
                    <p className="col-span-3 text-center text-sm text-gray-500">Calculando métricas...</p>
                  ) : (
                    indicadores.map((ind, idx) => (
                      <div key={idx} className="flex flex-col rounded-lg bg-gray-50 p-4 transition hover:bg-orange-50/50">
                        <span className="text-xs font-semibold text-gray-500">{ind.titulo}</span>
                        <span className="mt-1 text-xl font-bold text-gray-800">{ind.valor}</span>
                        <span className="mt-2 text-xs text-gray-400">{ind.descricao}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Movimentação por Empresa</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3 rounded-l-md">Empresa</th>
                        <th className="px-4 py-3 text-right">Entradas</th>
                        <th className="px-4 py-3 text-right">Saídas</th>
                        <th className="px-4 py-3 text-right rounded-r-md">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {carteira.map((c, i) => (
                        <tr key={i} className="group hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900 group-hover:text-orange-600">
                            {c.empresa}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600">
                            {formatMoney(c.entradas)}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600">
                            {formatMoney(c.saidas)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-800">
                            {formatMoney(c.entradas - c.saidas)}
                          </td>
                        </tr>
                      ))}
                      {carteira.length === 0 && !carregando && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-gray-500">
                            Nenhum movimento registrado no período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: Alerts & Quick Actions */}
            <div className="space-y-6">
              <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                   <AlertTriangle className="text-amber-500" size={20} />
                   <h3 className="text-lg font-bold text-gray-900">Atenção Necessária</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-3">
                    <div>
                      <p className="text-xs font-semibold text-red-600 uppercase">Contas Vencidas</p>
                      <p className="text-lg font-bold text-red-800">{formatMoney(alertas.vencidos)}</p>
                    </div>
                  </div>
                   <div className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50 p-3">
                    <div>
                      <p className="text-xs font-semibold text-orange-600 uppercase">Saídas Previstas</p>
                      <p className="text-lg font-bold text-orange-800">{formatMoney(alertas.saidasPeriodo)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-500 mb-3">Links Rápidos</p>
                  <div className="flex flex-col gap-2">
                     <button className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-orange-600 transition">
                        Nova Conta a Pagar
                     </button>
                     <button className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-orange-600 transition">
                        Lançamento Manual
                     </button>
                     <button className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-orange-600 transition">
                        Conciliação Bancária
                     </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-md">
                 <h3 className="text-lg font-bold">CristalCar Premium</h3>
                 <p className="mt-2 text-sm text-indigo-100">
                   Acesse relatórios avançados de DRE e Fluxo de Caixa para tomar decisões estratégicas.
                 </p>
                 <button className="mt-4 w-full rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur-sm hover:bg-white/30 transition">
                    Ver Relatórios
                 </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </LayoutShell>
  );
}
