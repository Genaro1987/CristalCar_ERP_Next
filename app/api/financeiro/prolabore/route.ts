import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

// ── Helpers de data (sábado-sexta) ──

function sabadoAnterior(data: Date): Date {
  const d = new Date(data);
  const dia = d.getUTCDay(); // 0=dom..6=sab
  const diff = dia === 6 ? 0 : dia + 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function formatarData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function adicionarDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

interface SemanaRange {
  inicio: string; // sábado YYYY-MM-DD
  fim: string;    // sexta YYYY-MM-DD
  label: string;  // "03/02 - 07/02"
}

function gerarSemanas(dataInicio: string, dataFim: string): SemanaRange[] {
  const semanas: SemanaRange[] = [];
  let sabado = sabadoAnterior(new Date(dataInicio + "T00:00:00Z"));
  const limite = new Date(dataFim + "T23:59:59Z");

  while (sabado <= limite) {
    const sexta = adicionarDias(sabado, 6);
    const sab = formatarData(sabado);
    const sex = formatarData(sexta);
    const [, mI, dI] = sab.split("-");
    const [, mF, dF] = sex.split("-");
    semanas.push({
      inicio: sab,
      fim: sex,
      label: `${dI}/${mI} - ${dF}/${mF}`,
    });
    sabado = adicionarDias(sabado, 7);
  }
  return semanas;
}

// ── GET: retorna extrato pró-labore ──

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const dataInicio = request.nextUrl.searchParams.get("dataInicio");
  const dataFim = request.nextUrl.searchParams.get("dataFim");

  if (!dataInicio || !dataFim) {
    return NextResponse.json(
      { success: false, error: "dataInicio e dataFim são obrigatórios (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    // 1) Buscar config
    const cfgRes = await db.execute({
      sql: `SELECT * FROM FIN_PROLABORE_CONFIG WHERE EMPRESA_ID = ? AND FIN_PROLABORE_ATIVO = 1`,
      args: [empresaId],
    });

    if (cfgRes.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { configurado: false, extrato: [], config: null },
      });
    }

    const cfg = cfgRes.rows[0] as any;
    const percentual = Number(cfg.FIN_PROLABORE_PERCENTUAL ?? 12.5);
    const saldoInicial = Number(cfg.FIN_PROLABORE_SALDO_INICIAL ?? 0);

    // 2) Buscar contas excluídas de receita
    const exclRes = await db.execute({
      sql: `SELECT FIN_PLANO_CONTA_ID FROM FIN_PROLABORE_RECEITA_EXCLUIDA WHERE EMPRESA_ID = ?`,
      args: [empresaId],
    });
    const contasExcluidas = new Set(
      exclRes.rows.map((r: any) => Number(r.FIN_PLANO_CONTA_ID))
    );

    // 3) Buscar contas de despesa pró-labore
    const despRes = await db.execute({
      sql: `SELECT FIN_PLANO_CONTA_ID FROM FIN_PROLABORE_DESPESA WHERE EMPRESA_ID = ?`,
      args: [empresaId],
    });
    const contasDespesa = new Set(
      despRes.rows.map((r: any) => Number(r.FIN_PLANO_CONTA_ID))
    );

    // 4) Gerar semanas no intervalo
    const semanas = gerarSemanas(dataInicio, dataFim);
    if (semanas.length === 0) {
      return NextResponse.json({ success: true, data: { configurado: true, extrato: [], config: { percentual, saldoInicial } } });
    }

    // Expandir o range para incluir a semana anterior à primeira (para calcular crédito)
    const primeiroSabado = semanas[0].inicio;
    const semanaAnteriorInicio = formatarData(adicionarDias(new Date(primeiroSabado + "T00:00:00Z"), -7));
    const ultimaSexta = semanas[semanas.length - 1].fim;

    // 5) Buscar todos os lançamentos do período expandido
    const lancRes = await db.execute({
      sql: `
        SELECT
          FIN_LANCAMENTO_DATA,
          FIN_LANCAMENTO_VALOR,
          FIN_PLANO_CONTA_ID,
          pc.FIN_PLANO_CONTA_NATUREZA
        FROM FIN_LANCAMENTO l
        INNER JOIN FIN_PLANO_CONTA pc ON pc.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID
        WHERE l.EMPRESA_ID = ?
          AND l.FIN_LANCAMENTO_DATA >= ?
          AND l.FIN_LANCAMENTO_DATA <= ?
        ORDER BY l.FIN_LANCAMENTO_DATA
      `,
      args: [empresaId, semanaAnteriorInicio, ultimaSexta],
    });

    // 6) Organizar lançamentos por semana
    const lancamentos = lancRes.rows as any[];

    function somaPorSemana(inicio: string, fim: string) {
      let receitas = 0;
      let despesasProlabore = 0;

      for (const l of lancamentos) {
        const data = l.FIN_LANCAMENTO_DATA;
        if (data < inicio || data > fim) continue;

        const contaId = Number(l.FIN_PLANO_CONTA_ID);
        const valor = Number(l.FIN_LANCAMENTO_VALOR);
        const natureza = l.FIN_PLANO_CONTA_NATUREZA;

        // Receitas (valor positivo, natureza RECEITA, não excluída)
        if (natureza === "RECEITA" && valor > 0 && !contasExcluidas.has(contaId)) {
          receitas += valor;
        }

        // Despesas pró-labore (contas configuradas)
        if (contasDespesa.has(contaId) && valor < 0) {
          despesasProlabore += Math.abs(valor);
        }
      }

      return { receitas, despesasProlabore };
    }

    // 7) Calcular extrato com saldo acumulado
    const extrato: Array<{
      semana: string;
      inicio: string;
      fim: string;
      receitaSemanaAnterior: number;
      credito: number;
      despesa: number;
      saldo: number;
      saldoAcumulado: number;
    }> = [];

    let saldoAcumulado = saldoInicial;

    for (let i = 0; i < semanas.length; i++) {
      const sem = semanas[i];

      // Crédito = percentual% das receitas da semana ANTERIOR
      const semAnteriorInicio = formatarData(adicionarDias(new Date(sem.inicio + "T00:00:00Z"), -7));
      const semAnteriorFim = formatarData(adicionarDias(new Date(sem.inicio + "T00:00:00Z"), -1));
      const { receitas: receitaAnterior } = somaPorSemana(semAnteriorInicio, semAnteriorFim);
      const credito = receitaAnterior * (percentual / 100);

      // Débito = despesas pró-labore da semana ATUAL
      const { despesasProlabore } = somaPorSemana(sem.inicio, sem.fim);

      const saldoSemana = credito - despesasProlabore;
      saldoAcumulado += saldoSemana;

      extrato.push({
        semana: sem.label,
        inicio: sem.inicio,
        fim: sem.fim,
        receitaSemanaAnterior: receitaAnterior,
        credito,
        despesa: despesasProlabore,
        saldo: saldoSemana,
        saldoAcumulado,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        configurado: true,
        config: { percentual, saldoInicial },
        extrato,
      },
    });
  } catch (error) {
    console.error("Erro ao calcular extrato pró-labore:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao calcular extrato pró-labore" },
      { status: 500 }
    );
  }
}

// ── POST: salvar/atualizar configuração ──

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const body = await request.json();
  const {
    percentual,
    saldoInicial,
    dataInicio,
    contasReceitaExcluidas,
    contasDespesaProlabore,
  } = body;

  if (!dataInicio) {
    return NextResponse.json(
      { success: false, error: "dataInicio é obrigatório" },
      { status: 400 }
    );
  }

  try {
    // Upsert config
    await db.execute({
      sql: `
        INSERT INTO FIN_PROLABORE_CONFIG (
          EMPRESA_ID, FIN_PROLABORE_PERCENTUAL, FIN_PROLABORE_SALDO_INICIAL,
          FIN_PROLABORE_DATA_INICIO, FIN_PROLABORE_ATIVO
        ) VALUES (?, ?, ?, ?, 1)
        ON CONFLICT (EMPRESA_ID) DO UPDATE SET
          FIN_PROLABORE_PERCENTUAL = excluded.FIN_PROLABORE_PERCENTUAL,
          FIN_PROLABORE_SALDO_INICIAL = excluded.FIN_PROLABORE_SALDO_INICIAL,
          FIN_PROLABORE_DATA_INICIO = excluded.FIN_PROLABORE_DATA_INICIO,
          FIN_PROLABORE_ATIVO = 1,
          FIN_PROLABORE_ATUALIZADO_EM = datetime('now')
      `,
      args: [empresaId, percentual ?? 12.5, saldoInicial ?? 0, dataInicio],
    });

    // Atualizar contas excluídas
    if (Array.isArray(contasReceitaExcluidas)) {
      await db.execute({
        sql: `DELETE FROM FIN_PROLABORE_RECEITA_EXCLUIDA WHERE EMPRESA_ID = ?`,
        args: [empresaId],
      });

      for (const contaId of contasReceitaExcluidas) {
        await db.execute({
          sql: `INSERT INTO FIN_PROLABORE_RECEITA_EXCLUIDA (EMPRESA_ID, FIN_PLANO_CONTA_ID) VALUES (?, ?)`,
          args: [empresaId, contaId],
        });
      }
    }

    // Atualizar contas de despesa pró-labore
    if (Array.isArray(contasDespesaProlabore)) {
      await db.execute({
        sql: `DELETE FROM FIN_PROLABORE_DESPESA WHERE EMPRESA_ID = ?`,
        args: [empresaId],
      });

      for (const contaId of contasDespesaProlabore) {
        await db.execute({
          sql: `INSERT INTO FIN_PROLABORE_DESPESA (EMPRESA_ID, FIN_PLANO_CONTA_ID) VALUES (?, ?)`,
          args: [empresaId, contaId],
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar configuração pró-labore:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao salvar configuração" },
      { status: 500 }
    );
  }
}

// ── GET config (endpoint separado via query param) ──
// Para buscar configuração sem calcular extrato, use GET ?configOnly=1

