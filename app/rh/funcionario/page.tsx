"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";

type Funcionario = {
  ID_FUNCIONARIO: string;
  CPF: string;
  NOME_COMPLETO: string;
  ID_DEPARTAMENTO: number;
  NOME_DEPARTAMENTO?: string | null;
  ID_JORNADA: string;
  NOME_JORNADA?: string | null;
  ID_PERFIL?: string | null;
  NOME_PERFIL?: string | null;
  DATA_ADMISSAO: string;
  DATA_DEMISSAO?: string | null;
  ATIVO: 0 | 1;
  SALARIO_BASE?: number | null;
  TIPO_SALARIO?: string | null;
  CARGA_HORARIA_MENSAL_REFERENCIA?: number | null;
};

type Departamento = {
  ID_DEPARTAMENTO: number;
  NOME_DEPARTAMENTO: string;
  ATIVO: 0 | 1;
};

type Jornada = {
  ID_JORNADA: string;
  NOME_JORNADA: string;
  ATIVO: 0 | 1;
};

type Perfil = {
  ID_PERFIL: string;
  NOME_PERFIL: string;
  ATIVO: 0 | 1;
};

function removerAcentosPreservandoEspaco(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizarTextoBasico(valor: string): string {
  const semAcento = removerAcentosPreservandoEspaco(valor ?? "");

  return semAcento.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim();
}

function limparCpf(valor: string): string {
  return (valor ?? "").replace(/\D/g, "").slice(0, 11);
}

function aplicarMascaraCpf(valor: string): string {
  const numeros = limparCpf(valor);
  const partes: string[] = [];

  if (numeros.length > 0) {
    partes.push(numeros.slice(0, 3));
  }
  if (numeros.length > 3) {
    partes.push(numeros.slice(3, 6));
  }
  if (numeros.length > 6) {
    partes.push(numeros.slice(6, 9));
  }

  const sufixo = numeros.length > 9 ? numeros.slice(9, 11) : "";

  if (partes.length === 0) return sufixo;

  const base = partes.join(".");
  return sufixo ? `${base}-${sufixo}` : base;
}

function formatarCpf(valor: string): string {
  const numeros = limparCpf(valor);
  if (numeros.length !== 11) return numeros;
  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9, 11)}`;
}

function formatarCodigoFuncionario(valor?: string) {
  return valor || "FUN-XXX";
}

export default function FuncionarioPage() {
  useRequerEmpresaSelecionada();

  const { empresa, carregando } = useEmpresaSelecionada();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpf, setCpf] = useState("");
  const [departamentoSelecionado, setDepartamentoSelecionado] = useState("");
  const [jornadaSelecionada, setJornadaSelecionada] = useState("");
  const [perfilSelecionado, setPerfilSelecionado] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [dataDemissao, setDataDemissao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [tipoSalario, setTipoSalario] = useState("MENSALISTA");
  const [salarioBase, setSalarioBase] = useState("");
  const [cargaHorariaMensalReferencia, setCargaHorariaMensalReferencia] = useState("220");
  const [funcionarioEmEdicao, setFuncionarioEmEdicao] = useState<Funcionario | null>(
    null
  );
  const [erroSalario, setErroSalario] = useState<string | null>(null);
  const [erroCargaHoraria, setErroCargaHoraria] = useState<string | null>(null);

  const empresaId = empresa?.id ?? null;

  const headersPadrao = useMemo<HeadersInit>(() => {
    const headers: Record<string, string> = {};

    if (empresaId) {
      headers["x-empresa-id"] = String(empresaId);
    }

    return headers;
  }, [empresaId]);

  const carregarFuncionarios = async () => {
    if (!empresaId) return;
    setCarregandoLista(true);
    setErroLista(null);

    try {
      const resposta = await fetch(`/api/rh/funcionarios`, {
        headers: headersPadrao,
      });
      const json = await resposta.json();

      if (json?.success) {
        setFuncionarios(json.data ?? []);
      } else {
        setErroLista("Não foi possível carregar os funcionários.");
      }
    } catch (error) {
      console.error(error);
      setErroLista("Erro ao buscar funcionários.");
    } finally {
      setCarregandoLista(false);
    }
  };

  const carregarDepartamentos = async () => {
    if (!empresaId) return;
    try {
      const resposta = await fetch(`/api/departamentos`, { headers: headersPadrao });
      const json = await resposta.json();

      if (json?.success) {
        setDepartamentos(json.data ?? []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const carregarJornadas = async () => {
    if (!empresaId) return;
    try {
      const resposta = await fetch(`/api/rh/jornadas`, { headers: headersPadrao });
      const json = await resposta.json();

      if (json?.success) {
        setJornadas(json.data ?? []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const carregarPerfis = async () => {
    if (!empresaId) return;
    try {
      const resposta = await fetch(`/api/seg/perfis`, { headers: headersPadrao });
      const json = await resposta.json();

      if (json?.success) {
        setPerfis(json.data ?? []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (carregando) return;
    carregarFuncionarios();
    carregarDepartamentos();
    carregarJornadas();
    carregarPerfis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, empresaId]);

  const limparFormulario = () => {
    setFuncionarioEmEdicao(null);
    setNomeCompleto("");
    setCpf("");
    setDepartamentoSelecionado("");
    setJornadaSelecionada("");
    setPerfilSelecionado("");
    setDataAdmissao("");
    setDataDemissao("");
    setAtivo(true);
    setErroFormulario(null);
    setTipoSalario("MENSALISTA");
    setSalarioBase("");
    setCargaHorariaMensalReferencia("220");
    setErroSalario(null);
    setErroCargaHoraria(null);
  };

  const preencherParaEdicao = (funcionario: Funcionario) => {
    setFuncionarioEmEdicao(funcionario);
    setNomeCompleto(normalizarTextoBasico(funcionario.NOME_COMPLETO ?? ""));
    setCpf(aplicarMascaraCpf(funcionario.CPF ?? ""));
    setDepartamentoSelecionado(String(funcionario.ID_DEPARTAMENTO ?? ""));
    setJornadaSelecionada(funcionario.ID_JORNADA ?? "");
    setPerfilSelecionado(funcionario.ID_PERFIL ?? "");
    setDataAdmissao(funcionario.DATA_ADMISSAO ?? "");
    setDataDemissao(funcionario.DATA_DEMISSAO ?? "");
    setAtivo(funcionario.ATIVO === 1 && !funcionario.DATA_DEMISSAO);
    setErroFormulario(null);
    setTipoSalario(funcionario.TIPO_SALARIO || "MENSALISTA");
    setSalarioBase(
      funcionario.SALARIO_BASE !== undefined && funcionario.SALARIO_BASE !== null
        ? String(funcionario.SALARIO_BASE)
        : ""
    );
    setCargaHorariaMensalReferencia(
      funcionario.CARGA_HORARIA_MENSAL_REFERENCIA !== undefined &&
        funcionario.CARGA_HORARIA_MENSAL_REFERENCIA !== null
        ? String(funcionario.CARGA_HORARIA_MENSAL_REFERENCIA)
        : "220"
    );
    setErroSalario(null);
    setErroCargaHoraria(null);
  };

  const validarDatas = (admissao: string, demissao: string) => {
    if (demissao && new Date(demissao) < new Date(admissao)) {
      return "Data de desligamento não pode ser anterior à admissão.";
    }
    return null;
  };

  const aoSalvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotification(null);
    setErroFormulario(null);
    setErroSalario(null);
    setErroCargaHoraria(null);

    if (!empresaId) {
      setNotification({ type: "error", message: "Selecione uma empresa antes de salvar." });
      return;
    }

    const nomeNormalizado = normalizarTextoBasico(nomeCompleto);
    const cpfLimpo = limparCpf(cpf);
    const dataAdmissaoValida = dataAdmissao || "";
    const dataDemissaoValida = dataDemissao || "";
    const salarioBaseNumero = Number(salarioBase);
    const cargaHorariaNumero = Number(cargaHorariaMensalReferencia);
    const erroDatas = validarDatas(dataAdmissaoValida, dataDemissaoValida);

    if (!nomeNormalizado) {
      setErroFormulario("Nome do funcionário é obrigatório.");
      return;
    }

    if (cpfLimpo.length !== 11) {
      setErroFormulario("CPF deve ter 11 dígitos.");
      return;
    }

    if (!departamentoSelecionado) {
      setErroFormulario("Selecione um departamento.");
      return;
    }

    if (!jornadaSelecionada) {
      setErroFormulario("Selecione uma jornada.");
      return;
    }

    if (!dataAdmissaoValida) {
      setErroFormulario("Data de admissão é obrigatória.");
      return;
    }

    if (erroDatas) {
      setErroFormulario(erroDatas);
      return;
    }

    if (!Number.isFinite(salarioBaseNumero) || salarioBaseNumero <= 0) {
      setErroSalario("Informe um salário base válido.");
      return;
    }

    if (!Number.isFinite(cargaHorariaNumero) || cargaHorariaNumero <= 0) {
      setErroCargaHoraria("Informe uma carga horária mensal válida.");
      return;
    }

    const payload = {
      NOME_COMPLETO: nomeNormalizado,
      CPF: cpfLimpo,
      ID_DEPARTAMENTO: Number(departamentoSelecionado),
      ID_JORNADA: jornadaSelecionada,
      ID_PERFIL: perfilSelecionado || null,
      DATA_ADMISSAO: dataAdmissaoValida,
      DATA_DEMISSAO: dataDemissaoValida || null,
      ATIVO: dataDemissaoValida ? 0 : ativo ? 1 : 0,
      salarioBase: salarioBaseNumero,
      tipoSalario: tipoSalario || "MENSALISTA",
      cargaHorariaMensalReferencia: cargaHorariaNumero,
    };

    const editando = Boolean(funcionarioEmEdicao?.ID_FUNCIONARIO);
    const url = editando
      ? `/api/rh/funcionarios?id=${encodeURIComponent(funcionarioEmEdicao?.ID_FUNCIONARIO ?? "")}`
      : "/api/rh/funcionarios";
    const method = editando ? "PUT" : "POST";

    setSalvando(true);

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
            ? "Funcionário atualizado com sucesso."
            : "Funcionário criado com sucesso.",
        });
        await carregarFuncionarios();
        limparFormulario();
      } else if (resposta.status === 409 && json?.error === "CPF_JA_CADASTRADO") {
        setErroFormulario("CPF já cadastrado para esta empresa.");
      } else if (resposta.status === 400) {
        setErroFormulario("Preencha todos os campos obrigatórios corretamente.");
      } else {
        setErroFormulario("Não foi possível salvar os dados. Tente novamente.");
      }
    } catch (error) {
      console.error(error);
      setErroFormulario("Erro ao se conectar com o servidor.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="CAD005_RH_FUNCIONARIO"
          nomeTela="CADASTRO DE FUNCIONARIO"
          caminhoRota="/rh/funcionario"
          modulo="RH"
        />

        <main className="page-content-card">
          {notification && (
            <NotificationBar type={notification.type} message={notification.message} />
          )}

          <div className="departamentos-page">
            <section className="panel">
              <header className="form-section-header">
                <h2>{funcionarioEmEdicao ? "Editar funcionário" : "Novo funcionário"}</h2>
                <p>
                  {funcionarioEmEdicao
                    ? "Atualize os dados do funcionário selecionado."
                    : "Informe os dados para cadastrar um novo funcionário."}
                </p>
              </header>

              {erroFormulario && <p className="error-text">{erroFormulario}</p>}

              <form className="form" onSubmit={aoSalvar}>
                <div className="form-grid two-columns">
                  <div className="form-group">
                    <label htmlFor="codigoFuncionario">Código</label>
                    <input
                      id="codigoFuncionario"
                      name="codigoFuncionario"
                      className="form-input"
                      placeholder="FUN-XXX"
                      value={formatarCodigoFuncionario(funcionarioEmEdicao?.ID_FUNCIONARIO)}
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="nomeCompleto">Nome do funcionário *</label>
                    <input
                      id="nomeCompleto"
                      name="nomeCompleto"
                      className="form-input"
                      value={nomeCompleto}
                      placeholder="Nome do funcionário"
                      onChange={(e) => setNomeCompleto(normalizarTextoBasico(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid two-columns">
                  <div className="form-group">
                    <label htmlFor="cpfFuncionario">CPF *</label>
                    <input
                      id="cpfFuncionario"
                      name="cpfFuncionario"
                      className="form-input"
                      value={cpf}
                      placeholder="000.000.000-00"
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setCpf(aplicarMascaraCpf(e.target.value))
                      }
                      maxLength={14}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="departamento">Departamento *</label>
                    <select
                      id="departamento"
                      name="departamento"
                      className="form-input"
                      value={departamentoSelecionado}
                      onChange={(e) => setDepartamentoSelecionado(e.target.value)}
                      required
                    >
                      <option value="">Selecione</option>
                      {departamentos
                        .filter((dep) => dep.ATIVO === 1)
                        .map((dep) => (
                          <option key={dep.ID_DEPARTAMENTO} value={dep.ID_DEPARTAMENTO}>
                            {dep.NOME_DEPARTAMENTO}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid two-columns">
                  <div className="form-group">
                    <label htmlFor="jornada">Jornada *</label>
                    <select
                      id="jornada"
                      name="jornada"
                      className="form-input"
                      value={jornadaSelecionada}
                      onChange={(e) => setJornadaSelecionada(e.target.value)}
                      required
                    >
                      <option value="">Selecione</option>
                      {jornadas
                        .filter((jor) => jor.ATIVO === 1)
                        .map((jor) => (
                          <option key={jor.ID_JORNADA} value={jor.ID_JORNADA}>
                            {jor.NOME_JORNADA}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="perfil">Perfil de acesso</label>
                    <select
                      id="perfil"
                      name="perfil"
                      className="form-input"
                      value={perfilSelecionado}
                      onChange={(e) => setPerfilSelecionado(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {perfis
                        .filter((perfil) => perfil.ATIVO === 1)
                        .map((perfil) => (
                          <option key={perfil.ID_PERFIL} value={perfil.ID_PERFIL}>
                            {perfil.NOME_PERFIL}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid two-columns">
                  <div className="form-group">
                    <label htmlFor="dataAdmissao">Data de admissão *</label>
                    <input
                      id="dataAdmissao"
                      name="dataAdmissao"
                      className="form-input"
                      type="date"
                      value={dataAdmissao}
                      onChange={(e) => setDataAdmissao(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="dataDemissao">Data de desligamento</label>
                    <input
                      id="dataDemissao"
                      name="dataDemissao"
                      className="form-input"
                      type="date"
                      value={dataDemissao}
                      onChange={(e) => setDataDemissao(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid three-columns">
                  <div className="form-group">
                    <label htmlFor="tipoSalario">Tipo de salário *</label>
                    <select
                      id="tipoSalario"
                      name="tipoSalario"
                      className="form-input"
                      value={tipoSalario}
                      onChange={(e) => setTipoSalario(e.target.value)}
                      required
                    >
                      <option value="MENSALISTA">Mensalista</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="salarioBase">Salário base *</label>
                    <input
                      id="salarioBase"
                      name="salarioBase"
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Ex.: 2500,00"
                      value={salarioBase}
                      onChange={(e) => setSalarioBase(e.target.value)}
                      style={{ textAlign: "right" }}
                      required
                    />
                    {erroSalario && <p className="error-text">{erroSalario}</p>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="cargaHorariaMensal">Carga horária mensal (horas) *</label>
                    <input
                      id="cargaHorariaMensal"
                      name="cargaHorariaMensal"
                      className="form-input"
                      type="number"
                      min="1"
                      value={cargaHorariaMensalReferencia}
                      onChange={(e) => setCargaHorariaMensalReferencia(e.target.value)}
                      required
                    />
                    <p className="helper-text">
                      Usada para calcular o valor da hora (salário ÷ horas/mês).
                    </p>
                    {erroCargaHoraria && <p className="error-text">{erroCargaHoraria}</p>}
                  </div>
                </div>

                <div className="form-actions departamentos-actions">
                  <label className="checkbox-row" htmlFor="funcionarioAtivo">
                    <input
                      type="checkbox"
                      id="funcionarioAtivo"
                      name="ativo"
                      checked={ativo}
                      onChange={(e) => setAtivo(e.target.checked)}
                      disabled={Boolean(dataDemissao)}
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
                <h2>Funcionários cadastrados</h2>
                <p>Visualize e selecione um funcionário para editar.</p>
              </header>

              {carregandoLista && <p>Carregando funcionários...</p>}
              {erroLista && <p className="error-text">{erroLista}</p>}

              {!carregandoLista && !erroLista && funcionarios.length === 0 && (
                <p className="helper-text">Nenhum funcionário cadastrado.</p>
              )}

              {!carregandoLista && !erroLista && funcionarios.length > 0 && (
                <div className="departamento-tabela-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="col-codigo">CÓDIGO</th>
                        <th className="col-nome">NOME</th>
                        <th className="col-nome">CPF</th>
                        <th className="col-nome">DEPARTAMENTO</th>
                        <th className="col-nome">JORNADA</th>
                        <th className="col-nome">PERFIL</th>
                        <th className="col-status">STATUS</th>
                        <th className="col-acoes">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funcionarios.map((funcionario) => (
                        <tr key={funcionario.ID_FUNCIONARIO}>
                          <td className="col-codigo">{formatarCodigoFuncionario(funcionario.ID_FUNCIONARIO)}</td>
                          <td className="col-nome">{funcionario.NOME_COMPLETO}</td>
                          <td className="col-nome">{formatarCpf(funcionario.CPF)}</td>
                          <td className="col-nome">{funcionario.NOME_DEPARTAMENTO || "-"}</td>
                          <td className="col-nome">{funcionario.NOME_JORNADA || "-"}</td>
                          <td className="col-nome">{funcionario.NOME_PERFIL || "-"}</td>
                          <td className="col-status">
                            <span
                              className={
                                funcionario.ATIVO === 1 && !funcionario.DATA_DEMISSAO
                                  ? "badge badge-success"
                                  : "badge badge-danger"
                              }
                            >
                              {funcionario.ATIVO === 1 && !funcionario.DATA_DEMISSAO
                                ? "ATIVO"
                                : "INATIVO"}
                            </span>
                          </td>
                          <td className="col-acoes">
                            <button
                              type="button"
                              className="button button-secondary"
                              onClick={() => preencherParaEdicao(funcionario)}
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
