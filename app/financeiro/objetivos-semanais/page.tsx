"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  tipoPeriodo: string | null;
  refPeriodo: string | null;
  valorTotal: number;
  meta: number;
};

type SemanaInfo = {
  label: string;
  inicio: string;
  fim: string;
  dias: number;
};

function calcularSemanas(tipoPeriodo: string | null, refPeriodo: string | null): SemanaInfo[] {
  if (!tipoPeriodo || !refPeriodo) return [];

  let dataInicio: Date;
  let dataFim: Date;

  if (tipoPeriodo === "mensal") {
    // refPeriodo = "2026-01"
    const partes = refPeriodo.split("-");
    const ano = Number(partes[0]);
    const mes = Number(partes[1]);
    dataInicio = new Date(ano, mes - 1, 1);
    dataFim = new Date(ano, mes, 0);
  } else if (tipoPeriodo === "trimestral") {
    // refPeriodo = "2026-T1" etc
    const partes = refPeriodo.split("-T");
    const ano = Number(partes[0]);
    const trimestre = Number(partes[1]);
    const mesInicio = (trimestre - 1) * 3;
    dataInicio = new Date(ano, mesInicio, 1);
    dataFim = new Date(ano, mesInicio + 3, 0);
  } else if (tipoPeriodo === "semestral") {
    // refPeriodo = "2026-S1" etc
    const partes = refPeriodo.split("-S");
    const ano = Number(partes[0]);
    const semestre = Number(partes[1]);
    const mesInicio = (semestre - 1) * 6;
    dataInicio = new Date(ano, mesInicio, 1);
    dataFim = new Date(ano, mesInicio + 6, 0);
  } else {
    // anual - refPeriodo = "2026"
    const ano = Number(refPeriodo);
    dataInicio = new Date(ano, 0, 1);
    dataFim = new Date(ano, 11, 31);
  }

  const semanas: SemanaInfo[] = [];
  const cursor = new Date(dataInicio);

  // Advance to the first Monday
  while (cursor.getDay() !== 1 && cursor <= dataFim) {
    cursor.setDate(cursor.getDate() + 1);
  }

  let numSemana = 1;
  while (cursor <= dataFim) {
    const seg = new Date(cursor);
    const sex = new Date(cursor);
    sex.setDate(sex.getDate() + 4); // Monday + 4 = Friday

    // If Friday is beyond end of period, cap it
    const fimReal = sex > dataFim ? dataFim : sex;
    const diasUteis = Math.min(5, Math.floor((fimReal.getTime() - seg.getTime()) / 86400000) + 1);

    const formatarData = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return dd + "/" + mm;
    };

    semanas.push({
      label: "Sem " + numSemana + " (" + formatarData(seg) + " - " + formatarData(fimReal) + ")",
      inicio: seg.toISOString().slice(0, 10),
      fim: fimReal.toISOString().slice(0, 10),
      dias: diasUteis,
    });

    numSemana++;
    cursor.setDate(cursor.getDate() + 7); // Next Monday
  }

  return semanas;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ObjetivosSemanaisPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/objetivos-semanais";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_OBJETIVOS_SEMANAIS";
  const nomeTela = tela?.NOME_TELA ?? "OBJETIVOS SEMANAIS";
  const moduloTela = tela?.MODULO ?? "OBJETIVOS";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [itens, setItens] = useState<ObjetivoSemanal[]>([]);
  const [objetivos, setObjetivos] = useState<ObjetivoOption[]>([]);
  const [objetivoSelecionadoId, setObjetivoSelecionadoId] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<ObjetivoSemanal | null>(null);
  const [modo, setModo] = useState<"novo" | "editar">("novo");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [distribuicaoAberta, setDistribuicaoAberta] = useState(false);
  const [valoresSemana, setValoresSemana] = useState<Record<string, number>>({});

  const objetivoAtual = useMemo(
    () => objetivos.find((o) => o.id === objetivoSelecionadoId) || null,
    [objetivos, objetivoSelecionadoId]
  );

  const semanas = useMemo(
    () => (objetivoAtual ? calcularSemanas(objetivoAtual.tipoPeriodo, objetivoAtual.refPeriodo) : []),
    [objetivoAtual]
  );

  const itensFiltrados = useMemo(() => {
    if (!objetivoSelecionadoId) return itens;
    return itens.filter((item) => item.objetivoId === objetivoSelecionadoId);
  }, [itens, objetivoSelecionadoId]);

  const totalDistribuido = useMemo(() => {
    return itensFiltrados.reduce((acc, item) => acc + item.metaSemanal, 0);
  }, [itensFiltrados]);

  const carregarDados = useCallback(async () => {
    if (!empresa?.id) return;
    try {
      setCarregando(true);
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
            tipoPeriodo: item.tipoPeriodo || null,
            refPeriodo: item.refPeriodo || null,
            valorTotal: Number(item.valorTotal ?? item.meta ?? 0),
            meta: Number(item.meta ?? 0),
          }));
          setObjetivos(objetivosCadastrados);
          if (objetivosCadastrados.length > 0 && !objetivoSelecionadoId) {
            setObjetivoSelecionadoId(objetivosCadastrados[0].id);
          }
        }
      }

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
  }, [empresa?.id, objetivoSelecionadoId]);

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id]);

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

  const handleAbrirDistribuicao = () => {
    if (!objetivoAtual || semanas.length === 0) return;
    const valorPorSemana = objetivoAtual.valorTotal / semanas.length;
    const valores: Record<string, number> = {};
    for (let i = 0; i < semanas.length; i++) {
      const sem = semanas[i];
      const existente = itensFiltrados.find((it) => it.semana === sem.label);
      valores[sem.label] = existente ? existente.metaSemanal : Math.round(valorPorSemana * 100) / 100;
    }
    setValoresSemana(valores);
    setDistribuicaoAberta(true);
  };

  const handleSalvarDistribuicao = async () => {
    if (!objetivoAtual || !empresa?.id) return;
    setSalvando(true);
    try {
      for (let i = 0; i < semanas.length; i++) {
        const sem = semanas[i];
        const valor = valoresSemana[sem.label] ?? 0;
        const existente = itensFiltrados.find((it) => it.semana === sem.label);

        if (existente) {
          await fetch("/api/financeiro/objetivos-semanais", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-empresa-id": String(empresa.id),
            },
            body: JSON.stringify({
              id: existente.id,
              objetivoId: objetivoAtual.id,
              semana: sem.label,
              metaSemanal: valor,
              responsavel: existente.responsavel,
              status: existente.status,
              observacao: existente.observacao || "",
            }),
          });
        } else {
          await fetch("/api/financeiro/objetivos-semanais", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-empresa-id": String(empresa.id),
            },
            body: JSON.stringify({
              objetivoId: objetivoAtual.id,
              semana: sem.label,
              metaSemanal: valor,
              responsavel: "",
              status: "pendente",
              observacao: "",
            }),
          });
        }
      }
      setDistribuicaoAberta(false);
      await carregarDados();
    } catch (erro) {
      console.error("Erro ao salvar distribuicao:", erro);
    } finally {
      setSalvando(false);
    }
  };

  const totalDistribuicao = useMemo(() => {
    let soma = 0;
    const keys = Object.keys(valoresSemana);
    for (let i = 0; i < keys.length; i++) {
      soma += valoresSemana[keys[i]] || 0;
    }
    return soma;
  }, [valoresSemana]);

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

  const podeCriar = objetivos.length > 0;

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
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
                  Distribua os objetivos financeiros em metas semanais (Segunda a Sexta).
                  {!podeCriar && !carregando && (
                    <span style={{ color: "#dc2626", marginLeft: 8 }}>
                      Cadastre um objetivo financeiro primeiro.
                    </span>
                  )}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {objetivoAtual && semanas.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAbrirDistribuicao}
                    className="button button-secondary"
                  >
                    Distribuir automatico
                  </button>
                )}
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

            {podeCriar && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div className="form-group" style={{ maxWidth: 400, flex: 1 }}>
                  <label htmlFor="objetivo-select">Objetivo financeiro</label>
                  <select
                    id="objetivo-select"
                    value={objetivoSelecionadoId}
                    onChange={(e) => setObjetivoSelecionadoId(e.target.value)}
                    className="form-input"
                  >
                    {objetivos.map((obj) => (
                      <option key={obj.id} value={obj.id}>
                        {obj.titulo} {obj.valorTotal > 0 ? "(" + formatarMoeda(obj.valorTotal) + ")" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {objetivoAtual && objetivoAtual.valorTotal > 0 && (
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", paddingBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Valor total</span>
                      <div style={{ fontWeight: 700, color: "#1e40af", fontSize: "1.05rem" }}>
                        {formatarMoeda(objetivoAtual.valorTotal)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Distribuido</span>
                      <div style={{ fontWeight: 700, color: totalDistribuido >= objetivoAtual.valorTotal * 0.99 ? "#059669" : "#dc2626", fontSize: "1.05rem" }}>
                        {formatarMoeda(totalDistribuido)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Semanas</span>
                      <div style={{ fontWeight: 700, color: "#374151", fontSize: "1.05rem" }}>
                        {semanas.length}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                Nenhuma semana encontrada.
                {semanas.length > 0
                  ? " Clique em \"Distribuir automatico\" para gerar as semanas do periodo."
                  : " Clique em \"Nova semana\" para criar."}
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
                        <td data-label="Responsavel">{item.responsavel || "-"}</td>
                        <td data-label="Meta" style={{ textAlign: "right", fontWeight: 600 }}>
                          {formatarMoeda(item.metaSemanal)}
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
                {objetivoAtual && objetivoAtual.valorTotal > 0 && (
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={3} style={{ textAlign: "right" }}>Total distribuido:</td>
                      <td style={{ textAlign: "right", color: totalDistribuido >= objetivoAtual.valorTotal * 0.99 ? "#059669" : "#dc2626" }}>
                        {formatarMoeda(totalDistribuido)}
                      </td>
                      <td colSpan={2} style={{ color: "#6b7280" }}>
                        de {formatarMoeda(objetivoAtual.valorTotal)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </section>
        </main>
        </PaginaProtegida>
      </div>

      {/* Modal: Nova/Editar semana individual */}
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
              defaultValue={selecionado?.objetivoId ?? objetivoSelecionadoId}
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
            {semanas.length > 0 ? (
              <select
                id="semanal-semana"
                name="semana"
                defaultValue={selecionado?.semana}
                className="form-input"
              >
                {semanas.map((sem) => (
                  <option key={sem.label} value={sem.label}>
                    {sem.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="semanal-semana"
                name="semana"
                defaultValue={selecionado?.semana}
                className="form-input"
                placeholder="Ex: Semana 1"
              />
            )}
          </div>
          <div className="form-group">
            <label htmlFor="semanal-meta">Meta semanal (R$)</label>
            <input
              id="semanal-meta"
              name="metaSemanal"
              type="number"
              step="0.01"
              defaultValue={selecionado?.metaSemanal}
              className="form-input"
              placeholder="Valor da meta"
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

      {/* Modal: Distribuicao automatica */}
      <ModalOverlay
        aberto={distribuicaoAberta}
        onClose={() => setDistribuicaoAberta(false)}
        titulo={"Distribuir objetivo nas semanas"}
      >
        <div>
          {objetivoAtual && (
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#f0f9ff", borderRadius: 8, border: "1px solid #bae6fd" }}>
              <div style={{ fontWeight: 700, color: "#1e40af" }}>{objetivoAtual.titulo}</div>
              <div style={{ color: "#6b7280", fontSize: "0.85rem", marginTop: 4 }}>
                Valor total: <strong>{formatarMoeda(objetivoAtual.valorTotal)}</strong> | {semanas.length} semanas (Seg-Sex)
              </div>
            </div>
          )}

          <table className="data-table" style={{ fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <th>Semana</th>
                <th style={{ textAlign: "right", width: 160 }}>Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {semanas.map((sem) => (
                <tr key={sem.label}>
                  <td style={{ fontWeight: 600 }}>{sem.label}</td>
                  <td style={{ textAlign: "right" }}>
                    <input
                      type="number"
                      step="0.01"
                      value={valoresSemana[sem.label] ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setValoresSemana((prev) => {
                          const novo = {} as Record<string, number>;
                          const keys = Object.keys(prev);
                          for (let i = 0; i < keys.length; i++) {
                            novo[keys[i]] = prev[keys[i]];
                          }
                          novo[sem.label] = val;
                          return novo;
                        });
                      }}
                      className="form-input"
                      style={{ textAlign: "right", maxWidth: 140 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td style={{ textAlign: "right" }}>Total:</td>
                <td style={{ textAlign: "right", color: objetivoAtual && Math.abs(totalDistribuicao - objetivoAtual.valorTotal) < 1 ? "#059669" : "#dc2626" }}>
                  {formatarMoeda(totalDistribuicao)}
                </td>
              </tr>
              {objetivoAtual && Math.abs(totalDistribuicao - objetivoAtual.valorTotal) >= 1 && (
                <tr>
                  <td style={{ textAlign: "right", color: "#6b7280", fontSize: "0.8rem" }}>Diferenca:</td>
                  <td style={{ textAlign: "right", color: "#dc2626", fontSize: "0.8rem" }}>
                    {formatarMoeda(totalDistribuicao - objetivoAtual.valorTotal)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => {
                if (!objetivoAtual || semanas.length === 0) return;
                const valorPorSemana = objetivoAtual.valorTotal / semanas.length;
                const novos: Record<string, number> = {};
                for (let i = 0; i < semanas.length; i++) {
                  novos[semanas[i].label] = Math.round(valorPorSemana * 100) / 100;
                }
                setValoresSemana(novos);
              }}
              className="button button-secondary"
            >
              Distribuir igual
            </button>
            <button type="button" onClick={() => setDistribuicaoAberta(false)} className="button button-secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarDistribuicao}
              disabled={salvando}
              className="button button-primary"
            >
              {salvando ? "Salvando..." : "Salvar distribuicao"}
            </button>
          </div>
        </div>
      </ModalOverlay>
    </LayoutShell>
  );
}
