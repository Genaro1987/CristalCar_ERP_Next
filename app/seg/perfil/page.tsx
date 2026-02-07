"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import {
  PermissoesPorTelaSection,
  TelaPermissao,
  TipoPermissao,
} from "./PermissoesPorTelaSection";

interface Perfil {
  ID_PERFIL: string;
  ID_EMPRESA: number;
  NOME_PERFIL: string;
  DESCRICAO?: string | null;
  ATIVO: 0 | 1;
  CRIADO_EM?: string;
  ATUALIZADO_EM?: string;
}

interface TelaPermitida {
  ID_TELA: number;
  CODIGO_TELA: string;
  NOME_TELA: string;
  MODULO: string;
  PODE_ACESSAR: boolean;
  PODE_CONSULTAR: boolean;
  PODE_EDITAR: boolean;
}

const CODIGO_PADRAO_PERFIL = "PER-XXX";

function formatarCodigoPerfil(codigo?: string | null): string {
  if (!codigo) return CODIGO_PADRAO_PERFIL;
  return codigo.startsWith("PER-") ? codigo : `PER-${codigo}`;
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

export default function PerfilPage() {
  useRequerEmpresaSelecionada();

  const { empresa, carregando } = useEmpresaSelecionada();
  const empresaId = empresa?.id ?? null;
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [telasPerfil, setTelasPerfil] = useState<TelaPermitida[]>([]);
  const [perfilSelecionado, setPerfilSelecionado] = useState<Perfil | null>(null);
  const [perfilEmEdicao, setPerfilEmEdicao] = useState<Perfil | null>(null);

  const [codigoPerfil, setCodigoPerfil] = useState(CODIGO_PADRAO_PERFIL);
  const [nomePerfil, setNomePerfil] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [carregandoPerfis, setCarregandoPerfis] = useState(false);
  const [carregandoTelas, setCarregandoTelas] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoTelas, setSalvandoTelas] = useState(false);
  const [erroPerfis, setErroPerfis] = useState<string | null>(null);
  const [erroTelas, setErroTelas] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = {};

    if (empresaId) {
      headers["x-empresa-id"] = String(empresaId);
    }

    return headers;
  }, [empresaId]);

  const carregarPerfis = useCallback(async () => {
    if (!empresaId) return;

    setCarregandoPerfis(true);
    setErroPerfis(null);

    try {
      const resposta = await fetch(`/api/seg/perfis`, { headers: headersPadrao });
      const json = await resposta.json();

      if (json?.success) {
        setPerfis(json.data ?? []);
      } else {
        setErroPerfis("Não foi possível carregar os perfis.");
      }
    } catch (error) {
      console.error(error);
      setErroPerfis("Erro ao se conectar com o servidor.");
    } finally {
      setCarregandoPerfis(false);
    }
  }, [empresaId, headersPadrao]);

  useEffect(() => {
    if (!empresaId) return;
    carregarPerfis();
  }, [carregarPerfis, empresaId]);

  const limparFormulario = () => {
    setPerfilEmEdicao(null);
    setCodigoPerfil(CODIGO_PADRAO_PERFIL);
    setNomePerfil("");
    setDescricao("");
    setAtivo(true);
  };

  const preencherParaEdicao = async (perfil: Perfil) => {
    setPerfilEmEdicao(perfil);
    setPerfilSelecionado(perfil);
    setCodigoPerfil(perfil.ID_PERFIL ?? CODIGO_PADRAO_PERFIL);
    setNomePerfil(normalizarTextoBasico(perfil.NOME_PERFIL ?? ""));
    setDescricao(normalizarDescricao(perfil.DESCRICAO ?? ""));
    setAtivo(perfil.ATIVO === 1);
    await carregarTelasPerfil(perfil.ID_PERFIL);
  };

  const selecionarPerfilParaConsulta = async (perfil: Perfil) => {
    setPerfilSelecionado(perfil);
    setPerfilEmEdicao(null);
    setNotification(null);
    await carregarTelasPerfil(perfil.ID_PERFIL);
  };

  const carregarTelasPerfil = async (idPerfil: string) => {
    if (!empresaId) return;
    setCarregandoTelas(true);
    setErroTelas(null);

    try {
      const resposta = await fetch(`/api/seg/perfis/${encodeURIComponent(idPerfil)}/telas`, {
        headers: headersPadrao,
      });
      const json = await resposta.json();

      if (json?.success) {
        const telasNormalizadas: TelaPermitida[] = (json.data ?? []).map(
          (tela: TelaPermitida) => ({
            ...tela,
            PODE_ACESSAR: Boolean(tela.PODE_ACESSAR),
            PODE_CONSULTAR: Boolean(tela.PODE_CONSULTAR),
            PODE_EDITAR: Boolean(tela.PODE_EDITAR),
          })
        );

        setTelasPerfil(telasNormalizadas);
      } else {
        setErroTelas("Não foi possível carregar as telas permitidas.");
      }
    } catch (error) {
      console.error(error);
      setErroTelas("Erro ao se conectar com o servidor.");
    } finally {
      setCarregandoTelas(false);
    }
  };

  const handleDescricaoChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDescricao(normalizarDescricao(event.target.value));
  };

  const aoSalvarPerfil = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotification(null);

    if (!empresaId) {
      setNotification({
        type: "error",
        message: "Selecione uma empresa antes de salvar.",
      });
      return;
    }

    const nomeNormalizado = normalizarTextoBasico(nomePerfil);
    const descricaoNormalizada = normalizarDescricao(descricao);

    if (!nomeNormalizado) {
      setNotification({ type: "error", message: "Nome do perfil é obrigatório." });
      return;
    }

    setSalvandoPerfil(true);

    const editando = Boolean(perfilEmEdicao?.ID_PERFIL);
    const url = editando
      ? `/api/seg/perfis?id=${encodeURIComponent(perfilEmEdicao?.ID_PERFIL ?? "")}`
      : "/api/seg/perfis";
    const method = editando ? "PUT" : "POST";

    const payload = {
      NOME_PERFIL: nomeNormalizado,
      DESCRICAO: descricaoNormalizada,
      ATIVO: ativo ? 1 : 0,
    };

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
          message: editando ? "Perfil atualizado com sucesso." : "Perfil criado com sucesso.",
        });
        await carregarPerfis();
        limparFormulario();
      } else if (resposta.status === 400 && json?.error === "NOME_PERFIL_OBRIGATORIO") {
        setNotification({ type: "error", message: "Informe o nome do perfil." });
      } else {
        setNotification({
          type: "error",
          message: "Não foi possível salvar os dados. Tente novamente.",
        });
      }
    } catch (error) {
      console.error(error);
      setNotification({ type: "error", message: "Erro ao se conectar com o servidor." });
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const handleTogglePermissao = (idTela: number, tipo: TipoPermissao) => {
    if (!podeEditarPermissoes) return;

    setTelasPerfil((prev) =>
      prev.map((tela) => {
        if (tela.ID_TELA !== idTela) return tela;

        let podeAcessar = tela.PODE_ACESSAR;
        let podeConsultar = tela.PODE_CONSULTAR;
        let podeEditar = tela.PODE_EDITAR;

        if (tipo === "acessar") {
          podeAcessar = !tela.PODE_ACESSAR;
          if (!podeAcessar) {
            podeConsultar = false;
            podeEditar = false;
          } else if (!podeConsultar && !podeEditar) {
            podeConsultar = true;
          }
        }

        if (tipo === "consultar") {
          const novoConsultar = !tela.PODE_CONSULTAR;
          podeConsultar = novoConsultar;
          if (novoConsultar) {
            podeAcessar = true;
          }
        }

        if (tipo === "editar") {
          const novoEditar = !tela.PODE_EDITAR;
          podeEditar = novoEditar;
          if (novoEditar) {
            podeAcessar = true;
            podeConsultar = true;
          }
        }

        if (!podeAcessar) {
          podeConsultar = false;
          podeEditar = false;
        }

        return {
          ...tela,
          PODE_ACESSAR: podeAcessar,
          PODE_CONSULTAR: podeConsultar,
          PODE_EDITAR: podeEditar,
        };
      })
    );
  };

  const salvarAcessos = async () => {
    if (!empresaId || !perfilSelecionado) {
      setNotification({
        type: "error",
        message: "Selecione um perfil para salvar os acessos.",
      });
      return;
    }

    if (!(perfilEmEdicao && perfilEmEdicao.ID_PERFIL === perfilSelecionado.ID_PERFIL)) {
      setNotification({
        type: "info",
        message: "Clique em Editar para habilitar a alteração das permissões.",
      });
      return;
    }

    setSalvandoTelas(true);
    setNotification(null);

    try {
      const resposta = await fetch(
        `/api/seg/perfis/${encodeURIComponent(perfilSelecionado.ID_PERFIL)}/telas`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...headersPadrao,
          },
          body: JSON.stringify({
            telas: telasPerfil.map((tela) => ({
              ID_TELA: tela.ID_TELA,
              PODE_ACESSAR: tela.PODE_ACESSAR,
              PODE_CONSULTAR: tela.PODE_CONSULTAR,
              PODE_EDITAR: tela.PODE_EDITAR,
            })),
          }),
        }
      );

      const json = await resposta.json();

      if (json?.success) {
        setNotification({ type: "success", message: "Acessos atualizados com sucesso." });
      } else {
        setNotification({ type: "error", message: "Não foi possível salvar os acessos." });
      }
    } catch (error) {
      console.error(error);
      setNotification({ type: "error", message: "Erro ao se conectar com o servidor." });
    } finally {
      setSalvandoTelas(false);
    }
  };

  const cancelarEdicaoPermissoes = async () => {
    if (!perfilSelecionado) return;
    await carregarTelasPerfil(perfilSelecionado.ID_PERFIL);
    setPerfilEmEdicao(null);
  };

  const telasPermissoes = useMemo<TelaPermissao[]>(() => {
    return telasPerfil
      .map((tela) => ({
        idTela: tela.ID_TELA,
        codigoTela: tela.CODIGO_TELA,
        nomeTela: tela.NOME_TELA,
        modulo: (tela.MODULO || "OUTROS").toUpperCase(),
        podeAcessar: tela.PODE_ACESSAR,
        podeConsultar: tela.PODE_CONSULTAR,
        podeEditar: tela.PODE_EDITAR,
      }))
      .sort((a, b) => {
        const moduloDiff = a.modulo.localeCompare(b.modulo);
        if (moduloDiff !== 0) return moduloDiff;
        return a.codigoTela.localeCompare(b.codigoTela);
      });
  }, [telasPerfil]);

  const podeEditarPermissoes = useMemo(
    () =>
      Boolean(
        perfilSelecionado &&
          perfilEmEdicao &&
          perfilSelecionado.ID_PERFIL === perfilEmEdicao.ID_PERFIL
      ),
    [perfilEmEdicao, perfilSelecionado]
  );

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="CAD006_SEG_PERFIL"
          nomeTela="CADASTRO DE PERFIL DE ACESSO"
          caminhoRota="/seg/perfil"
          modulo="SEGURANCA"
        />

        <PaginaProtegida codigoTela="CAD006_SEG_PERFIL">
        <main className="page-content-card">
          {notification && (
            <NotificationBar type={notification.type} message={notification.message} />
          )}

          <div className="departamentos-page">
            <section className="panel">
              <header className="form-section-header">
                <h2>{perfilEmEdicao ? "Editar perfil" : "Novo perfil"}</h2>
                <p>
                  {perfilEmEdicao
                    ? "Atualize os dados do perfil selecionado."
                    : "Informe os dados do perfil de acesso para salvar."}
                </p>
              </header>

              <form className="form" onSubmit={aoSalvarPerfil}>
                <div className="form-grid two-columns">
                  <div className="form-group">
                    <label htmlFor="codigoPerfil">Código</label>
                    <input
                      id="codigoPerfil"
                      name="codigoPerfil"
                      className="form-input"
                      value={formatarCodigoPerfil(codigoPerfil)}
                      placeholder={CODIGO_PADRAO_PERFIL}
                      disabled
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="nomePerfil">Nome do perfil *</label>
                    <input
                      id="nomePerfil"
                      name="nomePerfil"
                      className="form-input"
                      value={nomePerfil}
                      placeholder="Nome do perfil"
                      onChange={(e) => setNomePerfil(normalizarTextoBasico(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid single-column">
                  <div className="form-group">
                    <label htmlFor="descricaoPerfil">Descrição (máx. 100 caracteres)</label>
                    <input
                      id="descricaoPerfil"
                      name="descricaoPerfil"
                      className="form-input"
                      value={descricao}
                      placeholder="Descrição do perfil"
                      onChange={handleDescricaoChange}
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="form-actions departamentos-actions">
                  <label className="checkbox-row" htmlFor="perfilAtivo">
                    <input
                      type="checkbox"
                      id="perfilAtivo"
                      name="perfilAtivo"
                      checked={ativo}
                      onChange={(e) => setAtivo(e.target.checked)}
                    />
                    <span>Ativo</span>
                  </label>

                  <div className="button-row">
                    <button type="submit" className="button button-primary" disabled={salvandoPerfil}>
                      {salvandoPerfil ? "Salvando..." : "Salvar"}
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
                <h2>Perfis cadastrados</h2>
                <p>Visualize e selecione um perfil para editar e configurar as telas permitidas.</p>
              </header>

              {carregandoPerfis && <p>Carregando perfis...</p>}
              {erroPerfis && <p className="error-text">{erroPerfis}</p>}

              {!carregandoPerfis && !erroPerfis && perfis.length === 0 && (
                <p className="helper-text">Nenhum perfil cadastrado.</p>
              )}

              {!carregandoPerfis && !erroPerfis && perfis.length > 0 && (
                <div className="departamento-tabela-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="col-consulta">Consulta</th>
                        <th className="col-codigo">CÓDIGO</th>
                        <th className="col-nome">NOME</th>
                        <th className="col-descricao">DESCRIÇÃO</th>
                        <th className="col-status">STATUS</th>
                        <th className="col-acoes">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfis.map((perfil) => (
                        <tr key={perfil.ID_PERFIL}>
                          <td className="col-consulta">
                            <label className="radio-row">
                              <input
                                type="radio"
                                name="perfil-consulta"
                                checked={perfilSelecionado?.ID_PERFIL === perfil.ID_PERFIL}
                                onChange={() => selecionarPerfilParaConsulta(perfil)}
                              />
                            </label>
                          </td>
                          <td className="col-codigo">{formatarCodigoPerfil(perfil.ID_PERFIL)}</td>
                          <td className="col-nome">{perfil.NOME_PERFIL}</td>
                          <td className="col-descricao">{perfil.DESCRICAO || "-"}</td>
                          <td className="col-status">
                            <span
                              className={
                                perfil.ATIVO === 1 ? "badge badge-success" : "badge badge-danger"
                              }
                            >
                              {perfil.ATIVO === 1 ? "ATIVO" : "INATIVO"}
                            </span>
                          </td>
                          <td className="col-acoes">
                            <button
                              type="button"
                              className="button button-secondary"
                              onClick={() => preencherParaEdicao(perfil)}
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

            <section className="panel">
              <header className="form-section-header">
                <h2>Permissões por tela</h2>
                <p>
                  Selecione um perfil na tabela acima e ajuste as permissões nas telas
                  permitidas do módulo correspondente.
                </p>
              </header>

              {!perfilSelecionado && <p className="helper-text">Nenhum perfil selecionado.</p>}

              {perfilSelecionado && (
                <div className="perfil-telas-container">
                  {carregandoTelas && <p>Carregando telas...</p>}
                  {erroTelas && <p className="error-text">{erroTelas}</p>}

                  {!carregandoTelas && !erroTelas && telasPermissoes.length === 0 && (
                    <p className="helper-text">Nenhuma tela cadastrada.</p>
                  )}

                  {!carregandoTelas && !erroTelas && telasPermissoes.length > 0 && (
                    <PermissoesPorTelaSection
                      perfilCodigo={formatarCodigoPerfil(perfilSelecionado.ID_PERFIL)}
                      perfilNome={perfilSelecionado.NOME_PERFIL}
                      telas={telasPermissoes}
                      onTogglePermissao={handleTogglePermissao}
                      somenteConsulta={!podeEditarPermissoes}
                    />
                  )}

                  <div className="form-actions departamentos-actions">
                    <div />
                    <div className="button-row">
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={carregandoTelas || salvandoTelas || !podeEditarPermissoes}
                        onClick={cancelarEdicaoPermissoes}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={!perfilSelecionado || salvandoTelas || !podeEditarPermissoes}
                        onClick={salvarAcessos}
                      >
                        {salvandoTelas ? "Salvando..." : "Salvar acessos do perfil"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}
