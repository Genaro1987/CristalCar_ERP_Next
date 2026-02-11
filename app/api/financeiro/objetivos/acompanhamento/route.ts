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
type TipoObjetivo = "ESTRUTURA_DRE" | "PLANO_CONTAS" | "CENTRO_CUSTO";

interface PeriodoInfo {
  chave: string;
  label: string;
}

function construirArvore(linhas: DreNode[]): DreNode[] {
  var mapa = new Map<number, DreNode>();
  var raizes: DreNode[] = [];
  for (var i = 0; i < linhas.length; i++) {
    mapa.set(linhas[i].id, { ...linhas[i], filhos: [] });
  }
  mapa.forEach(function (l) {
    if (l.paiId && mapa.has(l.paiId)) {
      mapa.get(l.paiId)!.filhos.push(l);
    } else {
      raizes.push(l);
    }
  });
  return raizes;
}

function somarFilhos(node: DreNode): DreNode {
  var filhosAtualizados = node.filhos.map(somarFilhos);
  if (filhosAtualizados.length === 0) return node;

  var previsto = filhosAtualizados.reduce(function (acc, f) { return acc + f.previsto; }, 0);
  var realizado = filhosAtualizados.reduce(function (acc, f) { return acc + f.realizado; }, 0);
  var distorcaoValor = realizado - previsto;
  var distorcaoPct = previsto !== 0 ? (distorcaoValor / Math.abs(previsto)) * 100 : 0;

  // Sum child columns
  var colunasConsolidadas: DreNode["colunas"] = {};
  var chavesObj: Record<string, boolean> = {};
  for (var fi = 0; fi < filhosAtualizados.length; fi++) {
    var keys = Object.keys(filhosAtualizados[fi].colunas);
    for (var ki = 0; ki < keys.length; ki++) {
      chavesObj[keys[ki]] = true;
    }
  }
  var chaves = Object.keys(chavesObj);
  for (var ci = 0; ci < chaves.length; ci++) {
    var chave = chaves[ci];
    var pCol = 0;
    var rCol = 0;
    for (var cfi = 0; cfi < filhosAtualizados.length; cfi++) {
      var col = filhosAtualizados[cfi].colunas[chave];
      if (col) {
        pCol += col.previsto;
        rCol += col.realizado;
      }
    }
    var dv = rCol - pCol;
    colunasConsolidadas[chave] = {
      previsto: pCol,
      realizado: rCol,
      distorcaoValor: dv,
      distorcaoPct: pCol !== 0 ? (dv / Math.abs(pCol)) * 100 : 0,
    };
  }

  return { ...node, filhos: filhosAtualizados, previsto: previsto, realizado: realizado, distorcaoValor: distorcaoValor, distorcaoPct: distorcaoPct, colunas: colunasConsolidadas };
}

function gerarPeriodos(visao: TipoVisao, anoObj: number): PeriodoInfo[] {
  var nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  var periodos: PeriodoInfo[] = [];

  if (visao === "mensal") {
    for (var m = 1; m <= 12; m++) {
      periodos.push({ chave: anoObj + "-" + String(m).padStart(2, "0"), label: nomes[m - 1] + "/" + anoObj });
    }
  } else if (visao === "trimestral") {
    for (var t = 1; t <= 4; t++) {
      periodos.push({ chave: "T" + t + "-" + anoObj, label: t + "T/" + anoObj });
    }
  } else if (visao === "semestral") {
    periodos.push({ chave: "S1-" + anoObj, label: "1S/" + anoObj });
    periodos.push({ chave: "S2-" + anoObj, label: "2S/" + anoObj });
  } else {
    periodos.push({ chave: "A-" + anoObj, label: String(anoObj) });
  }

  return periodos;
}

function calcularMesesNoPeriodo(periodoChave: string, visao: TipoVisao): number[] {
  if (visao === "mensal") {
    var m = Number(periodoChave.split("-")[1]);
    return [m];
  } else if (visao === "trimestral") {
    var tNum = Number(periodoChave.split("-")[0].replace("T", ""));
    return [(tNum - 1) * 3 + 1, (tNum - 1) * 3 + 2, (tNum - 1) * 3 + 3];
  } else if (visao === "semestral") {
    var sNum = Number(periodoChave.split("-")[0].replace("S", ""));
    return sNum === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

/* ── Build node with previsto/realizado per period ── */
function montarNodeComPeriodos(
  id: number,
  paiId: number | null,
  codigo: string,
  nome: string,
  natureza: string,
  previstoMensal: number,
  realizadoPorMes: Map<number, number>,
  periodos: PeriodoInfo[],
  visao: TipoVisao
): DreNode {
  var colunas: DreNode["colunas"] = {};
  var realizadoTotal = 0;
  var previstoTotal = 0;

  for (var pi = 0; pi < periodos.length; pi++) {
    var periodo = periodos[pi];
    var mesesNoPeriodo = calcularMesesNoPeriodo(periodo.chave, visao);

    var previstoP = previstoMensal * mesesNoPeriodo.length;
    var realizadoP = 0;
    for (var mi = 0; mi < mesesNoPeriodo.length; mi++) {
      realizadoP += realizadoPorMes.get(mesesNoPeriodo[mi]) ?? 0;
    }

    var dvp = realizadoP - previstoP;
    colunas[periodo.chave] = {
      previsto: previstoP,
      realizado: realizadoP,
      distorcaoValor: dvp,
      distorcaoPct: previstoP !== 0 ? (dvp / Math.abs(previstoP)) * 100 : 0,
    };

    previstoTotal += previstoP;
    realizadoTotal += realizadoP;
  }

  var distValTotal = realizadoTotal - previstoTotal;

  return {
    id: id,
    paiId: paiId,
    codigo: codigo,
    nome: nome,
    natureza: natureza,
    previsto: previstoTotal,
    realizado: realizadoTotal,
    distorcaoValor: distValTotal,
    distorcaoPct: previstoTotal !== 0 ? (distValTotal / Math.abs(previstoTotal)) * 100 : 0,
    colunas: colunas,
    filhos: [],
  };
}

export async function GET(request: NextRequest) {
  var empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  var params = request.nextUrl.searchParams;
  var anoRef = Number(params.get("anoRef") ?? new Date().getFullYear());
  var mesInicioRef = Number(params.get("mesInicioRef") ?? 1);
  var mesFimRef = Number(params.get("mesFimRef") ?? new Date().getMonth() + 1);
  var anoObjetivo = Number(params.get("anoObjetivo") ?? new Date().getFullYear());
  var visao = (params.get("visao") ?? "mensal") as TipoVisao;
  var tipo = (params.get("tipo") ?? "ESTRUTURA_DRE") as TipoObjetivo;

  // Period for media calculation (reference)
  var mesesRef = mesFimRef >= mesInicioRef ? mesFimRef - mesInicioRef + 1 : 12 - mesInicioRef + 1 + mesFimRef;
  var mmI = String(mesInicioRef).padStart(2, "0");
  var mmF = String(mesFimRef).padStart(2, "0");
  var ultimoDiaRef = new Date(anoRef, mesFimRef, 0).getDate();
  var dataInicioRef = anoRef + "-" + mmI + "-01";
  var dataFimRef = anoRef + "-" + mmF + "-" + String(ultimoDiaRef).padStart(2, "0");

  // Objective year: full year for realizado
  var dataInicioObj = anoObjetivo + "-01-01";
  var dataFimObj = anoObjetivo + "-12-31";
  var divisor = Math.max(1, mesesRef);
  var periodos = gerarPeriodos(visao, anoObjetivo);

  try {
    if (tipo === "PLANO_CONTAS") {
      return await carregarAcompPlanoContas(empresaId, dataInicioRef, dataFimRef, dataInicioObj, dataFimObj, anoObjetivo, divisor, periodos, visao);
    }

    if (tipo === "CENTRO_CUSTO") {
      return await carregarAcompCentroCusto(empresaId, dataInicioRef, dataFimRef, dataInicioObj, dataFimObj, anoObjetivo, divisor, periodos, visao);
    }

    // Default: ESTRUTURA_DRE
    return await carregarAcompEstruturaDre(empresaId, dataInicioRef, dataFimRef, dataInicioObj, dataFimObj, anoObjetivo, divisor, periodos, visao);
  } catch (error) {
    console.error("Erro ao buscar acompanhamento:", error);
    return NextResponse.json({ success: false, error: "Erro ao buscar acompanhamento" }, { status: 500 });
  }
}

/* ── ESTRUTURA_DRE ── */
var carregarAcompEstruturaDre = async function (
  empresaId: number,
  dataInicioRef: string,
  dataFimRef: string,
  dataInicioObj: string,
  dataFimObj: string,
  anoObjetivo: number,
  divisor: number,
  periodos: PeriodoInfo[],
  visao: TipoVisao
) {
  // DRE structure
  var dreResult = await db.execute({
    sql: "SELECT FIN_ESTRUTURA_DRE_ID, FIN_ESTRUTURA_DRE_PAI_ID, FIN_ESTRUTURA_DRE_CODIGO, FIN_ESTRUTURA_DRE_NOME, FIN_ESTRUTURA_DRE_NATUREZA, COALESCE(FIN_ESTRUTURA_DRE_ORDEM, 0) as ORDEM FROM FIN_ESTRUTURA_DRE WHERE EMPRESA_ID = ? ORDER BY ORDEM ASC",
    args: [empresaId],
  });

  // DRE-to-plano-conta links
  var linksResult = await db.execute({
    sql: "SELECT FIN_ESTRUTURA_DRE_ID, FIN_PLANO_CONTA_ID FROM FIN_ESTRUTURA_DRE_CONTA WHERE EMPRESA_ID = ?",
    args: [empresaId],
  });

  var contasPorDre = new Map<number, number[]>();
  for (var li = 0; li < linksResult.rows.length; li++) {
    var r = linksResult.rows[li] as any;
    var dreId = Number(r.FIN_ESTRUTURA_DRE_ID);
    if (!contasPorDre.has(dreId)) contasPorDre.set(dreId, []);
    contasPorDre.get(dreId)!.push(Number(r.FIN_PLANO_CONTA_ID));
  }

  // Lancamentos totals per plano conta in REFERENCE period (for media/previsto)
  var lancRefResult = await db.execute({
    sql: "SELECT FIN_PLANO_CONTA_ID, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total FROM FIN_LANCAMENTO WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ? GROUP BY FIN_PLANO_CONTA_ID",
    args: [empresaId, dataInicioRef, dataFimRef],
  });

  var totaisContaRef = new Map<number, number>();
  for (var ri = 0; ri < lancRefResult.rows.length; ri++) {
    var rr = lancRefResult.rows[ri] as any;
    totaisContaRef.set(Number(rr.FIN_PLANO_CONTA_ID), Number(rr.total ?? 0));
  }

  // Lancamentos per plano conta per MONTH in OBJECTIVE year (for realizado by period)
  var lancObjResult = await db.execute({
    sql: "SELECT FIN_PLANO_CONTA_ID, CAST(SUBSTR(FIN_LANCAMENTO_DATA, 6, 2) AS INTEGER) as MES, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total FROM FIN_LANCAMENTO WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ? GROUP BY FIN_PLANO_CONTA_ID, MES",
    args: [empresaId, dataInicioObj, dataFimObj],
  });

  // Map: contaId -> mes -> total
  var realizadoPorContaMes = new Map<number, Map<number, number>>();
  for (var oi = 0; oi < lancObjResult.rows.length; oi++) {
    var ro = lancObjResult.rows[oi] as any;
    var contaId = Number(ro.FIN_PLANO_CONTA_ID);
    var mes = Number(ro.MES);
    if (!realizadoPorContaMes.has(contaId)) realizadoPorContaMes.set(contaId, new Map());
    realizadoPorContaMes.get(contaId)!.set(mes, Number(ro.total ?? 0));
  }

  // Saved percentages per DRE line
  var pctResult = await db.execute({
    sql: "SELECT FIN_CONTA_ID, FIN_OBJETIVO_PERCENTUAL FROM FIN_OBJETIVO_CONTA WHERE ID_EMPRESA = ? AND FIN_OBJETIVO_TIPO = 'ESTRUTURA_DRE' AND FIN_OBJETIVO_ANO = ?",
    args: [empresaId, anoObjetivo],
  });

  var percentuais = new Map<number, number>();
  for (var pi = 0; pi < pctResult.rows.length; pi++) {
    var rp = pctResult.rows[pi] as any;
    percentuais.set(Number(rp.FIN_CONTA_ID), Number(rp.FIN_OBJETIVO_PERCENTUAL ?? 0));
  }

  var linhas: DreNode[] = [];
  var dreRows = dreResult.rows as any[];
  for (var di = 0; di < dreRows.length; di++) {
    var dr = dreRows[di];
    if (dr.FIN_ESTRUTURA_DRE_NATUREZA === "CALCULADO") continue;

    var dId = Number(dr.FIN_ESTRUTURA_DRE_ID);
    var contas = contasPorDre.get(dId) ?? [];

    // Reference media
    var totalRef = 0;
    for (var ci = 0; ci < contas.length; ci++) {
      totalRef += totaisContaRef.get(contas[ci]) ?? 0;
    }
    var media = totalRef / divisor;
    var pct = percentuais.get(dId) ?? 0;
    var previstoMensal = media * (1 + pct / 100);

    // Realizado per month (aggregate across linked contas)
    var realizadoPorMes = new Map<number, number>();
    for (var cj = 0; cj < contas.length; cj++) {
      var mesMapa = realizadoPorContaMes.get(contas[cj]);
      if (mesMapa) {
        mesMapa.forEach(function (val, mesKey) {
          realizadoPorMes.set(mesKey, (realizadoPorMes.get(mesKey) ?? 0) + val);
        });
      }
    }

    linhas.push(montarNodeComPeriodos(
      dId,
      dr.FIN_ESTRUTURA_DRE_PAI_ID ? Number(dr.FIN_ESTRUTURA_DRE_PAI_ID) : null,
      String(dr.FIN_ESTRUTURA_DRE_CODIGO ?? ""),
      String(dr.FIN_ESTRUTURA_DRE_NOME ?? ""),
      String(dr.FIN_ESTRUTURA_DRE_NATUREZA ?? ""),
      previstoMensal,
      realizadoPorMes,
      periodos,
      visao
    ));
  }

  var arvore = construirArvore(linhas).map(somarFilhos);

  return NextResponse.json({
    success: true,
    data: arvore,
    periodos: periodos,
    anoObjetivo: anoObjetivo,
  });
};

/* ── PLANO_CONTAS ── */
var carregarAcompPlanoContas = async function (
  empresaId: number,
  dataInicioRef: string,
  dataFimRef: string,
  dataInicioObj: string,
  dataFimObj: string,
  anoObjetivo: number,
  divisor: number,
  periodos: PeriodoInfo[],
  visao: TipoVisao
) {
  // Plano de Contas hierarchy
  var contasResult = await db.execute({
    sql: "SELECT FIN_PLANO_CONTA_ID, FIN_PLANO_CONTA_PAI_ID, FIN_PLANO_CONTA_CODIGO, FIN_PLANO_CONTA_NOME, FIN_PLANO_CONTA_NATUREZA FROM FIN_PLANO_CONTA WHERE ID_EMPRESA = ? AND FIN_PLANO_CONTA_ATIVO = 1 ORDER BY FIN_PLANO_CONTA_ORDEM ASC",
    args: [empresaId],
  });

  // Reference period totals
  var lancRefResult = await db.execute({
    sql: "SELECT FIN_PLANO_CONTA_ID, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total FROM FIN_LANCAMENTO WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ? GROUP BY FIN_PLANO_CONTA_ID",
    args: [empresaId, dataInicioRef, dataFimRef],
  });

  var totaisContaRef = new Map<number, number>();
  for (var i = 0; i < lancRefResult.rows.length; i++) {
    var rr = lancRefResult.rows[i] as any;
    totaisContaRef.set(Number(rr.FIN_PLANO_CONTA_ID), Number(rr.total ?? 0));
  }

  // Objective year monthly totals
  var lancObjResult = await db.execute({
    sql: "SELECT FIN_PLANO_CONTA_ID, CAST(SUBSTR(FIN_LANCAMENTO_DATA, 6, 2) AS INTEGER) as MES, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total FROM FIN_LANCAMENTO WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ? GROUP BY FIN_PLANO_CONTA_ID, MES",
    args: [empresaId, dataInicioObj, dataFimObj],
  });

  var realizadoPorContaMes = new Map<number, Map<number, number>>();
  for (var oi = 0; oi < lancObjResult.rows.length; oi++) {
    var ro = lancObjResult.rows[oi] as any;
    var contaId = Number(ro.FIN_PLANO_CONTA_ID);
    var mes = Number(ro.MES);
    if (!realizadoPorContaMes.has(contaId)) realizadoPorContaMes.set(contaId, new Map());
    realizadoPorContaMes.get(contaId)!.set(mes, Number(ro.total ?? 0));
  }

  // Saved percentages
  var pctResult = await db.execute({
    sql: "SELECT FIN_CONTA_ID, FIN_OBJETIVO_PERCENTUAL FROM FIN_OBJETIVO_CONTA WHERE ID_EMPRESA = ? AND FIN_OBJETIVO_TIPO = 'PLANO_CONTAS' AND FIN_OBJETIVO_ANO = ?",
    args: [empresaId, anoObjetivo],
  });

  var percentuais = new Map<number, number>();
  for (var pi = 0; pi < pctResult.rows.length; pi++) {
    var rp = pctResult.rows[pi] as any;
    percentuais.set(Number(rp.FIN_CONTA_ID), Number(rp.FIN_OBJETIVO_PERCENTUAL ?? 0));
  }

  var linhas: DreNode[] = [];
  var contaRows = contasResult.rows as any[];
  for (var ci = 0; ci < contaRows.length; ci++) {
    var cr = contaRows[ci];
    var cId = Number(cr.FIN_PLANO_CONTA_ID);
    var totalRef = totaisContaRef.get(cId) ?? 0;
    var media = totalRef / divisor;
    var pct = percentuais.get(cId) ?? 0;
    var previstoMensal = media * (1 + pct / 100);
    var realizadoPorMes = realizadoPorContaMes.get(cId) ?? new Map<number, number>();

    linhas.push(montarNodeComPeriodos(
      cId,
      cr.FIN_PLANO_CONTA_PAI_ID ? Number(cr.FIN_PLANO_CONTA_PAI_ID) : null,
      String(cr.FIN_PLANO_CONTA_CODIGO ?? ""),
      String(cr.FIN_PLANO_CONTA_NOME ?? ""),
      String(cr.FIN_PLANO_CONTA_NATUREZA ?? ""),
      previstoMensal,
      realizadoPorMes,
      periodos,
      visao
    ));
  }

  var arvore = construirArvore(linhas).map(somarFilhos);

  return NextResponse.json({
    success: true,
    data: arvore,
    periodos: periodos,
    anoObjetivo: anoObjetivo,
  });
};

/* ── CENTRO_CUSTO ── */
var carregarAcompCentroCusto = async function (
  empresaId: number,
  dataInicioRef: string,
  dataFimRef: string,
  dataInicioObj: string,
  dataFimObj: string,
  anoObjetivo: number,
  divisor: number,
  periodos: PeriodoInfo[],
  visao: TipoVisao
) {
  // Centro de Custo hierarchy
  var ccResult = await db.execute({
    sql: "SELECT FIN_CENTRO_CUSTO_ID, FIN_CENTRO_CUSTO_PAI_ID, FIN_CENTRO_CUSTO_CODIGO, FIN_CENTRO_CUSTO_NOME FROM FIN_CENTRO_CUSTO WHERE ID_EMPRESA = ? AND FIN_CENTRO_CUSTO_ATIVO = 1 ORDER BY FIN_CENTRO_CUSTO_ORDEM ASC",
    args: [empresaId],
  });

  // Reference period totals
  var lancRefResult = await db.execute({
    sql: "SELECT FIN_CENTRO_CUSTO_ID, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total FROM FIN_LANCAMENTO WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ? AND FIN_CENTRO_CUSTO_ID IS NOT NULL GROUP BY FIN_CENTRO_CUSTO_ID",
    args: [empresaId, dataInicioRef, dataFimRef],
  });

  var totaisCcRef = new Map<number, number>();
  for (var i = 0; i < lancRefResult.rows.length; i++) {
    var rr = lancRefResult.rows[i] as any;
    totaisCcRef.set(Number(rr.FIN_CENTRO_CUSTO_ID), Number(rr.total ?? 0));
  }

  // Objective year monthly totals
  var lancObjResult = await db.execute({
    sql: "SELECT FIN_CENTRO_CUSTO_ID, CAST(SUBSTR(FIN_LANCAMENTO_DATA, 6, 2) AS INTEGER) as MES, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total FROM FIN_LANCAMENTO WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ? AND FIN_CENTRO_CUSTO_ID IS NOT NULL GROUP BY FIN_CENTRO_CUSTO_ID, MES",
    args: [empresaId, dataInicioObj, dataFimObj],
  });

  var realizadoPorCcMes = new Map<number, Map<number, number>>();
  for (var oi = 0; oi < lancObjResult.rows.length; oi++) {
    var ro = lancObjResult.rows[oi] as any;
    var ccId = Number(ro.FIN_CENTRO_CUSTO_ID);
    var mes = Number(ro.MES);
    if (!realizadoPorCcMes.has(ccId)) realizadoPorCcMes.set(ccId, new Map());
    realizadoPorCcMes.get(ccId)!.set(mes, Number(ro.total ?? 0));
  }

  // Saved percentages
  var pctResult = await db.execute({
    sql: "SELECT FIN_CONTA_ID, FIN_OBJETIVO_PERCENTUAL FROM FIN_OBJETIVO_CONTA WHERE ID_EMPRESA = ? AND FIN_OBJETIVO_TIPO = 'CENTRO_CUSTO' AND FIN_OBJETIVO_ANO = ?",
    args: [empresaId, anoObjetivo],
  });

  var percentuais = new Map<number, number>();
  for (var pi = 0; pi < pctResult.rows.length; pi++) {
    var rp = pctResult.rows[pi] as any;
    percentuais.set(Number(rp.FIN_CONTA_ID), Number(rp.FIN_OBJETIVO_PERCENTUAL ?? 0));
  }

  var linhas: DreNode[] = [];
  var ccRows = ccResult.rows as any[];
  for (var ci = 0; ci < ccRows.length; ci++) {
    var cr = ccRows[ci];
    var cId = Number(cr.FIN_CENTRO_CUSTO_ID);
    var totalRef = totaisCcRef.get(cId) ?? 0;
    var media = totalRef / divisor;
    var pct = percentuais.get(cId) ?? 0;
    var previstoMensal = media * (1 + pct / 100);
    var realizadoPorMes = realizadoPorCcMes.get(cId) ?? new Map<number, number>();

    linhas.push(montarNodeComPeriodos(
      cId,
      cr.FIN_CENTRO_CUSTO_PAI_ID ? Number(cr.FIN_CENTRO_CUSTO_PAI_ID) : null,
      String(cr.FIN_CENTRO_CUSTO_CODIGO ?? ""),
      String(cr.FIN_CENTRO_CUSTO_NOME ?? ""),
      "DESPESA",
      previstoMensal,
      realizadoPorMes,
      periodos,
      visao
    ));
  }

  var arvore = construirArvore(linhas).map(somarFilhos);

  return NextResponse.json({
    success: true,
    data: arvore,
    periodos: periodos,
    anoObjetivo: anoObjetivo,
  });
};
