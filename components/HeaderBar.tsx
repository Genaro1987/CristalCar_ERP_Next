"use client";

import { useRouter } from "next/navigation";
import { KeyboardEvent, useState } from "react";

type HeaderBarProps = {
  codigoTela: string;
  nomeTela: string;
  caminhoRota?: string;
};

export function HeaderBar({ codigoTela, nomeTela, caminhoRota }: HeaderBarProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpData, setHelpData] = useState<any | null>(null);
  const [helpLoading, setHelpLoading] = useState(false);

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
                <h2>
                  {helpData.CODIGO_TELA} - {helpData.NOME_TELA}
                </h2>
                <p>
                  <strong>Objetivo:</strong> {helpData.OBJETIVO_TELA}
                </p>
                <p>
                  <strong>Quando utilizar:</strong> {helpData.QUANDO_UTILIZAR}
                </p>
                <p>
                  <strong>Descricao:</strong> {helpData.DESCRICAO_PROCESSO}
                </p>
                <p>
                  <strong>Passo a passo:</strong> {helpData.PASSO_A_PASSO}
                </p>
                <p>
                  <strong>Campos obrigatorios:</strong> {helpData.CAMPOS_OBRIGATORIOS}
                </p>
                <p>
                  <strong>Campos opcionais:</strong> {helpData.CAMPOS_OPCIONAIS}
                </p>
                <p>
                  <strong>Reflexos no processo:</strong> {helpData.REFLEXOS_PROCESSO}
                </p>
                <p>
                  <strong>Erros comuns:</strong> {helpData.ERROS_COMUNS}
                </p>
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
