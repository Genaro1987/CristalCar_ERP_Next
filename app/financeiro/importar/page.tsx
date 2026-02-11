"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

// ============================================================================
// Types
// ============================================================================

type TipoImportacao = "plano_contas" | "centro_custo" | "lancamentos";

type CampoMapeamento = {
  campo: string;
  label: string;
  obrigatorio: boolean;
};

type AbaAtiva = "arquivos" | "lancamentos_financeiros";

type LancamentoFinanceiro = {
  _id: string; // internal tracking id
  codigo: string;
  descricao: string;
  conta: string;
  contaId: number | null;
  natureza: string;
  valor: string;
  dataInclusao: string;
  dataMovimento: string;
  placa: string;
  _editando?: boolean;
};

type PlanoContaOption = {
  id: number;
  codigo: string;
  nome: string;
  natureza: string;
};

// ============================================================================
// Constants
// ============================================================================

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

const CAMPOS_LANCAMENTO_FIN: CampoMapeamento[] = [
  { campo: "codigo", label: "Código", obrigatorio: false },
  { campo: "descricao", label: "Descrição", obrigatorio: true },
  { campo: "conta", label: "Conta (Plano de Contas)", obrigatorio: true },
  { campo: "natureza", label: "Natureza (RECEITA/DESPESA)", obrigatorio: false },
  { campo: "valor", label: "Valor", obrigatorio: true },
  { campo: "dataInclusao", label: "Data de Inclusão (digitação)", obrigatorio: false },
  { campo: "dataMovimento", label: "Data de Movimento (competência)", obrigatorio: true },
  { campo: "placa", label: "Placa do Veículo", obrigatorio: false },
];

const TIPO_LABELS: Record<TipoImportacao, string> = {
  plano_contas: "Plano de Contas",
  centro_custo: "Centro de Custo",
  lancamentos: "Lançamentos de Caixa",
};

// Regex patterns for Brazilian license plates
// Old format: ABC1234 or ABC-1234
// New Mercosul format: ABC1D23 or ABC-1D23
const PLACA_REGEX = /\b([A-Z]{3})-?(\d[A-Z0-9]\d{2})\b/i;
const PLACA_REGEX_ALT = /\b([A-Z]{3})-?(\d{4})\b/i;

function extrairPlaca(texto: string): string {
  if (!texto) return "";
  const upper = texto.toUpperCase();
  const match = upper.match(PLACA_REGEX) || upper.match(PLACA_REGEX_ALT);
  if (match) {
    const letras = match[1];
    const numeros = match[2];
    return `${letras}-${numeros}`;
  }
  return "";
}

let _nextId = 1;
function gerarId(): string {
  return `lanc_${Date.now()}_${_nextId++}`;
}

// ============================================================================
// CSV Parser
// ============================================================================

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

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

function parseValorBR(valorStr: string): number {
  if (!valorStr) return 0;
  const limpo = valorStr.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : Math.abs(num);
}

function formatarData(dataStr: string): string {
  if (!dataStr) return "";
  // Strip time portion: "06/02/2026 17:09" → "06/02/2026", "2026-02-06 17:09:00" → "2026-02-06"
  const semHora = dataStr.trim().split(/[\sT]/)[0];
  if (semHora.includes("/")) {
    const partes = semHora.split("/");
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;
    }
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(semHora)) {
    const partes = semHora.split("-");
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }
  // Already YYYY-MM-DD or unrecognized — return just date part
  return semHora;
}

// ============================================================================
// Main Component
// ============================================================================

export default function ImportarPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/importar";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_IMPORTAR";
  const nomeTela = tela?.NOME_TELA ?? "IMPORTACAO DE DADOS";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>("arquivos");
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // ============================================================
  // State for Aba 1: Importação de Arquivos (original)
  // ============================================================
  const [tipo, setTipo] = useState<TipoImportacao>("plano_contas");
  const [etapa, setEtapa] = useState<"selecao" | "mapeamento" | "resultado">("selecao");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dados, setDados] = useState<Record<string, string>[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({});
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ importados: number; erros: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ============================================================
  // State for Aba 2: Lançamentos Financeiros
  // ============================================================
  const [finEtapa, setFinEtapa] = useState<"selecao" | "mapeamento" | "edicao" | "resultado">("selecao");
  const [finHeaders, setFinHeaders] = useState<string[]>([]);
  const [finDadosBrutos, setFinDadosBrutos] = useState<Record<string, string>[]>([]);
  const [finMapeamento, setFinMapeamento] = useState<Record<string, string>>({});
  const [finLancamentos, setFinLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [finImportando, setFinImportando] = useState(false);
  const [finResultado, setFinResultado] = useState<{ importados: number; erros: string[] } | null>(null);
  const [finEditandoIdx, setFinEditandoIdx] = useState<number | null>(null);
  const [planoContas, setPlanoContas] = useState<PlanoContaOption[]>([]);
  const [finBusca, setFinBusca] = useState("");
  const [finPagina, setFinPagina] = useState(0);
  const finFileRef = useRef<HTMLInputElement>(null);

  const FIN_POR_PAGINA = 50;

  // Load plano de contas for aba 2
  useEffect(() => {
    if (!empresa?.id) return;
    const carregar = async () => {
      try {
        const res = await fetch("/api/financeiro/plano-contas", {
          headers: { "x-empresa-id": String(empresa.id) },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setPlanoContas(
              (json.data ?? []).map((i: any) => ({
                id: i.FIN_PLANO_CONTA_ID,
                codigo: i.FIN_PLANO_CONTA_CODIGO,
                nome: i.FIN_PLANO_CONTA_NOME,
                natureza: i.FIN_PLANO_CONTA_NATUREZA,
              }))
            );
          }
        }
      } catch (e) {
        console.error("Erro ao carregar plano de contas:", e);
      }
    };
    carregar();
  }, [empresa?.id]);

  // ============================================================
  // Aba 1: Handlers (original logic preserved)
  // ============================================================

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

      if (tipo === "lancamentos") {
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

        for (const [campo, aliases] of Object.entries(mapHeuristics)) {
          const match = h.find((hdr) => aliases.includes(hdr.toLowerCase().trim()));
          if (match) autoMap[campo] = match;
        }

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

        const dataHeaders = h.filter((hdr) => hdr.toLowerCase().includes("data"));
        if (dataHeaders.length >= 1) {
          const mainData = dataHeaders.find((hdr) => hdr.toLowerCase().trim() === "data") ?? dataHeaders[0];
          autoMap["data"] = mainData;
        }
      } else {
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
    } catch {
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

  // ============================================================
  // Aba 2: Lançamentos Financeiros Handlers
  // ============================================================

  const buscarContaPorRef = useCallback((ref: string): PlanoContaOption | undefined => {
    if (!ref) return undefined;
    const refUpper = ref.toUpperCase().trim();

    // Exact match by code
    const exatoCodigo = planoContas.find((p) => p.codigo.toUpperCase() === refUpper);
    if (exatoCodigo) return exatoCodigo;

    // Exact match by name
    const exatoNome = planoContas.find((p) => p.nome.toUpperCase() === refUpper);
    if (exatoNome) return exatoNome;

    // Partial match
    const parcial = planoContas.find(
      (p) => p.nome.toUpperCase().includes(refUpper) || refUpper.includes(p.nome.toUpperCase())
    );
    if (parcial) return parcial;

    // Normalized match
    const normalizar = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
    const refNorm = normalizar(refUpper);
    const parcialNorm = planoContas.find((p) => {
      const nomeNorm = normalizar(p.nome.toUpperCase());
      return nomeNorm.includes(refNorm) || refNorm.includes(nomeNorm);
    });
    return parcialNorm;
  }, [planoContas]);

  const handleFinArquivoSelecionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNotification(null);
    setFinResultado(null);

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

      setFinHeaders(h);
      setFinDadosBrutos(rows);

      // Auto-map columns
      const autoMap: Record<string, string> = {};
      const mapHeuristics: Record<string, string[]> = {
        codigo: ["codigo", "cod", "id", "ref", "referencia"],
        descricao: ["descricao", "descr", "historico", "conta", "obs", "observacao"],
        conta: ["tipo", "plano", "plano de conta", "categoria", "classificacao", "conta contabil"],
        natureza: ["natureza", "nat", "tipo conta"],
        valor: ["valor", "vlr", "montante", "total"],
        dataInclusao: ["data inclusao", "data digitacao", "data registro", "data cadastro", "dt inclusao"],
        dataMovimento: ["data", "data movimento", "data competencia", "dt movimento", "data lancamento", "dt"],
        placa: ["placa", "veiculo", "veículo"],
      };

      for (const [campo, aliases] of Object.entries(mapHeuristics)) {
        const match = h.find((hdr) => aliases.includes(hdr.toLowerCase().trim()));
        if (match) autoMap[campo] = match;
      }

      // Resolve ambiguity: "Data" alone → dataMovimento, "Data do Registro" → dataInclusao
      const dataHeaders = h.filter((hdr) => hdr.toLowerCase().includes("data"));
      if (dataHeaders.length >= 1 && !autoMap.dataMovimento) {
        const mainData = dataHeaders.find((hdr) => hdr.toLowerCase().trim() === "data") ?? dataHeaders[0];
        autoMap["dataMovimento"] = mainData;
      }
      if (dataHeaders.length >= 2 && !autoMap.dataInclusao) {
        const secondData = dataHeaders.find((hdr) => hdr.toLowerCase().includes("registro") || hdr.toLowerCase().includes("inclusao") || hdr.toLowerCase().includes("digitacao"));
        if (secondData) autoMap["dataInclusao"] = secondData;
      }

      // Handle "Tipo" vs "Conta" conflict
      const temColTipo = h.find((hdr) => hdr.toLowerCase().trim() === "tipo");
      const temColConta = h.find((hdr) => hdr.toLowerCase().trim() === "conta");
      if (temColTipo && temColConta) {
        autoMap["conta"] = temColTipo;
        autoMap["descricao"] = temColConta;
      }

      setFinMapeamento(autoMap);
      setFinEtapa("mapeamento");
    };

    reader.readAsText(file, "UTF-8");
  };

  const handleFinAplicarMapeamento = () => {
    // Validate required fields
    const camposFaltando = CAMPOS_LANCAMENTO_FIN
      .filter((c) => c.obrigatorio && !finMapeamento[c.campo])
      .map((c) => c.label);

    if (camposFaltando.length > 0) {
      setNotification({
        type: "error",
        message: `Mapear campos obrigatórios: ${camposFaltando.join(", ")}`,
      });
      return;
    }

    const hoje = new Date().toISOString().split("T")[0];

    // Transform raw data into structured lancamentos
    const lancamentos: LancamentoFinanceiro[] = finDadosBrutos.map((row) => {
      const getVal = (campo: string) => {
        const col = finMapeamento[campo];
        return col ? (row[col] ?? "").trim() : "";
      };

      const descricao = getVal("descricao");
      const contaRef = getVal("conta");
      const contaEncontrada = buscarContaPorRef(contaRef);
      const valorBruto = getVal("valor");
      const dataMovRaw = getVal("dataMovimento");
      const dataIncRaw = getVal("dataInclusao");
      const placaExplicita = getVal("placa");

      // Auto-detect placa from descricao
      const placaDetectada = placaExplicita || extrairPlaca(descricao);

      return {
        _id: gerarId(),
        codigo: getVal("codigo"),
        descricao,
        conta: contaEncontrada ? `${contaEncontrada.codigo} ${contaEncontrada.nome}` : contaRef,
        contaId: contaEncontrada?.id ?? null,
        natureza: getVal("natureza").toUpperCase() || contaEncontrada?.natureza || "",
        valor: String(parseValorBR(valorBruto)),
        dataInclusao: formatarData(dataIncRaw) || hoje,
        dataMovimento: formatarData(dataMovRaw),
        placa: placaDetectada,
      };
    });

    setFinLancamentos(lancamentos);
    setFinEtapa("edicao");
    setFinPagina(0);
    setNotification({
      type: "info",
      message: `${lancamentos.length} registros carregados para revisão. Edite, inclua ou exclua conforme necessário antes de importar.`,
    });
  };

  const handleFinEditarLinha = (idx: number) => {
    setFinEditandoIdx(idx);
  };

  const handleFinSalvarLinha = (idx: number, dados: Partial<LancamentoFinanceiro>) => {
    setFinLancamentos((prev) => {
      const novo = [...prev];
      novo[idx] = { ...novo[idx], ...dados };
      // Re-detect placa if descricao changed
      if (dados.descricao && !dados.placa) {
        novo[idx].placa = extrairPlaca(dados.descricao) || novo[idx].placa;
      }
      // Update natureza if conta changed
      if (dados.contaId) {
        const conta = planoContas.find((c) => c.id === dados.contaId);
        if (conta) {
          novo[idx].natureza = conta.natureza;
          novo[idx].conta = `${conta.codigo} ${conta.nome}`;
        }
      }
      return novo;
    });
    setFinEditandoIdx(null);
  };

  const handleFinExcluirLinha = (idx: number) => {
    setFinLancamentos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFinAdicionarLinha = () => {
    const hoje = new Date().toISOString().split("T")[0];
    const novoLanc: LancamentoFinanceiro = {
      _id: gerarId(),
      codigo: "",
      descricao: "",
      conta: "",
      contaId: null,
      natureza: "",
      valor: "0",
      dataInclusao: hoje,
      dataMovimento: hoje,
      placa: "",
    };
    setFinLancamentos((prev) => [novoLanc, ...prev]);
    setFinEditandoIdx(0);
    setFinPagina(0);
  };

  const handleFinImportar = async () => {
    if (!empresa?.id) return;

    const invalidos = finLancamentos.filter((l) => !l.contaId || !l.dataMovimento || parseFloat(l.valor) === 0);
    if (invalidos.length > 0) {
      setNotification({
        type: "error",
        message: `${invalidos.length} registro(s) com dados incompletos (conta não encontrada, data vazia ou valor zero). Corrija antes de importar.`,
      });
      return;
    }

    setFinImportando(true);
    setNotification(null);

    try {
      const resp = await fetch("/api/financeiro/importar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-empresa-id": String(empresa.id),
        },
        body: JSON.stringify({
          tipo: "lancamentos_financeiros",
          lancamentos: finLancamentos.map((l) => ({
            codigo: l.codigo,
            descricao: l.descricao,
            contaId: l.contaId,
            natureza: l.natureza,
            valor: l.valor,
            dataInclusao: l.dataInclusao,
            dataMovimento: l.dataMovimento,
            placa: l.placa,
          })),
        }),
      });

      const json = await resp.json();

      if (json.success) {
        setFinResultado(json.data);
        setFinEtapa("resultado");
        if (json.data.erros.length === 0) {
          setNotification({
            type: "success",
            message: `${json.data.importados} lançamentos importados com sucesso!`,
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
    } catch {
      setNotification({ type: "error", message: "Erro de conexão" });
    } finally {
      setFinImportando(false);
    }
  };

  const resetarFin = () => {
    setFinEtapa("selecao");
    setFinHeaders([]);
    setFinDadosBrutos([]);
    setFinMapeamento({});
    setFinLancamentos([]);
    setFinResultado(null);
    setFinEditandoIdx(null);
    setFinBusca("");
    setFinPagina(0);
    setNotification(null);
    if (finFileRef.current) finFileRef.current.value = "";
  };

  // Filtered + paginated lancamentos for aba 2
  const finLancamentosFiltrados = useMemo(() => {
    const b = finBusca.trim().toLowerCase();
    if (!b) return finLancamentos;
    return finLancamentos.filter((l) =>
      `${l.codigo} ${l.descricao} ${l.conta} ${l.natureza} ${l.placa}`.toLowerCase().includes(b)
    );
  }, [finLancamentos, finBusca]);

  const finTotalPaginas = Math.max(1, Math.ceil(finLancamentosFiltrados.length / FIN_POR_PAGINA));
  const finLancamentosPagina = useMemo(
    () => finLancamentosFiltrados.slice(finPagina * FIN_POR_PAGINA, (finPagina + 1) * FIN_POR_PAGINA),
    [finLancamentosFiltrados, finPagina]
  );

  const finResumo = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    let semConta = 0;
    for (const l of finLancamentos) {
      const v = parseFloat(l.valor) || 0;
      if (!l.contaId) semConta++;
      if (l.natureza === "RECEITA") receitas += v;
      else if (l.natureza === "DESPESA") despesas += v;
    }
    return { receitas, despesas, semConta, total: finLancamentos.length };
  }, [finLancamentos]);

  const formatadorMoeda = useMemo(
    () => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
    []
  );

  // ============================================================
  // Render
  // ============================================================

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

          {/* Tab Navigation */}
          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => { setAbaAtiva("arquivos"); setNotification(null); }}
              style={{
                padding: "10px 20px",
                border: "none",
                borderBottom: abaAtiva === "arquivos" ? "2px solid #2563eb" : "2px solid transparent",
                background: "none",
                color: abaAtiva === "arquivos" ? "#2563eb" : "#6b7280",
                fontWeight: abaAtiva === "arquivos" ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.9rem",
                marginBottom: -2,
              }}
            >
              Importação de Arquivos
            </button>
            <button
              type="button"
              onClick={() => { setAbaAtiva("lancamentos_financeiros"); setNotification(null); }}
              style={{
                padding: "10px 20px",
                border: "none",
                borderBottom: abaAtiva === "lancamentos_financeiros" ? "2px solid #2563eb" : "2px solid transparent",
                background: "none",
                color: abaAtiva === "lancamentos_financeiros" ? "#2563eb" : "#6b7280",
                fontWeight: abaAtiva === "lancamentos_financeiros" ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.9rem",
                marginBottom: -2,
              }}
            >
              Lançamentos Financeiros
            </button>
          </div>

          {/* ================================================================ */}
          {/* ABA 1: Importação de Arquivos (original) */}
          {/* ================================================================ */}
          {abaAtiva === "arquivos" && (
            <>
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
            </>
          )}

          {/* ================================================================ */}
          {/* ABA 2: Lançamentos Financeiros */}
          {/* ================================================================ */}
          {abaAtiva === "lancamentos_financeiros" && (
            <>
              {/* Step 1: File selection */}
              <section className="panel">
                <div className="form-section-header">
                  <div>
                    <h2>Importação de Lançamentos Financeiros</h2>
                    <p>Importe lançamentos financeiros com revisão e edição antes da importação final.</p>
                  </div>
                  {finEtapa !== "selecao" && (
                    <button type="button" className="button button-secondary" onClick={resetarFin}>
                      Nova importação
                    </button>
                  )}
                </div>

                {finEtapa === "selecao" && (
                  <>
                    <div className="form-grid two-columns" style={{ marginTop: 16 }}>
                      <div className="form-group">
                        <label htmlFor="fin-arquivo">Arquivo CSV</label>
                        <input
                          ref={finFileRef}
                          id="fin-arquivo"
                          type="file"
                          accept=".csv,.txt,.tsv"
                          className="form-input"
                          onChange={handleFinArquivoSelecionado}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 16, padding: 16, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                      <strong style={{ fontSize: "0.85rem", color: "#374151" }}>
                        Campos do Lançamento Financeiro:
                      </strong>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                        {CAMPOS_LANCAMENTO_FIN.map((c) => (
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
                      <p style={{ marginTop: 10, fontSize: "0.8rem", color: "#6b7280" }}>
                        O sistema detecta automaticamente placas de veículos nas descrições (formatos ABC-1234 e ABC1D23).
                        Valores são sempre positivos - a natureza da conta (RECEITA/DESPESA) determina o sinal.
                        Após o upload, você poderá editar, incluir e excluir registros antes da importação.
                      </p>
                    </div>
                  </>
                )}
              </section>

              {/* Step 2: Column mapping */}
              {finEtapa === "mapeamento" && (
                <section className="panel" style={{ marginTop: 16 }}>
                  <div className="form-section-header">
                    <div>
                      <h2>Mapeamento de Colunas</h2>
                      <p>{finDadosBrutos.length} linhas encontradas. Associe os campos e avance para a edição.</p>
                    </div>
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={handleFinAplicarMapeamento}
                    >
                      Aplicar e Revisar Registros
                    </button>
                  </div>

                  <div className="form-grid two-columns" style={{ marginTop: 16 }}>
                    {CAMPOS_LANCAMENTO_FIN.map((campo) => (
                      <div key={campo.campo} className="form-group">
                        <label htmlFor={`fin-map-${campo.campo}`}>
                          {campo.label} {campo.obrigatorio && <span style={{ color: "#dc2626" }}>*</span>}
                        </label>
                        <select
                          id={`fin-map-${campo.campo}`}
                          className="form-input"
                          value={finMapeamento[campo.campo] ?? ""}
                          onChange={(e) =>
                            setFinMapeamento((prev) => ({ ...prev, [campo.campo]: e.target.value }))
                          }
                        >
                          <option value="">-- Não mapear --</option>
                          {finHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Preview first 5 rows */}
                  {finDadosBrutos.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h3 style={{ fontSize: "0.9rem", color: "#374151", marginBottom: 8 }}>
                        Prévia dos dados (primeiros {Math.min(5, finDadosBrutos.length)} registros)
                      </h3>
                      <div style={{ overflowX: "auto" }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>#</th>
                              {CAMPOS_LANCAMENTO_FIN.map((c) => (
                                <th key={c.campo}>{c.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {finDadosBrutos.slice(0, 5).map((row, idx) => (
                              <tr key={idx}>
                                <td>{idx + 1}</td>
                                {CAMPOS_LANCAMENTO_FIN.map((c) => {
                                  const coluna = finMapeamento[c.campo];
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

              {/* Step 3: Editable grid */}
              {finEtapa === "edicao" && (
                <section className="panel" style={{ marginTop: 16 }}>
                  <div className="form-section-header">
                    <div>
                      <h2>Revisão dos Lançamentos</h2>
                      <p>
                        {finLancamentos.length} registros carregados.
                        Edite, inclua ou exclua registros antes de importar.
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={handleFinAdicionarLinha}
                      >
                        + Novo registro
                      </button>
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={handleFinImportar}
                        disabled={finImportando || finLancamentos.length === 0}
                      >
                        {finImportando ? "Importando..." : `Importar ${finLancamentos.length} registros`}
                      </button>
                    </div>
                  </div>

                  {/* Summary cards */}
                  <div className="summary-cards" style={{ marginTop: 12, marginBottom: 12 }}>
                    <div className="summary-card">
                      <span className="summary-label">Total</span>
                      <strong className="summary-value">{finResumo.total}</strong>
                    </div>
                    <div className="summary-card">
                      <span className="summary-label">Receitas</span>
                      <strong className="summary-value" style={{ color: "#059669" }}>
                        {formatadorMoeda.format(finResumo.receitas)}
                      </strong>
                    </div>
                    <div className="summary-card">
                      <span className="summary-label">Despesas</span>
                      <strong className="summary-value" style={{ color: "#dc2626" }}>
                        {formatadorMoeda.format(finResumo.despesas)}
                      </strong>
                    </div>
                    {finResumo.semConta > 0 && (
                      <div className="summary-card">
                        <span className="summary-label">Sem conta</span>
                        <strong className="summary-value" style={{ color: "#d97706" }}>
                          {finResumo.semConta}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Search */}
                  <div className="form-group" style={{ marginBottom: 12, maxWidth: 400 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Buscar por descrição, conta, placa..."
                      value={finBusca}
                      onChange={(e) => { setFinBusca(e.target.value); setFinPagina(0); }}
                    />
                  </div>

                  {/* Editable table */}
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ fontSize: "0.82rem" }}>
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>#</th>
                          <th style={{ width: 80 }}>Código</th>
                          <th style={{ minWidth: 200 }}>Descrição</th>
                          <th style={{ minWidth: 160 }}>Conta</th>
                          <th style={{ width: 80 }}>Natureza</th>
                          <th style={{ width: 110, textAlign: "right" }}>Valor</th>
                          <th style={{ width: 110 }}>Dt. Inclusão</th>
                          <th style={{ width: 110 }}>Dt. Movimento</th>
                          <th style={{ width: 90 }}>Placa</th>
                          <th style={{ width: 100, textAlign: "center" }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finLancamentosPagina.map((lanc, pageIdx) => {
                          const realIdx = finPagina * FIN_POR_PAGINA + pageIdx;
                          const globalIdx = finLancamentos.findIndex((l) => l._id === lanc._id);
                          const isEditing = finEditandoIdx === globalIdx;

                          if (isEditing) {
                            return (
                              <LinhaEditavel
                                key={lanc._id}
                                lanc={lanc}
                                idx={realIdx}
                                planoContas={planoContas}
                                onSalvar={(dados) => handleFinSalvarLinha(globalIdx, dados)}
                                onCancelar={() => setFinEditandoIdx(null)}
                              />
                            );
                          }

                          return (
                            <tr
                              key={lanc._id}
                              style={{
                                backgroundColor: !lanc.contaId ? "#fef3c7" : undefined,
                                cursor: "pointer",
                              }}
                              onClick={() => handleFinEditarLinha(globalIdx)}
                            >
                              <td>{realIdx + 1}</td>
                              <td>{lanc.codigo}</td>
                              <td>
                                {lanc.descricao}
                                {lanc.placa && (
                                  <span style={{
                                    display: "inline-block",
                                    marginLeft: 6,
                                    padding: "1px 6px",
                                    background: "#dbeafe",
                                    color: "#1e40af",
                                    borderRadius: 4,
                                    fontSize: "0.72rem",
                                    fontWeight: 600,
                                  }}>
                                    {lanc.placa}
                                  </span>
                                )}
                              </td>
                              <td style={{ color: !lanc.contaId ? "#d97706" : undefined }}>
                                {lanc.conta || <span style={{ color: "#dc2626" }}>Não encontrada</span>}
                              </td>
                              <td>
                                <span
                                  className={`badge ${lanc.natureza === "RECEITA" ? "badge-success" : lanc.natureza === "DESPESA" ? "badge-danger" : ""}`}
                                  style={{ fontSize: "0.72rem" }}
                                >
                                  {lanc.natureza || "?"}
                                </span>
                              </td>
                              <td style={{ textAlign: "right", fontWeight: 600 }}>
                                {formatadorMoeda.format(parseFloat(lanc.valor) || 0)}
                              </td>
                              <td>{lanc.dataInclusao}</td>
                              <td>{lanc.dataMovimento}</td>
                              <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{lanc.placa}</td>
                              <td style={{ textAlign: "center" }}>
                                <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                  <button
                                    type="button"
                                    className="button button-secondary button-compact"
                                    onClick={(e) => { e.stopPropagation(); handleFinEditarLinha(globalIdx); }}
                                    style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="button button-compact"
                                    onClick={(e) => { e.stopPropagation(); handleFinExcluirLinha(globalIdx); }}
                                    style={{ fontSize: "0.72rem", padding: "2px 8px", color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca" }}
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {finTotalPaginas > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 12 }}>
                      <button
                        type="button"
                        className="button button-secondary button-compact"
                        disabled={finPagina === 0}
                        onClick={() => setFinPagina((p) => Math.max(0, p - 1))}
                      >
                        Anterior
                      </button>
                      <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                        Página {finPagina + 1} de {finTotalPaginas}
                      </span>
                      <button
                        type="button"
                        className="button button-secondary button-compact"
                        disabled={finPagina >= finTotalPaginas - 1}
                        onClick={() => setFinPagina((p) => Math.min(finTotalPaginas - 1, p + 1))}
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* Step 4: Results */}
              {finEtapa === "resultado" && finResultado && (
                <section className="panel" style={{ marginTop: 16 }}>
                  <div className="form-section-header">
                    <h2>Resultado da Importação</h2>
                  </div>

                  <div className="summary-cards" style={{ marginTop: 12 }}>
                    <div className="summary-card">
                      <span className="summary-label">Importados</span>
                      <strong className="summary-value" style={{ color: "#059669" }}>
                        {finResultado.importados}
                      </strong>
                    </div>
                    <div className="summary-card">
                      <span className="summary-label">Erros</span>
                      <strong className="summary-value" style={{ color: finResultado.erros.length > 0 ? "#dc2626" : "#059669" }}>
                        {finResultado.erros.length}
                      </strong>
                    </div>
                    <div className="summary-card">
                      <span className="summary-label">Total enviados</span>
                      <strong className="summary-value">{finLancamentos.length}</strong>
                    </div>
                  </div>

                  {finResultado.erros.length > 0 && (
                    <div style={{ marginTop: 16, maxHeight: 300, overflowY: "auto" }}>
                      <h3 style={{ fontSize: "0.9rem", color: "#991b1b", marginBottom: 8 }}>
                        Detalhes dos erros:
                      </h3>
                      <ul style={{ margin: 0, padding: "0 0 0 20px", fontSize: "0.82rem", color: "#6b7280" }}>
                        {finResultado.erros.map((erro, i) => (
                          <li key={i} style={{ marginBottom: 4 }}>
                            {erro}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </main>
        </PaginaProtegida>
      </div>
    </LayoutShell>
  );
}

// ============================================================================
// Editable Row Component
// ============================================================================

function LinhaEditavel({
  lanc,
  idx,
  planoContas,
  onSalvar,
  onCancelar,
}: {
  lanc: LancamentoFinanceiro;
  idx: number;
  planoContas: PlanoContaOption[];
  onSalvar: (dados: Partial<LancamentoFinanceiro>) => void;
  onCancelar: () => void;
}) {
  const [codigo, setCodigo] = useState(lanc.codigo);
  const [descricao, setDescricao] = useState(lanc.descricao);
  const [contaId, setContaId] = useState(lanc.contaId ? String(lanc.contaId) : "");
  const [valor, setValor] = useState(lanc.valor);
  const [dataInclusao, setDataInclusao] = useState(lanc.dataInclusao);
  const [dataMovimento, setDataMovimento] = useState(lanc.dataMovimento);
  const [placa, setPlaca] = useState(lanc.placa);

  const contaSelecionada = planoContas.find((c) => String(c.id) === contaId);

  const handleSalvar = () => {
    onSalvar({
      codigo,
      descricao,
      contaId: contaSelecionada ? contaSelecionada.id : null,
      conta: contaSelecionada ? `${contaSelecionada.codigo} ${contaSelecionada.nome}` : "",
      natureza: contaSelecionada?.natureza || "",
      valor,
      dataInclusao,
      dataMovimento,
      placa: placa || extrairPlaca(descricao),
    });
  };

  return (
    <tr style={{ backgroundColor: "#eff6ff" }}>
      <td>{idx + 1}</td>
      <td>
        <input
          type="text"
          className="form-input"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          style={{ padding: "2px 6px", fontSize: "0.8rem", width: 70 }}
        />
      </td>
      <td>
        <input
          type="text"
          className="form-input"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          style={{ padding: "2px 6px", fontSize: "0.8rem", minWidth: 180 }}
        />
      </td>
      <td>
        <select
          className="form-input"
          value={contaId}
          onChange={(e) => setContaId(e.target.value)}
          style={{ padding: "2px 6px", fontSize: "0.8rem", minWidth: 140 }}
        >
          <option value="">Selecione</option>
          {planoContas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo} {c.nome}
            </option>
          ))}
        </select>
      </td>
      <td>
        <span className={`badge ${contaSelecionada?.natureza === "RECEITA" ? "badge-success" : contaSelecionada?.natureza === "DESPESA" ? "badge-danger" : ""}`} style={{ fontSize: "0.72rem" }}>
          {contaSelecionada?.natureza || "?"}
        </span>
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          min="0"
          className="form-input"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          style={{ padding: "2px 6px", fontSize: "0.8rem", width: 100, textAlign: "right" }}
        />
      </td>
      <td>
        <input
          type="date"
          className="form-input"
          value={dataInclusao}
          onChange={(e) => setDataInclusao(e.target.value)}
          style={{ padding: "2px 6px", fontSize: "0.8rem", width: 110 }}
        />
      </td>
      <td>
        <input
          type="date"
          className="form-input"
          value={dataMovimento}
          onChange={(e) => setDataMovimento(e.target.value)}
          style={{ padding: "2px 6px", fontSize: "0.8rem", width: 110 }}
        />
      </td>
      <td>
        <input
          type="text"
          className="form-input"
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase())}
          style={{ padding: "2px 6px", fontSize: "0.8rem", width: 80, textTransform: "uppercase" }}
        />
      </td>
      <td style={{ textAlign: "center" }}>
        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
          <button
            type="button"
            className="button button-primary button-compact"
            onClick={handleSalvar}
            style={{ fontSize: "0.72rem", padding: "2px 8px" }}
          >
            OK
          </button>
          <button
            type="button"
            className="button button-secondary button-compact"
            onClick={onCancelar}
            style={{ fontSize: "0.72rem", padding: "2px 8px" }}
          >
            X
          </button>
        </div>
      </td>
    </tr>
  );
}
