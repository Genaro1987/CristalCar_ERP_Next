"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";

interface DreLinha {
  id: number;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "OUTROS";
  valor: number;
  filhos?: DreLinha[];
}

function calcularValorPositivo(linha: DreLinha): number {
  const valorAbsoluto = Math.abs(linha.valor);
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
                R$ {Math.abs(node.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-600">
                Impacto no resultado: {calcularValorPositivo(node) >= 0 ? "+" : "-"}
                {Math.abs(calcularValorPositivo(node)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();

  const [periodoInicial, setPeriodoInicial] = useState<string>("");
  const [periodoFinal, setPeriodoFinal] = useState<string>("");
  const [linhas, setLinhas] = useState<DreLinha[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!empresa?.id) return;

    const carregarDre = async () => {
      try {
        setCarregando(true);
        const params = new URLSearchParams();
        if (periodoInicial) params.set("dataInicio", periodoInicial);
        if (periodoFinal) params.set("dataFim", periodoFinal);

        const resposta = await fetch(`/api/financeiro/dre?${params.toString()}`, {
          headers: {
            "x-empresa-id": String(empresa.id),
          },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            setLinhas(dados.data ?? []);
          }
        }
      } catch (erro) {
        console.error("Erro ao buscar DRE:", erro);
      } finally {
        setCarregando(false);
      }
    };

    carregarDre();
  }, [empresa?.id, periodoInicial, periodoFinal]);

  const totalResultado = useMemo(() => {
    return linhas.reduce((acc, linha) => acc + calcularValorPositivo(linha), 0);
  }, [linhas]);

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          nomeTela="Relatório DRE"
          codigoTela="FIN_DRE"
          caminhoRota="/financeiro/dre"
          modulo="FINANCEIRO"
        />

        <main className="page-content-card space-y-4">
          <section className="panel">
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
          </section>

          <section className="panel">
            <h2 className="text-base font-bold text-gray-800">DRE por linha</h2>
            {carregando ? (
              <div className="py-6 text-sm text-gray-600">Carregando dados do DRE...</div>
            ) : linhas.length === 0 ? (
              <div className="py-6 text-sm text-gray-600">Nenhum dado disponível para o período selecionado.</div>
            ) : (
              <TreeValores nodes={linhas} />
            )}

            <div className="mt-4 rounded border border-gray-300 bg-white p-3 text-right shadow-sm">
              <p className="text-sm font-semibold text-gray-800">
                Resultado do período: R$ {Math.abs(totalResultado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-600">
                Impacto aplicado: {totalResultado >= 0 ? "+" : "-"}
              </p>
            </div>
          </section>
        </main>
      </div>
    </LayoutShell>
  );
}
