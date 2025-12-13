"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { useHelpContext } from "@/components/LayoutShell";
import { useMemo, useState } from "react";

interface PlanoContaNode {
  id: number;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA";
  ativo: boolean;
  visivelDre: boolean;
  obrigaCentroCusto: boolean;
  filhos?: PlanoContaNode[];
}

function TreeView({ nodes }: { nodes: PlanoContaNode[] }) {
  return (
    <ul className="ml-4 list-disc space-y-2">
      {nodes.map((node) => (
        <li key={node.id} className="space-y-1">
          <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-800">
                  {node.codigo} - {node.nome}
                </p>
                <p className="text-xs text-gray-600">
                  Natureza: {node.natureza} | Visível DRE: {node.visivelDre ? "Sim" : "Não"} |
                  Centro de custo obrigatório: {node.obrigaCentroCusto ? "Sim" : "Não"}
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

export default function PlanoContaPage() {
  const { abrirAjuda } = useHelpContext();
  const [filtroNatureza, setFiltroNatureza] = useState<string>("");
  const [filtroBusca, setFiltroBusca] = useState<string>("");
  const [mostrarSomenteAtivos, setMostrarSomenteAtivos] = useState(true);

  const dadosFicticios: PlanoContaNode[] = useMemo(
    () => [
      {
        id: 1,
        nome: "Receitas Operacionais",
        codigo: "3.0",
        natureza: "RECEITA",
        ativo: true,
        visivelDre: true,
        obrigaCentroCusto: false,
        filhos: [
          {
            id: 2,
            nome: "Vendas de Produtos",
            codigo: "3.1",
            natureza: "RECEITA",
            ativo: true,
            visivelDre: true,
            obrigaCentroCusto: false,
          },
          {
            id: 3,
            nome: "Serviços",
            codigo: "3.2",
            natureza: "RECEITA",
            ativo: true,
            visivelDre: true,
            obrigaCentroCusto: false,
          },
        ],
      },
      {
        id: 4,
        nome: "Despesas Operacionais",
        codigo: "4.0",
        natureza: "DESPESA",
        ativo: true,
        visivelDre: true,
        obrigaCentroCusto: true,
        filhos: [
          {
            id: 5,
            nome: "Marketing",
            codigo: "4.1",
            natureza: "DESPESA",
            ativo: true,
            visivelDre: true,
            obrigaCentroCusto: true,
          },
          {
            id: 6,
            nome: "Folha de Pagamento",
            codigo: "4.2",
            natureza: "DESPESA",
            ativo: true,
            visivelDre: true,
            obrigaCentroCusto: false,
          },
        ],
      },
    ],
    []
  );

  const dadosFiltrados = useMemo(() => {
    return dadosFicticios
      .filter((node) =>
        mostrarSomenteAtivos ? node.ativo : true
      )
      .filter((node) =>
        filtroNatureza ? node.natureza === filtroNatureza : true
      )
      .filter((node) =>
        filtroBusca
          ? `${node.codigo} ${node.nome}`.toLowerCase().includes(filtroBusca.toLowerCase())
          : true
      );
  }, [dadosFicticios, filtroNatureza, filtroBusca, mostrarSomenteAtivos]);

  return (
    <LayoutShell>
      <HeaderBar
        nomeTela="Plano de Contas"
        codigoTela="FIN001_PLANO_CONTA"
        onHelp={() => abrirAjuda("FIN001_PLANO_CONTA", "Plano de Contas")}
      />
      <NotificationBar
        type="info"
        message="Esta tela está em fase inicial. A API de cadastro e a visualização em árvore serão conectadas após as próximas entregas de backend."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 rounded border border-gray-200 bg-white p-4 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-sm font-semibold text-gray-700">
            Natureza
            <select
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              value={filtroNatureza}
              onChange={(e) => setFiltroNatureza(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="RECEITA">Receita</option>
              <option value="DESPESA">Despesa</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-gray-700">
            Buscar por nome ou código
            <input
              type="text"
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              placeholder="Ex: 4.1 Marketing"
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
          Para cada conta, valide se a obrigatoriedade de centro de custo está adequada. Ao salvar um lançamento de uma conta que exige centro de custo, o campo deve estar preenchido.
        </p>
      </div>

      <div className="rounded border border-gray-200 bg-gray-50 p-4 shadow-inner">
        <h2 className="text-base font-bold text-gray-800">Pré-visualização da hierarquia</h2>
        <p className="text-sm text-gray-600">
          A árvore abaixo utiliza dados fictícios apenas para ilustrar a ordenação, filtros e indicadores de visibilidade no DRE.
        </p>
        <TreeView nodes={dadosFiltrados} />
      </div>
    </LayoutShell>
  );
}
