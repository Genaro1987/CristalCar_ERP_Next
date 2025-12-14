"use client";

import LayoutShell, { useHelpContext } from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { SplitViewShell } from "@/components/financeiro/SplitViewShell";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useMemo, useState } from "react";

type Natureza = "RECEITA" | "DESPESA";

type PlanoContaNode = {
  id: number;
  nome: string;
  codigo: string;
  natureza: Natureza;
  status: "ATIVO" | "INATIVO";
  exigeCentroCusto: boolean;
  visivelDre: boolean;
  filhos?: PlanoContaNode[];
};

function Tag({ label, tone = "gray" }: { label: string; tone?: "gray" | "orange" | "green" }) {
  const tones: Record<"gray" | "orange" | "green", string> = {
    gray: "bg-gray-100 text-gray-700",
    orange: "bg-orange-100 text-orange-700",
    green: "bg-green-100 text-green-700",
  } as const;
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {label}
    </span>
  );
}

function TreeItem({
  node,
  onSelect,
  selectedId,
  onOpenModal,
}: {
  node: PlanoContaNode;
  onSelect: (id: number) => void;
  selectedId: number | null;
  onOpenModal: (mode: "NOVO" | "EDITAR") => void;
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
              {node.codigo} - {node.nome}
            </button>
            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
              <Tag label={node.natureza} tone={node.natureza === "RECEITA" ? "green" : "orange"} />
              <Tag label={node.status === "ATIVO" ? "Ativo" : "Inativo"} tone={node.status === "ATIVO" ? "green" : "gray"} />
              {node.visivelDre ? <Tag label="Mostra no DRE" /> : <Tag label="Oculto no DRE" />}
              {node.exigeCentroCusto ? <Tag label="Exige Centro de Custo" /> : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 text-xs font-semibold uppercase text-gray-700">
            <button
              type="button"
              className="rounded border border-gray-200 px-2 py-1 hover:border-orange-400 hover:text-orange-600"
              onClick={() => onOpenModal("NOVO")}
            >
              Novo Filho
            </button>
            <button
              type="button"
              className="rounded border border-gray-200 px-2 py-1 hover:border-orange-400 hover:text-orange-600"
              onClick={() => onOpenModal("EDITAR")}
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
              onOpenModal={onOpenModal}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Modal({
  open,
  title,
  onClose,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
}) {
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              Código
              <input className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Ex: 4.1" />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Nome
              <input className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" placeholder="Ex: Marketing" />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              Natureza
              <select className="mt-1 w-full rounded border border-gray-300 p-2 text-sm">
                <option>Receita</option>
                <option>Despesa</option>
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input type="checkbox" /> Visível no DRE
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input type="checkbox" /> Exige Centro de Custo
            </label>
          </div>
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

function flatten(nodes: PlanoContaNode[]): PlanoContaNode[] {
  return nodes.flatMap((node) => [node, ...(node.filhos ? flatten(node.filhos) : [])]);
}

export default function PlanoContasPage() {
  const { abrirAjuda } = useHelpContext();
  const { empresa } = useEmpresaSelecionada();
  const dados = useMemo<PlanoContaNode[]>(
    () => [
      {
        id: 1,
        nome: "Receitas",
        codigo: "3",
        natureza: "RECEITA",
        status: "ATIVO",
        exigeCentroCusto: false,
        visivelDre: true,
        filhos: [
          {
            id: 2,
            nome: "Vendas de Veiculos",
            codigo: "3.1",
            natureza: "RECEITA",
            status: "ATIVO",
            exigeCentroCusto: true,
            visivelDre: true,
          },
          {
            id: 3,
            nome: "Servicos",
            codigo: "3.2",
            natureza: "RECEITA",
            status: "ATIVO",
            exigeCentroCusto: false,
            visivelDre: true,
          },
        ],
      },
      {
        id: 4,
        nome: "Despesas Operacionais",
        codigo: "4",
        natureza: "DESPESA",
        status: "ATIVO",
        exigeCentroCusto: true,
        visivelDre: true,
        filhos: [
          {
            id: 5,
            nome: "Marketing",
            codigo: "4.1",
            natureza: "DESPESA",
            status: "ATIVO",
            exigeCentroCusto: true,
            visivelDre: true,
          },
          {
            id: 6,
            nome: "Pessoal",
            codigo: "4.2",
            natureza: "DESPESA",
            status: "INATIVO",
            exigeCentroCusto: true,
            visivelDre: false,
          },
        ],
      },
    ],
    []
  );

  const [statusFiltro, setStatusFiltro] = useState<"TODOS" | "ATIVO" | "INATIVO">("TODOS");
  const [naturezaFiltro, setNaturezaFiltro] = useState<"TODAS" | Natureza>("TODAS");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<number | null>(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [modoModal, setModoModal] = useState<"NOVO" | "EDITAR">("NOVO");

  const filtrar = (nos: PlanoContaNode[]): PlanoContaNode[] =>
    nos
      .filter((node) => (statusFiltro === "TODOS" ? true : node.status === statusFiltro))
      .filter((node) => (naturezaFiltro === "TODAS" ? true : node.natureza === naturezaFiltro))
      .filter((node) =>
        busca
          ? `${node.codigo} ${node.nome}`.toLowerCase().includes(busca.trim().toLowerCase())
          : true
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
        nomeTela="PLANO DE CONTAS - CHATGPT"
        codigoTela="FIN_PLANO_CONTA"
        caminhoRota="/financeiro/plano-contas"
        modulo="FINANCEIRO"
      />

      <div className="page-container space-y-4">
        <NotificationBar
          type="info"
          message="Padronize ID_EMPRESA seguindo a mesma base de dados adotada pelo RH (coluna ID_EMPRESA vinculada a EMP_EMPRESA)."
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
              onClick={() => abrirAjuda("FIN_PLANO_CONTA", "PLANO DE CONTAS - CHATGPT")}
            >
              Ver ajuda da tela
            </button>
          </div>
        </div>

        <SplitViewShell
          title="PLANO DE CONTAS"
          subtitle="Organize hierarquia, status e natureza das contas com ID_EMPRESA alinhado ao cadastro de RH"
          onNew={() => abrirModal("NOVO")}
          onHelp={() => abrirAjuda("FIN_PLANO_CONTA", "PLANO DE CONTAS - CHATGPT")}
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
              <label className="text-sm font-semibold text-gray-700">
                Natureza
                <select
                  value={naturezaFiltro}
                  onChange={(e) => setNaturezaFiltro(e.target.value as typeof naturezaFiltro)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
                >
                  <option value="TODAS">Todas</option>
                  <option value="RECEITA">Receita</option>
                  <option value="DESPESA">Despesa</option>
                </select>
              </label>
            </>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold uppercase text-gray-800">Arvore de Contas</h3>
                <span className="text-xs font-semibold uppercase text-gray-500">
                  ID_EMPRESA vinculado em todos os cadastros
                </span>
              </div>
              <ul className="space-y-3">
                {dadosFiltrados.map((node) => (
                  <TreeItem
                    key={node.id}
                    node={node}
                    onSelect={setSelecionado}
                    selectedId={selecionado}
                    onOpenModal={abrirModal}
                  />
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 shadow-inner">
              <h3 className="text-sm font-extrabold uppercase text-gray-800">Detalhes da Selecionada</h3>
              {selecionadoNode ? (
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">
                    {selecionadoNode.codigo} - {selecionadoNode.nome}
                  </p>
                  <p>Natureza: {selecionadoNode.natureza}</p>
                  <p>Status: {selecionadoNode.status}</p>
                  <p>Visivel no DRE: {selecionadoNode.visivelDre ? "Sim" : "Nao"}</p>
                  <p>Exige Centro de Custo: {selecionadoNode.exigeCentroCusto ? "Sim" : "Nao"}</p>
                  <p className="text-xs text-gray-500">
                    Validar relacionamento com EMP_EMPRESA.ID_EMPRESA antes de salvar.
                  </p>
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
                      Duplicar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-600">Selecione uma conta para visualizar detalhes.</p>
              )}
            </div>
          </div>
        </SplitViewShell>
      </div>

      <Modal
        open={modalAberto}
        title={`${modoModal === "NOVO" ? "Novo" : "Editar"} Plano de Contas`}
        onClose={() => setModalAberto(false)}
      />
    </LayoutShell>
  );
}
