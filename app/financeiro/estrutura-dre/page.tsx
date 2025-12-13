"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { SplitViewShell } from "@/components/financeiro/SplitViewShell";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

type Natureza = "RECEITA" | "DESPESA" | "RESULTADO";

type LinhaDre = {
  id: number;
  ordem: string;
  nome: string;
  natureza: Natureza;
  status: "ATIVO" | "INATIVO";
  contasVinculadas: string[];
  filhos?: LinhaDre[];
};

function LinhaTree({
  node,
  onSelect,
  selectedId,
  onEdit,
}: {
  node: LinhaDre;
  onSelect: (id: number) => void;
  selectedId: number | null;
  onEdit: () => void;
}) {
  return (
    <li className="space-y-2">
      <div
        className={`rounded-lg border px-3 py-3 shadow-sm transition hover:border-orange-300 ${
          selectedId === node.id ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              className="text-left text-sm font-semibold text-gray-900"
            >
              ({node.ordem}) {node.nome}
            </button>
            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-700">{node.natureza}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">
                {node.status === "ATIVO" ? "Ativo" : "Inativo"}
              </span>
              <span className="rounded-full bg-gray-50 px-3 py-1 font-semibold text-gray-600">
                {node.contasVinculadas.length} contas
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-xs font-semibold uppercase text-gray-700">
            <button
              type="button"
              className="rounded border border-gray-200 px-2 py-1 hover:border-orange-400 hover:text-orange-600"
              onClick={onEdit}
            >
              Editar
            </button>
            <button
              type="button"
              className="rounded border border-gray-200 px-2 py-1 text-gray-500 hover:border-orange-400 hover:text-orange-600"
            >
              Inativar
            </button>
          </div>
        </div>
      </div>
      {node.filhos && node.filhos.length > 0 ? (
        <ul className="ml-4 border-l border-dashed border-gray-300 pl-4">
          {node.filhos.map((child) => (
            <LinhaTree
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedId={selectedId}
              onEdit={onEdit}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold uppercase text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-orange-600">
            Fechar
          </button>
        </div>
        <div className="mt-4 space-y-3">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-orange-400 hover:text-orange-600"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold uppercase text-white shadow hover:bg-orange-600"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function flatten(nodes: LinhaDre[]): LinhaDre[] {
  return nodes.flatMap((node) => [node, ...(node.filhos ? flatten(node.filhos) : [])]);
}

export default function EstruturaDrePage() {
  const dados = useMemo<LinhaDre[]>(
    () => [
      {
        id: 1,
        ordem: "1",
        nome: "Receita Liquida",
        natureza: "RECEITA",
        status: "ATIVO",
        contasVinculadas: ["3.1", "3.2"],
      },
      {
        id: 2,
        ordem: "2",
        nome: "Custos e Despesas",
        natureza: "DESPESA",
        status: "ATIVO",
        contasVinculadas: ["4.1", "4.2"],
        filhos: [
          {
            id: 3,
            ordem: "2.1",
            nome: "Marketing",
            natureza: "DESPESA",
            status: "ATIVO",
            contasVinculadas: ["4.1"],
          },
          {
            id: 4,
            ordem: "2.2",
            nome: "Pessoal",
            natureza: "DESPESA",
            status: "INATIVO",
            contasVinculadas: ["4.2"],
          },
        ],
      },
      {
        id: 5,
        ordem: "3",
        nome: "Resultado Operacional",
        natureza: "RESULTADO",
        status: "ATIVO",
        contasVinculadas: [],
      },
    ],
    []
  );

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<"TODOS" | "ATIVO" | "INATIVO">("TODOS");
  const [selecionado, setSelecionado] = useState<number | null>(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalVinculoAberto, setModalVinculoAberto] = useState(false);
  const [contasSelecionadas, setContasSelecionadas] = useState<string[]>(["3.1", "3.2"]);

  const filtrar = (nos: LinhaDre[]): LinhaDre[] =>
    nos
      .filter((node) => (statusFiltro === "TODOS" ? true : node.status === statusFiltro))
      .filter((node) =>
        busca ? `${node.ordem} ${node.nome}`.toLowerCase().includes(busca.trim().toLowerCase()) : true
      )
      .map((node) => ({
        ...node,
        filhos: node.filhos ? filtrar(node.filhos) : [],
      }));

  const dadosFiltrados = filtrar(dados);
  const selecionadoNode = useMemo(() => flatten(dados).find((node) => node.id === selecionado), [dados, selecionado]);

  const toggleConta = (codigo: string) => {
    setContasSelecionadas((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]
    );
  };

  return (
    <LayoutShell>
      <HeaderBar
        nomeTela="ESTRUTURA DRE - CHATGPT"
        codigoTela="FIN_ESTRUTURA_DRE"
        caminhoRota="/financeiro/estrutura-dre"
        modulo="FINANCEIRO"
      />

      <SplitViewShell
        title="ESTRUTURA DRE"
        subtitle="Visualize linhas, detalhes e vinculos de contas alinhados ao ID_EMPRESA"
        onNew={() => setModalAberto(true)}
        helpLink="/ajuda"
        filters={
          <>
            <label className="text-sm font-semibold text-gray-700">
              Busca
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por ordem ou nome"
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Status
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as typeof statusFiltro)}
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              >
                <option value="TODOS">Todos</option>
                <option value="ATIVO">Ativos</option>
                <option value="INATIVO">Inativos</option>
              </select>
            </label>
            <div className="rounded border border-dashed border-gray-200 bg-white p-3 text-xs text-gray-600">
              Confirme vinculo apenas com contas da mesma ID_EMPRESA.
            </div>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase text-gray-800">Arvore do DRE</h3>
              <span className="text-xs font-semibold uppercase text-gray-500">Performance otimizada</span>
            </div>
            <ul className="space-y-3">
              {dadosFiltrados.map((node) => (
                <LinhaTree
                  key={node.id}
                  node={node}
                  onSelect={setSelecionado}
                  selectedId={selecionado}
                  onEdit={() => setModalAberto(true)}
                />
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 shadow-inner">
            <h3 className="text-sm font-extrabold uppercase text-gray-800">Detalhe da Linha</h3>
            {selecionadoNode ? (
              <div className="mt-3 space-y-2 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">
                  ({selecionadoNode.ordem}) {selecionadoNode.nome}
                </p>
                <p>Natureza: {selecionadoNode.natureza}</p>
                <p>Status: {selecionadoNode.status}</p>
                <p>
                  Contas vinculadas: <span className="font-semibold">{selecionadoNode.contasVinculadas.join(", ")}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Respeitar hierarquia por ID_EMPRESA e validar consistencia antes de publicar o DRE.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className="rounded-md bg-gray-200 px-3 py-1 text-xs font-semibold uppercase text-gray-800 hover:bg-gray-300"
                    onClick={() => setModalAberto(true)}
                  >
                    Editar Linha
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-orange-500 px-3 py-1 text-xs font-semibold uppercase text-white hover:bg-orange-600"
                    onClick={() => setModalVinculoAberto(true)}
                  >
                    Vincular Conta
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600">Selecione uma linha para ver detalhes.</p>
            )}
          </div>

          <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase text-gray-800">Contas vinculadas</h3>
              <button
                type="button"
                className="rounded-md bg-orange-500 px-3 py-1 text-xs font-semibold uppercase text-white hover:bg-orange-600"
                onClick={() => setModalVinculoAberto(true)}
              >
                Vincular Conta
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {selecionadoNode?.contasVinculadas.length ? (
                selecionadoNode.contasVinculadas.map((conta) => (
                  <div
                    key={conta}
                    className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                  >
                    <span>{conta}</span>
                    <button className="text-xs font-semibold uppercase text-orange-600 hover:text-orange-700">
                      Remover
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-600">Nenhuma conta vinculada.</p>
              )}
            </div>
          </div>
        </div>
      </SplitViewShell>

      <Modal open={modalAberto} title="Nova linha do DRE" onClose={() => setModalAberto(false)}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-gray-700">
            Ordem
            <input className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Ex: 2.3" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Nome
            <input className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Ex: Despesas Administrativas" />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-gray-700">
            Natureza
            <select className="mt-1 w-full rounded border border-gray-300 p-2 text-sm">
              <option>Receita</option>
              <option>Despesa</option>
              <option>Resultado</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Status
            <select className="mt-1 w-full rounded border border-gray-300 p-2 text-sm">
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
          </label>
        </div>
        <label className="text-sm font-semibold text-gray-700">
          Observacoes
          <textarea className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" rows={3} placeholder="Documentar regra do calculo e ID_EMPRESA" />
        </label>
      </Modal>

      <Modal open={modalVinculoAberto} title="Vincular Conta" onClose={() => setModalVinculoAberto(false)}>
        <label className="text-sm font-semibold text-gray-700">
          Buscar conta
          <input className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Digite codigo ou nome" />
        </label>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {["3.1", "3.2", "4.1", "4.2", "4.3"].map((conta) => (
            <label
              key={conta}
              className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700"
            >
              <input
                type="checkbox"
                checked={contasSelecionadas.includes(conta)}
                onChange={() => toggleConta(conta)}
              />
              Conta {conta}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Apenas contas da mesma ID_EMPRESA podem ser vinculadas. Nenhum dado sera salvo neste prototipo.
        </p>
      </Modal>
    </LayoutShell>
  );
}
