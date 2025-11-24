"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";

function normalizarTextoBasico(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "");
}

function limparCnpj(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 14);
}

function formatarCnpj(valor: string): string {
  const v = limparCnpj(valor);
  if (!v) return "";

  return v
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, "$1/$2")
    .replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, "$1-$2");
}

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function CadastroEmpresaPage({ searchParams }: PageProps) {
  const router = useRouter();
  const modoParam = (searchParams?.modo as string | undefined) ?? null;
  const isNovo = modoParam === "novo";
  const { empresa, carregando: carregandoEmpresaSelecionada } =
    useEmpresaSelecionada();
  useRequerEmpresaSelecionada({ ativo: !isNovo });
  const [carregando, setCarregando] = useState(false);
  const [carregandoEmpresa, setCarregandoEmpresa] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [idEmpresaAtual, setIdEmpresaAtual] = useState<number | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [nomeFantasia, setNomeFantasia] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [regimeTributario, setRegimeTributario] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoFileName, setLogoFileName] = useState("Nenhum arquivo selecionado");
  const [ativa, setAtiva] = useState(true);

  useEffect(() => {
    if (isNovo) return;
    if (carregandoEmpresaSelecionada) return;

    const idNum = empresa?.id;
    if (!idNum) return;

    setModoEdicao(true);
    setIdEmpresaAtual(idNum);
    setCarregandoEmpresa(true);

    fetch(`/api/empresas/${idNum}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.empresa) {
          const empresaSelecionada = data.empresa;
          setNomeFantasia(normalizarTextoBasico(empresaSelecionada.NOME_FANTASIA ?? ""));
          setRazaoSocial(normalizarTextoBasico(empresaSelecionada.RAZAO_SOCIAL ?? ""));
          setCnpj(String(empresaSelecionada.CNPJ ?? "").replace(/\D/g, "").slice(0, 14));
          setInscricaoEstadual(normalizarTextoBasico(empresaSelecionada.INSCRICAO_ESTADUAL ?? ""));
          setInscricaoMunicipal(normalizarTextoBasico(empresaSelecionada.INSCRICAO_MUNICIPAL ?? ""));
          setRegimeTributario(empresaSelecionada.REGIME_TRIBUTARIO ?? "");
          setAtiva(empresaSelecionada.ATIVA === 1);
          setLogoFileName(
            empresaSelecionada.LOGOTIPO_URL
              ? "Logotipo já cadastrado"
              : "Nenhum arquivo selecionado"
          );
        }
      })
      .catch(() =>
        setNotification({
          type: "error",
          message: "Não foi possível carregar os dados da empresa selecionada.",
        })
      )
      .finally(() => setCarregandoEmpresa(false));
  }, [carregandoEmpresaSelecionada, empresa?.id, isNovo]);

  const aoSalvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotification(null);
    setCarregando(true);

    if (cnpj.length !== 14) {
      setNotification({
        type: "error",
        message: "CNPJ deve conter exatamente 14 digitos numericos.",
      });
      setCarregando(false);
      return;
    }

    const cnpjLimpo = cnpj.trim();

    const formData = new FormData();
    formData.append("NOME_FANTASIA", nomeFantasia.trim());
    formData.append("RAZAO_SOCIAL", razaoSocial.trim());
    formData.append("CNPJ", cnpjLimpo);
    formData.append("INSCRICAO_ESTADUAL", inscricaoEstadual.trim());
    formData.append("INSCRICAO_MUNICIPAL", inscricaoMunicipal.trim());
    formData.append("REGIME_TRIBUTARIO", regimeTributario.trim());
    formData.append("ATIVA", ativa ? "1" : "0");

    if (logoFile) {
      formData.append("LOGOTIPO", logoFile);
    }

    const url =
      modoEdicao && idEmpresaAtual
        ? `/api/empresas/${idEmpresaAtual}`
        : "/api/empresas";
    const method = modoEdicao && idEmpresaAtual ? "PUT" : "POST";

    try {
      const resposta = await fetch(url, {
        method,
        body: formData,
      });

      const json = await resposta.json();

      if ((resposta.status === 201 || resposta.status === 200) && json?.success) {
        setNotification({
          type: "success",
          message: modoEdicao
            ? "Empresa atualizada com sucesso."
            : "Empresa cadastrada com sucesso.",
        });
        setTimeout(() => router.push("/"), 600);
        return;
      }

      if (resposta.status === 409 && json?.error === "CNPJ_JA_CADASTRADO") {
        setNotification({ type: "error", message: "CNPJ já cadastrado." });
        return;
      }

      if (resposta.status === 400 && json?.error === "CNPJ_INVALIDO") {
        setNotification({ type: "error", message: "CNPJ inválido." });
        return;
      }

      if (resposta.status === 404 && json?.error === "EMPRESA_NAO_ENCONTRADA") {
        setNotification({
          type: "error",
          message: "Empresa selecionada não encontrada.",
        });
        return;
      }

      setNotification({
        type: "error",
        message: "Não foi possível salvar os dados. Tente novamente.",
      });
    } catch (error) {
      console.error(error);
      setNotification({
        type: "error",
        message: "Erro de conexão com o servidor.",
      });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="CAD002_EMP_EMPRESA"
          nomeTela="CADASTRO DE EMPRESA"
          caminhoRota="/core/empresa/nova"
          modulo="EMPRESA"
        />

        <main className="page-content-card">
          {notification && (
            <NotificationBar
              type={notification.type}
              message={notification.message}
            />
          )}

          <div className="panel">
            {carregandoEmpresa && <p>Carregando dados da empresa...</p>}
            <form className="form" onSubmit={aoSalvar}>
              <div className="form-grid two-columns">
                <div className="form-group">
                  <label htmlFor="NOME_FANTASIA">Nome fantasia *</label>
                  <input
                    id="NOME_FANTASIA"
                    name="NOME_FANTASIA"
                    required
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(normalizarTextoBasico(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="RAZAO_SOCIAL">Razão social *</label>
                  <input
                    id="RAZAO_SOCIAL"
                    name="RAZAO_SOCIAL"
                    required
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(normalizarTextoBasico(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-grid two-columns">
                <div className="form-group">
                  <label htmlFor="CNPJ">CNPJ *</label>
                  <input
                    id="CNPJ"
                    name="CNPJ"
                    required
                    value={formatarCnpj(cnpj)}
                    onChange={(e) => {
                      const apenasDigitos = limparCnpj(e.target.value);
                      setCnpj(apenasDigitos);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="INSCRICAO_ESTADUAL">Inscrição estadual</label>
                  <input
                    id="INSCRICAO_ESTADUAL"
                    name="INSCRICAO_ESTADUAL"
                    value={inscricaoEstadual}
                    onChange={(e) =>
                      setInscricaoEstadual(normalizarTextoBasico(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="form-grid two-columns">
                <div className="form-group">
                  <label htmlFor="INSCRICAO_MUNICIPAL">Inscrição municipal</label>
                  <input
                    id="INSCRICAO_MUNICIPAL"
                    name="INSCRICAO_MUNICIPAL"
                    value={inscricaoMunicipal}
                    onChange={(e) =>
                      setInscricaoMunicipal(normalizarTextoBasico(e.target.value))
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="REGIME_TRIBUTARIO">Regime tributário</label>
                  <select
                    id="REGIME_TRIBUTARIO"
                    name="REGIME_TRIBUTARIO"
                    value={regimeTributario}
                    onChange={(e) => setRegimeTributario(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    <option value="SIMPLES_NACIONAL">SIMPLES NACIONAL</option>
                    <option value="LUCRO_PRESUMIDO">LUCRO PRESUMIDO</option>
                    <option value="LUCRO_REAL">LUCRO REAL</option>
                    <option value="MEI">MEI</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Logotipo (opcional)</label>
                <div className="file-upload-wrapper">
                  <label className="file-upload-button">
                    Escolher arquivo
                    <input
                      type="file"
                      name="LOGOTIPO"
                      accept="image/*"
                      className="file-upload-input"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setLogoFile(file);
                        setLogoFileName(
                          file ? file.name : "Nenhum arquivo selecionado"
                        );
                      }}
                    />
                  </label>
                  <span className="file-upload-name">{logoFileName}</span>
                </div>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="ATIVA"
                  value="1"
                  aria-label="Empresa ativa"
                  checked={ativa}
                  onChange={(e) => setAtiva(e.target.checked)}
                />
                <span>Ativa</span>
              </label>

              <div className="button-row">
                <button
                  type="submit"
                  disabled={carregando}
                  className="button button-primary"
                >
                  {carregando ? "Salvando..." : "Salvar"}
                </button>

                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => router.push("/")}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </LayoutShell>
  );
}
