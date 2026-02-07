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

  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    const codigo = obterValor(linha, mapeamento, "codigo");
    const nome = obterValor(linha, mapeamento, "nome");
    const natureza = obterValor(linha, mapeamento, "natureza").toUpperCase() || "DESPESA";

    if (!codigo || !nome) {
      erros.push(`Linha ${i + 1}: código e nome são obrigatórios`);
      continue;
    }

    try {
      const existe = await db.execute({
        sql: `SELECT COUNT(*) as total FROM FIN_PLANO_CONTA WHERE FIN_PLANO_CONTA_CODIGO = ? AND EMPRESA_ID = ?`,
        args: [codigo, empresaId],
      });

      if ((existe.rows[0] as any).total > 0) {
        erros.push(`Linha ${i + 1}: código "${codigo}" já existe`);
        continue;
      }

      await db.execute({
        sql: `INSERT INTO FIN_PLANO_CONTA (
          FIN_PLANO_CONTA_CODIGO, FIN_PLANO_CONTA_NOME, FIN_PLANO_CONTA_NATUREZA,
          FIN_PLANO_CONTA_ATIVO, FIN_PLANO_CONTA_VISIVEL_DRE, FIN_PLANO_CONTA_OBRIGA_CENTRO_CUSTO,
          EMPRESA_ID
        ) VALUES (?, ?, ?, 1, 1, 0, ?)`,
        args: [codigo, nome, natureza, empresaId],
      });

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
  for (const row of planosResult.rows) {
    const r = row as any;
    planosPorCodigo.set(String(r.FIN_PLANO_CONTA_CODIGO).trim().toUpperCase(), Number(r.FIN_PLANO_CONTA_ID));
    planosPorNome.set(String(r.FIN_PLANO_CONTA_NOME).trim().toUpperCase(), Number(r.FIN_PLANO_CONTA_ID));
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

    if (!dataStr || !historico || !contaRef) {
      erros.push(`Linha ${i + 1}: data, histórico e conta são obrigatórios`);
      continue;
    }

    // Parse date - support dd/mm/yyyy and yyyy-mm-dd
    let dataFormatada = dataStr;
    if (dataStr.includes("/")) {
      const partes = dataStr.split("/");
      if (partes.length === 3) {
        dataFormatada = `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;
      }
    }

    // Parse valor
    let valor = parseFloat(
      valorStr
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    );

    if (isNaN(valor)) {
      erros.push(`Linha ${i + 1}: valor "${valorStr}" inválido`);
      continue;
    }

    // Determine sign based on tipo if available
    if (tipoStr === "SAIDA" || tipoStr === "SAÍDA" || tipoStr === "DESPESA" || tipoStr === "DEBITO" || tipoStr === "DÉBITO") {
      valor = -Math.abs(valor);
    } else if (tipoStr === "ENTRADA" || tipoStr === "RECEITA" || tipoStr === "CREDITO" || tipoStr === "CRÉDITO") {
      valor = Math.abs(valor);
    }

    // Resolve plano de conta
    const contaUpper = contaRef.toUpperCase();
    let contaId = planosPorCodigo.get(contaUpper) ?? planosPorNome.get(contaUpper);
    if (!contaId) {
      erros.push(`Linha ${i + 1}: conta "${contaRef}" não encontrada`);
      continue;
    }

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
        args: [dataFormatada, historico, valor, contaId, centroId, documento || null, empresaId],
      });

      importados++;
    } catch (err) {
      erros.push(`Linha ${i + 1}: erro ao inserir - ${(err as Error).message}`);
    }
  }

  return { importados, erros };
}
