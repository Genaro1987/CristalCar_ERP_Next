"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

interface Jornada {
  ID_JORNADA: string;
  ID_EMPRESA: number;
  NOME_JORNADA: string;
  DESCRICAO?: string | null;
  CARGA_SEMANAL_HORAS: number;
  HORA_ENTRADA_1?: string | null;
  HORA_SAIDA_1?: string | null;
  HORA_ENTRADA_2?: string | null;
  HORA_SAIDA_2?: string | null;
  HORA_ENTRADA_3?: string | null;
  HORA_SAIDA_3?: string | null;
  ATIVO: 0 | 1;
  CRIADO_EM?: string;
  ATUALIZADO_EM?: string;
}

function normalizarTextoBasico(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .trim();
}

function normalizarDescricao(valor: string): string {
  const semAcento = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const apenasPermitidos = semAcento.replace(/[^A-Z0-9 ]/gi, "");

  return apenasPermitidos.toUpperCase().slice(0, 100).trim();
}

function formatarCodigoJornada(codigo?: string) {
  if (!codigo) return "JOR-XXX";
  return codigo;
}

function montarResumoHorarios(jornada: Jornada) {
  const blocos: string[] = [];

  if (jornada.HORA_ENTRADA_1 && jornada.HORA_SAIDA_1) {
    blocos.push(`${jornada.HORA_ENTRADA_1}-${jornada.HORA_SAIDA_1}`);
  }

  if (jornada.HORA_ENTRADA_2 && jornada.HORA_SAIDA_2) {
    blocos.push(`${jornada.HORA_ENTRADA_2}-${jornada.HORA_SAIDA_2}`);
  }

  if (jornada.HORA_ENTRADA_3 && jornada.HORA_SAIDA_3) {
    blocos.push(`${jornada.HORA_ENTRADA_3}-${jornada.HORA_SAIDA_3}`);
  }

  return blocos.join(" / ") || "-";
}

export default function JornadaPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
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
  const [horaEntrada1, setHoraEntrada1] = useState("");
  const [horaSaida1, setHoraSaida1] = useState("");
  const [horaEntrada2, setHoraEntrada2] = useState("");
  const [horaSaida2, setHoraSaida2] = useState("");
  const [horaEntrada3, setHoraEntrada3] = useState("");
  const [horaSaida3, setHoraSaida3] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [jornadaEmEdicao, setJornadaEmEdicao] = useState<Jornada | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.localStorage.getItem("EMPRESA_ATUAL_ID");
    if (id) {
      const parsed = Number(id);
      if (Number.isFinite(parsed)) {
        setEmpresaId(parsed);
      }
    }
  }, []);

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = {};

    if (empresaId) {
      headers["x-empresa-id"] = String(empresaId);
    }

    return headers;
  }, [empresaId]);

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
    carregarJornadas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const limparFormulario = () => {
    setJornadaEmEdicao(null);
    setNomeJornada("");
    setDescricao("");
    setCargaSemanal("");
    setHoraEntrada1("");
    setHoraSaida1("");
    setHoraEntrada2("");
    setHoraSaida2("");
    setHoraEntrada3("");
    setHoraSaida3("");
    setAtivo(true);
  };

  const handleDescricaoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value || "";

    const semAcento = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const apenasPermitidos = semAcento.replace(/[^A-Z0-9 ]/gi, "");

    const valorFinal = apenasPermitidos.toUpperCase().slice(0, 100);

    setDescricao(valorFinal);
  };

  const preencherParaEdicao = (jornada: Jornada) => {
    setJornadaEmEdicao(jornada);
    setNomeJornada(normalizarTextoBasico(jornada.NOME_JORNADA ?? ""));
    setDescricao(normalizarDescricao(jornada.DESCRICAO ?? ""));
    setCargaSemanal(String(jornada.CARGA_SEMANAL_HORAS ?? ""));
    setHoraEntrada1(jornada.HORA_ENTRADA_1 ?? "");
    setHoraSaida1(jornada.HORA_SAIDA_1 ?? "");
    setHoraEntrada2(jornada.HORA_ENTRADA_2 ?? "");
    setHoraSaida2(jornada.HORA_SAIDA_2 ?? "");
    setHoraEntrada3(jornada.HORA_ENTRADA_3 ?? "");
    setHoraSaida3(jornada.HORA_SAIDA_3 ?? "");
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

    if (!horaEntrada1 || !horaSaida1) {
      setNotification({ type: "error", message: "Entrada e saída 1 são obrigatórias." });
      return;
    }

    setSalvando(true);

    const payload = {
      NOME_JORNADA: nomeNormalizado,
      DESCRICAO: descricaoNormalizada,
      CARGA_SEMANAL_HORAS: cargaNumero,
      HORA_ENTRADA_1: horaEntrada1,
      HORA_SAIDA_1: horaSaida1,
      HORA_ENTRADA_2: horaEntrada2 || null,
      HORA_SAIDA_2: horaSaida2 || null,
      HORA_ENTRADA_3: horaEntrada3 || null,
      HORA_SAIDA_3: horaSaida3 || null,
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
          codigoTela="CAD005_RH_JORNADA"
          nomeTela="CADASTRO DE JORNADA"
          caminhoRota="/rh/jornada"
          modulo="RH"
        />

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
                      <label htmlFor="horaEntrada1">Entrada 1 *</label>
                      <input
                        id="horaEntrada1"
                        name="horaEntrada1"
                        className="form-input"
                        type="time"
                        value={horaEntrada1}
                        onChange={(e) => setHoraEntrada1(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="horaSaida1">Saída 1 *</label>
                      <input
                        id="horaSaida1"
                        name="horaSaida1"
                        className="form-input"
                        type="time"
                        value={horaSaida1}
                        onChange={(e) => setHoraSaida1(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="horaEntrada2">Entrada 2</label>
                      <input
                        id="horaEntrada2"
                        name="horaEntrada2"
                        className="form-input"
                        type="time"
                        value={horaEntrada2}
                        onChange={(e) => setHoraEntrada2(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="horaSaida2">Saída 2</label>
                      <input
                        id="horaSaida2"
                        name="horaSaida2"
                        className="form-input"
                        type="time"
                        value={horaSaida2}
                        onChange={(e) => setHoraSaida2(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="horaEntrada3">Entrada 3</label>
                      <input
                        id="horaEntrada3"
                        name="horaEntrada3"
                        className="form-input"
                        type="time"
                        value={horaEntrada3}
                        onChange={(e) => setHoraEntrada3(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="horaSaida3">Saída 3</label>
                      <input
                        id="horaSaida3"
                        name="horaSaida3"
                        className="form-input"
                        type="time"
                        value={horaSaida3}
                        onChange={(e) => setHoraSaida3(e.target.value)}
                      />
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
              <header className="form-section-header">
                <h2>Jornadas cadastradas</h2>
                <p>Visualize e selecione uma jornada para editar.</p>
              </header>

              {carregandoLista && <p>Carregando jornadas...</p>}
              {erroLista && <p className="error-text">{erroLista}</p>}

              {!carregandoLista && !erroLista && jornadas.length === 0 && (
                <p className="helper-text">Nenhuma jornada cadastrada.</p>
              )}

              {!carregandoLista && !erroLista && jornadas.length > 0 && (
                <div className="departamento-tabela-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="col-codigo">CÓDIGO</th>
                        <th className="col-nome">NOME</th>
                        <th className="col-descricao">DESCRIÇÃO</th>
                        <th className="col-carga">CARGA (H)</th>
                        <th className="col-horarios">HORÁRIOS</th>
                        <th className="col-status">STATUS</th>
                        <th className="col-acoes">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jornadas.map((jornada) => (
                        <tr key={jornada.ID_JORNADA}>
                          <td className="col-codigo">{formatarCodigoJornada(jornada.ID_JORNADA)}</td>
                          <td className="col-nome">{jornada.NOME_JORNADA}</td>
                          <td className="col-descricao">{jornada.DESCRICAO || "-"}</td>
                          <td className="col-carga">{jornada.CARGA_SEMANAL_HORAS}</td>
                          <td className="col-horarios">{montarResumoHorarios(jornada)}</td>
                          <td className="col-status">
                            <span
                              className={
                                jornada.ATIVO === 1 ? "badge badge-success" : "badge badge-danger"
                              }
                            >
                              {jornada.ATIVO === 1 ? "ATIVO" : "INATIVO"}
                            </span>
                          </td>
                          <td className="col-acoes">
                            <button
                              type="button"
                              className="button button-secondary"
                              onClick={() => preencherParaEdicao(jornada)}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </LayoutShell>
  );
}
