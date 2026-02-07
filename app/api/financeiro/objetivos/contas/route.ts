import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface ContaComMedia {
  contaId: number;
  nome: string;
  natureza: string;
  media: number;
  percentual: number;
  objetivo: number;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const params = request.nextUrl.searchParams;
  const tipo = params.get("tipo") ?? "PLANO_CONTAS";
  const meses = Number(params.get("meses") ?? 3);
  const anoObjetivo = Number(params.get("ano") ?? new Date().getFullYear());

  const hoje = new Date();
  const dataFim = hoje.toISOString().slice(0, 10);
  const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - meses, 1).toISOString().slice(0, 10);

  try {
    let contasResult;
    let mediasResult;

    if (tipo === "CENTRO_CUSTO") {
      contasResult = await db.execute({
        sql: `
          SELECT FIN_CENTRO_CUSTO_ID as contaId, FIN_CENTRO_CUSTO_NOME as nome, 'DESPESA' as natureza
          FROM FIN_CENTRO_CUSTO
          WHERE EMPRESA_ID = ?
          ORDER BY FIN_CENTRO_CUSTO_NOME
        `,
        args: [empresaId],
      });

      mediasResult = await db.execute({
        sql: `
          SELECT FIN_CENTRO_CUSTO_ID as contaId,
                 COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total
          FROM FIN_LANCAMENTO
          WHERE EMPRESA_ID = ?
            AND FIN_LANCAMENTO_DATA >= ?
            AND FIN_LANCAMENTO_DATA <= ?
            AND FIN_CENTRO_CUSTO_ID IS NOT NULL
          GROUP BY FIN_CENTRO_CUSTO_ID
        `,
        args: [empresaId, dataInicio, dataFim],
      });
    } else {
      contasResult = await db.execute({
        sql: `
          SELECT FIN_PLANO_CONTA_ID as contaId, FIN_PLANO_CONTA_NOME as nome, FIN_PLANO_CONTA_NATUREZA as natureza
          FROM FIN_PLANO_CONTA
          WHERE EMPRESA_ID = ?
          ORDER BY FIN_PLANO_CONTA_CODIGO, FIN_PLANO_CONTA_NOME
        `,
        args: [empresaId],
      });

      mediasResult = await db.execute({
        sql: `
          SELECT FIN_PLANO_CONTA_ID as contaId,
                 COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total
          FROM FIN_LANCAMENTO
          WHERE EMPRESA_ID = ?
            AND FIN_LANCAMENTO_DATA >= ?
            AND FIN_LANCAMENTO_DATA <= ?
          GROUP BY FIN_PLANO_CONTA_ID
        `,
        args: [empresaId, dataInicio, dataFim],
      });
    }

    const totaisMapa = new Map<number, number>();
    (mediasResult.rows ?? []).forEach((row: any) => {
      totaisMapa.set(Number(row.contaId), Number(row.total ?? 0));
    });

    const objetivosResult = await db.execute({
      sql: `
        SELECT FIN_CONTA_ID, FIN_OBJETIVO_PERCENTUAL
        FROM FIN_OBJETIVO_CONTA
        WHERE ID_EMPRESA = ? AND FIN_OBJETIVO_TIPO = ? AND FIN_OBJETIVO_ANO = ?
      `,
      args: [empresaId, tipo, anoObjetivo],
    });

    const percentuaisMapa = new Map<number, number>();
    (objetivosResult.rows ?? []).forEach((row: any) => {
      percentuaisMapa.set(Number(row.FIN_CONTA_ID), Number(row.FIN_OBJETIVO_PERCENTUAL ?? 0));
    });

    const divisor = Math.max(1, meses);

    const contas: ContaComMedia[] = (contasResult.rows ?? []).map((row: any) => {
      const contaId = Number(row.contaId);
      const totalPeriodo = totaisMapa.get(contaId) ?? 0;
      const media = totalPeriodo / divisor;
      const percentual = percentuaisMapa.get(contaId) ?? 0;
      const objetivo = media * (1 + percentual / 100);

      return {
        contaId,
        nome: String(row.nome ?? ""),
        natureza: String(row.natureza ?? "OUTROS"),
        media,
        percentual,
        objetivo,
      };
    });

    return NextResponse.json({
      success: true,
      data: contas,
      periodo: { meses, dataInicio, dataFim },
    });
  } catch (error) {
    console.error("Erro ao buscar objetivos por conta:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar objetivos por conta" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const body = await request.json();
  const { tipo, ano, contas } = body as {
    tipo: string;
    ano: number;
    contas: { contaId: number; percentual: number }[];
  };

  if (!tipo || !ano || !Array.isArray(contas)) {
    return NextResponse.json(
      { success: false, error: "Dados inválidos" },
      { status: 400 }
    );
  }

  try {
    for (const conta of contas) {
      await db.execute({
        sql: `
          INSERT INTO FIN_OBJETIVO_CONTA (ID_EMPRESA, FIN_OBJETIVO_TIPO, FIN_CONTA_ID, FIN_OBJETIVO_PERCENTUAL, FIN_OBJETIVO_ANO)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (ID_EMPRESA, FIN_OBJETIVO_TIPO, FIN_CONTA_ID, FIN_OBJETIVO_ANO)
          DO UPDATE SET FIN_OBJETIVO_PERCENTUAL = excluded.FIN_OBJETIVO_PERCENTUAL
        `,
        args: [empresaId, tipo, conta.contaId, conta.percentual, ano],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar objetivos por conta:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao salvar objetivos" },
      { status: 500 }
    );
  }
}
