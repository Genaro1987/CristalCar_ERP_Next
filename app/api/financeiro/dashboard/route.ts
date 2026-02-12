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

  const dataInicio = request.nextUrl.searchParams.get("dataInicio");
  const dataFim = request.nextUrl.searchParams.get("dataFim");

  if (!dataInicio || !dataFim) {
    return NextResponse.json({ success: false, error: "dataInicio e dataFim obrigatorios" }, { status: 400 });
  }

  try {
    // Calcular resumo de carteira (entradas, saídas e saldo)
    const sqlResumo = `
      SELECT
        e.NOME_FANTASIA as empresa,
        COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR >= 0 THEN l.FIN_LANCAMENTO_VALOR ELSE 0 END), 0) as entradas,
        COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR < 0 THEN ABS(l.FIN_LANCAMENTO_VALOR) ELSE 0 END), 0) as saidas,
        COALESCE(SUM(l.FIN_LANCAMENTO_VALOR), 0) as saldo
      FROM EMP_EMPRESA e
      LEFT JOIN FIN_LANCAMENTO l ON l.EMPRESA_ID = e.ID_EMPRESA
        AND l.FIN_LANCAMENTO_DATA >= ? AND l.FIN_LANCAMENTO_DATA <= ?
      WHERE e.ID_EMPRESA = ?
      GROUP BY e.ID_EMPRESA, e.NOME_FANTASIA
    `;

    const args: any[] = [dataInicio, dataFim, empresaId];

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
        sql: `SELECT NOME_FANTASIA FROM EMP_EMPRESA WHERE ID_EMPRESA = ?`,
        args: [empresaId],
      });

      if (empresaResult.rows.length > 0) {
        carteira.push({
          empresa: (empresaResult.rows[0] as any).NOME_FANTASIA,
          saldo: 0,
          entradas: 0,
          saidas: 0,
        });
      }
    }

    // Calcular indicadores
    const indicadores: Indicador[] = [];

    const totalEntradas = carteira.reduce((acc, c) => acc + c.entradas, 0);
    const totalSaidas = carteira.reduce((acc, c) => acc + c.saidas, 0);
    const margem = totalEntradas > 0 ? ((totalEntradas - totalSaidas) / totalEntradas) * 100 : 0;

    indicadores.push({
      titulo: "Margem",
      valor: `${margem.toFixed(1)}%`,
      descricao: "Média do período selecionado",
    });

    indicadores.push({
      titulo: "Burn Rate",
      valor: `R$ ${(totalSaidas / 1000).toFixed(0)} mil`,
      descricao: "Saídas do período",
    });

    const fluxoProjetado = totalEntradas - totalSaidas;
    const sinalFluxo = fluxoProjetado >= 0 ? "+" : "-";
    indicadores.push({
      titulo: "Fluxo Projetado",
      valor: `${sinalFluxo}R$ ${(Math.abs(fluxoProjetado) / 1000).toFixed(0)} mil`,
      descricao: "Resultado do período",
    });

    const dataHoje = new Date().toISOString().slice(0, 10);

    const sqlAlertas = `
      SELECT
        COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR >= 0 THEN l.FIN_LANCAMENTO_VALOR ELSE 0 END), 0) as entradasPeriodo,
        COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR < 0 THEN ABS(l.FIN_LANCAMENTO_VALOR) ELSE 0 END), 0) as saidasPeriodo,
        COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_DATA < ? THEN ABS(l.FIN_LANCAMENTO_VALOR) ELSE 0 END), 0) as vencidos
      FROM FIN_LANCAMENTO l
      WHERE l.EMPRESA_ID = ?
        AND l.FIN_LANCAMENTO_DATA >= ? AND l.FIN_LANCAMENTO_DATA <= ?
    `;

    const resultadoAlertas = await db.execute({
      sql: sqlAlertas,
      args: [dataHoje, empresaId, dataInicio, dataFim],
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
