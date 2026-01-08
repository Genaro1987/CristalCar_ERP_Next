"use client";

import LayoutShell from "@/components/LayoutShell";
import { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada, useRequerEmpresaSelecionada } from "@/hooks/useEmpresaSelecionada";
import {
  BarraFiltros,
  FiltroPadrao,
  FinanceiroPageHeader,
  DreSplitView,
  ModalOverlay,
} from "../_components/financeiro-layout";

interface LinhaDre {
  id: string;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "OUTROS";
  status: "ativo" | "inativo";
  tipo?: string;
  descricao?: string;
  contasVinculadas?: string[];
  filhos?: LinhaDre[];
}

function filtrarDre(dados: LinhaDre[], filtro: FiltroPadrao): LinhaDre[] {
  const buscaNormalizada = filtro.busca.trim().toLowerCase();

  const atendeFiltro = (item: LinhaDre) => {
    const statusOk =
      filtro.status === "todos" ||
      (filtro.status === "ativos" && item.status === "ativo") ||
      (filtro.status === "inativos" && item.status === "inativo");
    const buscaOk = buscaNormalizada
      ? `${item.codigo} ${item.nome}`.toLowerCase().includes(buscaNormalizada)
      : true;

    return statusOk && buscaOk;
  };

  return dados.flatMap((item) => {
    const filhosFiltrados = item.filhos ? filtrarDre(item.filhos, filtro) : [];
    const corresponde = atendeFiltro(item);
    if (corresponde || filhosFiltrados.length > 0) {
      return [{ ...item, filhos: filhosFiltrados }];
    }
    return [];
  });
}

export default function EstruturaDrePage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();

  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "ativos" });
  const [selecionada, setSelecionada] = useState<LinhaDre | null>(null);
  const [modalLinha, setModalLinha] = useState(false);
  const [modalConta, setModalConta] = useState(false);
  const [linhasDre, setLinhasDre] = useState<LinhaDre[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Buscar estrutura DRE da API
  useEffect(() => {
    if (!empresa?.id) return;

    const buscarDre = async () => {
      try {
        setCarregando(true);
        const resposta = await fetch("/api/financeiro/estrutura-dre", {
          headers: {
            "x-empresa-id": String(empresa.id),
          },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            setLinhasDre(dados.data);
          }
        }
      } catch (erro) {
        console.error("Erro ao buscar estrutura DRE:", erro);
      } finally {
        setCarregando(false);
      }
    };

    buscarDre();
  }, [empresa?.id]);

  const arvoreFiltrada = useMemo(() => filtrarDre(linhasDre, filtro), [linhasDre, filtro]);

  const handleNovo = () => {
    setModalLinha(true);
  };

  const renderNo = (item: LinhaDre) => {
    const estaSelecionada = selecionada?.id === item.id;

    return (
      <div key={item.id} className="space-y-2">
        <div
          className={`flex flex-col gap-3 rounded-lg border border-gray-200 p-3 shadow-sm transition hover:border-orange-200 ${
            estaSelecionada ? "border-orange-300 bg-orange-50" : "bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.codigo}</p>
              <p className="text-sm font-bold text-gray-900">{item.nome}</p>
              <p className="text-xs text-gray-600">
                Natureza: {item.natureza} {item.tipo ? `| Tipo: ${item.tipo}` : ""}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                item.status === "ativo" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
              }`}
            >
              {item.status === "ativo" ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
              onClick={() => setModalLinha(true)}
            >
              Novo filho
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
              onClick={() => setModalLinha(true)}
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
              onClick={() => setSelecionada(item)}
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

  const contasSelecionadas = selecionada?.contasVinculadas ?? [];

  return (
    <LayoutShell>
      <div className="space-y-4">
        <FinanceiroPageHeader
          titulo="Estrutura do DRE"
          subtitulo="Financeiro | Demonstração de resultados"
          onNovo={handleNovo}
          codigoAjuda="FIN_ESTRUTURA_DRE"
        />

        <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))} />

        <DreSplitView
          esquerda={
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Linhas</p>
                  <h3 className="text-lg font-bold text-gray-900">Árvore do DRE</h3>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {arvoreFiltrada.length} blocos principais
                </span>
              </div>
              {carregando ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-gray-600">Carregando estrutura DRE...</p>
                </div>
              ) : arvoreFiltrada.length === 0 ? (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-8">
                  <p className="text-sm text-gray-600">Nenhuma linha do DRE encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">{arvoreFiltrada.map((item) => renderNo(item))}</div>
              )}
            </div>
          }
          centro={
            <div className="flex h-full flex-col gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Detalhes</p>
                <h3 className="text-lg font-bold text-gray-900">Linha selecionada</h3>
                <p className="text-sm text-gray-600">
                  Consulte a descrição da linha, natureza e comportamento antes de conectar ao plano de contas.
                </p>
              </div>
              {selecionada ? (
                <div className="space-y-4 rounded-lg bg-gray-50 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Código</p>
                      <p className="text-lg font-bold text-gray-900">{selecionada.codigo}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
                      <p className="text-sm font-semibold text-gray-900">{selecionada.status === "ativo" ? "Ativo" : "Inativo"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Natureza</p>
                      <p className="text-sm font-semibold text-gray-900">{selecionada.natureza}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo</p>
                      <p className="text-sm font-semibold text-gray-900">{selecionada.tipo ?? "Livre"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Título</p>
                      <p className="text-base font-semibold text-gray-800">{selecionada.nome}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Regras e comentários</p>
                    <p className="rounded-lg border border-dashed border-gray-200 bg-white p-3 text-sm text-gray-700">
                      Explique como calcular esta linha, se aceita lançamentos diretos ou somente consolidado de filhos.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                      onClick={() => setModalLinha(true)}
                    >
                      Editar linha
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
                      onClick={() => setModalConta(true)}
                    >
                      Vincular contas
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600">
                  <p className="font-semibold text-gray-800">Selecione uma linha para visualizar detalhes</p>
                  <p>A navegação pela árvore do DRE está na coluna esquerda.</p>
                </div>
              )}
            </div>
          }
          direita={
            <div className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contas vinculadas</p>
                  <h3 className="text-lg font-bold text-gray-900">Plano de contas no DRE</h3>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
                  onClick={() => setModalConta(true)}
                  disabled={!selecionada}
                >
                  Vincular conta
                </button>
              </div>
              {selecionada ? (
                <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                  {contasSelecionadas.length > 0 ? (
                    <ul className="space-y-2">
                      {contasSelecionadas.map((conta) => (
                        <li key={conta} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
                          <span>{conta}</span>
                          <button className="text-xs font-semibold text-orange-600 hover:underline">Remover</button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-600">Nenhuma conta associada a esta linha.</p>
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600">
                  <p className="font-semibold text-gray-800">Selecione uma linha</p>
                  <p>Escolha um item do DRE para listar as contas vinculadas.</p>
                </div>
              )}
            </div>
          }
        />
      </div>

      <ModalOverlay
        aberto={modalLinha}
        onClose={() => setModalLinha(false)}
        titulo="Cadastro de linha do DRE"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold text-gray-700">
            Nome da linha
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              placeholder="Ex: Resultado Operacional"
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-700">
            Código
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              placeholder="1.2.1"
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-700">
            Natureza
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none">
              <option>Receita</option>
              <option>Despesa</option>
              <option>Outros</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-gray-700">
            Tipo
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none">
              <option>Fixo</option>
              <option>Variável</option>
              <option>Calculado</option>
            </select>
          </label>
          <label className="md:col-span-2 space-y-1 text-sm font-semibold text-gray-700">
            Descrição
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
              placeholder="Explique como calcular e consolidar esta linha"
            />
          </label>
        </div>
      </ModalOverlay>

      <ModalOverlay
        aberto={modalConta}
        onClose={() => setModalConta(false)}
        titulo="Vincular contas ao DRE"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <label className="flex-1 space-y-1 text-sm font-semibold text-gray-700">
              Buscar contas
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
                placeholder="Digite nome ou código"
              />
            </label>
            <button
              type="button"
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 md:mt-6"
            >
              Aplicar filtro
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Sugestões mock</p>
            <div className="flex flex-wrap gap-2">
              {[
                "3.1 Vendas de Produtos",
                "4.1 Marketing",
                "4.2 Folha de Pagamento",
                "4.3 Custos Logísticos",
              ].map((conta) => (
                <span
                  key={conta}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-800"
                >
                  {conta}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Seleção atual</p>
            <div className="flex flex-wrap gap-2">
              {contasSelecionadas.length > 0 ? (
                contasSelecionadas.map((conta) => (
                  <span
                    key={conta}
                    className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700"
                  >
                    {conta}
                    <button className="text-orange-600 hover:underline">remover</button>
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-600">Nenhuma conta selecionada.</span>
              )}
            </div>
          </div>
        </div>
      </ModalOverlay>
    </LayoutShell>
  );
}
