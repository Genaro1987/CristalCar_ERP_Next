import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

type TipoImportacao = "plano_contas" | "centro_custo" | "lancamentos";

interface LinhaImportacao {
  [key: string]: string;
}

interface MapeamentoColunas {
  [campoDB: string]: string; // campo do sistema → coluna do arquivo
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  try {
    const body = await request.json();
    const { tipo, dados, mapeamento } = body as {
      tipo: TipoImportacao;
      dados: LinhaImportacao[];
      mapeamento: MapeamentoColunas;
    };

    if (!tipo || !dados || !mapeamento) {
      return NextResponse.json(
        { success: false, error: "Tipo, dados e mapeamento são obrigatórios" },
        { status: 400 }
      );
    }

    if (dados.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum dado para importar" },
        { status: 400 }
      );
    }

    let resultado: { importados: number; erros: string[] };

    if (tipo === "plano_contas") {
      resultado = await importarPlanoContas(empresaId, dados, mapeamento);
    } else if (tipo === "centro_custo") {
      resultado = await importarCentroCusto(empresaId, dados, mapeamento);
    } else if (tipo === "lancamentos") {
      resultado = await importarLancamentos(empresaId, dados, mapeamento);
    } else {
      return NextResponse.json(
        { success: false, error: "Tipo de importação inválido" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: resultado,
    });
  } catch (error) {
    console.error("Erro na importação:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno na importação" },
      { status: 500 }
    );
  }
}

function obterValor(linha: LinhaImportacao, mapeamento: MapeamentoColunas, campo: string): string {
  const coluna = mapeamento[campo];
  if (!coluna) return "";
  return (linha[coluna] ?? "").trim();
}

async function importarPlanoContas(
  empresaId: number,
  dados: LinhaImportacao[],
  mapeamento: MapeamentoColunas
): Promise<{ importados: number; erros: string[] }> {
  let importados = 0;
  const erros: string[] = [];

  // Build lookup map for conta pai by codigo
  const contasPorCodigo = new Map<string, number>();
  const contasExistentes = await db.execute({
    sql: "SELECT FIN_PLANO_CONTA_ID, FIN_PLANO_CONTA_CODIGO FROM FIN_PLANO_CONTA WHERE EMPRESA_ID = ?",
    args: [empresaId],
  });
  for (const row of contasExistentes.rows) {
    const r = row as any;
    contasPorCodigo.set(String(r.FIN_PLANO_CONTA_CODIGO).trim().toUpperCase(), Number(r.FIN_PLANO_CONTA_ID));
  }

  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    const codigo = obterValor(linha, mapeamento, "codigo");
    const nome = obterValor(linha, mapeamento, "nome");
    const natureza = obterValor(linha, mapeamento, "natureza").toUpperCase() || "DESPESA";
    const contaPaiCod = obterValor(linha, mapeamento, "contaPai");
    const tipo = obterValor(linha, mapeamento, "tipo").toUpperCase();
    const dataInclusao = obterValor(linha, mapeamento, "dataInclusao");

    if (!codigo || !nome) {
      erros.push(`Linha ${i + 1}: codigo e nome sao obrigatorios`);
      continue;
    }

    // Resolve conta pai
    let paiId: number | null = null;
    if (contaPaiCod) {
      paiId = contasPorCodigo.get(contaPaiCod.toUpperCase()) ?? null;
      if (!paiId) {
        erros.push(`Linha ${i + 1}: conta pai "${contaPaiCod}" nao encontrada (importando sem pai)`);
      }
    }

    // Determine if sintetica (has children = no direct lancamentos)
    // For import, we store tipo info but the main flag is visivelDre
    const isSintetica = tipo === "SINTETICA" || tipo === "S";

    try {
      const existe = await db.execute({
        sql: `SELECT COUNT(*) as total FROM FIN_PLANO_CONTA WHERE FIN_PLANO_CONTA_CODIGO = ? AND EMPRESA_ID = ?`,
        args: [codigo, empresaId],
      });

      if ((existe.rows[0] as any).total > 0) {
        erros.push(`Linha ${i + 1}: codigo "${codigo}" ja existe`);
        continue;
      }

      await db.execute({
        sql: `INSERT INTO FIN_PLANO_CONTA (
          FIN_PLANO_CONTA_CODIGO, FIN_PLANO_CONTA_NOME, FIN_PLANO_CONTA_NATUREZA,
          FIN_PLANO_CONTA_PAI_ID,
          FIN_PLANO_CONTA_ATIVO, FIN_PLANO_CONTA_VISIVEL_DRE, FIN_PLANO_CONTA_OBRIGA_CENTRO_CUSTO,
          EMPRESA_ID
        ) VALUES (?, ?, ?, ?, 1, ?, 0, ?)`,
        args: [
          codigo,
          nome,
          natureza,
          paiId,
          isSintetica ? 0 : 1,
          empresaId,
        ],
      });

      // Add to lookup so subsequent lines can reference this as parent
      const novoId = await db.execute({
        sql: "SELECT FIN_PLANO_CONTA_ID FROM FIN_PLANO_CONTA WHERE FIN_PLANO_CONTA_CODIGO = ? AND EMPRESA_ID = ?",
        args: [codigo, empresaId],
      });
      if (novoId.rows.length > 0) {
        contasPorCodigo.set(codigo.toUpperCase(), Number((novoId.rows[0] as any).FIN_PLANO_CONTA_ID));
      }

      importados++;
    } catch (err) {
      erros.push(`Linha ${i + 1}: erro ao inserir - ${(err as Error).message}`);
    }
  }

  return { importados, erros };
}

async function importarCentroCusto(
  empresaId: number,
  dados: LinhaImportacao[],
  mapeamento: MapeamentoColunas
): Promise<{ importados: number; erros: string[] }> {
  let importados = 0;
  const erros: string[] = [];

  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    const codigo = obterValor(linha, mapeamento, "codigo");
    const nome = obterValor(linha, mapeamento, "nome");
    const descricao = obterValor(linha, mapeamento, "descricao");

    if (!codigo || !nome) {
      erros.push(`Linha ${i + 1}: código e nome são obrigatórios`);
      continue;
    }

    try {
      const existe = await db.execute({
        sql: `SELECT COUNT(*) as total FROM FIN_CENTRO_CUSTO WHERE FIN_CENTRO_CUSTO_CODIGO = ? AND EMPRESA_ID = ?`,
        args: [codigo, empresaId],
      });

      if ((existe.rows[0] as any).total > 0) {
        erros.push(`Linha ${i + 1}: código "${codigo}" já existe`);
        continue;
      }

      await db.execute({
        sql: `INSERT INTO FIN_CENTRO_CUSTO (
          FIN_CENTRO_CUSTO_CODIGO, FIN_CENTRO_CUSTO_NOME, FIN_CENTRO_CUSTO_DESCRICAO,
          FIN_CENTRO_CUSTO_ATIVO, FIN_CENTRO_CUSTO_ORDEM, EMPRESA_ID
        ) VALUES (?, ?, ?, 1, 0, ?)`,
        args: [codigo, nome, descricao || null, empresaId],
      });

      importados++;
    } catch (err) {
      erros.push(`Linha ${i + 1}: erro ao inserir - ${(err as Error).message}`);
    }
  }

  return { importados, erros };
}

async function importarLancamentos(
  empresaId: number,
  dados: LinhaImportacao[],
  mapeamento: MapeamentoColunas
): Promise<{ importados: number; erros: string[] }> {
  let importados = 0;
  const erros: string[] = [];

  // Build lookup maps for plano de contas
  const planosResult = await db.execute({
    sql: `SELECT FIN_PLANO_CONTA_ID, FIN_PLANO_CONTA_CODIGO, FIN_PLANO_CONTA_NOME
          FROM FIN_PLANO_CONTA WHERE EMPRESA_ID = ?`,
    args: [empresaId],
  });

  const planosPorCodigo = new Map<string, number>();
  const planosPorNome = new Map<string, number>();
  const planosNomes: { nome: string; id: number }[] = [];
  for (const row of planosResult.rows) {
    const r = row as any;
    const id = Number(r.FIN_PLANO_CONTA_ID);
    const codigo = String(r.FIN_PLANO_CONTA_CODIGO).trim().toUpperCase();
    const nome = String(r.FIN_PLANO_CONTA_NOME).trim().toUpperCase();
    planosPorCodigo.set(codigo, id);
    planosPorNome.set(nome, id);
    planosNomes.push({ nome, id });
  }

  // Fuzzy match: find conta by partial name match
  function buscarContaFuzzy(ref: string): number | undefined {
    const refUpper = ref.toUpperCase().trim();
    // 1. Exact match by code or name
    const exato = planosPorCodigo.get(refUpper) ?? planosPorNome.get(refUpper);
    if (exato) return exato;

    // 2. Partial match: ref is contained in account name, or account name is contained in ref
    const parcial = planosNomes.find(
      (p) => p.nome.includes(refUpper) || refUpper.includes(p.nome)
    );
    if (parcial) return parcial.id;

    // 3. Normalize: remove accents, plurals, hyphens
    const normalizar = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
    const refNorm = normalizar(refUpper);
    const parcialNorm = planosNomes.find((p) => {
      const nomeNorm = normalizar(p.nome);
      return nomeNorm.includes(refNorm) || refNorm.includes(nomeNorm);
    });
    if (parcialNorm) return parcialNorm.id;

    return undefined;
  }

  // Build lookup maps for centros de custo
  const centrosResult = await db.execute({
    sql: `SELECT FIN_CENTRO_CUSTO_ID, FIN_CENTRO_CUSTO_CODIGO, FIN_CENTRO_CUSTO_NOME
          FROM FIN_CENTRO_CUSTO WHERE EMPRESA_ID = ?`,
    args: [empresaId],
  });

  const centrosPorCodigo = new Map<string, number>();
  const centrosPorNome = new Map<string, number>();
  for (const row of centrosResult.rows) {
    const r = row as any;
    centrosPorCodigo.set(String(r.FIN_CENTRO_CUSTO_CODIGO).trim().toUpperCase(), Number(r.FIN_CENTRO_CUSTO_ID));
    centrosPorNome.set(String(r.FIN_CENTRO_CUSTO_NOME).trim().toUpperCase(), Number(r.FIN_CENTRO_CUSTO_ID));
  }

  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    const dataStr = obterValor(linha, mapeamento, "data");
    const historico = obterValor(linha, mapeamento, "historico");
    const contaRef = obterValor(linha, mapeamento, "conta");
    const centroRef = obterValor(linha, mapeamento, "centroCusto");
    const valorStr = obterValor(linha, mapeamento, "valor");
    const documento = obterValor(linha, mapeamento, "documento");
    const tipoStr = obterValor(linha, mapeamento, "tipo").toUpperCase();
    const operacaoStr = obterValor(linha, mapeamento, "operacao").toUpperCase();

    if (!dataStr || !contaRef) {
      erros.push(`Linha ${i + 1}: data e conta sao obrigatorios`);
      continue;
    }

    // Parse date - support dd/mm/yyyy, dd-mm-yyyy, and yyyy-mm-dd
    let dataFormatada = dataStr;
    if (dataStr.includes("/")) {
      const partes = dataStr.split("/");
      if (partes.length === 3) {
        dataFormatada = `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;
      }
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(dataStr)) {
      const partes = dataStr.split("-");
      dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`;
    }

    // Parse valor - handle various BR formats: "1.234,56", "1234.56", "-R$ 1.234,56"
    let valor = parseFloat(
      valorStr
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    );

    if (isNaN(valor)) {
      erros.push(`Linha ${i + 1}: valor "${valorStr}" invalido`);
      continue;
    }

    // Determine sign based on tipo or operacao fields
    const sinalizador = tipoStr || operacaoStr;
    if (sinalizador === "SAIDA" || sinalizador === "SAÍDA" || sinalizador === "DESPESA" || sinalizador === "DEBITO" || sinalizador === "DÉBITO" || sinalizador === "S") {
      valor = -Math.abs(valor);
    } else if (sinalizador === "ENTRADA" || sinalizador === "RECEITA" || sinalizador === "CREDITO" || sinalizador === "CRÉDITO" || sinalizador === "E") {
      valor = Math.abs(valor);
    }

    // Resolve plano de conta with fuzzy matching
    const contaId = buscarContaFuzzy(contaRef);
    if (!contaId) {
      erros.push(`Linha ${i + 1}: conta "${contaRef}" nao encontrada`);
      continue;
    }

    // Use historico if mapped, otherwise use contaRef as fallback
    const historicoFinal = historico || contaRef;

    // Resolve centro de custo (optional)
    let centroId: number | null = null;
    if (centroRef) {
      const centroUpper = centroRef.toUpperCase();
      centroId = centrosPorCodigo.get(centroUpper) ?? centrosPorNome.get(centroUpper) ?? null;
      if (!centroId) {
        erros.push(`Linha ${i + 1}: centro de custo "${centroRef}" não encontrado (registro importado sem centro)`);
      }
    }

    try {
      await db.execute({
        sql: `INSERT INTO FIN_LANCAMENTO (
          FIN_LANCAMENTO_DATA, FIN_LANCAMENTO_HISTORICO, FIN_LANCAMENTO_VALOR,
          FIN_PLANO_CONTA_ID, FIN_CENTRO_CUSTO_ID, FIN_LANCAMENTO_DOCUMENTO,
          FIN_LANCAMENTO_STATUS, EMPRESA_ID
        ) VALUES (?, ?, ?, ?, ?, ?, 'confirmado', ?)`,
        args: [dataFormatada, historicoFinal, valor, contaId, centroId, documento || null, empresaId],
      });

      importados++;
    } catch (err) {
      erros.push(`Linha ${i + 1}: erro ao inserir - ${(err as Error).message}`);
    }
  }

  return { importados, erros };
}
