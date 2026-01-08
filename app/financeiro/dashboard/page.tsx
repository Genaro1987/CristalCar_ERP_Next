"use client";

import LayoutShell from "@/components/LayoutShell";
import React, { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { FinanceiroPageHeader } from "../_components/financeiro-layout";

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

export default function FinanceiroDashboardPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();

  const [periodo, setPeriodo] = useState("");
  const [carteira, setCarteira] = useState<ResumoCarteira[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
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

  return (
    <LayoutShell>
      <div className="space-y-4">
        <FinanceiroPageHeader
          titulo="Dashboard Financeiro"
          subtitulo="Financeiro | Consolidação de saldos"
          onNovo={() => undefined}
          codigoAjuda="FIN_DASHBOARD"
        />

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1 text-sm font-semibold text-gray-700">
              Empresa
              <div className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                {empresa?.nome || "Carregando..."}
              </div>
            </div>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Período
              <input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              />
            </label>
            <div className="flex items-end justify-end">
              <button
                type="button"
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                Exportar resumo
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-orange-50 to-gray-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Saldo consolidado</p>
            <h2 className="text-2xl font-bold text-gray-900">
              R$ {carteiraSelecionada.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </h2>
            <p className="text-sm text-gray-600">Período {periodo.replace("-", "/")}</p>
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
                <h3 className="text-lg font-bold text-gray-900">Contas a pagar e receber</h3>
              </div>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                Priorizado por vencimento
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                { titulo: "Receber hoje", valor: "R$ 28.300" },
                { titulo: "Pagar hoje", valor: "R$ 19.750" },
                { titulo: "Atrasados", valor: "R$ 6.200" },
              ].map((alerta) => (
                <div key={alerta.titulo} className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{alerta.titulo}</p>
                  <p className="text-base font-semibold text-gray-900">{alerta.valor}</p>
                  <p className="text-xs text-gray-600">Dados simulados com filtro por empresa ativa.</p>
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
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
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
        </div>
      </div>
    </LayoutShell>
  );
}
