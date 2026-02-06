import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface DreLinhaDB {
  FIN_ESTRUTURA_DRE_ID: number;
  FIN_ESTRUTURA_DRE_PAI_ID: number | null;
  FIN_ESTRUTURA_DRE_NOME: string;
  FIN_ESTRUTURA_DRE_CODIGO: string;
  FIN_ESTRUTURA_DRE_NATUREZA: "RECEITA" | "DESPESA" | "OUTROS";
  FIN_ESTRUTURA_DRE_ORDEM: number;
}

interface DreLinha {
  id: number;
  paiId: number | null;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "OUTROS";
  valor: number;
  filhos: DreLinha[];
}

function construirArvore(linhas: DreLinha[]): DreLinha[] {
  const mapa = new Map<number, DreLinha>();
  const raizes: DreLinha[] = [];

  linhas.forEach((linha) => {
    mapa.set(linha.id, { ...linha, filhos: [] });
  });

  mapa.forEach((linha) => {
    if (linha.paiId && mapa.has(linha.paiId)) {
      mapa.get(linha.paiId)!.filhos.push(linha);
    } else {
      raizes.push(linha);
    }
  });

  return raizes;
}

function somarFilhos(linha: DreLinha): DreLinha {
  const filhosAtualizados = linha.filhos.map(somarFilhos);
  const totalFilhos = filhosAtualizados.reduce((acc, item) => acc + item.valor, 0);
  const valor = linha.valor + totalFilhos;
  return { ...linha, filhos: filhosAtualizados, valor };
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const dataInicio = request.nextUrl.searchParams.get("dataInicio");
  const dataFim = request.nextUrl.searchParams.get("dataFim");

  try {
    const linhasResult = await db.execute({
      sql: `
        SELECT
          FIN_ESTRUTURA_DRE_ID,
          FIN_ESTRUTURA_DRE_PAI_ID,
          FIN_ESTRUTURA_DRE_NOME,
          FIN_ESTRUTURA_DRE_CODIGO,
          FIN_ESTRUTURA_DRE_NATUREZA,
          COALESCE(FIN_ESTRUTURA_DRE_ORDEM, 0) as FIN_ESTRUTURA_DRE_ORDEM
        FROM FIN_ESTRUTURA_DRE
        WHERE EMPRESA_ID = ?
        ORDER BY FIN_ESTRUTURA_DRE_ORDEM ASC
      `,
      args: [empresaId],
    });

    const contasResult = await db.execute({
      sql: `
        SELECT FIN_ESTRUTURA_DRE_ID, FIN_PLANO_CONTA_ID
        FROM FIN_ESTRUTURA_DRE_CONTA
        WHERE EMPRESA_ID = ?
      `,
      args: [empresaId],
    });

    let sqlLancamentos = `
      SELECT FIN_PLANO_CONTA_ID, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total
      FROM FIN_LANCAMENTO
      WHERE EMPRESA_ID = ?
    `;
    const lancArgs: any[] = [empresaId];

    if (dataInicio) {
      sqlLancamentos += ` AND FIN_LANCAMENTO_DATA >= ?`;
      lancArgs.push(dataInicio);
    }

    if (dataFim) {
      sqlLancamentos += ` AND FIN_LANCAMENTO_DATA <= ?`;
      lancArgs.push(dataFim);
    }

    sqlLancamentos += ` GROUP BY FIN_PLANO_CONTA_ID`;

    const lancResult = await db.execute({
      sql: sqlLancamentos,
      args: lancArgs,
    });

    const totaisConta = new Map<number, number>();
    (lancResult.rows ?? []).forEach((row: any) => {
      totaisConta.set(row.FIN_PLANO_CONTA_ID, Number(row.total ?? 0));
    });

    const contasPorLinha = new Map<number, number[]>();
    (contasResult.rows ?? []).forEach((row: any) => {
      const linhaId = Number(row.FIN_ESTRUTURA_DRE_ID);
      if (!contasPorLinha.has(linhaId)) {
        contasPorLinha.set(linhaId, []);
      }
      contasPorLinha.get(linhaId)!.push(Number(row.FIN_PLANO_CONTA_ID));
    });

    const linhas = (linhasResult.rows ?? []).map((linha: any) => {
      const contas = contasPorLinha.get(Number(linha.FIN_ESTRUTURA_DRE_ID)) ?? [];
      const total = contas.reduce((acc, contaId) => acc + (totaisConta.get(contaId) ?? 0), 0);
      return {
        id: Number(linha.FIN_ESTRUTURA_DRE_ID),
        paiId: linha.FIN_ESTRUTURA_DRE_PAI_ID,
        nome: linha.FIN_ESTRUTURA_DRE_NOME,
        codigo: linha.FIN_ESTRUTURA_DRE_CODIGO,
        natureza: linha.FIN_ESTRUTURA_DRE_NATUREZA,
        valor: total,
        filhos: [],
      } satisfies DreLinha;
    });

    const arvore = construirArvore(linhas).map(somarFilhos);

    return NextResponse.json({ success: true, data: arvore });
  } catch (error) {
    console.error("Erro ao buscar DRE:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar DRE" },
      { status: 500 }
    );
  }
}
