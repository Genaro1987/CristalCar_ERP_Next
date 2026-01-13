"use client";

import LayoutShell from "@/components/LayoutShell";
import React, { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { BarraFiltros, FiltroPadrao, FinanceiroPageHeader, ModalOverlay } from "../_components/financeiro-layout";

type Lancamento = {
  id: string;
  data: string;
  historico: string;
  conta: string;
  contaId: number;
  centroCusto: string;
  centroCustoId: number | null;
  valor: number;
  tipo: "Entrada" | "Saída";
  status: "confirmado" | "pendente";
  documento?: string;
};

type PlanoContaOption = {
  id: number;
  label: string;
};

type CentroCustoOption = {
  id: number;
  label: string;
};

export default function LancamentosPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();

  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "todos" });
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<Lancamento | null>(null);
  const [modo, setModo] = useState<"novo" | "editar">("novo");
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState<string>("");
  const [planoContaSelecionado, setPlanoContaSelecionado] = useState<string>("");
  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState<string>("");
  const [documentoFiltro, setDocumentoFiltro] = useState<string>("");
  const [planoContas, setPlanoContas] = useState<PlanoContaOption[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoOption[]>([]);

  // Buscar lançamentos da API
  useEffect(() => {
    if (!empresa?.id) return;

    const buscarLancamentos = async () => {
      try {
        setCarregando(true);
        let url = "/api/financeiro/lancamentos";
        if (periodo) {
          url += `?periodo=${periodo}`;
        }

        const resposta = await fetch(url, {
          headers: {
            "x-empresa-id": String(empresa.id),
          },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            setLancamentos(dados.data);
          }
        }
      } catch (erro) {
        console.error("Erro ao buscar lançamentos:", erro);
      } finally {
        setCarregando(false);
      }
    };

    buscarLancamentos();
  }, [empresa?.id, periodo]);

  useEffect(() => {
    if (!empresa?.id) return;

    const carregarOpcoes = async () => {
      try {
        const [planosResposta, centrosResposta] = await Promise.all([
          fetch("/api/financeiro/plano-contas", {
            headers: { "x-empresa-id": String(empresa.id) },
          }),
          fetch("/api/financeiro/centro-custo", {
            headers: { "x-empresa-id": String(empresa.id) },
          }),
        ]);

        if (planosResposta.ok) {
          const planosJson = await planosResposta.json();
          if (planosJson.success) {
            const opcoes = (planosJson.data ?? []).map((item: any) => ({
              id: item.FIN_PLANO_CONTA_ID,
              label: `${item.FIN_PLANO_CONTA_CODIGO} ${item.FIN_PLANO_CONTA_NOME}`,
            }));
            setPlanoContas(opcoes);
          }
        }

        if (centrosResposta.ok) {
          const centrosJson = await centrosResposta.json();
          if (centrosJson.success) {
            const normalizar = (items: any[]): CentroCustoOption[] =>
              items.flatMap((item) => [
                { id: Number(item.id), label: `${item.codigo} ${item.nome}` },
                ...(item.filhos ? normalizar(item.filhos) : []),
              ]);

            setCentrosCusto(normalizar(centrosJson.data ?? []));
          }
        }
      } catch (erro) {
        console.error("Erro ao carregar filtros:", erro);
      }
    };

    carregarOpcoes();
  }, [empresa?.id]);

  const dadosFiltrados = useMemo(() => {
    const busca = filtro.busca.trim().toLowerCase();
    const documentoNormalizado = documentoFiltro.trim().toLowerCase();
    return lancamentos.filter((item) => {
      const statusOk =
        filtro.status === "todos" ||
        (filtro.status === "ativos" && item.status === "confirmado") ||
        (filtro.status === "inativos" && item.status === "pendente");
      const buscaOk =
        !busca || `${item.historico} ${item.conta} ${item.centroCusto}`.toLowerCase().includes(busca);
      const contaOk = !planoContaSelecionado || String(item.contaId) === planoContaSelecionado;
      const centroOk =
        !centroCustoSelecionado || String(item.centroCustoId ?? "") === centroCustoSelecionado;
      const documentoOk = !documentoNormalizado || item.documento?.toLowerCase().includes(documentoNormalizado);

      return statusOk && buscaOk && contaOk && centroOk && documentoOk;
    });
  }, [filtro, lancamentos, planoContaSelecionado, centroCustoSelecionado, documentoFiltro]);

  const handleNovo = () => {
    setModo("novo");
    setSelecionado(null);
    setModalAberto(true);
  };

  const handleEditar = (item: Lancamento) => {
    setSelecionado(item);
    setModo("editar");
    setModalAberto(true);
  };

  const handleSalvar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tipo = (form.get("tipo") as Lancamento["tipo"]) ?? "Entrada";
    const valorInformado = Number(form.get("valor")) || 0;
    const valorNormalizado =
      tipo === "Saída" ? -Math.abs(valorInformado) : Math.abs(valorInformado);

    const payload = {
      id: selecionado?.id,
      data: (form.get("data") as string) ?? "",
      historico: (form.get("historico") as string) ?? "",
      contaId: Number(form.get("contaId")) || 0,
      centroCustoId: Number(form.get("centroCustoId")) || null,
      valor: valorNormalizado,
      documento: (form.get("documento") as string) ?? "",
      status: (form.get("status") as Lancamento["status"]) ?? "confirmado",
    };

    const salvar = async () => {
      try {
        const resposta = await fetch("/api/financeiro/lancamentos", {
          method: modo === "novo" ? "POST" : "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-empresa-id": String(empresa?.id ?? ""),
          },
          body: JSON.stringify(payload),
        });

        const json = await resposta.json();
        if (resposta.ok && json.success) {
          const atualizado = json.data as Lancamento;
          if (modo === "novo") {
            setLancamentos((prev) => [atualizado, ...prev]);
          } else {
            setLancamentos((prev) => prev.map((item) => (item.id === atualizado.id ? atualizado : item)));
          }
          setModalAberto(false);
        }
      } catch (erro) {
        console.error("Erro ao salvar lançamento:", erro);
      }
    };

    salvar();
  };

  return (
    <LayoutShell>
      <div className="page-container">
        <FinanceiroPageHeader
          titulo="Lançamentos (Caixa)"
          subtitulo="Financeiro | Contas a pagar e receber"
          onNovo={handleNovo}
          codigoAjuda="FIN_LANCAMENTOS"
        />

        <main className="page-content-card space-y-4">
          <section className="panel space-y-4">
            <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((prev) => ({ ...prev, ...novo }))} />

            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contexto</p>
                  <h2 className="text-lg font-bold text-gray-900">Filtros principais</h2>
                  <p className="text-sm text-gray-600">
                    Cada lançamento respeita a empresa ativa, natureza e centro de custo. Utilize os filtros antes de incluir dados.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleNovo}
                >
                  Novo lançamento
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="form-group">
                  <label htmlFor="filtro-periodo">Período</label>
                  <input
                    id="filtro-periodo"
                    type="month"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="filtro-plano-conta">Plano de Conta</label>
                  <select
                    id="filtro-plano-conta"
                    value={planoContaSelecionado}
                    onChange={(e) => setPlanoContaSelecionado(e.target.value)}
                    className="form-input"
                  >
                    <option value="">Todas</option>
                    {planoContas.map((conta) => (
                      <option key={conta.id} value={conta.id}>
                        {conta.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="filtro-centro-custo">Centro de Custo</label>
                  <select
                    id="filtro-centro-custo"
                    value={centroCustoSelecionado}
                    onChange={(e) => setCentroCustoSelecionado(e.target.value)}
                    className="form-input"
                  >
                    <option value="">Todos</option>
                    {centrosCusto.map((centro) => (
                      <option key={centro.id} value={centro.id}>
                        {centro.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="filtro-documento">Documento</label>
                  <input
                    id="filtro-documento"
                    type="text"
                    value={documentoFiltro}
                    onChange={(e) => setDocumentoFiltro(e.target.value)}
                    className="form-input"
                    placeholder="Número ou referência"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Visão consolidada</p>
                <h3 className="text-lg font-bold text-gray-900">Lançamentos cadastrados</h3>
                <p className="text-sm text-gray-600">Use editar para ajustar histórico, conta e centros antes do envio ao DRE.</p>
              </div>
              <span className="rounded bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">ID_EMPRESA obrigatório</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-dashed border-gray-200 bg-white text-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Histórico</th>
                    <th className="px-4 py-3 text-left">Conta</th>
                    <th className="px-4 py-3 text-left">Centro de Custo</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Valor</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {carregando ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-600">
                        Carregando lançamentos...
                      </td>
                    </tr>
                  ) : dadosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-600">
                        Nenhum lançamento encontrado
                      </td>
                    </tr>
                  ) : (
                    dadosFiltrados.map((item) => (
                      <tr key={item.id} className="hover:bg-orange-50/40">
                        <td className="px-4 py-3 text-xs font-semibold text-gray-800">{item.data}</td>
                        <td className="px-4 py-3 text-xs text-gray-800">{item.historico}</td>
                        <td className="px-4 py-3 text-xs text-gray-800">{item.conta}</td>
                        <td className="px-4 py-3 text-xs text-gray-800">{item.centroCusto}</td>
                        <td className="px-4 py-3 text-xs text-gray-800">{item.tipo}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-gray-800">
                          R$ {Math.abs(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold">
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] ${
                              item.status === "confirmado"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {item.status === "confirmado" ? "Confirmado" : "Pendente"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="button button-secondary button-compact"
                              onClick={() => handleEditar(item)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="button button-primary button-compact"
                            >
                              Conciliar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      <ModalOverlay
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        titulo={modo === "novo" ? "Novo lançamento" : "Editar lançamento"}
      >
        <form className="space-y-3" onSubmit={handleSalvar}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="form-group">
              <label htmlFor="modal-data">Data</label>
              <input
                id="modal-data"
                name="data"
                type="date"
                defaultValue={selecionado?.data}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="modal-tipo">Tipo</label>
              <select
                id="modal-tipo"
                name="tipo"
                defaultValue={selecionado?.tipo ?? "Entrada"}
                className="form-input"
              >
                <option value="Entrada">Entrada</option>
                <option value="Saída">Saída</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="modal-historico">Histórico</label>
              <input
                id="modal-historico"
                name="historico"
                defaultValue={selecionado?.historico}
                className="form-input"
                placeholder="Descrição do lançamento"
              />
            </div>
            <div className="form-group">
              <label htmlFor="modal-conta">Plano de Conta</label>
              <select
                id="modal-conta"
                name="contaId"
                defaultValue={selecionado?.contaId}
                className="form-input"
                required
              >
                <option value="">Selecione</option>
                {planoContas.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="modal-centro-custo">Centro de Custo</label>
              <select
                id="modal-centro-custo"
                name="centroCustoId"
                defaultValue={selecionado?.centroCustoId ?? ""}
                className="form-input"
              >
                <option value="">Selecione</option>
                {centrosCusto.map((centro) => (
                  <option key={centro.id} value={centro.id}>
                    {centro.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="modal-valor">Valor</label>
              <input
                id="modal-valor"
                name="valor"
                type="number"
                defaultValue={selecionado?.valor ?? 0}
                className="form-input"
                placeholder="Informe valores positivos para entradas e negativos para saídas"
              />
            </div>
            <div className="form-group">
              <label htmlFor="modal-documento">Documento</label>
              <input
                id="modal-documento"
                name="documento"
                defaultValue={selecionado?.documento}
                className="form-input"
                placeholder="Número ou referência"
              />
            </div>
            <div className="form-group">
              <label htmlFor="modal-status">Status</label>
              <select
                id="modal-status"
                name="status"
                defaultValue={selecionado?.status ?? "confirmado"}
                className="form-input"
              >
                <option value="confirmado">Confirmado</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalAberto(false)}
              className="button button-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="button button-primary"
            >
              Salvar lançamento
            </button>
          </div>
        </form>
      </ModalOverlay>
    </LayoutShell>
  );
}
