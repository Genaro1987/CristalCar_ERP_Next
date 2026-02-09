"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { usePermissoes } from "@/app/_hooks/usePermissoes";
import Image from "next/image";

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

interface Perfil {
  ID_PERFIL: string;
  NOME_PERFIL: string;
  DESCRICAO?: string | null;
  ATIVO: 0 | 1;
}

export default function SelecaoEmpresaPage() {
  const router = useRouter();
  const { definirEmpresa } = useEmpresaSelecionada();
  const { aplicarPerfil, limparPermissoes } = usePermissoes();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [saudacao, setSaudacao] = useState("");
  const [dataHoje, setDataHoje] = useState("");

  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);
  const [perfisDisponiveis, setPerfisDisponiveis] = useState<Perfil[]>([]);
  const [carregandoPerfis, setCarregandoPerfis] = useState(false);

  useEffect(() => {
    const carregarEmpresas = async () => {
      try {
        const resposta = await fetch("/api/empresas");
        const json = await resposta.json();

        if (json?.success) {
          setEmpresas(json.data || []);
        } else {
          setErro("Nao foi possivel carregar as empresas.");
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

  async function handleSelecionar(empresa: Empresa) {
    definirEmpresa({
      id: empresa.ID_EMPRESA,
      nomeFantasia: empresa.NOME_FANTASIA,
      cnpj: empresa.CNPJ,
      logoUrl: empresa.LOGOTIPO_URL ?? null,
    });

    setEmpresaSelecionada(empresa);
    setCarregandoPerfis(true);

    try {
      const res = await fetch("/api/seg/perfis", {
        headers: { "x-empresa-id": String(empresa.ID_EMPRESA) },
      });
      const json = await res.json();
      const perfisAtivos = (json?.data ?? []).filter((p: Perfil) => p.ATIVO === 1);

      if (perfisAtivos.length === 0) {
        limparPermissoes();
        router.push("/core/empresa/nova");
      } else if (perfisAtivos.length === 1) {
        await aplicarPerfil(
          perfisAtivos[0].ID_PERFIL,
          perfisAtivos[0].NOME_PERFIL,
          empresa.ID_EMPRESA
        );
        router.push("/core/empresa/nova");
      } else {
        setPerfisDisponiveis(perfisAtivos);
      }
    } catch (err) {
      console.error(err);
      limparPermissoes();
      router.push("/core/empresa/nova");
    } finally {
      setCarregandoPerfis(false);
    }
  }

  async function handleSelecionarPerfil(perfil: Perfil) {
    if (!empresaSelecionada) return;
    await aplicarPerfil(perfil.ID_PERFIL, perfil.NOME_PERFIL, empresaSelecionada.ID_EMPRESA);
    router.push("/core/empresa/nova");
  }

  function handlePularPerfil() {
    limparPermissoes();
    router.push("/core/empresa/nova");
  }

  return (
    <LayoutShell>
      <div className="page-container">
        <HeaderBar
          codigoTela="CAD001_EMP_SELECAO"
          nomeTela="INICIAL"
          modulo="CADASTROS"
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

          {perfisDisponiveis.length > 0 && empresaSelecionada && (
            <div className="perfil-selector-overlay">
              <h3>SELECIONE O PERFIL DE ACESSO</h3>
              <p>
                Empresa: <strong>{empresaSelecionada.NOME_FANTASIA}</strong> —
                Selecione seu perfil para definir as permissoes de acesso.
              </p>
              <div className="perfil-card-list">
                {perfisDisponiveis.map((perfil) => (
                  <div
                    key={perfil.ID_PERFIL}
                    className="perfil-card"
                    onClick={() => handleSelecionarPerfil(perfil)}
                  >
                    <div className="perfil-card-info">
                      <span className="perfil-card-nome">
                        {perfil.ID_PERFIL} — {perfil.NOME_PERFIL}
                      </span>
                      {perfil.DESCRICAO && (
                        <span className="perfil-card-desc">{perfil.DESCRICAO}</span>
                      )}
                    </div>
                    <button type="button" className="perfil-card-btn">
                      SELECIONAR
                    </button>
                  </div>
                ))}
              </div>
              <div className="perfil-skip-btn">
                <button type="button" onClick={handlePularPerfil}>
                  Continuar sem perfil (acesso total)
                </button>
              </div>
            </div>
          )}

          {carregandoPerfis && (
            <p className="helper-text">Carregando perfis de acesso...</p>
          )}

          <div>
            {empresas.map((empresa) => {
              const ativa = empresa.ATIVA === 1;

              return (
                <div className="empresa-card" key={empresa.ID_EMPRESA}>
                  <div className="empresa-card-logo">
                    {empresa.LOGOTIPO_URL && (
                      <Image
                        src={empresa.LOGOTIPO_URL}
                        alt={empresa.NOME_FANTASIA}
                        width={120}
                        height={80}
                        className="empresa-card-logo-img"
                        unoptimized
                      />
                    )}
                  </div>
                  <div className="empresa-card-info">
                    <div className="empresa-nome">{empresa.NOME_FANTASIA}</div>
                    <div className="empresa-razao">
                      Razao social: {empresa.RAZAO_SOCIAL}
                    </div>
                    <div className="empresa-cnpj">CNPJ: {empresa.CNPJ}</div>
                  <span
                    className={
                      ativa ? "status-empresa-ativa" : "status-empresa-inativa"
                    }
                  >
                    {ativa ? "ATIVA" : "INATIVA"}
                  </span>
                  </div>
                  <div className="empresa-card-actions">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => handleSelecionar(empresa)}
                      disabled={carregandoPerfis}
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
