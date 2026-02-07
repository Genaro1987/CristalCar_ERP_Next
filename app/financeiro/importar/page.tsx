"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
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
    { campo: "codigo", label: "Código", obrigatorio: true },
    { campo: "nome", label: "Nome", obrigatorio: true },
    { campo: "natureza", label: "Natureza (RECEITA/DESPESA)", obrigatorio: false },
  ],
  centro_custo: [
    { campo: "codigo", label: "Código", obrigatorio: true },
    { campo: "nome", label: "Nome", obrigatorio: true },
    { campo: "descricao", label: "Descrição", obrigatorio: false },
  ],
  lancamentos: [
    { campo: "data", label: "Data", obrigatorio: true },
    { campo: "historico", label: "Histórico", obrigatorio: true },
    { campo: "conta", label: "Plano de Conta (código ou nome)", obrigatorio: true },
    { campo: "valor", label: "Valor", obrigatorio: true },
    { campo: "tipo", label: "Tipo (Entrada/Saída)", obrigatorio: false },
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
  const nomeTela = tela?.NOME_TELA ?? "Importação de Dados";
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

      // Auto-map matching columns
      const autoMap: Record<string, string> = {};
      for (const campo of camposDoTipo) {
        const campoLower = campo.campo.toLowerCase();
        const labelLower = campo.label.toLowerCase();
        const match = h.find((hdr) => {
          const hdrLower = hdr.toLowerCase();
          return hdrLower === campoLower || hdrLower.includes(campoLower) || hdrLower.includes(labelLower);
        });
        if (match) autoMap[campo.campo] = match;
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
      </div>
    </LayoutShell>
  );
}
