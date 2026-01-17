"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import React, { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

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

export default function FinanceiroDashboardPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/dashboard";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_DASHBOARD";
  const nomeTela = tela?.NOME_TELA ?? "Dashboard Financeiro";
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
  const periodoLabel = periodo ? periodo.replace("-", "/") : "atual";

  return (
    <LayoutShell>
      <div className="page-container financeiro-page">
        <HeaderBar
          nomeTela={nomeTela}
          codigoTela={codigoTela}
          caminhoRota={caminhoTela}
          modulo={moduloTela}
        />

        <main className="page-content-card space-y-4">
          <section className="panel">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="form-group">
                <label htmlFor="dashboard-empresa">Empresa</label>
                <input
                  id="dashboard-empresa"
                  type="text"
                  value={nomeEmpresa}
                  readOnly
                  className="form-input bg-gray-50 text-gray-800"
                />
              </div>
              <div className="form-group">
                <label htmlFor="dashboard-periodo">Período</label>
                <input
                  id="dashboard-periodo"
                  type="month"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  className="button button-secondary"
                >
                  Exportar resumo
                </button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-orange-50 to-gray-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Saldo consolidado</p>
              <h2 className="text-2xl font-bold text-gray-900">
                R$ {carteiraSelecionada.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </h2>
              <p className="text-sm text-gray-600">Período {periodoLabel}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-700">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Entradas</p>
                  <p className="font-semibold text-green-700">
                    R$ {carteiraSelecionada.entradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Saídas</p>
                  <p className="font-semibold text-red-700">
                    R$ {carteiraSelecionada.saidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Alertas</p>
                  <h3 className="text-lg font-bold text-gray-900">Contas no período</h3>
                </div>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                  {periodo ? `Referência ${periodoLabel}` : "Referência mês atual"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { titulo: "Entradas", valor: alertas.entradasPeriodo },
                  { titulo: "Saídas", valor: alertas.saidasPeriodo },
                  { titulo: "Vencidos", valor: alertas.vencidos },
                ].map((alerta) => (
                  <div key={alerta.titulo} className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{alerta.titulo}</p>
                    <p className="text-base font-semibold text-gray-900">
                      R$ {alerta.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-600">Atualizado a partir dos lançamentos.</p>
                  </div>
                ))}
              </div>
            </div>

            {carregando ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-3">
                <p className="text-center text-sm text-gray-600">Carregando indicadores...</p>
              </div>
            ) : (
              indicadores.map((card) => (
                <div
                  key={card.titulo}
                  className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-orange-50 p-4 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Indicador</p>
                  <h2 className="text-lg font-bold text-gray-900">{card.titulo}</h2>
                  <p className="text-2xl font-extrabold text-orange-600">{card.valor}</p>
                  <p className="text-sm text-gray-600">{card.descricao}</p>
                </div>
              ))
            )}

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fluxo por empresa</p>
                  <h3 className="text-lg font-bold text-gray-900">Comparativo rápido</h3>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">Multiempresa</span>
              </div>
              <div className="financeiro-table-wrapper mt-3 overflow-x-auto">
                <table className="financeiro-table min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Empresa</th>
                      <th className="px-4 py-3 text-left">Saldo</th>
                      <th className="px-4 py-3 text-left">Entradas</th>
                      <th className="px-4 py-3 text-left">Saídas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {carregando ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-600">
                          Carregando dados...
                        </td>
                      </tr>
                    ) : carteira.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-600">
                          Nenhum dado disponível
                        </td>
                      </tr>
                    ) : (
                      carteira.map((item) => (
                        <tr key={item.empresa} className="hover:bg-orange-50/40">
                          <td className="px-4 py-3 font-semibold text-gray-900">{item.empresa}</td>
                          <td className="px-4 py-3 text-gray-800">
                            R$ {item.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-green-700">
                            R$ {item.entradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-red-700">
                            R$ {item.saidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
        </section>
        </main>
      </div>
    </LayoutShell>
  );
}
