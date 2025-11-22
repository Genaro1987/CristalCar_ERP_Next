"use client";

import { useRouter } from "next/navigation";
import { KeyboardEvent, useEffect, useState } from "react";

type HeaderBarProps = {
  codigoTela: string;
  nomeTela: string;
  caminhoRota?: string;
  modulo?: string;
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

export function HeaderBar({ codigoTela, nomeTela, caminhoRota, modulo }: HeaderBarProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpData, setHelpData] = useState<any | null>(null);
  const [helpLoading, setHelpLoading] = useState(false);

  useEffect(() => {
    async function registrarTela() {
      try {
        await fetch("/api/telas/registrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codigoTela,
            nomeTela,
            caminhoRota: caminhoRota ?? "",
            modulo: modulo ?? "",
          }),
        });
      } catch (error) {
        console.error("Erro ao registrar tela", error);
      }
    }

    registrarTela();
  }, [codigoTela, nomeTela, caminhoRota, modulo]);

  const handleSearch = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const term = searchTerm.trim();
    if (!term) return;

    const res = await fetch(`/api/telas?q=${encodeURIComponent(term)}`);
    const data = await res.json();
    if (data.success) {
      setSearchResults(data.telas);
      setShowResults(true);
    }
  };

  const openHelp = async () => {
    setHelpOpen(true);
    setHelpLoading(true);
    const res = await fetch(`/api/ajuda?tela=${codigoTela}`);
    const data = await res.json();
    setHelpLoading(false);
    if (data.success) {
      setHelpData(data.help);
    } else {
      setHelpData(null);
    }
  };

  return (
    <header className="header-bar">
      <div>
        <h1 className="header-title">{nomeTela}</h1>
        <div className="header-subtitle">
          {codigoTela}
          {caminhoRota ? ` | ${caminhoRota}` : null}
        </div>
      </div>

      <div className="header-actions">
        <div className="header-search">
          <input
            type="text"
            placeholder="Pesquisar tela..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearch}
          />
          {showResults && (
            <div className="header-search-results">
              {searchResults.map((tela) => (
                <button
                  key={tela.ID_TELA}
                  type="button"
                  onClick={() => {
                    setShowResults(false);
                    router.push(tela.CAMINHO_ROTA);
                  }}
                >
                  {tela.CODIGO_TELA} - {tela.NOME_TELA}
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="header-help-button" onClick={openHelp}>
          ?
        </button>
      </div>

      {helpOpen && (
        <div className="help-panel">
          <div className="help-panel-content">
            <button
              type="button"
              className="help-panel-close"
              onClick={() => setHelpOpen(false)}
            >
              ×
            </button>

            {helpLoading && <p>Carregando ajuda...</p>}

            {!helpLoading && helpData && (
              <>
                <h2 className="help-title">{helpData.NOME_TELA}</h2>
                <p className="help-code">{helpData.CODIGO_TELA}</p>
                <HelpSection titulo="Objetivo" texto={helpData.OBJETIVO_TELA} />
                <HelpSection
                  titulo="Quando utilizar"
                  texto={helpData.QUANDO_UTILIZAR}
                />
                <HelpSection
                  titulo="Descricao"
                  texto={helpData.DESCRICAO_PROCESSO}
                />
                <HelpSection titulo="Passo a passo" texto={helpData.PASSO_A_PASSO} />
                <HelpSection
                  titulo="Campos obrigatorios"
                  texto={helpData.CAMPOS_OBRIGATORIOS}
                />
                <HelpSection
                  titulo="Campos opcionais"
                  texto={helpData.CAMPOS_OPCIONAIS}
                />
                <HelpSection
                  titulo="Reflexos no processo"
                  texto={helpData.REFLEXOS_PROCESSO}
                />
                <HelpSection titulo="Erros comuns" texto={helpData.ERROS_COMUNS} />
              </>
            )}

            {!helpLoading && !helpData && (
              <p>Ajuda ainda nao configurada para esta tela.</p>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
