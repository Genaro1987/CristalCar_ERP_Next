"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { useEmpresaObrigatoria } from "@/hooks/useEmpresaObrigatoria";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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

type TelaPerfil = {
  idTela: number;
  codigoTela: string;
  nomeTela: string;
  podeAcessar: boolean;
  podeConsultar: boolean;
  podeEditar: boolean;
};

type ModuloAgrupado = {
  modulo: string;
  telas: TelaPerfil[];
};

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

function SelecaoTelasPorModulo({
  modulos,
  onTogglePermissao,
  somenteConsulta,
  perfilSelecionadoLabel,
}: {
  modulos: ModuloAgrupado[];
  onTogglePermissao: (
    idTela: number,
    tipo: "ACESSAR" | "CONSULTAR" | "EDITAR",
    value: boolean
  ) => void;
  somenteConsulta: boolean;
  perfilSelecionadoLabel?: string;
}) {
  if (!modulos.length) return null;

  return (
    <section className="mt-8 space-y-6">
      <h2 className="text-base font-semibold text-slate-900">
        Telas permitidas para o perfil selecionado
      </h2>
      <p className="text-xs text-slate-500">
        Configure abaixo as permissões de cada tela para o perfil em edição.
      </p>

      {perfilSelecionadoLabel ? (
        <p className="text-xs font-medium text-slate-700">{perfilSelecionadoLabel}</p>
      ) : null}

      {modulos.map((modulo) => (
        <div key={modulo.modulo} className="overflow-hidden rounded-2xl shadow-sm w-full">
          <div className="bg-[#ff7a1a] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
            {modulo.modulo}
          </div>

          <div className="mt-2 rounded-b-2xl bg-white">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap w-[220px]">
                      CÓDIGO TELA
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                      NOME DA TELA
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 whitespace-nowrap w-[140px]">
                      PODE ACESSAR
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 whitespace-nowrap w-[150px]">
                      PODE CONSULTAR
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 whitespace-nowrap w-[130px]">
                      PODE EDITAR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modulo.telas.map((tela) => (
                    <tr key={tela.idTela} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-sm text-gray-800 whitespace-nowrap">
                        {tela.codigoTela}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-800" title={tela.nomeTela}>
                        {tela.nomeTela}
                      </td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          disabled={somenteConsulta}
                          checked={tela.podeAcessar}
                          onChange={(e) =>
                            onTogglePermissao(tela.idTela, "ACESSAR", e.target.checked)
                          }
                        />
                      </td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          disabled={somenteConsulta || !tela.podeAcessar}
                          checked={tela.podeConsultar}
                          onChange={(e) =>
                            onTogglePermissao(tela.idTela, "CONSULTAR", e.target.checked)
                          }
                        />
                      </td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          disabled={somenteConsulta || !tela.podeAcessar}
                          checked={tela.podeEditar}
                          onChange={(e) =>
                            onTogglePermissao(tela.idTela, "EDITAR", e.target.checked)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

export default function PerfilPage() {
  useEmpresaObrigatoria();

  const [empresaId, setEmpresaId] = useState<number | null>(null);
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

  const atualizarPermissaoTela = (
    idTela: number,
    tipo: "ACESSAR" | "CONSULTAR" | "EDITAR",
    valor: boolean
  ) => {
    setTelasPerfil((prev) =>
      prev.map((tela) => {
        if (tela.ID_TELA !== idTela) return tela;

        let podeAcessar = tela.PODE_ACESSAR;
        let podeConsultar = tela.PODE_CONSULTAR;
        let podeEditar = tela.PODE_EDITAR;

        if (tipo === "ACESSAR") {
          podeAcessar = valor;
          if (!podeAcessar) {
            podeConsultar = false;
            podeEditar = false;
          } else if (!podeConsultar && !podeEditar) {
            podeConsultar = true;
          }
        }

        if (tipo === "CONSULTAR") {
          podeConsultar = valor;
          if (podeConsultar) {
            podeAcessar = true;
          } else if (!podeAcessar) {
            podeConsultar = false;
          }
        }

        if (tipo === "EDITAR") {
          podeEditar = valor;
          if (podeEditar) {
            podeAcessar = true;
            podeConsultar = true;
          } else if (!podeAcessar) {
            podeEditar = false;
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

  const modulosAgrupados = useMemo<ModuloAgrupado[]>(() => {
    const grupos: Record<string, TelaPermitida[]> = {};

    for (const tela of telasPerfil) {
      const modulo = tela.MODULO || "OUTROS";
      if (!grupos[modulo]) grupos[modulo] = [];
      grupos[modulo].push(tela);
    }

    return Object.entries(grupos).map(([modulo, telas]) => ({
      modulo,
      telas: telas
        .slice()
        .sort((a, b) => a.CODIGO_TELA.localeCompare(b.CODIGO_TELA))
        .map((tela) => ({
          idTela: tela.ID_TELA,
          codigoTela: tela.CODIGO_TELA,
          nomeTela: tela.NOME_TELA,
          podeAcessar: tela.PODE_ACESSAR,
          podeConsultar: tela.PODE_CONSULTAR,
          podeEditar: tela.PODE_EDITAR,
        })),
    }));
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

                  {!carregandoTelas && !erroTelas && modulosAgrupados.length === 0 && (
                    <p className="helper-text">Nenhuma tela cadastrada.</p>
                  )}

                  {!carregandoTelas && !erroTelas && modulosAgrupados.length > 0 && (
                    <SelecaoTelasPorModulo
                      modulos={modulosAgrupados}
                      onTogglePermissao={atualizarPermissaoTela}
                      somenteConsulta={!podeEditarPermissoes}
                      perfilSelecionadoLabel={`Configurando acessos para ${formatarCodigoPerfil(perfilSelecionado.ID_PERFIL)} - ${perfilSelecionado.NOME_PERFIL}`}
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
      </div>
    </LayoutShell>
  );
}
