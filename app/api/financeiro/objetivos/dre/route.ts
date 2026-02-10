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

  // If node has children, its media/objetivo is the sum of children
  // Unless it has its own direct value (leaf nodes)
  const temFilhos = filhosAtualizados.length > 0;
  const mediaFinal = temFilhos ? node.media + mediaFilhos : node.media;
  const objetivoFinal = temFilhos ? node.objetivo + objetivoFilhos : node.objetivo;

  return { ...node, filhos: filhosAtualizados, media: mediaFinal, objetivo: objetivoFinal };
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const params = request.nextUrl.searchParams;
  const anoRef = Number(params.get("anoRef") ?? new Date().getFullYear());
  const mesInicio = Number(params.get("mesInicio") ?? 1);
  const mesFim = Number(params.get("mesFim") ?? new Date().getMonth() + 1);
  const anoObjetivo = Number(params.get("anoObjetivo") ?? new Date().getFullYear());

  const meses = mesFim >= mesInicio ? mesFim - mesInicio + 1 : 12 - mesInicio + 1 + mesFim;
  const mmI = String(mesInicio).padStart(2, "0");
  const mmF = String(mesFim).padStart(2, "0");
  const ultimoDia = new Date(anoRef, mesFim, 0).getDate();
  const dataInicio = `${anoRef}-${mmI}-01`;
  const dataFim = `${anoRef}-${mmF}-${String(ultimoDia).padStart(2, "0")}`;

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

    // Lancamentos totals per plano conta in period
    const lancResult = await db.execute({
      sql: `SELECT FIN_PLANO_CONTA_ID, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total
            FROM FIN_LANCAMENTO
            WHERE EMPRESA_ID = ? AND FIN_LANCAMENTO_DATA >= ? AND FIN_LANCAMENTO_DATA <= ?
            GROUP BY FIN_PLANO_CONTA_ID`,
      args: [empresaId, dataInicio, dataFim],
    });

    const totaisConta = new Map<number, number>();
    for (const r of lancResult.rows as any[]) {
      totaisConta.set(Number(r.FIN_PLANO_CONTA_ID), Number(r.total ?? 0));
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

    const divisor = Math.max(1, meses);

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
  } catch (error) {
    console.error("Erro ao buscar objetivos DRE:", error);
    return NextResponse.json({ success: false, error: "Erro ao buscar objetivos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const body = await request.json();
  const { ano, percentuais: pcts, tipoPeriodo, refPeriodo, valorTotal, periodoLabel } = body as {
    ano: number;
    percentuais: { dreId: number; percentual: number }[];
    tipoPeriodo?: string;
    refPeriodo?: string;
    valorTotal?: number;
    periodoLabel?: string;
  };

  if (!ano || !Array.isArray(pcts)) {
    return NextResponse.json({ success: false, error: "Dados invalidos" }, { status: 400 });
  }

  try {
    // Save percentages per DRE line
    for (let i = 0; i < pcts.length; i++) {
      const p = pcts[i];
      await db.execute({
        sql: `INSERT INTO FIN_OBJETIVO_CONTA (ID_EMPRESA, FIN_OBJETIVO_TIPO, FIN_CONTA_ID, FIN_OBJETIVO_PERCENTUAL, FIN_OBJETIVO_ANO)
              VALUES (?, 'ESTRUTURA_DRE', ?, ?, ?)
              ON CONFLICT (ID_EMPRESA, FIN_OBJETIVO_TIPO, FIN_CONTA_ID, FIN_OBJETIVO_ANO)
              DO UPDATE SET FIN_OBJETIVO_PERCENTUAL = excluded.FIN_OBJETIVO_PERCENTUAL`,
        args: [empresaId, p.dreId, p.percentual, ano],
      });
    }

    // Create/update FIN_OBJETIVO parent record for integration with Objetivos Semanais
    if (tipoPeriodo && refPeriodo) {
      const titulo = `Objetivo ${periodoLabel || refPeriodo}`;
      const periodoDb = tipoPeriodo === "mensal" ? "Mensal" : tipoPeriodo === "trimestral" ? "Trimestral" : "Anual";

      // Check if objective already exists for this period
      const existente = await db.execute({
        sql: `SELECT FIN_OBJETIVO_ID FROM FIN_OBJETIVO
              WHERE ID_EMPRESA = ? AND FIN_OBJETIVO_TIPO_PERIODO = ? AND FIN_OBJETIVO_REF_PERIODO = ?`,
        args: [empresaId, tipoPeriodo, refPeriodo],
      });

      if (existente.rows.length > 0) {
        // Update existing
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
        // Insert new
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
