"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { useEffect, useState } from "react";

export default function AjudaPage() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [help, setHelp] = useState<any | null>(null);

  const buscarTelas = async () => {
    const query = term.trim();
    const url = query ? `/api/telas?q=${encodeURIComponent(query)}` : "/api/telas";
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      setResults(data.telas);
    }
  };

  const carregarHelp = async (codigoTela: string) => {
    const res = await fetch(`/api/ajuda?tela=${codigoTela}`);
    const data = await res.json();
    if (data.success) {
      setHelp(data.help);
    } else {
      setHelp(null);
    }
  };

  useEffect(() => {
    buscarTelas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LayoutShell>
      <HeaderBar
        codigoTela="HELP000_AJUDA_GERAL"
        nomeTela="CENTRAL DE AJUDA"
        caminhoRota="/ajuda"
        modulo="CORE"
      />
      <main className="page-content">
        <section className="panel">
          <div className="ajuda-search-block">
            <input
              type="text"
              placeholder="Pesquisar tela por codigo ou nome..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <button
              type="button"
              className="button button-primary"
              onClick={buscarTelas}
            >
              Buscar
            </button>
          </div>

          <div className="ajuda-layout">
            <div className="ajuda-telas-lista">
              {results.map((tela) => (
                <button
                  key={tela.ID_TELA}
                  type="button"
                  onClick={() => carregarHelp(tela.CODIGO_TELA)}
                >
                  {tela.CODIGO_TELA} - {tela.NOME_TELA}
                </button>
              ))}
            </div>

            <div className="ajuda-detalhe">
              {help ? (
                <>
                  <h2>
                    {help.CODIGO_TELA} - {help.NOME_TELA}
                  </h2>
                  <p>
                    <strong>Objetivo:</strong> {help.OBJETIVO_TELA}
                  </p>
                  <p>
                    <strong>Quando utilizar:</strong> {help.QUANDO_UTILIZAR}
                  </p>
                  <p>
                    <strong>Descricao:</strong> {help.DESCRICAO_PROCESSO}
                  </p>
                  <p>
                    <strong>Passo a passo:</strong> {help.PASSO_A_PASSO}
                  </p>
                  <p>
                    <strong>Campos obrigatorios:</strong> {help.CAMPOS_OBRIGATORIOS}
                  </p>
                  <p>
                    <strong>Campos opcionais:</strong> {help.CAMPOS_OPCIONAIS}
                  </p>
                  <p>
                    <strong>Reflexos no processo:</strong> {help.REFLEXOS_PROCESSO}
                  </p>
                  <p>
                    <strong>Erros comuns:</strong> {help.ERROS_COMUNS}
                  </p>
                </>
              ) : (
                <p>Selecione uma tela para visualizar o help.</p>
              )}
            </div>
          </div>
        </section>
      </main>
    </LayoutShell>
  );
}
