import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface ResumoCarteira {
  empresa: string;
  saldo: number;
  entradas: number;
  saidas: number;
}

interface Indicador {
  titulo: string;
  valor: string;
  descricao: string;
}

interface DashboardData {
  carteira: ResumoCarteira[];
  indicadores: Indicador[];
  alertas: Alertas;
}

interface Alertas {
  entradasPeriodo: number;
  saidasPeriodo: number;
  vencidos: number;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const periodo = request.nextUrl.searchParams.get("periodo"); // formato: YYYY-MM

  try {
    // Calcular resumo de carteira (entradas, saídas e saldo)
    let sqlResumo = `
      SELECT
        e.NOME_EMPRESA as empresa,
        COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR >= 0 THEN l.FIN_LANCAMENTO_VALOR ELSE 0 END), 0) as entradas,
        COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR < 0 THEN ABS(l.FIN_LANCAMENTO_VALOR) ELSE 0 END), 0) as saidas,
        COALESCE(SUM(l.FIN_LANCAMENTO_VALOR), 0) as saldo
      FROM EMP_EMPRESA e
      LEFT JOIN FIN_LANCAMENTO l ON l.ID_EMPRESA = e.ID_EMPRESA
    `;

    const args: any[] = [];

    if (periodo) {
      sqlResumo += ` AND strftime('%Y-%m', l.FIN_LANCAMENTO_DATA) = ?`;
      args.push(periodo);
    }

    sqlResumo += `
      WHERE e.ID_EMPRESA = ?
      GROUP BY e.ID_EMPRESA, e.NOME_EMPRESA
    `;

    args.push(empresaId);

    const resultadoResumo = await db.execute({
      sql: sqlResumo,
      args,
    });

    const carteira: ResumoCarteira[] = resultadoResumo.rows.map((row: any) => ({
      empresa: row.empresa,
      saldo: Number(row.saldo),
      entradas: Number(row.entradas),
      saidas: Number(row.saidas),
    }));

    // Se não houver dados, retornar empresa com valores zerados
    if (carteira.length === 0) {
      const empresaResult = await db.execute({
        sql: `SELECT NOME_EMPRESA FROM EMP_EMPRESA WHERE ID_EMPRESA = ?`,
        args: [empresaId],
      });

      if (empresaResult.rows.length > 0) {
        carteira.push({
          empresa: (empresaResult.rows[0] as any).NOME_EMPRESA,
          saldo: 0,
          entradas: 0,
          saidas: 0,
        });
      }
    }

    // Calcular indicadores
    const indicadores: Indicador[] = [];

    // Margem (receitas - despesas / receitas)
    const totalEntradas = carteira.reduce((acc, c) => acc + c.entradas, 0);
    const totalSaidas = carteira.reduce((acc, c) => acc + c.saidas, 0);
    const margem = totalEntradas > 0 ? ((totalEntradas - totalSaidas) / totalEntradas) * 100 : 0;

    indicadores.push({
      titulo: "Margem",
      valor: `${margem.toFixed(1)}%`,
      descricao: "Média do período selecionado",
    });

    // Burn Rate (média de saídas por mês)
    indicadores.push({
      titulo: "Burn Rate",
      valor: `R$ ${(totalSaidas / 1000).toFixed(0)} mil`,
      descricao: "Saídas do período",
    });

    // Fluxo Projetado (entradas - saídas)
    const fluxoProjetado = totalEntradas - totalSaidas;
    const sinalFluxo = fluxoProjetado >= 0 ? "+" : "-";
    indicadores.push({
      titulo: "Fluxo Projetado",
      valor: `${sinalFluxo}R$ ${(Math.abs(fluxoProjetado) / 1000).toFixed(0)} mil`,
      descricao: "Resultado do período",
    });

    const dataHoje = new Date().toISOString().slice(0, 10);

    let sqlAlertas = `
      SELECT
        COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR >= 0 THEN l.FIN_LANCAMENTO_VALOR ELSE 0 END), 0) as entradasPeriodo,
        COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR < 0 THEN ABS(l.FIN_LANCAMENTO_VALOR) ELSE 0 END), 0) as saidasPeriodo,
        COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_DATA < ? THEN ABS(l.FIN_LANCAMENTO_VALOR) ELSE 0 END), 0) as vencidos
      FROM FIN_LANCAMENTO l
      WHERE l.ID_EMPRESA = ?
    `;

    const alertasArgs: any[] = [dataHoje, empresaId];

    if (periodo) {
      sqlAlertas += ` AND strftime('%Y-%m', l.FIN_LANCAMENTO_DATA) = ?`;
      alertasArgs.push(periodo);
    }

    const resultadoAlertas = await db.execute({
      sql: sqlAlertas,
      args: alertasArgs,
    });

    const alertas: Alertas = {
      entradasPeriodo: Number((resultadoAlertas.rows[0] as any)?.entradasPeriodo ?? 0),
      saidasPeriodo: Number((resultadoAlertas.rows[0] as any)?.saidasPeriodo ?? 0),
      vencidos: Number((resultadoAlertas.rows[0] as any)?.vencidos ?? 0),
    };

    const dashboardData: DashboardData = {
      carteira,
      indicadores,
      alertas,
    };

    return NextResponse.json({ success: true, data: dashboardData });
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar dados do dashboard" },
      { status: 500 }
    );
  }
}
