import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface DreNode {
  id: number;
  paiId: number | null;
  codigo: string;
  nome: string;
  natureza: string;
  media: number;
  percentual: number;
  objetivo: number;
  filhos: DreNode[];
}

type TipoObjetivo = "ESTRUTURA_DRE" | "PLANO_CONTAS" | "CENTRO_CUSTO";

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
  const mediaFilhos = filhosAtualizados.reduce((acc, f) => acc + f.media, 0);
  const objetivoFilhos = filhosAtualizados.reduce((acc, f) => acc + f.objetivo, 0);

  const temFilhos = filhosAtualizados.length > 0;
  const mediaFinal = temFilhos ? node.media + mediaFilhos : node.media;
  const objetivoFinal = temFilhos ? node.objetivo + objetivoFilhos : node.objetivo;

  return { ...node, filhos: filhosAtualizados, media: mediaFinal, objetivo: objetivoFinal };
}

function calcularMesesEntrePeriodos(periodoInicio: string, periodoFim: string): number {
  const [anoI, mesI] = periodoInicio.split("-").map(Number);
  const [anoF, mesF] = periodoFim.split("-").map(Number);
  return (anoF - anoI) * 12 + (mesF - mesI) + 1;
}

function periodoParaDatas(periodoInicio: string, periodoFim: string): { dataInicio: string; dataFim: string } {
  const [anoF, mesF] = periodoFim.split("-").map(Number);
  const ultimoDia = new Date(anoF, mesF, 0).getDate();
  return {
    dataInicio: `${periodoInicio}-01`,
    dataFim: `${periodoFim}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

/* ── GET: Load hierarchy + lancamentos + saved percentages ── */
export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const params = request.nextUrl.searchParams;
  const anoObjetivo = Number(params.get("anoObjetivo") ?? new Date().getFullYear());
  const tipo = (params.get("tipo") ?? "ESTRUTURA_DRE") as TipoObjetivo;

  // New cross-year period params (YYYY-MM format)
  const periodoInicio = params.get("periodoInicio");
  const periodoFim = params.get("periodoFim");

  // Legacy params (backward compat)
  const anoRef = Number(params.get("anoRef") ?? new Date().getFullYear());
  const mesInicioLegacy = Number(params.get("mesInicio") ?? 1);
  const mesFimLegacy = Number(params.get("mesFim") ?? new Date().getMonth() + 1);

  let dataInicio: string;
  let dataFim: string;
  let meses: number;

  if (periodoInicio && periodoFim) {
    meses = calcularMesesEntrePeriodos(periodoInicio, periodoFim);
    const datas = periodoParaDatas(periodoInicio, periodoFim);
    dataInicio = datas.dataInicio;
    dataFim = datas.dataFim;
  } else {
    meses = mesFimLegacy >= mesInicioLegacy
      ? mesFimLegacy - mesInicioLegacy + 1
      : 12 - mesInicioLegacy + 1 + mesFimLegacy;
    const mmI = String(mesInicioLegacy).padStart(2, "0");
    const mmF = String(mesFimLegacy).padStart(2, "0");
    const ultimoDia = new Date(anoRef, mesFimLegacy, 0).getDate();
    dataInicio = `${anoRef}-${mmI}-01`;
    dataFim = `${anoRef}-${mmF}-${String(ultimoDia).padStart(2, "0")}`;
  }

  try {
    const divisor = Math.max(1, meses);

    if (tipo === "PLANO_CONTAS") {
      return await carregarPlanoContas(empresaId, dataInicio, dataFim, anoObjetivo, divisor);
    }

    if (tipo === "CENTRO_CUSTO") {
      return await carregarCentroCusto(empresaId, dataInicio, dataFim, anoObjetivo, divisor);
    }

    // Default: ESTRUTURA_DRE
    return await carregarEstruturaDre(empresaId, dataInicio, dataFim, anoObjetivo, divisor);
  } catch (error) {
    console.error("Erro ao buscar objetivos DRE:", error);
    return NextResponse.json({ success: false, error: "Erro ao buscar objetivos" }, { status: 500 });
  }
}

/* ── ESTRUTURA_DRE (existing behavior) ── */
const carregarEstruturaDre = async (
  empresaId: number,
  dataInicio: string,
  dataFim: string,
  anoObjetivo: number,
  divisor: number
) => {
  const dreResult = await db.execute({
    sql: `SELECT FIN_ESTRUTURA_DRE_ID, FIN_ESTRUTURA_DRE_PAI_ID, FIN_ESTRUTURA_DRE_CODIGO,
                 FIN_ESTRUTURA_DRE_NOME, FIN_ESTRUTURA_DRE_NATUREZA,
                 COALESCE(FIN_ESTRUTURA_DRE_ORDEM, 0) as ORDEM
          FROM FIN_ESTRUTURA_DRE WHERE EMPRESA_ID = ? ORDER BY ORDEM ASC`,
    args: [empresaId],
  });

  const linksResult = await db.execute({
    sql: `SELECT FIN_ESTRUTURA_DRE_ID, FIN_PLANO_CONTA_ID
          FROM FIN_ESTRUTURA_DRE_CONTA WHERE EMPRESA_ID = ?`,
    args: [empresaId],
  });

  const contasPorDre = new Map<number, number[]>();
  for (let i = 0; i < linksResult.rows.length; i++) {
    const r = linksResult.rows[i] as any;
    const dreId = Number(r.FIN_ESTRUTURA_DRE_ID);
    if (!contasPorDre.has(dreId)) contasPorDre.set(dreId, []);
    contasPorDre.get(dreId)!.push(Number(r.FIN_PLANO_CONTA_ID));
  }

  const lancResult = await db.execute({
    sql: `SELECT FIN_PLANO_CONTA_ID, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total
          FROM FIN_LANCAMENTO
          WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ?
          GROUP BY FIN_PLANO_CONTA_ID`,
    args: [empresaId, dataInicio, dataFim],
  });

  const totaisConta = new Map<number, number>();
  for (let i = 0; i < lancResult.rows.length; i++) {
    const r = lancResult.rows[i] as any;
    totaisConta.set(Number(r.FIN_PLANO_CONTA_ID), Number(r.total ?? 0));
  }

  const pctResult = await db.execute({
    sql: `SELECT FIN_CONTA_ID, FIN_OBJETIVO_PERCENTUAL
          FROM FIN_OBJETIVO_CONTA
          WHERE ID_EMPRESA = ? AND FIN_OBJETIVO_TIPO = 'ESTRUTURA_DRE' AND FIN_OBJETIVO_ANO = ?`,
    args: [empresaId, anoObjetivo],
  });

  const percentuais = new Map<number, number>();
  for (let i = 0; i < pctResult.rows.length; i++) {
    const r = pctResult.rows[i] as any;
    percentuais.set(Number(r.FIN_CONTA_ID), Number(r.FIN_OBJETIVO_PERCENTUAL ?? 0));
  }

  const linhas: DreNode[] = (dreResult.rows as any[])
    .filter((r) => r.FIN_ESTRUTURA_DRE_NATUREZA !== "CALCULADO")
    .map((r) => {
      const dreId = Number(r.FIN_ESTRUTURA_DRE_ID);
      const contas = contasPorDre.get(dreId) ?? [];
      const totalPeriodo = contas.reduce((acc, cId) => acc + (totaisConta.get(cId) ?? 0), 0);
      const media = totalPeriodo / divisor;
      const pct = percentuais.get(dreId) ?? 0;
      const objetivo = media * (1 + pct / 100);

      return {
        id: dreId,
        paiId: r.FIN_ESTRUTURA_DRE_PAI_ID ? Number(r.FIN_ESTRUTURA_DRE_PAI_ID) : null,
        codigo: String(r.FIN_ESTRUTURA_DRE_CODIGO ?? ""),
        nome: String(r.FIN_ESTRUTURA_DRE_NOME ?? ""),
        natureza: String(r.FIN_ESTRUTURA_DRE_NATUREZA ?? ""),
        media,
        percentual: pct,
        objetivo,
        filhos: [],
      };
    });

  const arvore = construirArvore(linhas).map(somarFilhos);

  return NextResponse.json({
    success: true,
    data: arvore,
    periodo: { meses: divisor, dataInicio, dataFim },
  });
};

/* ── PLANO_CONTAS ── */
const carregarPlanoContas = async (
  empresaId: number,
  dataInicio: string,
  dataFim: string,
  anoObjetivo: number,
  divisor: number
) => {
  const contasResult = await db.execute({
    sql: `SELECT FIN_PLANO_CONTA_ID, FIN_PLANO_CONTA_PAI_ID, FIN_PLANO_CONTA_CODIGO,
                 FIN_PLANO_CONTA_NOME, FIN_PLANO_CONTA_NATUREZA
          FROM FIN_PLANO_CONTA
          WHERE EMPRESA_ID = ? AND FIN_PLANO_CONTA_ATIVO = 1
          ORDER BY FIN_PLANO_CONTA_ORDEM ASC`,
    args: [empresaId],
  });

  const lancResult = await db.execute({
    sql: `SELECT FIN_PLANO_CONTA_ID, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total
          FROM FIN_LANCAMENTO
          WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ?
          GROUP BY FIN_PLANO_CONTA_ID`,
    args: [empresaId, dataInicio, dataFim],
  });

  const totaisConta = new Map<number, number>();
  for (let i = 0; i < lancResult.rows.length; i++) {
    const r = lancResult.rows[i] as any;
    totaisConta.set(Number(r.FIN_PLANO_CONTA_ID), Number(r.total ?? 0));
  }

  const pctResult = await db.execute({
    sql: `SELECT FIN_CONTA_ID, FIN_OBJETIVO_PERCENTUAL
          FROM FIN_OBJETIVO_CONTA
          WHERE ID_EMPRESA = ? AND FIN_OBJETIVO_TIPO = 'PLANO_CONTAS' AND FIN_OBJETIVO_ANO = ?`,
    args: [empresaId, anoObjetivo],
  });

  const percentuais = new Map<number, number>();
  for (let i = 0; i < pctResult.rows.length; i++) {
    const r = pctResult.rows[i] as any;
    percentuais.set(Number(r.FIN_CONTA_ID), Number(r.FIN_OBJETIVO_PERCENTUAL ?? 0));
  }

  const linhas: DreNode[] = (contasResult.rows as any[]).map((r) => {
    const contaId = Number(r.FIN_PLANO_CONTA_ID);
    const totalPeriodo = totaisConta.get(contaId) ?? 0;
    const media = totalPeriodo / divisor;
    const pct = percentuais.get(contaId) ?? 0;
    const objetivo = media * (1 + pct / 100);

    return {
      id: contaId,
      paiId: r.FIN_PLANO_CONTA_PAI_ID ? Number(r.FIN_PLANO_CONTA_PAI_ID) : null,
      codigo: String(r.FIN_PLANO_CONTA_CODIGO ?? ""),
      nome: String(r.FIN_PLANO_CONTA_NOME ?? ""),
      natureza: String(r.FIN_PLANO_CONTA_NATUREZA ?? ""),
      media,
      percentual: pct,
      objetivo,
      filhos: [],
    };
  });

  const arvore = construirArvore(linhas).map(somarFilhos);

  return NextResponse.json({
    success: true,
    data: arvore,
    periodo: { meses: divisor, dataInicio, dataFim },
  });
};

/* ── CENTRO_CUSTO ── */
const carregarCentroCusto = async (
  empresaId: number,
  dataInicio: string,
  dataFim: string,
  anoObjetivo: number,
  divisor: number
) => {
  const ccResult = await db.execute({
    sql: `SELECT FIN_CENTRO_CUSTO_ID, FIN_CENTRO_CUSTO_PAI_ID, FIN_CENTRO_CUSTO_CODIGO,
                 FIN_CENTRO_CUSTO_NOME
          FROM FIN_CENTRO_CUSTO
          WHERE EMPRESA_ID = ? AND FIN_CENTRO_CUSTO_ATIVO = 1
          ORDER BY FIN_CENTRO_CUSTO_ORDEM ASC`,
    args: [empresaId],
  });

  const lancResult = await db.execute({
    sql: `SELECT FIN_CENTRO_CUSTO_ID, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total
          FROM FIN_LANCAMENTO
          WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ?
            AND FIN_CENTRO_CUSTO_ID IS NOT NULL
          GROUP BY FIN_CENTRO_CUSTO_ID`,
    args: [empresaId, dataInicio, dataFim],
  });

  const totaisCc = new Map<number, number>();
  for (let i = 0; i < lancResult.rows.length; i++) {
    const r = lancResult.rows[i] as any;
    totaisCc.set(Number(r.FIN_CENTRO_CUSTO_ID), Number(r.total ?? 0));
  }

  const pctResult = await db.execute({
    sql: `SELECT FIN_CONTA_ID, FIN_OBJETIVO_PERCENTUAL
          FROM FIN_OBJETIVO_CONTA
          WHERE ID_EMPRESA = ? AND FIN_OBJETIVO_TIPO = 'CENTRO_CUSTO' AND FIN_OBJETIVO_ANO = ?`,
    args: [empresaId, anoObjetivo],
  });

  const percentuais = new Map<number, number>();
  for (let i = 0; i < pctResult.rows.length; i++) {
    const r = pctResult.rows[i] as any;
    percentuais.set(Number(r.FIN_CONTA_ID), Number(r.FIN_OBJETIVO_PERCENTUAL ?? 0));
  }

  const linhas: DreNode[] = (ccResult.rows as any[]).map((r) => {
    const ccId = Number(r.FIN_CENTRO_CUSTO_ID);
    const totalPeriodo = totaisCc.get(ccId) ?? 0;
    const media = totalPeriodo / divisor;
    const pct = percentuais.get(ccId) ?? 0;
    const objetivo = media * (1 + pct / 100);

    return {
      id: ccId,
      paiId: r.FIN_CENTRO_CUSTO_PAI_ID ? Number(r.FIN_CENTRO_CUSTO_PAI_ID) : null,
      codigo: String(r.FIN_CENTRO_CUSTO_CODIGO ?? ""),
      nome: String(r.FIN_CENTRO_CUSTO_NOME ?? ""),
      natureza: "DESPESA",
      media,
      percentual: pct,
      objetivo,
      filhos: [],
    };
  });

  const arvore = construirArvore(linhas).map(somarFilhos);

  return NextResponse.json({
    success: true,
    data: arvore,
    periodo: { meses: divisor, dataInicio, dataFim },
  });
};

/* ── POST: Save percentages ── */
export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const body = await request.json();
  const { ano, percentuais: pcts, tipoPeriodo, refPeriodo, valorTotal, periodoLabel, tipo } = body as {
    ano: number;
    percentuais: { dreId: number; percentual: number }[];
    tipoPeriodo?: string;
    refPeriodo?: string;
    valorTotal?: number;
    periodoLabel?: string;
    tipo?: TipoObjetivo;
  };

  if (!ano || !Array.isArray(pcts)) {
    return NextResponse.json({ success: false, error: "Dados invalidos" }, { status: 400 });
  }

  const tipoObjetivo: TipoObjetivo = tipo ?? "ESTRUTURA_DRE";

  try {
    for (let i = 0; i < pcts.length; i++) {
      const p = pcts[i];
      await db.execute({
        sql: `INSERT INTO FIN_OBJETIVO_CONTA (ID_EMPRESA, FIN_OBJETIVO_TIPO, FIN_CONTA_ID, FIN_OBJETIVO_PERCENTUAL, FIN_OBJETIVO_ANO)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT (ID_EMPRESA, FIN_OBJETIVO_TIPO, FIN_CONTA_ID, FIN_OBJETIVO_ANO)
              DO UPDATE SET FIN_OBJETIVO_PERCENTUAL = excluded.FIN_OBJETIVO_PERCENTUAL`,
        args: [empresaId, tipoObjetivo, p.dreId, p.percentual, ano],
      });
    }

    if (tipoPeriodo && refPeriodo) {
      const titulo = `Objetivo ${periodoLabel || refPeriodo}`;
      const periodoDb = tipoPeriodo === "mensal" ? "Mensal" : tipoPeriodo === "trimestral" ? "Trimestral" : "Anual";

      const existente = await db.execute({
        sql: `SELECT FIN_OBJETIVO_ID FROM FIN_OBJETIVO
              WHERE ID_EMPRESA = ? AND FIN_OBJETIVO_TIPO_PERIODO = ? AND FIN_OBJETIVO_REF_PERIODO = ?`,
        args: [empresaId, tipoPeriodo, refPeriodo],
      });

      if (existente.rows.length > 0) {
        const id = (existente.rows[0] as any).FIN_OBJETIVO_ID;
        await db.execute({
          sql: `UPDATE FIN_OBJETIVO SET
                  FIN_OBJETIVO_TITULO = ?,
                  FIN_OBJETIVO_META = ?,
                  FIN_OBJETIVO_VALOR_TOTAL = ?,
                  FIN_OBJETIVO_ATUALIZADO_EM = datetime('now')
                WHERE FIN_OBJETIVO_ID = ? AND ID_EMPRESA = ?`,
          args: [titulo, valorTotal ?? 0, valorTotal ?? 0, id, empresaId],
        });
      } else {
        await db.execute({
          sql: `INSERT INTO FIN_OBJETIVO (
                  FIN_OBJETIVO_TITULO, FIN_OBJETIVO_PERIODO, FIN_OBJETIVO_META,
                  FIN_OBJETIVO_STATUS, ID_EMPRESA,
                  FIN_OBJETIVO_TIPO_PERIODO, FIN_OBJETIVO_REF_PERIODO, FIN_OBJETIVO_VALOR_TOTAL
                ) VALUES (?, ?, ?, 'ativo', ?, ?, ?, ?)`,
          args: [titulo, periodoDb, valorTotal ?? 0, empresaId, tipoPeriodo, refPeriodo, valorTotal ?? 0],
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar objetivos DRE:", error);
    return NextResponse.json({ success: false, error: "Erro ao salvar" }, { status: 500 });
  }
}
