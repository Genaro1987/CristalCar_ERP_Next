"use client";

import { HeaderBar } from "@/components/HeaderBar";
import LayoutShell from "@/components/LayoutShell";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

function sanitizeCnpj(value: string): string {
  return value.replace(/\D/g, "");
}

export default function CadastroEmpresaPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [logoFileName, setLogoFileName] = useState<string>("Nenhum arquivo selecionado");
  const [cnpj, setCnpj] = useState("");
  const [formErrors, setFormErrors] = useState<{ cnpj?: string }>({});

  const aoSalvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
    setFormErrors({});

    const cleanedCnpj = sanitizeCnpj(cnpj);

    if (cleanedCnpj.length !== 14) {
      setFormErrors({ cnpj: "CNPJ deve conter exatamente 14 digitos." });
      return;
    }

    setCarregando(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("CNPJ", cleanedCnpj);

    const ativaInput = form.elements.namedItem("ATIVA") as HTMLInputElement | null;
    formData.set("ATIVA", ativaInput?.checked ? "1" : "0");

    try {
      const resposta = await fetch("/api/empresas", {
        method: "POST",
        body: formData,
      });

      const json = await resposta.json();

      if (resposta.status === 201 && json?.success) {
        router.push("/");
        return;
      }

      if (json?.error === "CNPJ_INVALIDO") {
        setFormErrors({ cnpj: "CNPJ deve conter exatamente 14 digitos." });
        return;
      }

      if (resposta.status === 409 && json?.error === "CNPJ_JA_CADASTRADO") {
        setFormErrors({ cnpj: "CNPJ já cadastrado" });
        return;
      }

      setErro("Não foi possível salvar os dados. Tente novamente.");
    } catch (error) {
      console.error(error);
      setErro("Erro de conexão com o servidor.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <LayoutShell
      header={
        <HeaderBar
          codigoTela="CAD001_CORE_EMPRESA"
          nomeTela="CADASTRO DE EMPRESA"
          caminhoRota="/core/empresa/nova"
        />
      }
    >
      <main className="page-content">
        <section className="panel">
          <form className="form" onSubmit={aoSalvar}>
            <div className="form-grid two-columns">
              <div className="form-group">
                <label>Nome fantasia *</label>
                <input name="NOME_FANTASIA" required />
              </div>
              <div className="form-group">
                <label>Razão social *</label>
                <input name="RAZAO_SOCIAL" required />
              </div>
            </div>

            <div className="form-grid two-columns">
              <div className="form-group">
                <label>CNPJ *</label>
                <input
                  name="CNPJ"
                  value={cnpj}
                  onChange={(e) => {
                    setCnpj(e.target.value);
                    setFormErrors((prev) => ({ ...prev, cnpj: undefined }));
                  }}
                  required
                  className={formErrors.cnpj ? "input-error" : ""}
                />
                {formErrors.cnpj && <p className="field-error">{formErrors.cnpj}</p>}
              </div>
              <div className="form-group">
                <label>Inscrição estadual</label>
                <input name="INSCRICAO_ESTADUAL" />
              </div>
            </div>

            <div className="form-grid two-columns">
              <div className="form-group">
                <label>Inscrição municipal</label>
                <input name="INSCRICAO_MUNICIPAL" />
              </div>
              <div className="form-group">
                <label>Regime tributário</label>
                <select name="REGIME_TRIBUTARIO" defaultValue="">
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
                      const file = event.target.files?.[0];
                      setLogoFileName(file ? file.name : "Nenhum arquivo selecionado");
                    }}
                  />
                </label>
                <span className="file-upload-name">{logoFileName}</span>
              </div>
            </div>

            <div className="checkbox-row">
              <input defaultChecked type="checkbox" name="ATIVA" value="1" />
              <span>Ativa</span>
            </div>

            {erro && <p className="error-text">{erro}</p>}

            <div className="button-row">
              <button type="submit" disabled={carregando} className="button button-primary">
                {carregando ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="button button-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      </main>
    </LayoutShell>
  );
}
