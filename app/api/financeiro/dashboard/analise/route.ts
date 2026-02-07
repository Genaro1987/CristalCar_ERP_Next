import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface ContaMensal {
  contaId: number;
  conta: string;
  natureza: string;
  mes: string;
  total: number;
}

interface ResumoMensal {
  mes: string;
  label: string;
  receitas: number;
  despesas: number;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const params = request.nextUrl.searchParams;
  const dataInicio = params.get("dataInicio");
  const dataFim = params.get("dataFim");
  const tipo = params.get("tipo"); // "receitas" | "despesas" | "evolucao" | "contas"

  if (!dataInicio || !dataFim) {
    return NextResponse.json({ success: false, error: "dataInicio e dataFim obrigatorios" }, { status: 400 });
  }

  try {
    if (tipo === "evolucao") {
      // Monthly evolution: receitas vs despesas
      const result = await db.execute({
        sql: `
          SELECT
            strftime('%Y-%m', l.FIN_LANCAMENTO_DATA) as mes,
            COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR >= 0 THEN l.FIN_LANCAMENTO_VALOR ELSE 0 END), 0) as receitas,
            COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR < 0 THEN ABS(l.FIN_LANCAMENTO_VALOR) ELSE 0 END), 0) as despesas
          FROM FIN_LANCAMENTO l
          WHERE l.EMPRESA_ID = ?
            AND l.FIN_LANCAMENTO_DATA >= ?
            AND l.FIN_LANCAMENTO_DATA <= ?
          GROUP BY strftime('%Y-%m', l.FIN_LANCAMENTO_DATA)
          ORDER BY mes ASC
        `,
        args: [empresaId, dataInicio, dataFim],
      });

      const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const evolucao: ResumoMensal[] = (result.rows ?? []).map((row: any) => {
        const mesNum = parseInt(String(row.mes).split("-")[1]) - 1;
        return {
          mes: String(row.mes),
          label: mesesNomes[mesNum] ?? String(row.mes),
          receitas: Number(row.receitas),
          despesas: Number(row.despesas),
        };
      });

      return NextResponse.json({ success: true, data: evolucao });
    }

    if (tipo === "receitas" || tipo === "despesas") {
      // Breakdown by account for receitas or despesas
      const filtroValor = tipo === "receitas"
        ? "l.FIN_LANCAMENTO_VALOR >= 0"
        : "l.FIN_LANCAMENTO_VALOR < 0";

      const result = await db.execute({
        sql: `
          SELECT
            p.FIN_PLANO_CONTA_ID as contaId,
            p.FIN_PLANO_CONTA_NOME as conta,
            p.FIN_PLANO_CONTA_NATUREZA as natureza,
            strftime('%Y-%m', l.FIN_LANCAMENTO_DATA) as mes,
            COALESCE(SUM(ABS(l.FIN_LANCAMENTO_VALOR)), 0) as total
          FROM FIN_LANCAMENTO l
          JOIN FIN_PLANO_CONTA p ON p.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID
            AND p.EMPRESA_ID = l.EMPRESA_ID
          WHERE l.EMPRESA_ID = ?
            AND l.FIN_LANCAMENTO_DATA >= ?
            AND l.FIN_LANCAMENTO_DATA <= ?
            AND ${filtroValor}
          GROUP BY p.FIN_PLANO_CONTA_ID, p.FIN_PLANO_CONTA_NOME, p.FIN_PLANO_CONTA_NATUREZA, strftime('%Y-%m', l.FIN_LANCAMENTO_DATA)
          ORDER BY p.FIN_PLANO_CONTA_NOME, mes
        `,
        args: [empresaId, dataInicio, dataFim],
      });

      // Group by account
      const contasMap = new Map<number, { conta: string; natureza: string; meses: Record<string, number>; total: number }>();
      const mesesSet = new Set<string>();

      for (const row of result.rows ?? []) {
        const r = row as any;
        const contaId = Number(r.contaId);
        const mes = String(r.mes);
        const total = Number(r.total);
        mesesSet.add(mes);

        if (!contasMap.has(contaId)) {
          contasMap.set(contaId, { conta: String(r.conta), natureza: String(r.natureza), meses: {}, total: 0 });
        }
        const entry = contasMap.get(contaId)!;
        entry.meses[mes] = total;
        entry.total += total;
      }

      const meses = Array.from(mesesSet).sort();
      const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const mesesLabels = meses.map((m) => {
        const mesNum = parseInt(m.split("-")[1]) - 1;
        return mesesNomes[mesNum] ?? m;
      });

      const contas = Array.from(contasMap.entries())
        .map(([id, data]) => ({
          contaId: id,
          conta: data.conta,
          natureza: data.natureza,
          meses: data.meses,
          total: data.total,
          media: meses.length > 0 ? data.total / meses.length : 0,
        }))
        .sort((a, b) => b.total - a.total);

      const totalGeral = contas.reduce((acc, c) => acc + c.total, 0);
      const mediaGeral = meses.length > 0 ? totalGeral / meses.length : 0;

      // Top account
      const topConta = contas.length > 0 ? contas[0] : null;

      return NextResponse.json({
        success: true,
        data: {
          contas,
          meses,
          mesesLabels,
          totalGeral,
          mediaGeral,
          topConta: topConta ? { nome: topConta.conta, total: topConta.total } : null,
          qtdContas: contas.length,
        },
      });
    }

    if (tipo === "contas") {
      // All accounts for chart cross-reference (DRE + Plano de Contas)
      const [planoResult, dreResult] = await Promise.all([
        db.execute({
          sql: `SELECT FIN_PLANO_CONTA_ID as id, FIN_PLANO_CONTA_NOME as nome, FIN_PLANO_CONTA_NATUREZA as natureza, 'PLANO_CONTAS' as origem
                FROM FIN_PLANO_CONTA WHERE EMPRESA_ID = ? ORDER BY FIN_PLANO_CONTA_NOME`,
          args: [empresaId],
        }),
        db.execute({
          sql: `SELECT FIN_ESTRUTURA_DRE_ID as id, FIN_ESTRUTURA_DRE_NOME as nome, FIN_ESTRUTURA_DRE_NATUREZA as natureza, 'DRE' as origem
                FROM FIN_ESTRUTURA_DRE WHERE EMPRESA_ID = ? ORDER BY FIN_ESTRUTURA_DRE_NOME`,
          args: [empresaId],
        }),
      ]);

      const contas = [
        ...(planoResult.rows ?? []).map((r: any) => ({ id: Number(r.id), nome: String(r.nome), natureza: String(r.natureza), origem: "PLANO_CONTAS" })),
        ...(dreResult.rows ?? []).map((r: any) => ({ id: Number(r.id), nome: String(r.nome), natureza: String(r.natureza), origem: "DRE" })),
      ];

      return NextResponse.json({ success: true, data: contas });
    }

    if (tipo === "cruzamento") {
      // Cross-reference: monthly data for selected accounts
      const contaIds = params.get("contaIds")?.split(",").map(Number).filter(Boolean) ?? [];
      if (contaIds.length === 0) {
        return NextResponse.json({ success: true, data: { series: [], meses: [], mesesLabels: [] } });
      }

      const placeholders = contaIds.map(() => "?").join(",");
      const result = await db.execute({
        sql: `
          SELECT
            p.FIN_PLANO_CONTA_ID as contaId,
            p.FIN_PLANO_CONTA_NOME as conta,
            strftime('%Y-%m', l.FIN_LANCAMENTO_DATA) as mes,
            COALESCE(SUM(l.FIN_LANCAMENTO_VALOR), 0) as total
          FROM FIN_LANCAMENTO l
          JOIN FIN_PLANO_CONTA p ON p.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID
            AND p.EMPRESA_ID = l.EMPRESA_ID
          WHERE l.EMPRESA_ID = ?
            AND l.FIN_LANCAMENTO_DATA >= ?
            AND l.FIN_LANCAMENTO_DATA <= ?
            AND l.FIN_PLANO_CONTA_ID IN (${placeholders})
          GROUP BY p.FIN_PLANO_CONTA_ID, p.FIN_PLANO_CONTA_NOME, strftime('%Y-%m', l.FIN_LANCAMENTO_DATA)
          ORDER BY mes ASC
        `,
        args: [empresaId, dataInicio, dataFim, ...contaIds],
      });

      const mesesSet = new Set<string>();
      const seriesMap = new Map<number, { nome: string; dados: Record<string, number> }>();

      for (const row of result.rows ?? []) {
        const r = row as any;
        const contaId = Number(r.contaId);
        const mes = String(r.mes);
        mesesSet.add(mes);

        if (!seriesMap.has(contaId)) {
          seriesMap.set(contaId, { nome: String(r.conta), dados: {} });
        }
        seriesMap.get(contaId)!.dados[mes] = Number(r.total);
      }

      const meses = Array.from(mesesSet).sort();
      const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const mesesLabels = meses.map((m) => {
        const mesNum = parseInt(m.split("-")[1]) - 1;
        return mesesNomes[mesNum] ?? m;
      });

      const series = Array.from(seriesMap.entries()).map(([id, data]) => ({
        contaId: id,
        nome: data.nome,
        valores: meses.map((m) => data.dados[m] ?? 0),
      }));

      return NextResponse.json({ success: true, data: { series, meses, mesesLabels } });
    }

    return NextResponse.json({ success: false, error: "Tipo invalido. Use: evolucao, receitas, despesas, contas, cruzamento" }, { status: 400 });
  } catch (error) {
    console.error("Erro na analise do dashboard:", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}
