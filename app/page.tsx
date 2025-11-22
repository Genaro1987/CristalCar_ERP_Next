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
  const [saudacao, setSaudacao] = useState("");
  const [dataHoje, setDataHoje] = useState("");

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

  useEffect(() => {
    const agora = new Date();
    const hora = agora.getHours();

    let saud = "Boa noite";
    if (hora < 12) saud = "Bom dia";
    else if (hora < 18) saud = "Boa tarde";

    const formatador = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    setSaudacao(saud);
    setDataHoje(formatador.format(agora));
  }, []);

  function handleSelecionar(empresa: Empresa) {
    if (typeof window !== "undefined") {
      localStorage.setItem("EMPRESA_ATUAL_ID", String(empresa.ID_EMPRESA));
      localStorage.setItem("EMPRESA_ATUAL_NOME", empresa.NOME_FANTASIA ?? "");
      const logoUrl = empresa.LOGOTIPO_URL ?? "";
      localStorage.setItem("EMPRESA_ATUAL_LOGO_URL", logoUrl);
    }

    router.push("/core/empresa/nova");
  }

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="CAD001_EMP_SELECAO"
          nomeTela="INICIAL"
          caminhoRota="/"
          modulo="EMPRESA"
        />

        <main className="page-content-card">
          <section className="home-header">
            <div>
              <p className="home-greeting">{saudacao},</p>
              <h2 className="home-subtitle">BEM VINDO AO CRISTALCAR ERP</h2>
            </div>
            <div className="home-date">{dataHoje}</div>
          </section>

          <div className="section-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => router.push("/core/empresa/nova?modo=novo")}
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
                      className={`badge-status ${
                        ativa ? "badge-status-ativa" : "badge-status-inativa"
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
        </main>
      </div>
    </LayoutShell>
  );
}
