"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";

interface Feriado {
  RH_FERIADO_ID: number;
  FERIADO_DIA: number;
  FERIADO_MES: number;
  FERIADO_DESCRICAO: string;
  FERIADO_ATIVO: number;
}

const NOMES_MESES: Record<number, string> = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
  5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
  9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
};

interface Jornada {
  ID_JORNADA: string;
  ID_EMPRESA: number;
  NOME_JORNADA: string;
  DESCRICAO?: string | null;
  CARGA_SEMANAL_HORAS: number;
  HORA_ENTRADA_MANHA?: string | null;
  HORA_SAIDA_MANHA?: string | null;
  HORA_ENTRADA_TARDE?: string | null;
  HORA_SAIDA_TARDE?: string | null;
  HORA_ENTRADA_INTERVALO?: string | null;
  HORA_SAIDA_INTERVALO?: string | null;
  TOLERANCIA_MINUTOS: number;
  ATIVO: 0 | 1;
  CRIADO_EM?: string;
  ATUALIZADO_EM?: string;
}

function removerAcentosPreservandoEspaco(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizarTextoBasico(valor: string): string {
  const semAcento = removerAcentosPreservandoEspaco(valor ?? "");

  return semAcento.toUpperCase().replace(/[^A-Z0-9 ]/g, "");
}

function normalizarDescricao(valor: string): string {
  const semAcento = removerAcentosPreservandoEspaco(valor ?? "");

  return semAcento.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 100);
}

function formatarCodigoJornada(codigo?: string) {
  if (!codigo) return "JOR-XXX";
  return codigo;
}

function montarResumoHorariosTrabalho(jornada: Jornada) {
  const blocos: string[] = [];

  if (jornada.HORA_ENTRADA_MANHA && jornada.HORA_SAIDA_MANHA) {
    blocos.push(`${jornada.HORA_ENTRADA_MANHA}-${jornada.HORA_SAIDA_MANHA}`);
  }

  if (jornada.HORA_ENTRADA_TARDE && jornada.HORA_SAIDA_TARDE) {
    blocos.push(`${jornada.HORA_ENTRADA_TARDE}-${jornada.HORA_SAIDA_TARDE}`);
  }

  return blocos.join(" / ") || "-";
}

function montarResumoIntervalo(jornada: Jornada) {
  if (jornada.HORA_ENTRADA_INTERVALO && jornada.HORA_SAIDA_INTERVALO) {
    return `${jornada.HORA_ENTRADA_INTERVALO}-${jornada.HORA_SAIDA_INTERVALO}`;
  }

  return "-";
}

export default function JornadaPage() {
  useRequerEmpresaSelecionada();

  const { empresa, carregando } = useEmpresaSelecionada();
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [nomeJornada, setNomeJornada] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cargaSemanal, setCargaSemanal] = useState("");
  const [horaEntradaManha, setHoraEntradaManha] = useState("");
  const [horaSaidaManha, setHoraSaidaManha] = useState("");
  const [horaEntradaTarde, setHoraEntradaTarde] = useState("");
  const [horaSaidaTarde, setHoraSaidaTarde] = useState("");
  const [horaEntradaIntervalo, setHoraEntradaIntervalo] = useState("");
  const [horaSaidaIntervalo, setHoraSaidaIntervalo] = useState("");
  const [toleranciaMinutos, setToleranciaMinutos] = useState("0");
  const [ativo, setAtivo] = useState(true);
  const [jornadaEmEdicao, setJornadaEmEdicao] = useState<Jornada | null>(null);

  // Feriados
  const [modalFeriados, setModalFeriados] = useState(false);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [carregandoFeriados, setCarregandoFeriados] = useState(false);
  const [feriadoDia, setFeriadoDia] = useState("");
  const [feriadoMes, setFeriadoMes] = useState("");
  const [feriadoDescricao, setFeriadoDescricao] = useState("");
  const [salvandoFeriado, setSalvandoFeriado] = useState(false);
  const [confirmarExclusaoFeriado, setConfirmarExclusaoFeriado] = useState<number | null>(null);

  const empresaId = empresa?.id ?? null;

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = {};

    if (empresaId) {
      headers["x-empresa-id"] = String(empresaId);
    }

    return headers;
  }, [empresaId]);

  const carregarFeriados = useCallback(async () => {
    if (!empresaId) return;
    setCarregandoFeriados(true);
    try {
      const resp = await fetch("/api/rh/feriados", { headers: headersPadrao });
      const json = await resp.json();
      if (json?.success) setFeriados(json.data ?? []);
    } catch (err) {
      console.error("Erro ao carregar feriados:", err);
    } finally {
      setCarregandoFeriados(false);
    }
  }, [empresaId, headersPadrao]);

  const salvarFeriado = async () => {
    const dia = Number(feriadoDia);
    const mes = Number(feriadoMes);
    if (!dia || !mes || dia < 1 || dia > 31 || mes < 1 || mes > 12) {
      setNotification({ type: "error", message: "Informe dia e mês válidos." });
      return;
    }
    setSalvandoFeriado(true);
    try {
      const resp = await fetch("/api/rh/feriados", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headersPadrao },
        body: JSON.stringify({ dia, mes, descricao: feriadoDescricao }),
      });
      const json = await resp.json();
      if (json?.success) {
        setNotification({ type: "success", message: "Feriado cadastrado com sucesso." });
        setFeriadoDia("");
        setFeriadoMes("");
        setFeriadoDescricao("");
        await carregarFeriados();
      } else {
        setNotification({ type: "error", message: "Erro ao salvar feriado." });
      }
    } catch (err) {
      console.error(err);
      setNotification({ type: "error", message: "Erro ao salvar feriado." });
    } finally {
      setSalvandoFeriado(false);
    }
  };

  const excluirFeriado = async (id: number) => {
    setConfirmarExclusaoFeriado(null);
    try {
      const resp = await fetch("/api/rh/feriados", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...headersPadrao },
        body: JSON.stringify({ id }),
      });
      const json = await resp.json();
      if (json?.success) {
        setNotification({ type: "success", message: "Feriado excluído com sucesso." });
        await carregarFeriados();
      } else {
        setNotification({ type: "error", message: "Erro ao excluir feriado." });
      }
    } catch (err) {
      console.error(err);
      setNotification({ type: "error", message: "Erro ao excluir feriado." });
    }
  };

  const carregarJornadas = async () => {
    if (!empresaId) return;
    setCarregandoLista(true);
    setErroLista(null);

    try {
      const resposta = await fetch(`/api/rh/jornadas`, {
        headers: headersPadrao,
      });
      const json = await resposta.json();

      if (json?.success) {
        setJornadas(json.data ?? []);
      } else {
        setErroLista("Não foi possível carregar as jornadas.");
      }
    } catch (error) {
      console.error(error);
      setErroLista("Erro ao buscar jornadas.");
    } finally {
      setCarregandoLista(false);
    }
  };

  useEffect(() => {
    if (carregando) return;
    carregarJornadas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, empresaId]);

  const limparFormulario = () => {
    setJornadaEmEdicao(null);
    setNomeJornada("");
    setDescricao("");
    setCargaSemanal("");
    setHoraEntradaManha("");
    setHoraSaidaManha("");
    setHoraEntradaTarde("");
    setHoraSaidaTarde("");
    setHoraEntradaIntervalo("");
    setHoraSaidaIntervalo("");
    setToleranciaMinutos("0");
    setAtivo(true);
  };

  const handleDescricaoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value || "";
    setDescricao(normalizarDescricao(raw));
  };

  const handleToleranciaChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    if (raw === "") {
      setToleranciaMinutos("");
      return;
    }

    const numero = Number(raw);
    if (!Number.isFinite(numero) || numero < 0) {
      setToleranciaMinutos("0");
      return;
    }

    setToleranciaMinutos(String(Math.trunc(numero)));
  };

  const preencherParaEdicao = (jornada: Jornada) => {
    setJornadaEmEdicao(jornada);
    setNomeJornada(normalizarTextoBasico(jornada.NOME_JORNADA ?? ""));
    setDescricao(normalizarDescricao(jornada.DESCRICAO ?? ""));
    setCargaSemanal(String(jornada.CARGA_SEMANAL_HORAS ?? ""));
    setHoraEntradaManha(jornada.HORA_ENTRADA_MANHA ?? "");
    setHoraSaidaManha(jornada.HORA_SAIDA_MANHA ?? "");
    setHoraEntradaTarde(jornada.HORA_ENTRADA_TARDE ?? "");
    setHoraSaidaTarde(jornada.HORA_SAIDA_TARDE ?? "");
    setHoraEntradaIntervalo(jornada.HORA_ENTRADA_INTERVALO ?? "");
    setHoraSaidaIntervalo(jornada.HORA_SAIDA_INTERVALO ?? "");
    setToleranciaMinutos(String(jornada.TOLERANCIA_MINUTOS ?? "0"));
    setAtivo(jornada.ATIVO === 1);
  };

  const aoSalvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotification(null);

    if (!empresaId) {
      setNotification({ type: "error", message: "Selecione uma empresa antes de salvar." });
      return;
    }

    const nomeNormalizado = normalizarTextoBasico(nomeJornada);
    const descricaoNormalizada = normalizarDescricao(descricao);
    const cargaNumero = Number(cargaSemanal);

    if (!nomeNormalizado) {
      setNotification({ type: "error", message: "Nome da jornada é obrigatório." });
      return;
    }

    if (!Number.isFinite(cargaNumero) || cargaNumero <= 0) {
      setNotification({ type: "error", message: "Informe uma carga semanal válida." });
      return;
    }

    if (!horaEntradaManha || !horaSaidaManha) {
      setNotification({
        type: "error",
        message: "Entrada e saída da manhã são obrigatórias.",
      });
      return;
    }

    setSalvando(true);

    const tolerancia = Math.max(0, Math.trunc(Number(toleranciaMinutos) || 0));

    const payload = {
      NOME_JORNADA: nomeNormalizado,
      DESCRICAO: descricaoNormalizada,
      CARGA_SEMANAL_HORAS: cargaNumero,
      HORA_ENTRADA_MANHA: horaEntradaManha,
      HORA_SAIDA_MANHA: horaSaidaManha,
      HORA_ENTRADA_TARDE: horaEntradaTarde || null,
      HORA_SAIDA_TARDE: horaSaidaTarde || null,
      HORA_ENTRADA_INTERVALO: horaEntradaIntervalo || null,
      HORA_SAIDA_INTERVALO: horaSaidaIntervalo || null,
      TOLERANCIA_MINUTOS: tolerancia,
      ATIVO: ativo ? 1 : 0,
    };

    const editando = Boolean(jornadaEmEdicao?.ID_JORNADA);
    const url = editando
      ? `/api/rh/jornadas?id=${encodeURIComponent(jornadaEmEdicao?.ID_JORNADA ?? "")}`
      : "/api/rh/jornadas";
    const method = editando ? "PUT" : "POST";

    try {
      const resposta = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headersPadrao,
        },
        body: JSON.stringify(payload),
      });

      const json = await resposta.json();

      if ((resposta.status === 201 || resposta.status === 200) && json?.success) {
        setNotification({
          type: "success",
          message: editando
            ? "Jornada atualizada com sucesso."
            : "Jornada criada com sucesso.",
        });
        await carregarJornadas();
        limparFormulario();
      } else if (
        resposta.status === 400 &&
        (json?.error === "NOME_JORNADA_OBRIGATORIO" ||
          json?.error === "CARGA_SEMANAL_INVALIDA" ||
          json?.error === "HORARIO_OBRIGATORIO")
      ) {
        setNotification({
          type: "error",
          message: json?.error === "NOME_JORNADA_OBRIGATORIO"
            ? "Informe o nome da jornada."
            : json?.error === "CARGA_SEMANAL_INVALIDA"
              ? "Informe uma carga semanal válida."
              : "Preencha os horários obrigatórios.",
        });
      } else {
        setNotification({
          type: "error",
          message: "Não foi possível salvar os dados. Tente novamente.",
        });
      }
    } catch (error) {
      console.error(error);
      setNotification({
        type: "error",
        message: "Erro ao se conectar com o servidor.",
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="CAD004_RH_JORNADA"
          nomeTela="CADASTRO DE JORNADA"
          caminhoRota="/rh/jornada"
          modulo="RH"
        />

        <PaginaProtegida codigoTela="CAD004_RH_JORNADA">
        <main className="page-content-card">
          {notification && (
            <NotificationBar type={notification.type} message={notification.message} />
          )}

          <div className="departamentos-page">
            <section className="panel">
              <header className="form-section-header">
                <h2>{jornadaEmEdicao ? "Editar jornada" : "Nova jornada"}</h2>
                <p>
                  {jornadaEmEdicao
                    ? "Atualize os dados da jornada selecionada."
                    : "Informe os dados da jornada de trabalho para salvar."}
                </p>
              </header>

              <form className="form" onSubmit={aoSalvar}>
                <div className="form-grid three-columns jornadas-grid">
                  <div className="form-group">
                    <label htmlFor="codigoJornada">Código</label>
                    <input
                      id="codigoJornada"
                      name="codigoJornada"
                      className="form-input"
                      placeholder="JOR-XXX"
                      value={formatarCodigoJornada(jornadaEmEdicao?.ID_JORNADA)}
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="nomeJornada">Nome da jornada *</label>
                    <input
                      id="nomeJornada"
                      name="nomeJornada"
                      className="form-input"
                      value={nomeJornada}
                      placeholder="Nome da jornada"
                      onChange={(e) => setNomeJornada(normalizarTextoBasico(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="cargaSemanal">Carga semanal (horas) *</label>
                    <input
                      id="cargaSemanal"
                      name="cargaSemanal"
                      className="form-input"
                      type="number"
                      min={1}
                      value={cargaSemanal}
                      placeholder="Ex.: 44"
                      onChange={(e) => setCargaSemanal(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid single-column">
                  <div className="form-group">
                    <label htmlFor="descricaoJornada">Descrição (máx. 100 caracteres)</label>
                    <input
                      id="descricaoJornada"
                      name="descricaoJornada"
                      className="form-input"
                      value={descricao}
                      placeholder="Descrição"
                      onChange={handleDescricaoChange}
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="horarios-bloco">
                  <h3>Horários</h3>
                  <div className="form-grid horarios-grid">
                    <div className="form-group">
                      <label htmlFor="horaEntradaManha">Entrada manhã *</label>
                      <input
                        id="horaEntradaManha"
                        name="horaEntradaManha"
                        className="form-input w-20 text-center px-1 py-1 text-sm"
                        type="time"
                        value={horaEntradaManha}
                        onChange={(e) => setHoraEntradaManha(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="horaSaidaManha">Saída manhã *</label>
                      <input
                        id="horaSaidaManha"
                        name="horaSaidaManha"
                        className="form-input w-20 text-center px-1 py-1 text-sm"
                        type="time"
                        value={horaSaidaManha}
                        onChange={(e) => setHoraSaidaManha(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="horaEntradaTarde">Entrada tarde</label>
                      <input
                        id="horaEntradaTarde"
                        name="horaEntradaTarde"
                        className="form-input w-20 text-center px-1 py-1 text-sm"
                        type="time"
                        value={horaEntradaTarde}
                        onChange={(e) => setHoraEntradaTarde(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="horaSaidaTarde">Saída tarde</label>
                      <input
                        id="horaSaidaTarde"
                        name="horaSaidaTarde"
                        className="form-input w-20 text-center px-1 py-1 text-sm"
                        type="time"
                        value={horaSaidaTarde}
                        onChange={(e) => setHoraSaidaTarde(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="horaEntradaIntervalo">Entrada intervalo</label>
                      <input
                        id="horaEntradaIntervalo"
                        name="horaEntradaIntervalo"
                        className="form-input w-20 text-center px-1 py-1 text-sm"
                        type="time"
                        value={horaEntradaIntervalo}
                        onChange={(e) => setHoraEntradaIntervalo(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="horaSaidaIntervalo">Saída intervalo</label>
                      <input
                        id="horaSaidaIntervalo"
                        name="horaSaidaIntervalo"
                        className="form-input w-20 text-center px-1 py-1 text-sm"
                        type="time"
                        value={horaSaidaIntervalo}
                        onChange={(e) => setHoraSaidaIntervalo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-grid single-column">
                    <div className="form-group">
                    <label htmlFor="toleranciaMinutos">TOLERANCIA (MIN)</label>
                    <input
                      id="toleranciaMinutos"
                      name="toleranciaMinutos"
                      className="form-input w-24"
                      type="number"
                      min={0}
                      value={toleranciaMinutos}
                      onChange={handleToleranciaChange}
                    />
                      <p className="helper-text">
                        Desconsidere diferenças diárias dentro desse limite ao apurar horas
                        extras ou faltas.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="form-actions departamentos-actions">
                  <label className="checkbox-row" htmlFor="jornadaAtiva">
                    <input
                      type="checkbox"
                      id="jornadaAtiva"
                      name="ativo"
                      checked={ativo}
                      onChange={(e) => setAtivo(e.target.checked)}
                    />
                    <span>Ativa</span>
                  </label>

                  <div className="button-row">
                    <button type="submit" className="button button-primary" disabled={salvando}>
                      {salvando ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={limparFormulario}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>
            </section>

            <section className="panel">
              <div className="form-actions" style={{ marginBottom: 16 }}>
                <header className="form-section-header" style={{ marginBottom: 0, flex: 1 }}>
                  <h2>Jornadas cadastradas</h2>
                  <p>Visualize e selecione uma jornada para editar.</p>
                </header>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => { setModalFeriados(true); carregarFeriados(); }}
                >
                  Gerenciar Feriados
                </button>
              </div>

              {carregandoLista && <p>Carregando jornadas...</p>}
              {erroLista && <p className="error-text">{erroLista}</p>}

              {!carregandoLista && !erroLista && jornadas.length === 0 && (
                <p className="helper-text">Nenhuma jornada cadastrada.</p>
              )}

              {!carregandoLista && !erroLista && jornadas.length > 0 && (
                <table className="data-table mobile-cards">
                  <thead>
                    <tr>
                      <th>CÓDIGO</th>
                      <th>NOME</th>
                      <th>CARGA (H)</th>
                      <th>HORÁRIOS</th>
                      <th>INTERVALO</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: "right" }}>AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jornadas.map((jornada) => (
                      <tr key={jornada.ID_JORNADA}>
                        <td data-label="Código">{formatarCodigoJornada(jornada.ID_JORNADA)}</td>
                        <td data-label="Nome" style={{ fontWeight: 600 }}>{jornada.NOME_JORNADA}</td>
                        <td data-label="Carga">{jornada.CARGA_SEMANAL_HORAS}h</td>
                        <td data-label="Horários">{montarResumoHorariosTrabalho(jornada)}</td>
                        <td data-label="Intervalo">{montarResumoIntervalo(jornada)}</td>
                        <td data-label="Status">
                          <span
                            className={
                              jornada.ATIVO === 1 ? "badge badge-success" : "badge badge-danger"
                            }
                          >
                            {jornada.ATIVO === 1 ? "ATIVO" : "INATIVO"}
                          </span>
                        </td>
                        <td data-label="">
                          <button
                            type="button"
                            className="button button-secondary button-compact"
                            onClick={() => preencherParaEdicao(jornada)}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </main>
        </PaginaProtegida>
      </div>
      {/* Modal de Feriados */}
      {modalFeriados && (
        <div className="modal-overlay" onClick={() => setModalFeriados(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: "none" }}>
            <div className="form-actions" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Feriados Cadastrados</h3>
              <button
                type="button"
                className="button button-secondary button-compact"
                onClick={() => setModalFeriados(false)}
              >
                Fechar
              </button>
            </div>

            {/* Form para novo feriado */}
            <div className="detail-card" style={{ marginBottom: 16 }}>
              <p className="detail-label">Novo feriado</p>
              <div className="form-grid feriado-novo-grid" style={{ gridTemplateColumns: "80px 1fr 1fr", gap: 12, alignItems: "flex-end" }}>
                <div className="form-group">
                  <label htmlFor="feriadoDia">Dia *</label>
                  <input
                    id="feriadoDia"
                    type="number"
                    min={1}
                    max={31}
                    className="form-input"
                    value={feriadoDia}
                    onChange={(e) => setFeriadoDia(e.target.value)}
                    placeholder="01"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="feriadoMes">Mês *</label>
                  <select
                    id="feriadoMes"
                    className="form-input"
                    value={feriadoMes}
                    onChange={(e) => setFeriadoMes(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {Object.entries(NOMES_MESES).map(([num, nome]) => (
                      <option key={num} value={num}>{nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="feriadoDesc">Descrição</label>
                  <input
                    id="feriadoDesc"
                    className="form-input"
                    value={feriadoDescricao}
                    onChange={(e) => setFeriadoDescricao(e.target.value)}
                    placeholder="Ex: Confraternização Universal"
                  />
                </div>
              </div>
              <div className="button-row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={salvarFeriado}
                  disabled={salvandoFeriado}
                >
                  {salvandoFeriado ? "Salvando..." : "Adicionar Feriado"}
                </button>
              </div>
            </div>

            {/* Lista de feriados */}
            {carregandoFeriados ? (
              <p className="helper-text">Carregando feriados...</p>
            ) : feriados.length === 0 ? (
              <div className="empty-state">
                <strong>Nenhum feriado cadastrado</strong>
                <p>Cadastre os feriados para que sejam considerados no cálculo do ponto.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>DIA</th>
                    <th style={{ width: 100 }}>MÊS</th>
                    <th>DESCRIÇÃO</th>
                    <th style={{ width: 70, textAlign: "right" }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {feriados.map((f) => (
                    <tr key={f.RH_FERIADO_ID}>
                      <td>{String(f.FERIADO_DIA).padStart(2, "0")}</td>
                      <td>{NOMES_MESES[f.FERIADO_MES] ?? f.FERIADO_MES}</td>
                      <td>{f.FERIADO_DESCRICAO || "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="button button-secondary button-compact"
                          style={{ color: "#dc2626" }}
                          onClick={() => setConfirmarExclusaoFeriado(f.RH_FERIADO_ID)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão de feriado */}
      {confirmarExclusaoFeriado !== null && (
        <div className="modal-overlay" onClick={() => setConfirmarExclusaoFeriado(null)} style={{ zIndex: 60 }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", fontWeight: 700 }}>Excluir feriado</h3>
            <p style={{ margin: "0 0 24px", fontSize: "0.95rem", color: "#374151" }}>
              Tem certeza que deseja excluir este feriado?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setConfirmarExclusaoFeriado(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button button-primary"
                style={{ backgroundColor: "#dc2626" }}
                onClick={() => excluirFeriado(confirmarExclusaoFeriado)}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
