"use client";

import { HeaderBar } from "@/components/HeaderBar";
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
      header={
        <HeaderBar
          codigoTela="CORE010_SELECAO_EMPRESA"
          nomeTela="SELECAO DE EMPRESA"
          caminhoRota="/"
        />
      }
    >
      <div className="page-content">
        <div className="section-actions">
          <button
            onClick={() => router.push("/core/empresa/nova")}
            className="button button-primary"
          >
            CADASTRAR EMPRESA
          </button>
        </div>

        {carregando && <p>Carregando empresas...</p>}
        {erro && <p className="error-text">{erro}</p>}

        {!carregando && empresas.length === 0 && !erro && (
          <p className="helper-text">Nenhuma empresa cadastrada.</p>
        )}

        <div className="company-card-grid">
          {empresas.map((empresa) => (
            <div key={empresa.ID_EMPRESA} className="company-card">
              {empresa.LOGOTIPO_URL ? (
                <img
                  src={empresa.LOGOTIPO_URL}
                  alt={`Logotipo da ${empresa.NOME_FANTASIA}`}
                  className="company-logo"
                />
              ) : (
                <div className="company-logo-placeholder">Sem logotipo</div>
              )}

              <div style={{ fontWeight: 700, fontSize: 18 }}>{empresa.NOME_FANTASIA}</div>
              <div style={{ color: "#374151" }}>CNPJ: {empresa.CNPJ}</div>
              <div>
                <span className={`badge ${empresa.ATIVA === 1 ? "badge-success" : "badge-danger"}`}>
                  {empresa.ATIVA === 1 ? "ATIVA" : "INATIVA"}
                </span>
              </div>

              <button
                onClick={() => aoSelecionar(empresa)}
                className="button button-primary"
                style={{ marginTop: "auto" }}
              >
                SELECIONAR
              </button>
            </div>
          ))}
        </div>
      </div>
    </LayoutShell>
  );
}
