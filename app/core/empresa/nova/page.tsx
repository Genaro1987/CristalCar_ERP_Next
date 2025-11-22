"use client";

import LayoutShell from "@/components/LayoutShell";
import { CSSProperties, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function CadastroEmpresaPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const aoSalvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
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
        router.push("/");
        return;
      }

      if (resposta.status === 409 && json?.error === "CNPJ_JA_CADASTRADO") {
        setErro("CNPJ já cadastrado");
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
    <LayoutShell codigoTela="CAD001_CORE_EMPRESA" nomeTela="CADASTRO DE EMPRESA">
      <form
        onSubmit={aoSalvar}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: 640,
          backgroundColor: "#fff",
          padding: 24,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Nome fantasia *</span>
            <input name="NOME_FANTASIA" required style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Razão social *</span>
            <input name="RAZAO_SOCIAL" required style={inputStyle} />
          </label>
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>CNPJ *</span>
            <input name="CNPJ" required style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Inscrição estadual</span>
            <input name="INSCRICAO_ESTADUAL" style={inputStyle} />
          </label>
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Inscrição municipal</span>
            <input name="INSCRICAO_MUNICIPAL" style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Regime tributário</span>
            <select name="REGIME_TRIBUTARIO" defaultValue="" style={inputStyle}>
              <option value="">Selecione</option>
              <option value="SIMPLES_NACIONAL">SIMPLES NACIONAL</option>
              <option value="LUCRO_PRESUMIDO">LUCRO PRESUMIDO</option>
              <option value="LUCRO_REAL">LUCRO REAL</option>
              <option value="MEI">MEI</option>
            </select>
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Logotipo (opcional)</span>
          <input name="LOGOTIPO" type="file" accept="image/*" style={inputStyle} />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            defaultChecked
            type="checkbox"
            name="ATIVA"
            value="1"
            style={{ width: 18, height: 18 }}
          />
          <span>Ativa</span>
        </label>

        {erro && <p style={{ color: "#b91c1c", fontWeight: 600 }}>{erro}</p>}

        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button
            type="submit"
            disabled={carregando}
            style={{
              backgroundColor: "#f97316",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
              opacity: carregando ? 0.8 : 1,
            }}
          >
            {carregando ? "Salvando..." : "Salvar"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              backgroundColor: "#e5e7eb",
              color: "#111827",
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </LayoutShell>
  );
}

const inputStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "10px 12px",
  outline: "none",
  fontSize: 14,
};
