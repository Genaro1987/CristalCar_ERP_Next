"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { useMemo, useState } from "react";

type Natureza = "RECEITA" | "DESPESA" | "CALCULADO";
type TipoGasto = "FIXO" | "VARIAVEL" | "NAO_APLICA";

interface EstruturaDreNode {
  id: number;
  nome: string;
  ordem: number;
  natureza: Natureza;
  tipoGasto: TipoGasto;
  ativo: boolean;
  contasVinculadas?: string[];
  filhos?: EstruturaDreNode[];
}

function validarTipoGasto(natureza: Natureza, tipo: TipoGasto): boolean {
  if (natureza === "DESPESA") return tipo === "FIXO" || tipo === "VARIAVEL";
  return tipo === "NAO_APLICA";
}

function TreeView({ nodes }: { nodes: EstruturaDreNode[] }) {
  return (
    <ul className="ml-4 list-disc space-y-2">
      {nodes.map((node) => (
        <li key={node.id} className="space-y-1">
          <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-800">
                  ({node.ordem}) {node.nome}
                </p>
                <p className="text-xs text-gray-600">
                  Natureza: {node.natureza} | Tipo de gasto: {node.tipoGasto}
                </p>
                {node.contasVinculadas && node.contasVinculadas.length > 0 && (
                  <p className="text-xs text-gray-600">
                    Contas vinculadas: {node.contasVinculadas.join(", ")}
                  </p>
                )}
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

export default function EstruturaDrePage() {
  const [filtroNatureza, setFiltroNatureza] = useState<string>("");
  const [mensagemValidacao, setMensagemValidacao] = useState<string | null>(null);

  const dadosFicticios: EstruturaDreNode[] = useMemo(
    () => [
      {
        id: 1,
        nome: "Receita Líquida",
        ordem: 1,
        natureza: "RECEITA",
        tipoGasto: "NAO_APLICA",
        ativo: true,
        contasVinculadas: ["3.1", "3.2"],
      },
      {
        id: 2,
        nome: "Despesas Operacionais",
        ordem: 2,
        natureza: "DESPESA",
        tipoGasto: "FIXO",
        ativo: true,
        filhos: [
          {
            id: 3,
            nome: "Marketing",
            ordem: 2.1,
            natureza: "DESPESA",
            tipoGasto: "VARIAVEL",
            ativo: true,
            contasVinculadas: ["4.1"],
          },
          {
            id: 4,
            nome: "Pessoal",
            ordem: 2.2,
            natureza: "DESPESA",
            tipoGasto: "FIXO",
            ativo: true,
            contasVinculadas: ["4.2"],
          },
        ],
      },
      {
        id: 5,
        nome: "Resultado Operacional",
        ordem: 3,
        natureza: "CALCULADO",
        tipoGasto: "NAO_APLICA",
        ativo: true,
      },
    ],
    []
  );

  const dadosFiltrados = useMemo(() => {
    return dadosFicticios.filter((node) =>
      filtroNatureza ? node.natureza === filtroNatureza : true
    );
  }, [dadosFicticios, filtroNatureza]);

  const testarValidacao = () => {
    const erros: string[] = [];

    dadosFicticios.forEach((node) => {
      if (!validarTipoGasto(node.natureza, node.tipoGasto)) {
        erros.push(`Tipo de gasto inválido para a linha ${node.nome}`);
      }
    });

    if (erros.length > 0) {
      setMensagemValidacao(erros.join("; "));
    } else {
      setMensagemValidacao("Regras de natureza e tipo de gasto válidas para a estrutura atual.");
    }
  };

  return (
    <LayoutShell>
      <HeaderBar
        nomeTela="Estrutura do DRE"
        codigoTela="FIN003_ESTRUTURA_DRE"
      />
      <NotificationBar
        type="info"
        message="Validações de natureza/tipo de gasto e vínculo de contas serão reforçadas quando os endpoints forem disponibilizados."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 rounded border border-gray-200 bg-white p-4 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <option value="CALCULADO">Calculado</option>
            </select>
          </label>

          <button
            type="button"
            className="self-end rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            onClick={testarValidacao}
          >
            Validar regras
          </button>
        </div>
        {mensagemValidacao && (
          <NotificationBar
            type={mensagemValidacao.includes("inválido") ? "error" : "success"}
            message={mensagemValidacao}
          />
        )}
        <p className="text-xs text-gray-600">
          Linhas de natureza DESPESA devem ser FIXO ou VARIAVEL. RECEITA e CALCULADO devem permanecer como NAO_APLICA. Vínculos com contas serão salvos em FIN_ESTRUTURA_DRE_CONTA.
        </p>
      </div>

      <div className="rounded border border-gray-200 bg-gray-50 p-4 shadow-inner">
        <h2 className="text-base font-bold text-gray-800">Pré-visualização da estrutura</h2>
        <TreeView nodes={dadosFiltrados} />
      </div>
    </LayoutShell>
  );
}
