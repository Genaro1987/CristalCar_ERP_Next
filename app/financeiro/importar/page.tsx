"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import React, { useState, useRef, useMemo } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

type TipoImportacao = "plano_contas" | "centro_custo" | "lancamentos";

type CampoMapeamento = {
  campo: string;
  label: string;
  obrigatorio: boolean;
};

const CAMPOS_POR_TIPO: Record<TipoImportacao, CampoMapeamento[]> = {
  plano_contas: [
    { campo: "codigo", label: "Codigo", obrigatorio: true },
    { campo: "nome", label: "Nome", obrigatorio: true },
    { campo: "natureza", label: "Natureza (RECEITA/DESPESA)", obrigatorio: false },
    { campo: "contaPai", label: "Conta Pai (codigo)", obrigatorio: false },
    { campo: "tipo", label: "Tipo (SINTETICA/ANALITICA)", obrigatorio: false },
    { campo: "dataInclusao", label: "Data de Inclusao", obrigatorio: false },
  ],
  centro_custo: [
    { campo: "codigo", label: "Codigo", obrigatorio: true },
    { campo: "nome", label: "Nome", obrigatorio: true },
    { campo: "descricao", label: "Descricao", obrigatorio: false },
  ],
  lancamentos: [
    { campo: "data", label: "Data", obrigatorio: true },
    { campo: "historico", label: "Historico / Descricao", obrigatorio: false },
    { campo: "conta", label: "Plano de Conta (codigo ou nome)", obrigatorio: true },
    { campo: "valor", label: "Valor", obrigatorio: true },
    { campo: "tipo", label: "Tipo (Entrada/Saida)", obrigatorio: false },
    { campo: "operacao", label: "Operacao (Entrada/Saida)", obrigatorio: false },
    { campo: "centroCusto", label: "Centro de Custo", obrigatorio: false },
    { campo: "documento", label: "Documento", obrigatorio: false },
  ],
};

const TIPO_LABELS: Record<TipoImportacao, string> = {
  plano_contas: "Plano de Contas",
  centro_custo: "Centro de Custo",
  lancamentos: "Lançamentos de Caixa",
};

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect separator: tab, semicolon, or comma
  const firstLine = lines[0];
  let sep = ",";
  if (firstLine.includes("\t")) sep = "\t";
  else if (firstLine.split(";").length > firstLine.split(",").length) sep = ";";

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === sep && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    return obj;
  });

  return { headers, rows };
}

export default function ImportarPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/importar";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_IMPORTAR";
  const nomeTela = tela?.NOME_TELA ?? "IMPORTACAO DE DADOS";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [tipo, setTipo] = useState<TipoImportacao>("plano_contas");
  const [etapa, setEtapa] = useState<"selecao" | "mapeamento" | "resultado">("selecao");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dados, setDados] = useState<Record<string, string>[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({});
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ importados: number; erros: string[] } | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const camposDoTipo = CAMPOS_POR_TIPO[tipo];

  const previewDados = useMemo(() => dados.slice(0, 5), [dados]);

  const handleArquivoSelecionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNotification(null);
    setResultado(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setNotification({ type: "error", message: "Arquivo vazio ou ilegível" });
        return;
      }

      const { headers: h, rows } = parseCSV(text);

      if (h.length === 0 || rows.length === 0) {
        setNotification({ type: "error", message: "Arquivo sem dados válidos" });
        return;
      }

      setHeaders(h);
      setDados(rows);

      // Auto-map matching columns with smart heuristics
      const autoMap: Record<string, string> = {};
      const headersLower = h.map((hdr) => hdr.toLowerCase().trim());

      if (tipo === "lancamentos") {
        // Smart mapping for common Excel formats (e.g., ID, Data, Operacao, Tipo, Conta, Valor, Data do Registro)
        const mapHeuristics: Record<string, string[]> = {
          data: ["data", "data lancamento", "dt"],
          historico: ["conta", "descricao", "historico", "descr", "obs", "observacao"],
          conta: ["tipo", "plano", "plano de conta", "categoria", "classificacao"],
          valor: ["valor", "vlr", "montante", "total"],
          tipo: ["tipo"],
          operacao: ["operacao", "operação", "op", "entrada/saida", "entrada_saida"],
          centroCusto: ["centro", "centro custo", "centro de custo", "cc"],
          documento: ["documento", "doc", "nf", "nota"],
        };

        // First pass: try exact matches
        for (const [campo, aliases] of Object.entries(mapHeuristics)) {
          const match = h.find((hdr) => aliases.includes(hdr.toLowerCase().trim()));
          if (match) autoMap[campo] = match;
        }

        // Handle conflict: if both "tipo" and "conta" map to "Tipo" column,
        // and there's a separate "Conta" column, resolve it:
        // "Tipo" (TERCEIROS, GASTO FIXO etc) = plano de contas → campo "conta"
        // "Conta" (description text) = historico → campo "historico"
        const temColTipo = h.find((hdr) => hdr.toLowerCase().trim() === "tipo");
        const temColConta = h.find((hdr) => hdr.toLowerCase().trim() === "conta");
        const temColOperacao = h.find((hdr) => hdr.toLowerCase().trim() === "operacao" || hdr.toLowerCase().trim() === "operação");

        if (temColTipo && temColConta) {
          autoMap["conta"] = temColTipo;
          autoMap["historico"] = temColConta;
          if (temColOperacao) {
            autoMap["operacao"] = temColOperacao;
          }
          delete autoMap["tipo"];
        }

        // Find "Data" but not "Data do Registro" for the main date
        const dataHeaders = h.filter((hdr) => hdr.toLowerCase().includes("data"));
        if (dataHeaders.length >= 1) {
          const mainData = dataHeaders.find((hdr) => hdr.toLowerCase().trim() === "data") ?? dataHeaders[0];
          autoMap["data"] = mainData;
        }
      } else {
        // Default mapping for plano_contas and centro_custo
        for (const campo of camposDoTipo) {
          const campoLower = campo.campo.toLowerCase();
          const labelLower = campo.label.toLowerCase();
          const match = h.find((hdr) => {
            const hdrLower = hdr.toLowerCase();
            return hdrLower === campoLower || hdrLower.includes(campoLower) || hdrLower.includes(labelLower);
          });
          if (match) autoMap[campo.campo] = match;
        }
      }
      setMapeamento(autoMap);
      setEtapa("mapeamento");
    };

    reader.readAsText(file, "UTF-8");
  };

  const handleImportar = async () => {
    if (!empresa?.id) return;

    // Validate required fields are mapped
    const camposFaltando = camposDoTipo
      .filter((c) => c.obrigatorio && !mapeamento[c.campo])
      .map((c) => c.label);

    if (camposFaltando.length > 0) {
      setNotification({
        type: "error",
        message: `Mapear campos obrigatórios: ${camposFaltando.join(", ")}`,
      });
      return;
    }

    setImportando(true);
    setNotification(null);

    try {
      const resp = await fetch("/api/financeiro/importar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-empresa-id": String(empresa.id),
        },
        body: JSON.stringify({ tipo, dados, mapeamento }),
      });

      const json = await resp.json();

      if (json.success) {
        setResultado(json.data);
        setEtapa("resultado");

        if (json.data.erros.length === 0) {
          setNotification({
            type: "success",
            message: `${json.data.importados} registros importados com sucesso!`,
          });
        } else {
          setNotification({
            type: "info",
            message: `${json.data.importados} importados, ${json.data.erros.length} com problemas`,
          });
        }
      } else {
        setNotification({ type: "error", message: json.error || "Erro na importação" });
      }
    } catch (err) {
      setNotification({ type: "error", message: "Erro de conexão" });
    } finally {
      setImportando(false);
    }
  };

  const resetar = () => {
    setEtapa("selecao");
    setHeaders([]);
    setDados([]);
    setMapeamento({});
    setResultado(null);
    setNotification(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <LayoutShell>
      <div className="page-container financeiro-page">
        <HeaderBar
          nomeTela={nomeTela}
          codigoTela={codigoTela}
          caminhoRota={caminhoTela}
          modulo={moduloTela}
        />

        <PaginaProtegida codigoTela={codigoTela}>
        <main className="page-content-card">
          {notification && <NotificationBar type={notification.type} message={notification.message} />}

          {/* Step 1: Select type and file */}
          <section className="panel">
            <div className="form-section-header">
              <div>
                <h2>Importação de Dados</h2>
                <p>Selecione o tipo de dados e o arquivo CSV para importar.</p>
              </div>
              {etapa !== "selecao" && (
                <button type="button" className="button button-secondary" onClick={resetar}>
                  Nova importação
                </button>
              )}
            </div>

            <div className="form-grid two-columns" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label htmlFor="import-tipo">Tipo de importação</label>
                <select
                  id="import-tipo"
                  className="form-input"
                  value={tipo}
                  onChange={(e) => { setTipo(e.target.value as TipoImportacao); resetar(); }}
                  disabled={etapa !== "selecao"}
                >
                  <option value="plano_contas">Plano de Contas</option>
                  <option value="centro_custo">Centro de Custo</option>
                  <option value="lancamentos">Lançamentos de Caixa</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="import-arquivo">Arquivo (CSV, TXT)</label>
                <input
                  ref={fileRef}
                  id="import-arquivo"
                  type="file"
                  accept=".csv,.txt,.tsv"
                  className="form-input"
                  onChange={handleArquivoSelecionado}
                  disabled={etapa !== "selecao"}
                />
              </div>
            </div>

            {etapa === "selecao" && (
              <div style={{ marginTop: 16, padding: 16, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <strong style={{ fontSize: "0.85rem", color: "#374151" }}>
                  Campos para {TIPO_LABELS[tipo]}:
                </strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {camposDoTipo.map((c) => (
                    <span
                      key={c.campo}
                      className="badge"
                      style={{
                        backgroundColor: c.obrigatorio ? "#dbeafe" : "#f3f4f6",
                        color: c.obrigatorio ? "#1e40af" : "#6b7280",
                        fontSize: "0.78rem",
                        padding: "4px 10px",
                      }}
                    >
                      {c.label} {c.obrigatorio && "*"}
                    </span>
                  ))}
                </div>
                {tipo === "lancamentos" && (
                  <p style={{ marginTop: 10, fontSize: "0.8rem", color: "#6b7280" }}>
                    Dica: Se seu arquivo tem colunas como &quot;Tipo&quot; (ex: TERCEIROS, GASTO FIXO, PECAS) e &quot;Conta&quot; (descricao),
                    mapeie &quot;Tipo&quot; para &quot;Plano de Conta&quot; e &quot;Conta&quot; para &quot;Historico&quot;.
                    O sistema busca o plano de contas pelo nome, inclusive com correspondencia parcial.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Step 2: Column mapping */}
          {etapa === "mapeamento" && (
            <section className="panel" style={{ marginTop: 16 }}>
              <div className="form-section-header">
                <div>
                  <h2>Mapeamento de Colunas</h2>
                  <p>
                    {dados.length} linhas encontradas. Associe cada campo do sistema a uma coluna do arquivo.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleImportar}
                  disabled={importando}
                >
                  {importando ? "Importando..." : `Importar ${dados.length} registros`}
                </button>
              </div>

              <div className="form-grid two-columns" style={{ marginTop: 16 }}>
                {camposDoTipo.map((campo) => (
                  <div key={campo.campo} className="form-group">
                    <label htmlFor={`map-${campo.campo}`}>
                      {campo.label} {campo.obrigatorio && <span style={{ color: "#dc2626" }}>*</span>}
                    </label>
                    <select
                      id={`map-${campo.campo}`}
                      className="form-input"
                      value={mapeamento[campo.campo] ?? ""}
                      onChange={(e) =>
                        setMapeamento((prev) => ({ ...prev, [campo.campo]: e.target.value }))
                      }
                    >
                      <option value="">-- Não mapear --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              {previewDados.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h3 style={{ fontSize: "0.9rem", color: "#374151", marginBottom: 8 }}>
                    Prévia dos dados (primeiros {previewDados.length} registros)
                  </h3>
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>#</th>
                          {camposDoTipo.map((c) => (
                            <th key={c.campo}>{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewDados.map((row, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            {camposDoTipo.map((c) => {
                              const coluna = mapeamento[c.campo];
                              return (
                                <td key={c.campo} style={{ fontSize: "0.82rem" }}>
                                  {coluna ? row[coluna] ?? "" : <span style={{ color: "#9ca3af" }}>--</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Step 3: Results */}
          {etapa === "resultado" && resultado && (
            <section className="panel" style={{ marginTop: 16 }}>
              <div className="form-section-header">
                <h2>Resultado da Importação</h2>
              </div>

              <div className="summary-cards" style={{ marginTop: 12 }}>
                <div className="summary-card">
                  <span className="summary-label">Importados</span>
                  <strong className="summary-value" style={{ color: "#059669" }}>
                    {resultado.importados}
                  </strong>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Erros</span>
                  <strong className="summary-value" style={{ color: resultado.erros.length > 0 ? "#dc2626" : "#059669" }}>
                    {resultado.erros.length}
                  </strong>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Total no arquivo</span>
                  <strong className="summary-value">{dados.length}</strong>
                </div>
              </div>

              {resultado.erros.length > 0 && (
                <div style={{ marginTop: 16, maxHeight: 300, overflowY: "auto" }}>
                  <h3 style={{ fontSize: "0.9rem", color: "#991b1b", marginBottom: 8 }}>
                    Detalhes dos erros:
                  </h3>
                  <ul style={{ margin: 0, padding: "0 0 0 20px", fontSize: "0.82rem", color: "#6b7280" }}>
                    {resultado.erros.map((erro, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {erro}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}
