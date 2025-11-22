"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useHelpContext } from "./LayoutShell";

type HeaderBarProps = {
  codigoTela: string;
  nomeTela: string;
  caminhoRota?: string;
  modulo?: string;
};

type ScreenResult = {
  ID_TELA: number;
  CODIGO_TELA: string;
  NOME_TELA: string;
  CAMINHO_ROTA: string | null;
};

export function HeaderBar({ codigoTela, nomeTela, caminhoRota, modulo }: HeaderBarProps) {
  const router = useRouter();
  const { abrirAjuda } = useHelpContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScreenResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const isAjudaGeral = codigoTela === "HELP000_CORE_AJUDA";

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

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/telas?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (data.success) {
          setResults(data.telas);
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Erro ao pesquisar telas", error);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [query]);

  function handleSelecionarTela(tela: ScreenResult) {
    if (typeof window !== "undefined") {
      const rotaAlvo = tela.CAMINHO_ROTA || "/";
      const rotasLivres = ["/", "/ajuda"];
      const empresaId = window.localStorage.getItem("EMPRESA_ATUAL_ID");

      if (!empresaId && !rotasLivres.includes(rotaAlvo)) {
        console.warn("Nenhuma empresa selecionada. Redirecionando para a tela inicial.");
        router.push("/");
        return;
      }

      router.push(rotaAlvo);
      setIsOpen(false);
      setQuery("");
    }
  }

  return (
    <header className="page-header-wrapper">
      <div className="page-header-card">
        <div>
          <h1 className="header-title">{nomeTela}</h1>
          <div className="header-subtitle">
            {codigoTela}
            {caminhoRota ? ` | ${caminhoRota}` : null}
          </div>
        </div>

        <div className="header-actions">
          <div className="screen-search-container">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              placeholder="Pesquisar tela..."
              className="screen-search-input"
              onFocus={() => results.length > 0 && setIsOpen(true)}
            />
            {isOpen && results.length > 0 && (
              <div className="screen-search-results">
                {results.map((tela) => (
                  <button
                    key={tela.CODIGO_TELA}
                    type="button"
                    className="screen-search-item"
                    onClick={() => handleSelecionarTela(tela)}
                  >
                    <div className="screen-search-item-name">{tela.NOME_TELA}</div>
                    <div className="screen-search-item-code">{tela.CODIGO_TELA}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isAjudaGeral && (
            <button
              type="button"
              className="header-help-button"
              onClick={() => abrirAjuda(codigoTela, nomeTela)}
            >
              ?
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
