"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import React, { useEffect, useMemo, useState } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { ModalOverlay } from "../_components/financeiro-layout";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

type ObjetivoSemanal = {
  id: string;
  objetivoId: string;
  objetivo: string;
  semana: string;
  metaSemanal: number;
  responsavel: string;
  status: "pendente" | "andamento" | "concluido";
  observacao?: string;
};

type ObjetivoOption = {
  id: string;
  titulo: string;
};

export default function ObjetivosSemanaisPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/objetivos-semanais";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_OBJETIVOS_SEMANAIS";
  const nomeTela = tela?.NOME_TELA ?? "Objetivos Semanais";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [filtroObjetivo, setFiltroObjetivo] = useState<string>("");
  const [itens, setItens] = useState<ObjetivoSemanal[]>([]);
  const [objetivos, setObjetivos] = useState<ObjetivoOption[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<ObjetivoSemanal | null>(null);
  const [modo, setModo] = useState<"novo" | "editar">("novo");
  const [carregando, setCarregando] = useState(true);
  const podeCriar = objetivos.length > 0;

  useEffect(() => {
    if (!empresa?.id) return;

    const carregarDados = async () => {
      try {
        setCarregando(true);
        const [objetivosResposta, semanasResposta] = await Promise.all([
          fetch("/api/financeiro/objetivos", {
            headers: { "x-empresa-id": String(empresa.id) },
          }),
          fetch("/api/financeiro/objetivos-semanais", {
            headers: { "x-empresa-id": String(empresa.id) },
          }),
        ]);

        if (objetivosResposta.ok) {
          const objetivosJson = await objetivosResposta.json();
          if (objetivosJson.success) {
            setObjetivos(
              (objetivosJson.data ?? []).map((item: any) => ({
                id: String(item.id),
                titulo: item.titulo,
              }))
            );
          }
        }

        if (semanasResposta.ok) {
          const semanasJson = await semanasResposta.json();
          if (semanasJson.success) {
            setItens(semanasJson.data ?? []);
          }
        }
      } catch (erro) {
        console.error("Erro ao carregar objetivos semanais:", erro);
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();
  }, [empresa?.id]);

  const itensFiltrados = useMemo(() => {
    const busca = filtroObjetivo.trim().toLowerCase();
    if (!busca) return itens;
    return itens.filter((item) => item.objetivo.toLowerCase().includes(busca));
  }, [filtroObjetivo, itens]);

  const handleNovo = () => {
    setModo("novo");
    setSelecionado(null);
    setModalAberto(true);
  };

  const handleEditar = (item: ObjetivoSemanal) => {
    setSelecionado(item);
    setModo("editar");
    setModalAberto(true);
  };

  const handleSalvar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      id: selecionado?.id,
      objetivoId: (form.get("objetivoId") as string) ?? "",
      semana: (form.get("semana") as string) ?? "",
      metaSemanal: Number(form.get("metaSemanal")) || 0,
      responsavel: (form.get("responsavel") as string) ?? "",
      status: (form.get("status") as ObjetivoSemanal["status"]) ?? "pendente",
      observacao: (form.get("observacao") as string) ?? "",
    };

    const salvar = async () => {
      try {
        const resposta = await fetch("/api/financeiro/objetivos-semanais", {
          method: modo === "novo" ? "POST" : "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-empresa-id": String(empresa?.id ?? ""),
          },
          body: JSON.stringify(payload),
        });

        const json = await resposta.json();
        if (resposta.ok && json.success) {
          const atualizado = json.data as ObjetivoSemanal;
          if (modo === "novo") {
            setItens((prev) => [atualizado, ...prev]);
          } else {
            setItens((prev) => prev.map((item) => (item.id === atualizado.id ? atualizado : item)));
          }
          setModalAberto(false);
        }
      } catch (erro) {
        console.error("Erro ao salvar objetivo semanal:", erro);
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
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filtrar por objetivo</p>
                <h2 className="text-lg font-bold text-gray-900">Roadmap semanal</h2>
                <p className="text-sm text-gray-600">Planeje entregas semanais alinhadas ao plano financeiro.</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="form-group">
                  <label htmlFor="objetivo-filtro">Buscar objetivo</label>
                  <input
                    id="objetivo-filtro"
                    type="text"
                    value={filtroObjetivo}
                    onChange={(e) => setFiltroObjetivo(e.target.value)}
                    className="form-input"
                    placeholder="Busque pelo nome do objetivo"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleNovo}
                  disabled={!podeCriar}
                  className="button button-primary"
                >
                  Nova semana
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {carregando ? (
                <div className="col-span-full text-sm text-gray-600">Carregando semanas...</div>
              ) : itensFiltrados.length === 0 ? (
                <div className="col-span-full text-sm text-gray-600">
                  {podeCriar ? "Nenhuma semana encontrada." : "Cadastre um objetivo financeiro antes de planejar semanas."}
                </div>
              ) : (
                itensFiltrados.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.semana}</p>
                        <p className="text-sm font-bold text-gray-900">{item.objetivo}</p>
                        <p className="text-xs text-gray-600">Responsável: {item.responsavel}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          item.status === "concluido"
                            ? "bg-green-100 text-green-700"
                            : item.status === "andamento"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {item.status === "concluido" ? "Concluído" : item.status === "andamento" ? "Em andamento" : "Pendente"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                      <div>
                        <p className="uppercase tracking-wide text-gray-500">Meta semanal</p>
                        <p className="font-semibold text-gray-900">
                          {item.metaSemanal <= 100
                            ? `${item.metaSemanal}%`
                            : `R$ ${item.metaSemanal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wide text-gray-500">Observações</p>
                        <p className="text-gray-800">{item.observacao || "—"}</p>
                      </div>
                    </div>
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
                        Atualizar status
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>

      <ModalOverlay
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        titulo={modo === "novo" ? "Novo planejamento semanal" : "Editar planejamento semanal"}
      >
        <form className="space-y-3" onSubmit={handleSalvar}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="form-group">
              <label htmlFor="semanal-objetivo">Objetivo</label>
              <select
                id="semanal-objetivo"
                name="objetivoId"
                defaultValue={selecionado?.objetivoId ?? ""}
                required
                className="form-input"
              >
                <option value="">Selecione</option>
                {objetivos.map((objetivo) => (
                  <option key={objetivo.id} value={objetivo.id}>
                    {objetivo.titulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="semanal-semana">Semana</label>
              <select
                id="semanal-semana"
                name="semana"
                defaultValue={selecionado?.semana}
                className="form-input"
              >
                <option>Semana 1</option>
                <option>Semana 2</option>
                <option>Semana 3</option>
                <option>Semana 4</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="semanal-meta">Meta semanal</label>
              <input
                id="semanal-meta"
                name="metaSemanal"
                type="number"
                defaultValue={selecionado?.metaSemanal}
                className="form-input"
                placeholder="Valor ou percentual"
              />
            </div>
            <div className="form-group">
              <label htmlFor="semanal-responsavel">Responsável</label>
              <input
                id="semanal-responsavel"
                name="responsavel"
                defaultValue={selecionado?.responsavel}
                className="form-input"
                placeholder="Equipe ou pessoa"
              />
            </div>
            <div className="form-group">
              <label htmlFor="semanal-status">Status</label>
              <select
                id="semanal-status"
                name="status"
                defaultValue={selecionado?.status ?? "pendente"}
                className="form-input"
              >
                <option value="pendente">Pendente</option>
                <option value="andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
            <div className="form-group md:col-span-2">
              <label htmlFor="semanal-observacao">Observações</label>
              <textarea
                id="semanal-observacao"
                name="observacao"
                defaultValue={selecionado?.observacao}
                className="form-input min-h-[80px]"
                placeholder="Alinhe dependências, entregáveis e impactos no caixa"
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
              Salvar semana
            </button>
          </div>
        </form>
      </ModalOverlay>
    </LayoutShell>
  );
}
