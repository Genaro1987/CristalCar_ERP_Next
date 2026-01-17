"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import React, { useEffect, useMemo, useState } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";
import {
  BarraFiltros,
  FiltroPadrao,
  ModalOverlay,
} from "../_components/financeiro-layout";

type ObjetivoFinanceiro = {
  id: string;
  titulo: string;
  periodo: "Mensal" | "Trimestral" | "Anual";
  meta: number;
  responsavel: string;
  status: "ativo" | "inativo";
  observacao?: string;
};

export default function ObjetivosPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/objetivos";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_OBJETIVOS";
  const nomeTela = tela?.NOME_TELA ?? "Objetivos Financeiros";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "ativos" });
  const [objetivos, setObjetivos] = useState<ObjetivoFinanceiro[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [modo, setModo] = useState<"novo" | "editar">("novo");
  const [selecionado, setSelecionado] = useState<ObjetivoFinanceiro | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!empresa?.id) return;

    const carregarObjetivos = async () => {
      try {
        setCarregando(true);
        const resposta = await fetch("/api/financeiro/objetivos", {
          headers: {
            "x-empresa-id": String(empresa.id),
          },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            setObjetivos(dados.data ?? []);
          }
        }
      } catch (erro) {
        console.error("Erro ao carregar objetivos:", erro);
      } finally {
        setCarregando(false);
      }
    };

    carregarObjetivos();
  }, [empresa?.id]);

  const objetivosFiltrados = useMemo(() => {
    const busca = filtro.busca.trim().toLowerCase();

    return objetivos.filter((item) => {
      const statusOk =
        filtro.status === "todos" ||
        (filtro.status === "ativos" && item.status === "ativo") ||
        (filtro.status === "inativos" && item.status === "inativo");
      const buscaOk =
        !busca || `${item.titulo} ${item.responsavel}`.toLowerCase().includes(busca);

      return statusOk && buscaOk;
    });
  }, [filtro, objetivos]);

  const handleNovo = () => {
    setModo("novo");
    setSelecionado(null);
    setModalAberto(true);
  };

  const handleEditar = (objetivo: ObjetivoFinanceiro) => {
    setSelecionado(objetivo);
    setModo("editar");
    setModalAberto(true);
  };

  const handleSalvar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      id: selecionado?.id,
      titulo: (formData.get("titulo") as string) ?? "",
      periodo: (formData.get("periodo") as ObjetivoFinanceiro["periodo"]) ?? "Mensal",
      meta: Number(formData.get("meta")) || 0,
      responsavel: (formData.get("responsavel") as string) ?? "",
      status: (formData.get("status") as ObjetivoFinanceiro["status"]) ?? "ativo",
      observacao: (formData.get("observacao") as string) ?? "",
    };

    const salvar = async () => {
      try {
        const resposta = await fetch("/api/financeiro/objetivos", {
          method: modo === "novo" ? "POST" : "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-empresa-id": String(empresa?.id ?? ""),
          },
          body: JSON.stringify(payload),
        });

        const json = await resposta.json();
        if (resposta.ok && json.success) {
          const atualizado = json.data as ObjetivoFinanceiro;
          if (modo === "novo") {
            setObjetivos((prev) => [atualizado, ...prev]);
          } else {
            setObjetivos((prev) => prev.map((item) => (item.id === atualizado.id ? atualizado : item)));
          }
          setModalAberto(false);
        }
      } catch (erro) {
        console.error("Erro ao salvar objetivo:", erro);
      }
    };

    salvar();
  };

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
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Planejamento</p>
                <h2 className="text-lg font-bold text-gray-900">Mapa de objetivos financeiros</h2>
                <p className="text-sm text-gray-600">
                  Cadastre metas, períodos e responsáveis para acompanhar a execução.
                </p>
              </div>
              <button type="button" className="button button-primary" onClick={handleNovo}>
                Novo objetivo
              </button>
            </div>

            <div className="mt-4">
              <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((prev) => ({ ...prev, ...novo }))} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {carregando ? (
              <div className="col-span-full text-sm text-gray-600">Carregando objetivos...</div>
            ) : objetivosFiltrados.length === 0 ? (
              <div className="col-span-full text-sm text-gray-600">Nenhum objetivo encontrado.</div>
            ) : (
              objetivosFiltrados.map((objetivo) => (
                <div key={objetivo.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{objetivo.id}</p>
                      <p className="text-base font-bold text-gray-900">{objetivo.titulo}</p>
                      <p className="text-sm text-gray-600">
                        Empresa: {empresa?.nomeFantasia ?? empresa?.cnpj ?? "Empresa ativa"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        objetivo.status === "ativo" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {objetivo.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Período</p>
                      <p className="font-semibold text-gray-900">{objetivo.periodo}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Meta</p>
                      <p className="font-semibold text-gray-900">
                        {objetivo.meta <= 100
                          ? `${objetivo.meta}%`
                          : `R$ ${objetivo.meta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Responsável</p>
                      <p className="font-semibold text-gray-900">{objetivo.responsavel}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Observações</p>
                      <p className="text-gray-700">{objetivo.observacao || "—"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => handleEditar(objetivo)}
                    >
                      Editar objetivo
                    </button>
                    <button
                      type="button"
                      className="button button-primary"
                    >
                      Aplicar metas semanais
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        </main>
      </div>

      <ModalOverlay
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        titulo={modo === "novo" ? "Novo objetivo" : "Editar objetivo"}
      >
        <form className="space-y-3" onSubmit={handleSalvar}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="form-group">
              <label htmlFor="objetivo-titulo">Título</label>
              <input
                id="objetivo-titulo"
                name="titulo"
                defaultValue={selecionado?.titulo}
                required
                className="form-input"
                placeholder="Ex: Receita mensal"
              />
            </div>
            <div className="form-group">
              <label htmlFor="objetivo-empresa">Empresa ativa</label>
              <input
                id="objetivo-empresa"
                value={empresa?.nomeFantasia ?? empresa?.cnpj ?? ""}
                disabled
                className="form-input bg-gray-100 text-gray-700"
              />
            </div>
            <div className="form-group">
              <label htmlFor="objetivo-periodo">Período de medição</label>
              <select
                id="objetivo-periodo"
                name="periodo"
                defaultValue={selecionado?.periodo}
                className="form-input"
              >
                <option value="Mensal">Mensal</option>
                <option value="Trimestral">Trimestral</option>
                <option value="Anual">Anual</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="objetivo-meta">Meta</label>
              <input
                id="objetivo-meta"
                name="meta"
                type="number"
                defaultValue={selecionado?.meta}
                className="form-input"
                placeholder="Valor numérico"
              />
            </div>
            <div className="form-group">
              <label htmlFor="objetivo-responsavel">Responsável</label>
              <input
                id="objetivo-responsavel"
                name="responsavel"
                defaultValue={selecionado?.responsavel}
                className="form-input"
                placeholder="Equipe ou pessoa"
              />
            </div>
            <div className="form-group">
              <label htmlFor="objetivo-status">Status</label>
              <select
                id="objetivo-status"
                name="status"
                defaultValue={selecionado?.status ?? "ativo"}
                className="form-input"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div className="form-group md:col-span-2">
              <label htmlFor="objetivo-observacao">Observações</label>
              <textarea
                id="objetivo-observacao"
                name="observacao"
                defaultValue={selecionado?.observacao}
                className="form-input min-h-[100px]"
                placeholder="Oriente o time sobre como medir, quem atualiza e onde o resultado impacta o DRE"
              />
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
              Salvar alterações
            </button>
          </div>
        </form>
      </ModalOverlay>
    </LayoutShell>
  );
}
