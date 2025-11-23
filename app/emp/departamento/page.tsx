"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

interface Departamento {
  ID_DEPARTAMENTO: number;
  ID_EMPRESA: number;
  NOME_DEPARTAMENTO: string;
  DESCRICAO?: string | null;
  ATIVO: 0 | 1;
  DATA_CADASTRO: string;
  DATA_ATUALIZACAO?: string | null;
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
  const semAcento = (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const apenasPermitidos = semAcento.replace(/[^A-Z0-9 ]/gi, "");

  return apenasPermitidos.toUpperCase().slice(0, 100).trim();
}

function formatarCodigoDepartamento(id?: number) {
  if (!id) return "DEP-XXX";
  return `DEP-${String(id).padStart(3, "0")}`;
}

export default function DepartamentoPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [nomeDepartamento, setNomeDepartamento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [departamentoEmEdicao, setDepartamentoEmEdicao] = useState<Departamento | null>(
    null
  );

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

  const carregarDepartamentos = async () => {
    if (!empresaId) return;
    setCarregandoLista(true);
    setErroLista(null);

    try {
      const resposta = await fetch(`/api/departamentos?empresaId=${empresaId}`, {
        headers: headersPadrao,
      });
      const json = await resposta.json();

      if (json?.success) {
        setDepartamentos(json.data ?? []);
      } else {
        setErroLista("Não foi possível carregar os departamentos.");
      }
    } catch (error) {
      console.error(error);
      setErroLista("Erro ao buscar departamentos.");
    } finally {
      setCarregandoLista(false);
    }
  };

  useEffect(() => {
    carregarDepartamentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const limparFormulario = () => {
    setDepartamentoEmEdicao(null);
    setNomeDepartamento("");
    setDescricao("");
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

  const preencherParaEdicao = (dep: Departamento) => {
    setDepartamentoEmEdicao(dep);
    setNomeDepartamento(dep.NOME_DEPARTAMENTO ?? "");
    setDescricao(normalizarDescricao(dep.DESCRICAO ?? ""));
    setAtivo(dep.ATIVO === 1);
  };

  const aoSalvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotification(null);

    if (!empresaId) {
      setNotification({ type: "error", message: "Selecione uma empresa antes de salvar." });
      return;
    }

    const nomeNormalizado = normalizarTextoBasico(nomeDepartamento);
    const descricaoNormalizada = normalizarDescricao(descricao);

    if (!nomeNormalizado) {
      setNotification({
        type: "error",
        message: "Nome do departamento é obrigatório.",
      });
      return;
    }

    setSalvando(true);

    const payload = {
      NOME_DEPARTAMENTO: nomeNormalizado,
      DESCRICAO: descricaoNormalizada,
      ATIVO: ativo ? 1 : 0,
    };

    const editando = Boolean(departamentoEmEdicao?.ID_DEPARTAMENTO);
    const url = editando
      ? `/api/departamentos/${departamentoEmEdicao?.ID_DEPARTAMENTO}`
      : "/api/departamentos";
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
            ? "Departamento atualizado com sucesso."
            : "Departamento criado com sucesso.",
        });
        await carregarDepartamentos();
        limparFormulario();
      } else if (resposta.status === 400 && json?.error === "NOME_DEPARTAMENTO_OBRIGATORIO") {
        setNotification({ type: "error", message: "Informe o nome do departamento." });
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
          codigoTela="CAD003_EMP_DEPARTAMENTO"
          nomeTela="CADASTRO DE DEPARTAMENTO"
          caminhoRota="/emp/departamento"
          modulo="EMPRESA"
        />

        <main className="page-content-card">
          {notification && (
            <NotificationBar type={notification.type} message={notification.message} />
          )}

          <div className="departamentos-page">
            <section className="panel">
              <header className="form-section-header">
                <h2>{departamentoEmEdicao ? "Editar departamento" : "Novo departamento"}</h2>
                <p>
                  {departamentoEmEdicao
                    ? "Atualize os dados do departamento selecionado."
                    : "Informe os dados do departamento para salvar."}
                </p>
              </header>

              <form className="form" onSubmit={aoSalvar}>
                <div className="form-grid three-columns departamentos-grid">
                  <div className="form-group">
                    <label htmlFor="codigoDepartamento">Código</label>
                    <input
                      id="codigoDepartamento"
                      name="codigoDepartamento"
                      className="form-input"
                      placeholder="DEP-XXX"
                      value={formatarCodigoDepartamento(
                        departamentoEmEdicao?.ID_DEPARTAMENTO ?? undefined
                      )}
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="nomeDepartamento">Nome do departamento *</label>
                    <input
                      id="nomeDepartamento"
                      name="nomeDepartamento"
                      className="form-input"
                      value={nomeDepartamento}
                      placeholder="Nome do departamento"
                      onChange={(e) => setNomeDepartamento(normalizarTextoBasico(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="descricaoDepartamento">Descrição (máx. 100 caracteres)</label>
                    <input
                      id="descricaoDepartamento"
                      name="descricaoDepartamento"
                      className="form-input"
                      value={descricao}
                      placeholder="Descrição"
                      onChange={handleDescricaoChange}
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="form-actions departamentos-actions">
                  <label className="checkbox-row" htmlFor="departamentoAtivo">
                    <input
                      type="checkbox"
                      id="departamentoAtivo"
                      name="ativo"
                      checked={ativo}
                      onChange={(e) => setAtivo(e.target.checked)}
                    />
                    <span>Ativo</span>
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
                <h2>Departamentos cadastrados</h2>
                <p>Visualize e selecione um departamento para editar.</p>
              </header>

              {carregandoLista && <p>Carregando departamentos...</p>}
              {erroLista && <p className="error-text">{erroLista}</p>}

              {!carregandoLista && !erroLista && departamentos.length === 0 && (
                <p className="helper-text">Nenhum departamento cadastrado.</p>
              )}

              {!carregandoLista && !erroLista && departamentos.length > 0 && (
                <div className="departamento-tabela-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="col-codigo">CÓDIGO</th>
                        <th className="col-nome">NOME</th>
                        <th className="col-descricao">DESCRIÇÃO</th>
                        <th className="col-status">STATUS</th>
                        <th className="col-acoes">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departamentos.map((dep) => (
                        <tr key={dep.ID_DEPARTAMENTO}>
                          <td className="col-codigo">
                            {formatarCodigoDepartamento(dep.ID_DEPARTAMENTO)}
                          </td>
                          <td className="col-nome">{dep.NOME_DEPARTAMENTO}</td>
                          <td className="col-descricao">{dep.DESCRICAO || "-"}</td>
                          <td className="col-status">
                            <span
                              className={
                                dep.ATIVO === 1 ? "badge badge-success" : "badge badge-danger"
                              }
                            >
                              {dep.ATIVO === 1 ? "ATIVO" : "INATIVO"}
                            </span>
                          </td>
                          <td className="col-acoes">
                            <button
                              type="button"
                              className="button button-secondary"
                              onClick={() => preencherParaEdicao(dep)}
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
