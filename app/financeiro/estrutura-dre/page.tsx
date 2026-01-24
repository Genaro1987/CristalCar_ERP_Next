"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";
import {
  BarraFiltros,
  FiltroPadrao,
  SplitView,
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

interface PlanoContaOption {
  id: number;
  label: string;
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
  const caminhoRota = "/financeiro/estrutura-dre";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_ESTRUTURA_DRE";
  const nomeTela = tela?.NOME_TELA ?? "Estrutura do DRE";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "ativos" });
  const [selecionada, setSelecionada] = useState<LinhaDre | null>(null);
  const [modalLinha, setModalLinha] = useState(false);
  const [modalConta, setModalConta] = useState(false);
  const [linhasDre, setLinhasDre] = useState<LinhaDre[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [planoContas, setPlanoContas] = useState<PlanoContaOption[]>([]);

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

  useEffect(() => {
    if (!empresa?.id) return;

    const carregarPlanoContas = async () => {
      try {
        const resposta = await fetch("/api/financeiro/plano-contas", {
          headers: { "x-empresa-id": String(empresa.id) },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            const opcoes = (dados.data ?? []).map((item: any) => ({
              id: item.FIN_PLANO_CONTA_ID,
              label: `${item.FIN_PLANO_CONTA_CODIGO} ${item.FIN_PLANO_CONTA_NOME}`,
            }));
            setPlanoContas(opcoes);
          }
        }
      } catch (erro) {
        console.error("Erro ao carregar plano de contas:", erro);
      }
    };

    carregarPlanoContas();
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
              className="button button-secondary button-compact"
              onClick={() => setModalLinha(true)}
            >
              Novo filho
            </button>
            <button
              type="button"
              className="button button-secondary button-compact"
              onClick={() => setModalLinha(true)}
            >
              Editar
            </button>
            <button
              type="button"
              className="button button-secondary button-compact"
            >
              Inativar
            </button>
            <button
              type="button"
              className="button button-primary button-compact"
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
      <div className="page-container financeiro-page">
        <HeaderBar
          nomeTela={nomeTela}
          codigoTela={codigoTela}
          caminhoRota={caminhoTela}
          modulo={moduloTela}
        />

        <main className="page-content-card space-y-4">
          <section className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cadastro financeiro</p>
                <h2 className="text-lg font-bold text-gray-900">Árvore da estrutura do DRE</h2>
                <p className="text-sm text-gray-600">
                  Estruture linhas e conecte contas para garantir o fechamento correto do resultado.
                </p>
              </div>
              <button type="button" className="button button-primary" onClick={handleNovo}>
                Nova linha
              </button>
            </div>

            <div className="mt-4">
              <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))} />
            </div>
          </section>

          <section className="panel">
            <SplitView
              left={
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
              right={
                <div className="flex h-full flex-col gap-6">
                  <div className="space-y-3">
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
                            {selecionada.descricao || "Sem descrição cadastrada para esta linha."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => setModalLinha(true)}
                          >
                            Editar linha
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600">
                        <p className="font-semibold text-gray-800">Selecione uma linha para visualizar detalhes</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 border-t border-gray-200 pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contas vinculadas</p>
                        <h3 className="text-lg font-bold text-gray-900">Plano de contas no DRE</h3>
                      </div>
                      <button
                        type="button"
                        className="button button-primary"
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
                      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600">
                        <p className="font-semibold text-gray-800">Selecione uma linha</p>
                      </div>
                    )}
                  </div>
                </div>
              }
            />
          </section>
        </main>
      </div>

      <ModalOverlay
        aberto={modalLinha}
        onClose={() => setModalLinha(false)}
        titulo="Cadastro de linha do DRE"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="form-group">
            <label htmlFor="dre-linha-nome">Nome da linha</label>
            <input
              id="dre-linha-nome"
              className="form-input"
              placeholder="Ex: Resultado Operacional"
            />
          </div>
          <div className="form-group">
            <label htmlFor="dre-linha-codigo">Código</label>
            <input id="dre-linha-codigo" className="form-input" placeholder="1.2.1" />
          </div>
          <div className="form-group">
            <label htmlFor="dre-linha-natureza">Natureza</label>
            <select id="dre-linha-natureza" className="form-input">
              <option>Receita</option>
              <option>Despesa</option>
              <option>Outros</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="dre-linha-tipo">Tipo</label>
            <select id="dre-linha-tipo" className="form-input">
              <option>Fixo</option>
              <option>Variável</option>
              <option>Calculado</option>
            </select>
          </div>
          <div className="form-group md:col-span-2">
            <label htmlFor="dre-linha-descricao">Descrição</label>
            <textarea
              id="dre-linha-descricao"
              className="form-input min-h-[100px]"
              placeholder="Explique como calcular e consolidar esta linha"
            />
          </div>
        </div>
      </ModalOverlay>

      <ModalOverlay
        aberto={modalConta}
        onClose={() => setModalConta(false)}
        titulo="Vincular contas ao DRE"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="form-group flex-1">
              <label htmlFor="dre-busca-conta">Buscar contas</label>
              <input
                id="dre-busca-conta"
                className="form-input"
                placeholder="Digite nome ou código"
              />
            </div>
            <button
              type="button"
              className="button button-secondary md:mt-6"
            >
              Aplicar filtro
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Sugestões por plano de contas</p>
            <div className="flex flex-wrap gap-2">
              {planoContas.slice(0, 6).map((conta) => (
                <span
                  key={conta.id}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-800"
                >
                  {conta.label}
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
