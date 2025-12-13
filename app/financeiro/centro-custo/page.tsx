"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { useMemo, useState } from "react";

interface CentroCustoNode {
  id: number;
  nome: string;
  codigo: string;
  ativo: boolean;
  filhos?: CentroCustoNode[];
}

function TreeView({ nodes }: { nodes: CentroCustoNode[] }) {
  return (
    <ul className="ml-4 list-disc space-y-2">
      {nodes.map((node) => (
        <li key={node.id} className="space-y-1">
          <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {node.codigo} - {node.nome}
                </p>
                <p className="text-xs text-gray-600">
                  Hierarquia pronta para uso em filtros e lançamentos.
                </p>
              </div>
              <span
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  node.ativo ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                }`}
              >
                {node.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
          </div>
          {node.filhos && node.filhos.length > 0 && <TreeView nodes={node.filhos} />}
        </li>
      ))}
    </ul>
  );
}

export default function CentroCustoPage() {
  const [filtroBusca, setFiltroBusca] = useState<string>("");
  const [mostrarSomenteAtivos, setMostrarSomenteAtivos] = useState(true);

  const dadosFicticios: CentroCustoNode[] = useMemo(
    () => [
      {
        id: 1,
        nome: "Administrativo",
        codigo: "01",
        ativo: true,
        filhos: [
          { id: 2, nome: "Financeiro", codigo: "01.01", ativo: true },
          { id: 3, nome: "Pessoas", codigo: "01.02", ativo: true },
        ],
      },
      {
        id: 4,
        nome: "Operações",
        codigo: "02",
        ativo: true,
        filhos: [
          { id: 5, nome: "Serviços", codigo: "02.01", ativo: true },
          { id: 6, nome: "Vendas", codigo: "02.02", ativo: false },
        ],
      },
    ],
    []
  );

  const dadosFiltrados = useMemo(() => {
    const filtroNormalizado = filtroBusca.toLowerCase();

    const filtrar = (nos: CentroCustoNode[]): CentroCustoNode[] =>
      nos
        .filter((node) => (mostrarSomenteAtivos ? node.ativo : true))
        .filter((node) =>
          filtroNormalizado
            ? `${node.codigo} ${node.nome}`.toLowerCase().includes(filtroNormalizado)
            : true
        )
        .map((node) => ({
          ...node,
          filhos: node.filhos ? filtrar(node.filhos) : [],
        }));

    return filtrar(dadosFicticios);
  }, [dadosFicticios, filtroBusca, mostrarSomenteAtivos]);

  return (
    <LayoutShell>
      <HeaderBar
        nomeTela="Centro de Custo"
        codigoTela="FIN002_CENTRO_CUSTO"
      />
      <NotificationBar
        type="info"
        message="Cadastros e filtros serão ligados ao backend após a criação das APIs financeiras."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 rounded border border-gray-200 bg-white p-4 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-gray-700">
            Buscar por nome ou código
            <input
              type="text"
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              placeholder="Ex: 02.01 Serviços"
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={mostrarSomenteAtivos}
              onChange={(e) => setMostrarSomenteAtivos(e.target.checked)}
            />
            Mostrar apenas ativos
          </label>
        </div>
        <p className="text-xs text-gray-600">
          Os lançamentos de contas que exigirem centro de custo devem preencher este campo. Utilize a hierarquia para separar áreas, projetos ou unidades.
        </p>
      </div>

      <div className="rounded border border-gray-200 bg-gray-50 p-4 shadow-inner">
        <h2 className="text-base font-bold text-gray-800">Pré-visualização da hierarquia</h2>
        <TreeView nodes={dadosFiltrados} />
      </div>
    </LayoutShell>
  );
}
