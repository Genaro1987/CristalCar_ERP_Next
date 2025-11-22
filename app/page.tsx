"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
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
  ATIVA: 0 | 1;
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

  function handleSelecionar(empresa: Empresa) {
    if (typeof window !== "undefined") {
      localStorage.setItem("EMPRESA_ATUAL_ID", String(empresa.ID_EMPRESA));
      localStorage.setItem("EMPRESA_ATUAL_NOME", empresa.NOME_FANTASIA ?? "");
      localStorage.setItem("EMPRESA_ATUAL_LOGO_URL", empresa.LOGOTIPO_URL ?? "");
    }

    router.push("/");
  }

  return (
    <LayoutShell>
      <HeaderBar
        codigoTela="CORE010_SELECAO_EMPRESA"
        nomeTela="SELECAO DE EMPRESA"
        caminhoRota="/"
      />

      <div className="page-content">
        <div className="section-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => router.push("/core/empresa/nova")}
          >
            CADASTRAR EMPRESA
          </button>
        </div>

        {carregando && <p>Carregando empresas...</p>}
        {erro && <p className="error-text">{erro}</p>}

        {!carregando && empresas.length === 0 && !erro && (
          <p className="helper-text">Nenhuma empresa cadastrada.</p>
        )}

        <div>
          {empresas.map((empresa) => {
            const ativa = empresa.ATIVA === 1;

            return (
              <div className="empresa-card" key={empresa.ID_EMPRESA}>
                <div className="empresa-card-logo">
                  {empresa.LOGOTIPO_URL && (
                    <img
                      src={empresa.LOGOTIPO_URL}
                      alt={empresa.NOME_FANTASIA}
                    />
                  )}
                </div>
                <div className="empresa-card-info">
                  <div className="empresa-nome">{empresa.NOME_FANTASIA}</div>
                  <div className="empresa-razao">
                    Razão social: {empresa.RAZAO_SOCIAL}
                  </div>
                  <div className="empresa-cnpj">CNPJ: {empresa.CNPJ}</div>
                  <span
                    className={`empresa-status ${
                      ativa ? "status-ativa" : "status-inativa"
                    }`}
                  >
                    {ativa ? "ATIVA" : "INATIVA"}
                  </span>
                </div>
                <div className="empresa-card-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => handleSelecionar(empresa)}
                  >
                    SELECIONAR
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </LayoutShell>
  );
}
