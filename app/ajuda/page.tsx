"use client";

import LayoutShell from "@/components/LayoutShell";
import { useEffect, useMemo, useState } from "react";

type Tela = {
  ID_TELA: number;
  CODIGO_TELA: string;
  NOME_TELA: string;
  MODULO: string | null;
  CAMINHO_ROTA: string | null;
};

type HelpData = {
  CODIGO_TELA: string;
  NOME_TELA: string;
  OBJETIVO_TELA?: string | null;
  QUANDO_UTILIZAR?: string | null;
  DESCRICAO_PROCESSO?: string | null;
  PASSO_A_PASSO?: string | null;
  CAMPOS_OBRIGATORIOS?: string | null;
  CAMPOS_OPCIONAIS?: string | null;
  REFLEXOS_PROCESSO?: string | null;
  ERROS_COMUNS?: string | null;
};

function HelpSection(props: { titulo: string; texto?: string | null }) {
  if (!props.texto) return null;
  return (
    <div className="help-section">
      <div className="help-section-title">{props.titulo}</div>
      <p className="help-section-body">{props.texto}</p>
    </div>
  );
}

export default function CentralAjudaPage() {
  const [telas, setTelas] = useState<Tela[]>([]);
  const [query, setQuery] = useState("");
  const [moduloSelecionado, setModuloSelecionado] = useState<string | null>(null);
  const [telaSelecionada, setTelaSelecionada] = useState<Tela | null>(null);
  const [help, setHelp] = useState<HelpData | null>(null);

  useEffect(() => {
    async function carregarTelas() {
      try {
        const res = await fetch("/api/telas");
        const data = await res.json();
        if (data.success) {
          const todas = data.telas.filter(
            (t: Tela) => t.CODIGO_TELA !== "HELP000_AJUDA_GERAL"
          );
          setTelas(todas);
        }
      } catch (error) {
        console.error("Erro ao carregar telas para ajuda", error);
      }
    }

    carregarTelas();
  }, []);

  const modulos = useMemo(() => {
    const set = new Set<string>();
    telas.forEach((t) => {
      if (t.MODULO) {
        set.add(t.MODULO.toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [telas]);

  useEffect(() => {
    if (modulos.length > 0 && !moduloSelecionado) {
      setModuloSelecionado(modulos[0]);
    }
  }, [modulos, moduloSelecionado]);

  const telasFiltradas = useMemo(() => {
    const q = query.trim().toUpperCase();
    return telas.filter((t) => {
      if (moduloSelecionado && (t.MODULO ?? "").toUpperCase() !== moduloSelecionado) {
        return false;
      }
      if (!q) return true;
      const nome = (t.NOME_TELA ?? "").toUpperCase();
      const cod = (t.CODIGO_TELA ?? "").toUpperCase();
      return nome.includes(q) || cod.includes(q);
    });
  }, [telas, moduloSelecionado, query]);

  async function handleSelecionarTela(tela: Tela) {
    setTelaSelecionada(tela);
    try {
      const res = await fetch(`/api/ajuda?tela=${encodeURIComponent(tela.CODIGO_TELA)}`);
      const data = await res.json();
      if (data.success && data.help) {
        setHelp(data.help);
      } else {
        setHelp({
          CODIGO_TELA: tela.CODIGO_TELA,
          NOME_TELA: tela.NOME_TELA,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar ajuda da tela", error);
    }
  }

  return (
    <LayoutShell>
      <div className="page-container help-page">
        <header className="page-header-wrapper">
          <div className="page-header-card">
            <div>
              <h1>CENTRAL DE AJUDA</h1>
              <p className="help-header-code">HELP000_AJUDA_GERAL | /AJUDA</p>
            </div>
          </div>
        </header>

        <main className="page-content-card help-body">
          <section className="help-sidebar">
            <div className="help-modulo-column">
              {modulos.map((mod) => (
                <button
                  key={mod}
                  type="button"
                  className={
                    moduloSelecionado === mod ? "help-modulo-tab active" : "help-modulo-tab"
                  }
                  onClick={() => setModuloSelecionado(mod)}
                >
                  {mod}
                </button>
              ))}
            </div>

            <div className="help-screen-column">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                placeholder="Pesquisar tela por nome ou codigo..."
                className="help-search-input"
              />

              <div className="help-screen-list">
                {telasFiltradas.map((tela) => (
                  <button
                    key={tela.CODIGO_TELA}
                    type="button"
                    className={
                      telaSelecionada?.CODIGO_TELA === tela.CODIGO_TELA
                        ? "help-screen-item active"
                        : "help-screen-item"
                    }
                    onClick={() => handleSelecionarTela(tela)}
                  >
                    <span className="help-screen-name">{tela.NOME_TELA}</span>
                    <span className="help-screen-code">{tela.CODIGO_TELA}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="help-content">
            {help ? (
              <>
                <h2 className="help-title">{help.NOME_TELA}</h2>
                <p className="help-code">{help.CODIGO_TELA}</p>

                <HelpSection titulo="Objetivo" texto={help.OBJETIVO_TELA} />
                <HelpSection titulo="Quando utilizar" texto={help.QUANDO_UTILIZAR} />
                <HelpSection titulo="Descricao" texto={help.DESCRICAO_PROCESSO} />
                <HelpSection titulo="Passo a passo" texto={help.PASSO_A_PASSO} />
                <HelpSection titulo="Campos obrigatorios" texto={help.CAMPOS_OBRIGATORIOS} />
                <HelpSection titulo="Campos opcionais" texto={help.CAMPOS_OPCIONAIS} />
                <HelpSection titulo="Reflexos no processo" texto={help.REFLEXOS_PROCESSO} />
                <HelpSection titulo="Erros comuns" texto={help.ERROS_COMUNS} />
              </>
            ) : (
              <p>Selecione uma tela no modulo ao lado para visualizar o help.</p>
            )}
          </section>
        </main>
      </div>
    </LayoutShell>
  );
}
