import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface DreNode {
  id: number;
  paiId: number | null;
  codigo: string;
  nome: string;
  natureza: string;
  previsto: number;
  realizado: number;
  distorcaoValor: number;
  distorcaoPct: number;
  colunas: Record<string, { previsto: number; realizado: number; distorcaoValor: number; distorcaoPct: number }>;
  filhos: DreNode[];
}

type TipoVisao = "mensal" | "trimestral" | "semestral" | "anual";

interface PeriodoInfo {
  chave: string;
  label: string;
}

function construirArvore(linhas: DreNode[]): DreNode[] {
  const mapa = new Map<number, DreNode>();
  const raizes: DreNode[] = [];
  linhas.forEach((l) => mapa.set(l.id, { ...l, filhos: [] }));
  mapa.forEach((l) => {
    if (l.paiId && mapa.has(l.paiId)) {
      mapa.get(l.paiId)!.filhos.push(l);
    } else {
      raizes.push(l);
    }
  });
  return raizes;
}

function somarFilhos(node: DreNode): DreNode {
  const filhosAtualizados = node.filhos.map(somarFilhos);
  if (filhosAtualizados.length === 0) return node;

  const previsto = filhosAtualizados.reduce((acc, f) => acc + f.previsto, 0);
  const realizado = filhosAtualizados.reduce((acc, f) => acc + f.realizado, 0);
  const distorcaoValor = realizado - previsto;
  const distorcaoPct = previsto !== 0 ? (distorcaoValor / Math.abs(previsto)) * 100 : 0;

  // Sum child columns
  const colunasConsolidadas: DreNode["colunas"] = {};
  const chavesSet = new Set<string>();
  filhosAtualizados.forEach((f) => Object.keys(f.colunas).forEach((k) => chavesSet.add(k)));
  const chaves = Array.from(chavesSet);
  for (let ci = 0; ci < chaves.length; ci++) {
    const chave = chaves[ci];
    const pCol = filhosAtualizados.reduce((acc, f) => acc + (f.colunas[chave]?.previsto ?? 0), 0);
    const rCol = filhosAtualizados.reduce((acc, f) => acc + (f.colunas[chave]?.realizado ?? 0), 0);
    const dv = rCol - pCol;
    colunasConsolidadas[chave] = {
      previsto: pCol,
      realizado: rCol,
      distorcaoValor: dv,
      distorcaoPct: pCol !== 0 ? (dv / Math.abs(pCol)) * 100 : 0,
    };
  }

  return { ...node, filhos: filhosAtualizados, previsto, realizado, distorcaoValor, distorcaoPct, colunas: colunasConsolidadas };
}

function gerarPeriodos(visao: TipoVisao, anoObj: number): PeriodoInfo[] {
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const periodos: PeriodoInfo[] = [];

  if (visao === "mensal") {
    for (let m = 1; m <= 12; m++) {
      periodos.push({ chave: `${anoObj}-${String(m).padStart(2, "0")}`, label: `${nomes[m - 1]}/${anoObj}` });
    }
  } else if (visao === "trimestral") {
    for (let t = 1; t <= 4; t++) {
      const mInicio = (t - 1) * 3 + 1;
      const mFim = t * 3;
      periodos.push({ chave: `T${t}-${anoObj}`, label: `${t}T/${anoObj}` });
    }
  } else if (visao === "semestral") {
    periodos.push({ chave: `S1-${anoObj}`, label: `1S/${anoObj}` });
    periodos.push({ chave: `S2-${anoObj}`, label: `2S/${anoObj}` });
  } else {
    periodos.push({ chave: `A-${anoObj}`, label: `${anoObj}` });
  }

  return periodos;
}

function mesParaPeriodo(mes: number, visao: TipoVisao, ano: number): string {
  if (visao === "mensal") return `${ano}-${String(mes).padStart(2, "0")}`;
  if (visao === "trimestral") return `T${Math.ceil(mes / 3)}-${ano}`;
  if (visao === "semestral") return `S${mes <= 6 ? 1 : 2}-${ano}`;
  return `A-${ano}`;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const params = request.nextUrl.searchParams;
  const anoRef = Number(params.get("anoRef") ?? new Date().getFullYear());
  const mesInicioRef = Number(params.get("mesInicioRef") ?? 1);
  const mesFimRef = Number(params.get("mesFimRef") ?? new Date().getMonth() + 1);
  const anoObjetivo = Number(params.get("anoObjetivo") ?? new Date().getFullYear());
  const visao = (params.get("visao") ?? "mensal") as TipoVisao;

  // Period for media calculation (reference)
  const mesesRef = mesFimRef >= mesInicioRef ? mesFimRef - mesInicioRef + 1 : 12 - mesInicioRef + 1 + mesFimRef;
  const mmI = String(mesInicioRef).padStart(2, "0");
  const mmF = String(mesFimRef).padStart(2, "0");
  const ultimoDiaRef = new Date(anoRef, mesFimRef, 0).getDate();
  const dataInicioRef = `${anoRef}-${mmI}-01`;
  const dataFimRef = `${anoRef}-${mmF}-${String(ultimoDiaRef).padStart(2, "0")}`;

  // Objective year: full year for realizado
  const dataInicioObj = `${anoObjetivo}-01-01`;
  const dataFimObj = `${anoObjetivo}-12-31`;

  try {
    // DRE structure
    const dreResult = await db.execute({
      sql: `SELECT FIN_ESTRUTURA_DRE_ID, FIN_ESTRUTURA_DRE_PAI_ID, FIN_ESTRUTURA_DRE_CODIGO,
                   FIN_ESTRUTURA_DRE_NOME, FIN_ESTRUTURA_DRE_NATUREZA,
                   COALESCE(FIN_ESTRUTURA_DRE_ORDEM, 0) as ORDEM
            FROM FIN_ESTRUTURA_DRE WHERE EMPRESA_ID = ? ORDER BY ORDEM ASC`,
      args: [empresaId],
    });

    // DRE-to-plano-conta links
    const linksResult = await db.execute({
      sql: `SELECT FIN_ESTRUTURA_DRE_ID, FIN_PLANO_CONTA_ID
            FROM FIN_ESTRUTURA_DRE_CONTA WHERE EMPRESA_ID = ?`,
      args: [empresaId],
    });

    const contasPorDre = new Map<number, number[]>();
    for (const r of linksResult.rows as any[]) {
      const dreId = Number(r.FIN_ESTRUTURA_DRE_ID);
      if (!contasPorDre.has(dreId)) contasPorDre.set(dreId, []);
      contasPorDre.get(dreId)!.push(Number(r.FIN_PLANO_CONTA_ID));
    }

    // Lancamentos totals per plano conta in REFERENCE period (for media/previsto)
    const lancRefResult = await db.execute({
      sql: `SELECT FIN_PLANO_CONTA_ID, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total
            FROM FIN_LANCAMENTO
            WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ?
            GROUP BY FIN_PLANO_CONTA_ID`,
      args: [empresaId, dataInicioRef, dataFimRef],
    });

    const totaisContaRef = new Map<number, number>();
    for (const r of lancRefResult.rows as any[]) {
      totaisContaRef.set(Number(r.FIN_PLANO_CONTA_ID), Number(r.total ?? 0));
    }

    // Lancamentos per plano conta per MONTH in OBJECTIVE year (for realizado by period)
    const lancObjResult = await db.execute({
      sql: `SELECT FIN_PLANO_CONTA_ID,
                   CAST(SUBSTR(FIN_LANCAMENTO_DATA, 6, 2) AS INTEGER) as MES,
                   COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total
            FROM FIN_LANCAMENTO
            WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ?
            GROUP BY FIN_PLANO_CONTA_ID, MES`,
      args: [empresaId, dataInicioObj, dataFimObj],
    });

    // Map: contaId -> mes -> total
    const realizadoPorContaMes = new Map<number, Map<number, number>>();
    for (const r of lancObjResult.rows as any[]) {
      const contaId = Number(r.FIN_PLANO_CONTA_ID);
      const mes = Number(r.MES);
      if (!realizadoPorContaMes.has(contaId)) realizadoPorContaMes.set(contaId, new Map());
      realizadoPorContaMes.get(contaId)!.set(mes, Number(r.total ?? 0));
    }

    // Saved percentages per DRE line
    const pctResult = await db.execute({
      sql: `SELECT FIN_CONTA_ID, FIN_OBJETIVO_PERCENTUAL
            FROM FIN_OBJETIVO_CONTA
            WHERE ID_EMPRESA = ? AND FIN_OBJETIVO_TIPO = 'ESTRUTURA_DRE' AND FIN_OBJETIVO_ANO = ?`,
      args: [empresaId, anoObjetivo],
    });

    const percentuais = new Map<number, number>();
    for (const r of pctResult.rows as any[]) {
      percentuais.set(Number(r.FIN_CONTA_ID), Number(r.FIN_OBJETIVO_PERCENTUAL ?? 0));
    }

    const divisor = Math.max(1, mesesRef);
    const periodos = gerarPeriodos(visao, anoObjetivo);

    const linhas: DreNode[] = (dreResult.rows as any[])
      .filter((r) => r.FIN_ESTRUTURA_DRE_NATUREZA !== "CALCULADO")
      .map((r) => {
        const dreId = Number(r.FIN_ESTRUTURA_DRE_ID);
        const contas = contasPorDre.get(dreId) ?? [];

        // Reference media
        const totalRef = contas.reduce((acc, cId) => acc + (totaisContaRef.get(cId) ?? 0), 0);
        const media = totalRef / divisor;
        const pct = percentuais.get(dreId) ?? 0;
        const previstoMensal = media * (1 + pct / 100);

        // Realizado by period
        const colunas: DreNode["colunas"] = {};
        let realizadoTotal = 0;
        let previstoTotal = 0;

        for (const periodo of periodos) {
          let mesesNoPeriodo: number[] = [];
          if (visao === "mensal") {
            const m = Number(periodo.chave.split("-")[1]);
            mesesNoPeriodo = [m];
          } else if (visao === "trimestral") {
            const t = Number(periodo.chave.split("-")[0].replace("T", ""));
            mesesNoPeriodo = [(t - 1) * 3 + 1, (t - 1) * 3 + 2, (t - 1) * 3 + 3];
          } else if (visao === "semestral") {
            const s = Number(periodo.chave.split("-")[0].replace("S", ""));
            mesesNoPeriodo = s === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
          } else {
            mesesNoPeriodo = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
          }

          const previstoP = previstoMensal * mesesNoPeriodo.length;
          let realizadoP = 0;
          for (const cId of contas) {
            const mesMapa = realizadoPorContaMes.get(cId);
            if (mesMapa) {
              for (const m of mesesNoPeriodo) {
                realizadoP += mesMapa.get(m) ?? 0;
              }
            }
          }

          const dv = realizadoP - previstoP;
          colunas[periodo.chave] = {
            previsto: previstoP,
            realizado: realizadoP,
            distorcaoValor: dv,
            distorcaoPct: previstoP !== 0 ? (dv / Math.abs(previstoP)) * 100 : 0,
          };

          previstoTotal += previstoP;
          realizadoTotal += realizadoP;
        }

        const distValTotal = realizadoTotal - previstoTotal;

        return {
          id: dreId,
          paiId: r.FIN_ESTRUTURA_DRE_PAI_ID ? Number(r.FIN_ESTRUTURA_DRE_PAI_ID) : null,
          codigo: String(r.FIN_ESTRUTURA_DRE_CODIGO ?? ""),
          nome: String(r.FIN_ESTRUTURA_DRE_NOME ?? ""),
          natureza: String(r.FIN_ESTRUTURA_DRE_NATUREZA ?? ""),
          previsto: previstoTotal,
          realizado: realizadoTotal,
          distorcaoValor: distValTotal,
          distorcaoPct: previstoTotal !== 0 ? (distValTotal / Math.abs(previstoTotal)) * 100 : 0,
          colunas,
          filhos: [],
        };
      });

    const arvore = construirArvore(linhas).map(somarFilhos);

    return NextResponse.json({
      success: true,
      data: arvore,
      periodos,
      anoObjetivo,
    });
  } catch (error) {
    console.error("Erro ao buscar acompanhamento:", error);
    return NextResponse.json({ success: false, error: "Erro ao buscar acompanhamento" }, { status: 500 });
  }
}
