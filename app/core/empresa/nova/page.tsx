"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function CadastroEmpresaPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const aoSalvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotification(null);
    setCarregando(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const ativaInput = form.elements.namedItem("ATIVA") as HTMLInputElement | null;
    formData.set("ATIVA", ativaInput?.checked ? "1" : "0");

    try {
      const resposta = await fetch("/api/empresas", {
        method: "POST",
        body: formData,
      });

      const json = await resposta.json();

      if (resposta.status === 201 && json?.success) {
        setNotification({
          type: "success",
          message: "Empresa cadastrada com sucesso.",
        });
        setTimeout(() => router.push("/"), 600);
        return;
      }

      if (resposta.status === 409 && json?.error === "CNPJ_JA_CADASTRADO") {
        setNotification({ type: "error", message: "CNPJ já cadastrado." });
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
      <HeaderBar
        codigoTela="CAD001_CORE_EMPRESA"
        nomeTela="CADASTRO DE EMPRESA"
        caminhoRota="/core/empresa/nova"
      />

      <div className="page-content">
        {notification && (
          <NotificationBar
            type={notification.type}
            message={notification.message}
          />
        )}

        <div className="panel">
          <form className="form" onSubmit={aoSalvar}>
            <div className="form-grid two-columns">
              <div className="form-group">
                <label htmlFor="NOME_FANTASIA">Nome fantasia *</label>
                <input id="NOME_FANTASIA" name="NOME_FANTASIA" required />
              </div>
              <div className="form-group">
                <label htmlFor="RAZAO_SOCIAL">Razão social *</label>
                <input id="RAZAO_SOCIAL" name="RAZAO_SOCIAL" required />
              </div>
            </div>

            <div className="form-grid two-columns">
              <div className="form-group">
                <label htmlFor="CNPJ">CNPJ *</label>
                <input id="CNPJ" name="CNPJ" required />
              </div>
              <div className="form-group">
                <label htmlFor="INSCRICAO_ESTADUAL">Inscrição estadual</label>
                <input id="INSCRICAO_ESTADUAL" name="INSCRICAO_ESTADUAL" />
              </div>
            </div>

            <div className="form-grid two-columns">
              <div className="form-group">
                <label htmlFor="INSCRICAO_MUNICIPAL">Inscrição municipal</label>
                <input id="INSCRICAO_MUNICIPAL" name="INSCRICAO_MUNICIPAL" />
              </div>
              <div className="form-group">
                <label htmlFor="REGIME_TRIBUTARIO">Regime tributário</label>
                <select id="REGIME_TRIBUTARIO" name="REGIME_TRIBUTARIO" defaultValue="">
                  <option value="">Selecione</option>
                  <option value="SIMPLES_NACIONAL">SIMPLES NACIONAL</option>
                  <option value="LUCRO_PRESUMIDO">LUCRO PRESUMIDO</option>
                  <option value="LUCRO_REAL">LUCRO REAL</option>
                  <option value="MEI">MEI</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="LOGOTIPO">Logotipo (opcional)</label>
              <input
                id="LOGOTIPO"
                name="LOGOTIPO"
                type="file"
                accept="image/*"
              />
            </div>

            <label className="checkbox-row">
              <input
                defaultChecked
                type="checkbox"
                name="ATIVA"
                value="1"
                aria-label="Empresa ativa"
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
      </div>
    </LayoutShell>
  );
}
