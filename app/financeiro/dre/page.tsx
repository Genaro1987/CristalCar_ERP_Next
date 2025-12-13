"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { useMemo, useState } from "react";

interface DreLinha {
  id: number;
  nome: string;
  natureza: "RECEITA" | "DESPESA" | "CALCULADO";
  valorCalculado: number;
  filhos?: DreLinha[];
}

function calcularValorPositivo(linha: DreLinha): number {
  const valorAbsoluto = Math.abs(linha.valorCalculado);
  if (linha.natureza === "RECEITA") return valorAbsoluto;
  if (linha.natureza === "DESPESA") return -valorAbsoluto;
  return valorAbsoluto;
}

function TreeValores({ nodes }: { nodes: DreLinha[] }) {
  return (
    <ul className="ml-4 space-y-2">
      {nodes.map((node) => (
        <li key={node.id} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">{node.nome}</p>
              <p className="text-xs text-gray-600">Natureza: {node.natureza}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">
                R$ {Math.abs(node.valorCalculado).toFixed(2)}
              </p>
              <p className="text-xs text-gray-600">
                Impacto no resultado: {calcularValorPositivo(node) >= 0 ? "+" : "-"}
                {Math.abs(calcularValorPositivo(node)).toFixed(2)}
              </p>
            </div>
          </div>
          {node.filhos && node.filhos.length > 0 && <TreeValores nodes={node.filhos} />}
        </li>
      ))}
    </ul>
  );
}

export default function DrePage() {
  const [periodoInicial, setPeriodoInicial] = useState<string>("");
  const [periodoFinal, setPeriodoFinal] = useState<string>("");

  const estruturaExemplo: DreLinha[] = useMemo(
    () => [
      {
        id: 1,
        nome: "Receita Líquida",
        natureza: "RECEITA",
        valorCalculado: 150000,
      },
      {
        id: 2,
        nome: "Despesas Operacionais",
        natureza: "DESPESA",
        valorCalculado: -80000,
        filhos: [
          {
            id: 3,
            nome: "Marketing",
            natureza: "DESPESA",
            valorCalculado: -20000,
          },
          {
            id: 4,
            nome: "Pessoal",
            natureza: "DESPESA",
            valorCalculado: -60000,
          },
        ],
      },
      {
        id: 5,
        nome: "Resultado Operacional",
        natureza: "CALCULADO",
        valorCalculado: 70000,
      },
    ],
    []
  );

  const totalResultado = useMemo(() => {
    return estruturaExemplo.reduce((acc, linha) => acc + calcularValorPositivo(linha), 0);
  }, [estruturaExemplo]);

  return (
    <LayoutShell>
      <HeaderBar
        nomeTela="Relatório DRE"
        codigoTela="FIN_DRE"
        caminhoRota="/financeiro/dre"
        modulo="FINANCEIRO"
      />
      <NotificationBar
        type="info"
        message="Em construção / MVP: cálculos ainda usam dados fictícios. As consultas serão filtradas por ID_EMPRESA e alinhadas aos lançamentos válidos."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 rounded border border-gray-200 bg-white p-4 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-sm font-semibold text-gray-700">
            Período inicial
            <input
              type="date"
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              value={periodoInicial}
              onChange={(e) => setPeriodoInicial(e.target.value)}
            />
          </label>

          <label className="text-sm font-semibold text-gray-700">
            Período final
            <input
              type="date"
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              value={periodoFinal}
              onChange={(e) => setPeriodoFinal(e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-gray-600">
          Valores são exibidos como absolutos, mas receitas somam e despesas diminuem o resultado. Contas que exigem centro de custo devem ser lançadas com FIN_CENTRO_CUSTO_ID preenchido.
        </p>
      </div>

      <div className="rounded border border-gray-200 bg-gray-50 p-4 shadow-inner">
        <h2 className="text-base font-bold text-gray-800">DRE por linha</h2>
        <TreeValores nodes={estruturaExemplo} />

        <div className="mt-4 rounded border border-gray-300 bg-white p-3 text-right shadow-sm">
          <p className="text-sm font-semibold text-gray-800">
            Resultado do período: R$ {Math.abs(totalResultado).toFixed(2)}
          </p>
          <p className="text-xs text-gray-600">
            Impacto aplicado: {totalResultado >= 0 ? "+" : "-"}
          </p>
        </div>
      </div>
    </LayoutShell>
  );
}
