"use client";

import LayoutShell, { useHelpContext } from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { SplitViewShell } from "@/components/financeiro/SplitViewShell";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useMemo, useState } from "react";

type CentroCustoNode = {
  id: number;
  nome: string;
  codigo: string;
  status: "ATIVO" | "INATIVO";
  responsavel: string;
  filhos?: CentroCustoNode[];
};

function TreeItem({
  node,
  onSelect,
  selectedId,
  onNewChild,
  onEdit,
}: {
  node: CentroCustoNode;
  onSelect: (id: number) => void;
  selectedId: number | null;
  onNewChild: () => void;
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
          <div>
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              className="text-left text-sm font-semibold text-gray-900"
            >
              {node.codigo} - {node.nome}
            </button>
            <p className="text-xs text-gray-600">Responsavel: {node.responsavel}</p>
            <p className="text-xs font-semibold uppercase text-gray-700">
              {node.status === "ATIVO" ? "Ativo" : "Inativo"}
            </p>
          </div>
          <div className="flex flex-col gap-2 text-xs font-semibold uppercase text-gray-700">
            <button
              type="button"
              className="rounded border border-gray-200 px-2 py-1 hover:border-orange-400 hover:text-orange-600"
              onClick={onNewChild}
            >
              Novo Filho
            </button>
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
            <TreeItem
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedId={selectedId}
              onNewChild={onNewChild}
              onEdit={onEdit}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Modal({ open, onClose, title }: { open: boolean; onClose: () => void; title: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold uppercase text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-orange-600">
            Fechar
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="text-sm font-semibold text-gray-700">
            Nome
            <input className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Ex: Financeiro" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Código
            <input className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Ex: 01.02" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Responsavel
            <input className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Ex: Gestor" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Status
            <select className="mt-1 w-full rounded border border-gray-300 p-2 text-sm">
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
          </label>
        </div>
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

function flatten(nodes: CentroCustoNode[]): CentroCustoNode[] {
  return nodes.flatMap((node) => [node, ...(node.filhos ? flatten(node.filhos) : [])]);
}

export default function CentroCustoPage() {
  const { abrirAjuda } = useHelpContext();
  const { empresa } = useEmpresaSelecionada();
  const dados = useMemo<CentroCustoNode[]>(
    () => [
      {
        id: 1,
        nome: "Administrativo",
        codigo: "01",
        status: "ATIVO",
        responsavel: "Coordenacao",
        filhos: [
          { id: 2, nome: "Financeiro", codigo: "01.01", status: "ATIVO", responsavel: "Controller" },
          { id: 3, nome: "Pessoas", codigo: "01.02", status: "ATIVO", responsavel: "RH" },
        ],
      },
      {
        id: 4,
        nome: "Operacoes",
        codigo: "02",
        status: "ATIVO",
        responsavel: "Diretoria",
        filhos: [
          { id: 5, nome: "Servicos", codigo: "02.01", status: "ATIVO", responsavel: "Supervisor" },
          { id: 6, nome: "Vendas", codigo: "02.02", status: "INATIVO", responsavel: "Coordenador" },
        ],
      },
    ],
    []
  );

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<"TODOS" | "ATIVO" | "INATIVO">("TODOS");
  const [selecionado, setSelecionado] = useState<number | null>(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [modoModal, setModoModal] = useState<"NOVO" | "EDITAR">("NOVO");

  const filtrar = (nos: CentroCustoNode[]): CentroCustoNode[] =>
    nos
      .filter((node) => (statusFiltro === "TODOS" ? true : node.status === statusFiltro))
      .filter((node) =>
        busca ? `${node.codigo} ${node.nome}`.toLowerCase().includes(busca.trim().toLowerCase()) : true
      )
      .map((node) => ({
        ...node,
        filhos: node.filhos ? filtrar(node.filhos) : [],
      }));

  const dadosFiltrados = filtrar(dados);
  const selecionadoNode = useMemo(() => flatten(dados).find((node) => node.id === selecionado), [dados, selecionado]);

  const abrirModal = (modo: "NOVO" | "EDITAR") => {
    setModoModal(modo);
    setModalAberto(true);
  };

  return (
    <LayoutShell>
      <HeaderBar
        nomeTela="CENTRO DE CUSTO - CHATGPT"
        codigoTela="FIN_CENTRO_CUSTO"
        caminhoRota="/financeiro/centro-custo"
        modulo="FINANCEIRO"
      />

      <div className="page-container space-y-4">
        <NotificationBar
          type="info"
          message="Atualize colunas EMPRESA_ID para ID_EMPRESA e siga o mesmo relacionamento com EMP_EMPRESA utilizado pelas tabelas de RH."
        />

        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Empresa ativa</p>
              <p className="text-sm text-gray-600">
                {empresa?.nomeFantasia
                  ? `${empresa.nomeFantasia} (ID ${empresa.id})`
                  : "Nenhuma empresa selecionada - siga o fluxo de RH para definir ID_EMPRESA"}
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-semibold uppercase text-orange-600 underline hover:text-orange-700"
              onClick={() => abrirAjuda("FIN_CENTRO_CUSTO", "CENTRO DE CUSTO - CHATGPT")}
            >
              Ver ajuda da tela
            </button>
          </div>
        </div>

        <SplitViewShell
          title="CENTRO DE CUSTO"
          subtitle="Organize centros vinculados por ID_EMPRESA para filtros e lancamentos"
          onNew={() => abrirModal("NOVO")}
          onHelp={() => abrirAjuda("FIN_CENTRO_CUSTO", "CENTRO DE CUSTO - CHATGPT")}
          helpLink="/ajuda"
          filters={
            <>
              <label className="text-sm font-semibold text-gray-700">
                Busca
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por codigo ou nome"
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
                Vincule sempre ao ID_EMPRESA para manter consistencia em relatorios.
              </div>
            </>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold uppercase text-gray-800">Arvore de Centros</h3>
                <span className="text-xs font-semibold uppercase text-gray-500">Priorize performance nos filtros</span>
              </div>
              <ul className="space-y-3">
                {dadosFiltrados.map((node) => (
                  <TreeItem
                    key={node.id}
                    node={node}
                    onSelect={setSelecionado}
                    selectedId={selecionado}
                    onNewChild={() => abrirModal("NOVO")}
                    onEdit={() => abrirModal("EDITAR")}
                  />
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 shadow-inner">
              <h3 className="text-sm font-extrabold uppercase text-gray-800">Detalhes do Centro</h3>
              {selecionadoNode ? (
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">
                    {selecionadoNode.codigo} - {selecionadoNode.nome}
                  </p>
                  <p>Responsavel: {selecionadoNode.responsavel}</p>
                  <p>Status: {selecionadoNode.status}</p>
                  <p className="text-xs text-gray-500">Aplique controle de acesso por ID_EMPRESA.</p>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      className="rounded-md bg-gray-200 px-3 py-1 text-xs font-semibold uppercase text-gray-800 hover:bg-gray-300"
                      onClick={() => abrirModal("EDITAR")}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-orange-500 px-3 py-1 text-xs font-semibold uppercase text-white hover:bg-orange-600"
                    >
                      Compartilhar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-600">Selecione um centro para visualizar detalhes.</p>
              )}
            </div>
          </div>
        </SplitViewShell>
      </div>

      <Modal
        open={modalAberto}
        title={`${modoModal === "NOVO" ? "Novo" : "Editar"} Centro de Custo`}
        onClose={() => setModalAberto(false)}
      />
    </LayoutShell>
  );
}
