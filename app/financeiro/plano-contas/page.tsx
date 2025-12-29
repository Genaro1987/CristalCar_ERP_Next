"use client";

import LayoutShell from "@/components/LayoutShell";
import { useMemo, useState } from "react";
import {
  BarraFiltros,
  FiltroPadrao,
  FinanceiroPageHeader,
  ModalOverlay,
  SplitView,
} from "../_components/financeiro-layout";

interface PlanoContaItem {
  id: string;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA";
  status: "ativo" | "inativo";
  obrigatorioCentroCusto?: boolean;
  filhos?: PlanoContaItem[];
}

const MOCK_PLANO_CONTAS: PlanoContaItem[] = [
  {
    id: "1",
    nome: "Receitas Operacionais",
    codigo: "3.0",
    natureza: "RECEITA",
    status: "ativo",
    filhos: [
      {
        id: "1.1",
        nome: "Vendas de Produtos",
        codigo: "3.1",
        natureza: "RECEITA",
        status: "ativo",
      },
      {
        id: "1.2",
        nome: "Serviços",
        codigo: "3.2",
        natureza: "RECEITA",
        status: "ativo",
      },
    ],
  },
  {
    id: "2",
    nome: "Despesas Operacionais",
    codigo: "4.0",
    natureza: "DESPESA",
    status: "ativo",
    obrigatorioCentroCusto: true,
    filhos: [
      {
        id: "2.1",
        nome: "Marketing",
        codigo: "4.1",
        natureza: "DESPESA",
        status: "ativo",
        obrigatorioCentroCusto: true,
      },
      {
        id: "2.2",
        nome: "Folha de Pagamento",
        codigo: "4.2",
        natureza: "DESPESA",
        status: "ativo",
      },
      {
        id: "2.3",
        nome: "Custos Logísticos",
        codigo: "4.3",
        natureza: "DESPESA",
        status: "inativo",
      },
    ],
  },
];

function filtrarArvore(
  dados: PlanoContaItem[],
  filtro: FiltroPadrao
): PlanoContaItem[] {
  const buscaNormalizada = filtro.busca.trim().toLowerCase();

  const atendeFiltro = (item: PlanoContaItem) => {
    const statusOk =
      filtro.status === "todos" ||
      (filtro.status === "ativos" && item.status === "ativo") ||
      (filtro.status === "inativos" && item.status === "inativo");
    const naturezaOk = filtro.natureza ? item.natureza === filtro.natureza : true;
    const buscaOk = buscaNormalizada
      ? `${item.codigo} ${item.nome}`.toLowerCase().includes(buscaNormalizada)
      : true;

    return statusOk && naturezaOk && buscaOk;
  };

  return dados.flatMap((item): PlanoContaItem[] => {
    const filhosFiltrados = item.filhos ? filtrarArvore(item.filhos, filtro) : [];
    const corresponde = atendeFiltro(item);

    if (corresponde || filhosFiltrados.length > 0) {
      return [{ ...item, filhos: filhosFiltrados }];
    }

    return [];
  });
}

export default function PlanoContasPage() {
  const [filtro, setFiltro] = useState<FiltroPadrao>({
    busca: "",
    status: "ativos",
    natureza: "",
  });
  const [selecionado, setSelecionado] = useState<PlanoContaItem | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState<"novo" | "editar">("novo");

  const arvoreFiltrada = useMemo(() => filtrarArvore(MOCK_PLANO_CONTAS, filtro), [filtro]);

  const handleNovo = () => {
    setModoEdicao("novo");
    setModalAberto(true);
  };

  const handleEditar = (item: PlanoContaItem) => {
    setSelecionado(item);
    setModoEdicao("editar");
    setModalAberto(true);
  };

  const renderNo = (item: PlanoContaItem) => {
    const estaSelecionado = selecionado?.id === item.id;
    const statusClass =
      item.status === "ativo"
        ? "bg-green-100 text-green-700"
        : "bg-gray-200 text-gray-700";

    return (
      <div key={item.id} className="space-y-2">
        <div
          className={`flex flex-col gap-3 rounded-lg border border-gray-200 p-3 shadow-sm transition hover:border-orange-200 ${
            estaSelecionado ? "border-orange-300 bg-orange-50" : "bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.codigo}</p>
              <p className="text-sm font-bold text-gray-900">{item.nome}</p>
              <p className="text-xs text-gray-600">
                Natureza: {item.natureza} | Centro de custo obrigatório: {" "}
                {item.obrigatorioCentroCusto ? "Sim" : "Não"}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
              {item.status === "ativo" ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
              onClick={handleNovo}
            >
              Novo filho
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
              onClick={() => handleEditar(item)}
            >
              Editar
            </button>
            <button
              type="button"
              className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
            >
              Inativar
            </button>
            <button
              type="button"
              className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
              onClick={() => setSelecionado(item)}
            >
              Ver detalhes
            </button>
          </div>
        </div>
        {item.filhos && item.filhos.length > 0 ? (
          <div className="ml-5 border-l border-dashed border-gray-200 pl-4">
            {item.filhos.map((filho) => renderNo(filho))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <LayoutShell>
      <div className="space-y-4">
        <FinanceiroPageHeader
          titulo="Plano de Contas"
          subtitulo="Financeiro | Hierarquia contábil"
          onNovo={handleNovo}
          codigoAjuda="FIN_PLANO_CONTAS"
        />

        <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))} exibirNatureza />

        <SplitView
          left={
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Árvore</p>
                  <h3 className="text-lg font-bold text-gray-900">Estrutura do plano</h3>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {arvoreFiltrada.length} grupos principais
                </span>
              </div>
              <div className="space-y-3">
                {arvoreFiltrada.map((item) => renderNo(item))}
              </div>
            </div>
          }
          right={
            <div className="flex h-full flex-col gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Detalhes</p>
                <h3 className="text-lg font-bold text-gray-900">Conta selecionada</h3>
                <p className="text-sm text-gray-600">
                  Visualização simples para validar descrições, códigos e configurações antes de publicar no backend.
                </p>
              </div>
              {selecionado ? (
                <div className="space-y-4 rounded-lg bg-gray-50 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Código</p>
                    <p className="text-lg font-bold text-gray-900">{selecionado.codigo}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Título</p>
                    <p className="text-base font-semibold text-gray-800">{selecionado.nome}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Natureza</p>
                      <p className="font-semibold text-gray-900">{selecionado.natureza}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
                      <p className="font-semibold text-gray-900">{selecionado.status === "ativo" ? "Ativo" : "Inativo"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Centro de custo</p>
                      <p className="font-semibold text-gray-900">
                        {selecionado.obrigatorioCentroCusto ? "Obrigatório" : "Opcional"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Visível no DRE</p>
                      <p className="font-semibold text-gray-900">Sim (mock)</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Descrição / observações</p>
                    <p className="rounded-lg border border-dashed border-gray-200 bg-white p-3 text-sm text-gray-700">
                      Inclua orientações para lançamentos, responsáveis e se a conta deve aparecer em dashboards.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                      onClick={() => handleEditar(selecionado)}
                    >
                      Editar conta
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
                    >
                      Exportar mock
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600">
                  <p className="font-semibold text-gray-800">Selecione uma conta para visualizar detalhes</p>
                  <p>Use a coluna esquerda para navegar pela hierarquia.</p>
                </div>
              )}
            </div>
          }
        />
      </div>

      <ModalOverlay
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        titulo={modoEdicao === "novo" ? "Nova conta" : "Editar conta"}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold text-gray-700">
            Nome da conta
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              placeholder="Ex: Despesas administrativas"
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-700">
            Código
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              placeholder="4.1.01"
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-700">
            Natureza
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none">
              <option>Receita</option>
              <option>Despesa</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-700">
            Status
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none">
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
          </label>
          <label className="md:col-span-2 space-y-1 text-sm font-semibold text-gray-700">
            Observações
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              placeholder="Detalhes sobre obrigatoriedade de centro de custo, visibilidade no DRE e responsáveis"
            />
          </label>
        </div>
      </ModalOverlay>
    </LayoutShell>
  );
}
