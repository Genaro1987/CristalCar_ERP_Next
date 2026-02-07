"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
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
  const nomeTela = tela?.NOME_TELA ?? "OBJETIVOS SEMANAIS";
  const moduloTela = tela?.MODULO ?? "OBJETIVOS";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [filtroObjetivo, setFiltroObjetivo] = useState("");
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
        // First load objectives (parent records)
        const objetivosResposta = await fetch("/api/financeiro/objetivos", {
          headers: { "x-empresa-id": String(empresa.id) },
        });

        let objetivosCadastrados: ObjetivoOption[] = [];
        if (objetivosResposta.ok) {
          const objetivosJson = await objetivosResposta.json();
          if (objetivosJson.success) {
            objetivosCadastrados = (objetivosJson.data ?? []).map((item: any) => ({
              id: String(item.id),
              titulo: item.titulo,
            }));
            setObjetivos(objetivosCadastrados);
          }
        }

        // Only load weekly objectives if there are registered objectives
        if (objetivosCadastrados.length > 0) {
          const semanasResposta = await fetch("/api/financeiro/objetivos-semanais", {
            headers: { "x-empresa-id": String(empresa.id) },
          });

          if (semanasResposta.ok) {
            const semanasJson = await semanasResposta.json();
            if (semanasJson.success) {
              setItens(semanasJson.data ?? []);
            }
          }
        } else {
          setItens([]);
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

  const statusLabel = (s: string) => {
    if (s === "concluido") return "Concluido";
    if (s === "andamento") return "Em andamento";
    return "Pendente";
  };

  const statusColor = (s: string) => {
    if (s === "concluido") return { bg: "#d1fae5", color: "#065f46" };
    if (s === "andamento") return { bg: "#ffedd5", color: "#9a3412" };
    return { bg: "#f3f4f6", color: "#374151" };
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

        <PaginaProtegida codigoTela={codigoTela}>
        <main className="page-content-card">
          <section className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
                  Planeje entregas semanais alinhadas ao plano financeiro.
                  {!podeCriar && !carregando && (
                    <span style={{ color: "#dc2626", marginLeft: 8 }}>
                      Cadastre um objetivo financeiro primeiro.
                    </span>
                  )}
                </p>
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

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
              <div className="form-group" style={{ maxWidth: 300 }}>
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
            </div>
          </section>

          <section className="panel" style={{ marginTop: 16 }}>
            {carregando ? (
              <div className="empty-state">Carregando semanas...</div>
            ) : !podeCriar ? (
              <div className="empty-state">
                Nenhum objetivo financeiro cadastrado. Acesse &quot;Objetivos Financeiros&quot; para cadastrar objetivos antes de planejar semanas.
              </div>
            ) : itensFiltrados.length === 0 ? (
              <div className="empty-state">
                Nenhuma semana encontrada. Clique em &quot;Nova semana&quot; para criar.
              </div>
            ) : (
              <table className="data-table mobile-cards">
                <thead>
                  <tr>
                    <th>Semana</th>
                    <th>Objetivo</th>
                    <th>Responsavel</th>
                    <th style={{ textAlign: "right" }}>Meta</th>
                    <th>Status</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map((item) => {
                    const sc = statusColor(item.status);
                    return (
                      <tr key={item.id}>
                        <td data-label="Semana" style={{ fontWeight: 600 }}>{item.semana}</td>
                        <td data-label="Objetivo">{item.objetivo}</td>
                        <td data-label="Responsavel">{item.responsavel}</td>
                        <td data-label="Meta">
                          {item.metaSemanal <= 100
                            ? `${item.metaSemanal}%`
                            : item.metaSemanal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td data-label="Status">
                          <span className="badge" style={{ backgroundColor: sc.bg, color: sc.color }}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td data-label="">
                          <button
                            type="button"
                            className="button button-secondary button-compact"
                            onClick={() => handleEditar(item)}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </main>
        </PaginaProtegida>
      </div>

      <ModalOverlay
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        titulo={modo === "novo" ? "Novo planejamento semanal" : "Editar planejamento semanal"}
      >
        <form className="form-grid two-columns" onSubmit={handleSalvar}>
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
            <label htmlFor="semanal-responsavel">Responsavel</label>
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
              <option value="concluido">Concluido</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="semanal-observacao">Observacoes</label>
            <textarea
              id="semanal-observacao"
              name="observacao"
              defaultValue={selecionado?.observacao}
              className="form-input"
              style={{ minHeight: 80 }}
              placeholder="Alinhe dependencias, entregaveis e impactos no caixa"
            />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setModalAberto(false)} className="button button-secondary">
              Cancelar
            </button>
            <button type="submit" className="button button-primary">
              Salvar semana
            </button>
          </div>
        </form>
      </ModalOverlay>
    </LayoutShell>
  );
}
