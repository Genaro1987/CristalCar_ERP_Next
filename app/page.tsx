"use client";

import LayoutShell from "@/components/LayoutShell";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Empresa {
  ID_EMPRESA: number;
  NOME_FANTASIA: string;
  RAZAO_SOCIAL: string;
  CNPJ: string;
  INSCRICAO_ESTADUAL?: string | null;
  INSCRICAO_MUNICIPAL?: string | null;
  REGIME_TRIBUTARIO?: string | null;
  LOGOTIPO_URL?: string | null;
  ATIVA: number;
  DATA_CADASTRO: string;
  DATA_ATUALIZACAO?: string | null;
}

export default function SelecaoEmpresaPage() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const carregarEmpresas = async () => {
      try {
        const resposta = await fetch("/api/empresas");
        const json = await resposta.json();

        if (json?.success) {
          setEmpresas(json.data || []);
        } else {
          setErro("Não foi possível carregar as empresas.");
        }
      } catch (err) {
        console.error(err);
        setErro("Erro ao conectar com o servidor.");
      } finally {
        setCarregando(false);
      }
    };

    carregarEmpresas();
  }, []);

  const aoSelecionar = (empresa: Empresa) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("EMPRESA_ATUAL_ID", String(empresa.ID_EMPRESA));
      localStorage.setItem("EMPRESA_ATUAL_NOME", empresa.NOME_FANTASIA);
    }

    router.push("/");
  };

  return (
    <LayoutShell
      codigoTela="CORE010_SELECAO_EMPRESA"
      nomeTela="SELECAO DE EMPRESA"
    >
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => router.push("/core/empresa/nova")}
          style={{
            backgroundColor: "#f97316",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          CADASTRAR EMPRESA
        </button>
      </div>

      {carregando && <p>Carregando empresas...</p>}
      {erro && <p style={{ color: "#b91c1c" }}>{erro}</p>}

      {!carregando && empresas.length === 0 && !erro && (
        <p style={{ color: "#374151" }}>Nenhuma empresa cadastrada.</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {empresas.map((empresa) => (
          <div
            key={empresa.ID_EMPRESA}
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 16,
              border: "1px solid #e5e7eb",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            {empresa.LOGOTIPO_URL ? (
              <img
                src={empresa.LOGOTIPO_URL}
                alt={`Logotipo da ${empresa.NOME_FANTASIA}`}
                style={{ width: "100%", height: 120, objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 120,
                  backgroundColor: "#f3f4f6",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                }}
              >
                Sem logotipo
              </div>
            )}

            <div style={{ fontWeight: 700, fontSize: 18 }}>{empresa.NOME_FANTASIA}</div>
            <div style={{ color: "#374151" }}>CNPJ: {empresa.CNPJ}</div>
            <div>
              <span
                style={{
                  backgroundColor: empresa.ATIVA === 1 ? "#dcfce7" : "#fee2e2",
                  color: empresa.ATIVA === 1 ? "#166534" : "#991b1b",
                  padding: "4px 8px",
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {empresa.ATIVA === 1 ? "ATIVA" : "INATIVA"}
              </span>
            </div>

            <button
              onClick={() => aoSelecionar(empresa)}
              style={{
                marginTop: "auto",
                backgroundColor: "#2563eb",
                color: "#fff",
                padding: "10px 12px",
                borderRadius: 8,
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              SELECIONAR
            </button>
          </div>
        ))}
      </div>
    </LayoutShell>
  );
}
