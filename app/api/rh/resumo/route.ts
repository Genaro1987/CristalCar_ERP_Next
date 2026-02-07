import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const url = request.nextUrl;
  const anoParam = url.searchParams.get("ano");
  const mesInicioParam = url.searchParams.get("mesInicio");
  const mesFimParam = url.searchParams.get("mesFim");

  const ano = anoParam ? Number(anoParam) : new Date().getFullYear();
  const mesInicio = mesInicioParam ? Number(mesInicioParam) : 1;
  const mesFim = mesFimParam ? Number(mesFimParam) : new Date().getMonth() + 1;

  try {
    // Fetch all active employees
    const funcionariosResult = await db.execute({
      sql: `
        SELECT
          f.ID_FUNCIONARIO,
          f.NOME_COMPLETO,
          f.DATA_ADMISSAO,
          f.SALARIO_BASE,
          f.CARGA_HORARIA_MENSAL_REFERENCIA,
          d.NOME_DEPARTAMENTO,
          j.NOME_JORNADA,
          j.TOLERANCIA_MINUTOS
        FROM RH_FUNCIONARIO f
        LEFT JOIN EMP_DEPARTAMENTO d ON d.ID_DEPARTAMENTO = f.ID_DEPARTAMENTO AND d.ID_EMPRESA = f.ID_EMPRESA
        LEFT JOIN RH_JORNADA_TRABALHO j ON j.ID_JORNADA = f.ID_JORNADA AND j.ID_EMPRESA = f.ID_EMPRESA
        WHERE f.ID_EMPRESA = ? AND f.ATIVO = 1
        ORDER BY f.NOME_COMPLETO
      `,
      args: [empresaId],
    });

    const funcionarios = funcionariosResult.rows as any[];
    if (funcionarios.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch fechamento data for all employees in the period range
    const competencias: string[] = [];
    for (let m = mesInicio; m <= mesFim; m++) {
      competencias.push(`${ano}-${String(m).padStart(2, "0")}`);
    }

    const placeholders = competencias.map(() => "?").join(",");
    const funcIds = funcionarios.map((f) => f.ID_FUNCIONARIO);
    const funcPlaceholders = funcIds.map(() => "?").join(",");

    // Get closed period data
    const fechamentosResult = await db.execute({
      sql: `
        SELECT
          ID_FUNCIONARIO,
          COMPETENCIA,
          HORAS_EXTRAS_50_MINUTOS,
          HORAS_EXTRAS_100_MINUTOS,
          HORAS_DEVIDAS_MINUTOS,
          SALDO_FINAL_MINUTOS,
          VALOR_PAGAR,
          VALOR_DESCONTAR
        FROM RH_BANCO_HORAS_FECHAMENTO
        WHERE ID_EMPRESA = ?
          AND COMPETENCIA IN (${placeholders})
          AND ID_FUNCIONARIO IN (${funcPlaceholders})
      `,
      args: [empresaId, ...competencias, ...funcIds],
    });

    const fechamentos = fechamentosResult.rows as any[];

    // Count occurrences (faltas, férias) from ponto
    const dataInicio = `${ano}-${String(mesInicio).padStart(2, "0")}-01`;
    const lastDay = new Date(ano, mesFim, 0).getDate();
    const dataFim = `${ano}-${String(mesFim).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const ocorrenciasResult = await db.execute({
      sql: `
        SELECT
          ID_FUNCIONARIO,
          TIPO_OCORRENCIA,
          COUNT(*) as TOTAL
        FROM RH_PONTO_LANCAMENTO
        WHERE ID_EMPRESA = ?
          AND DATA_REFERENCIA >= ?
          AND DATA_REFERENCIA <= ?
          AND ID_FUNCIONARIO IN (${funcPlaceholders})
        GROUP BY ID_FUNCIONARIO, TIPO_OCORRENCIA
      `,
      args: [empresaId, dataInicio, dataFim, ...funcIds],
    });

    const ocorrencias = ocorrenciasResult.rows as any[];

    // Count days worked from ponto
    const diasTrabalhadosResult = await db.execute({
      sql: `
        SELECT
          ID_FUNCIONARIO,
          COUNT(*) as DIAS_TRABALHADOS
        FROM RH_PONTO_LANCAMENTO
        WHERE ID_EMPRESA = ?
          AND DATA_REFERENCIA >= ?
          AND DATA_REFERENCIA <= ?
          AND ID_FUNCIONARIO IN (${funcPlaceholders})
          AND (TIPO_OCORRENCIA IS NULL OR TIPO_OCORRENCIA = 'NORMAL')
          AND (ENTRADA_MANHA IS NOT NULL OR ENTRADA_TARDE IS NOT NULL)
        GROUP BY ID_FUNCIONARIO
      `,
      args: [empresaId, dataInicio, dataFim, ...funcIds],
    });

    const diasTrabalhados = diasTrabalhadosResult.rows as any[];

    // Build lookup maps
    const fechamentoMap = new Map<string, any[]>();
    for (const f of fechamentos) {
      const key = f.ID_FUNCIONARIO;
      if (!fechamentoMap.has(key)) fechamentoMap.set(key, []);
      fechamentoMap.get(key)!.push(f);
    }

    const ocorrenciaMap = new Map<string, Map<string, number>>();
    for (const o of ocorrencias) {
      const key = o.ID_FUNCIONARIO;
      if (!ocorrenciaMap.has(key)) ocorrenciaMap.set(key, new Map());
      ocorrenciaMap.get(key)!.set(o.TIPO_OCORRENCIA || "NORMAL", Number(o.TOTAL));
    }

    const diasMap = new Map<string, number>();
    for (const d of diasTrabalhados) {
      diasMap.set(d.ID_FUNCIONARIO, Number(d.DIAS_TRABALHADOS));
    }

    // Monthly breakdown per employee
    const mesesEvol: string[] = [];
    for (let m = mesInicio; m <= mesFim; m++) {
      mesesEvol.push(`${ano}-${String(m).padStart(2, "0")}`);
    }

    // Assemble result
    const resultado = funcionarios.map((func) => {
      const id = func.ID_FUNCIONARIO;
      const fech = fechamentoMap.get(id) ?? [];
      const ocorr = ocorrenciaMap.get(id) ?? new Map();

      // Aggregate totals from fechamento
      let totalExtras50 = 0;
      let totalExtras100 = 0;
      let totalDevidas = 0;
      let totalPagar = 0;
      let totalDescontar = 0;

      for (const f of fech) {
        totalExtras50 += Number(f.HORAS_EXTRAS_50_MINUTOS ?? 0);
        totalExtras100 += Number(f.HORAS_EXTRAS_100_MINUTOS ?? 0);
        totalDevidas += Number(f.HORAS_DEVIDAS_MINUTOS ?? 0);
        totalPagar += Number(f.VALOR_PAGAR ?? 0);
        totalDescontar += Number(f.VALOR_DESCONTAR ?? 0);
      }

      // Monthly evolution
      const evolucao = mesesEvol.map((comp) => {
        const fechMes = fech.find((f: any) => f.COMPETENCIA === comp);
        return {
          competencia: comp,
          extras50Min: Number(fechMes?.HORAS_EXTRAS_50_MINUTOS ?? 0),
          extras100Min: Number(fechMes?.HORAS_EXTRAS_100_MINUTOS ?? 0),
          devidasMin: Number(fechMes?.HORAS_DEVIDAS_MINUTOS ?? 0),
          saldoMin: Number(fechMes?.SALDO_FINAL_MINUTOS ?? 0),
        };
      });

      return {
        id,
        nome: func.NOME_COMPLETO,
        departamento: func.NOME_DEPARTAMENTO ?? "Sem departamento",
        jornada: func.NOME_JORNADA ?? "",
        dataAdmissao: func.DATA_ADMISSAO,
        salarioBase: Number(func.SALARIO_BASE ?? 0),
        diasTrabalhados: diasMap.get(id) ?? 0,
        feriasCount: ocorr.get("FERIAS") ?? 0,
        faltasJustificadas: ocorr.get("FALTA_JUSTIFICADA") ?? 0,
        faltasNaoJustificadas: ocorr.get("FALTA_NAO_JUSTIFICADA") ?? 0,
        extras50Min: totalExtras50,
        extras100Min: totalExtras100,
        devidasMin: totalDevidas,
        valorPagar: totalPagar,
        valorDescontar: totalDescontar,
        saldoUltimoMes: fech.length > 0 ? Number(fech[fech.length - 1].SALDO_FINAL_MINUTOS ?? 0) : 0,
        evolucao,
      };
    });

    return NextResponse.json({ success: true, data: resultado });
  } catch (error) {
    console.error("Erro ao gerar resumo de funcionários:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao gerar resumo" },
      { status: 500 }
    );
  }
}
