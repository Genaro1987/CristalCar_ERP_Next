import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return respostaEmpresaNaoSelecionada();

  const params = request.nextUrl.searchParams;
  const dataInicio = params.get("dataInicio");
  const dataFim = params.get("dataFim");
  const visao = params.get("visao") ?? "agrupado"; // agrupado, detalhado, diario
  const busca = params.get("busca") ?? "";
  const contaId = params.get("contaId");

  if (!dataInicio || !dataFim) {
    return NextResponse.json({ success: false, error: "dataInicio e dataFim obrigatorios" }, { status: 400 });
  }

  try {
    // Get all plano de contas for tree building
    const contasResult = await db.execute({
      sql: `SELECT FIN_PLANO_CONTA_ID as id, FIN_PLANO_CONTA_NOME as nome, FIN_PLANO_CONTA_CODIGO as codigo,
                   FIN_PLANO_CONTA_NATUREZA as natureza, FIN_PLANO_CONTA_PAI_ID as paiId
            FROM FIN_PLANO_CONTA WHERE EMPRESA_ID = ? ORDER BY FIN_PLANO_CONTA_CODIGO`,
      args: [empresaId],
    });

    const contaMap = new Map<number, { nome: string; codigo: string; natureza: string; paiId: number | null }>();
    for (const r of contasResult.rows as any[]) {
      contaMap.set(Number(r.id), { nome: String(r.nome), codigo: String(r.codigo), natureza: String(r.natureza), paiId: r.paiId ? Number(r.paiId) : null });
    }

    const getRootParent = (contaId: number): { id: number; nome: string; codigo: string } | null => {
      const current = contaMap.get(contaId);
      if (!current || !current.paiId) return null;
      let parentId = current.paiId;
      let parent = contaMap.get(parentId);
      while (parent && parent.paiId) {
        parentId = parent.paiId;
        parent = contaMap.get(parentId);
      }
      return parent ? { id: parentId, nome: parent.nome, codigo: parent.codigo } : null;
    };

    if (visao === "diario") {
      // Daily summary: by date
      let sql = `
        SELECT
          l.FIN_LANCAMENTO_DATA as data,
          COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR >= 0 THEN l.FIN_LANCAMENTO_VALOR ELSE 0 END), 0) as receitas,
          COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR < 0 THEN ABS(l.FIN_LANCAMENTO_VALOR) ELSE 0 END), 0) as despesas,
          COALESCE(SUM(l.FIN_LANCAMENTO_VALOR), 0) as saldo,
          COUNT(*) as qtd
        FROM FIN_LANCAMENTO l
        WHERE l.EMPRESA_ID = ? AND l.FIN_LANCAMENTO_DATA >= ? AND l.FIN_LANCAMENTO_DATA <= ?
      `;
      const args: any[] = [empresaId, dataInicio, dataFim];

      if (busca.trim().length >= 3) {
        sql += ` AND l.FIN_LANCAMENTO_DESCRICAO LIKE ?`;
        args.push(`%${busca.trim()}%`);
      }

      sql += ` GROUP BY l.FIN_LANCAMENTO_DATA ORDER BY l.FIN_LANCAMENTO_DATA DESC`;

      const result = await db.execute({ sql, args });

      const dias = (result.rows as any[]).map((r) => ({
        data: String(r.data),
        receitas: Number(r.receitas),
        despesas: Number(r.despesas),
        saldo: Number(r.saldo),
        qtd: Number(r.qtd),
      }));

      const totalReceitas = dias.reduce((a, d) => a + d.receitas, 0);
      const totalDespesas = dias.reduce((a, d) => a + d.despesas, 0);

      return NextResponse.json({ success: true, data: { dias, totalReceitas, totalDespesas, saldoTotal: totalReceitas - totalDespesas } });
    }

    if (visao === "detalhado") {
      // Detailed: individual lancamentos
      let sql = `
        SELECT
          l.FIN_LANCAMENTO_ID as id,
          l.FIN_LANCAMENTO_DATA as data,
          l.FIN_LANCAMENTO_DESCRICAO as descricao,
          l.FIN_LANCAMENTO_VALOR as valor,
          l.FIN_LANCAMENTO_PLACA as placa,
          p.FIN_PLANO_CONTA_ID as contaId,
          p.FIN_PLANO_CONTA_NOME as contaNome,
          p.FIN_PLANO_CONTA_CODIGO as contaCodigo,
          COALESCE(pes.CAD_PESSOA_NOME, '') as pessoaNome
        FROM FIN_LANCAMENTO l
        JOIN FIN_PLANO_CONTA p ON p.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID AND p.EMPRESA_ID = l.EMPRESA_ID
        LEFT JOIN CAD_PESSOA pes ON pes.CAD_PESSOA_ID = l.FIN_LANCAMENTO_PESSOA_ID
        WHERE l.EMPRESA_ID = ? AND l.FIN_LANCAMENTO_DATA >= ? AND l.FIN_LANCAMENTO_DATA <= ?
      `;
      const args: any[] = [empresaId, dataInicio, dataFim];

      if (contaId) {
        sql += ` AND l.FIN_PLANO_CONTA_ID = ?`;
        args.push(Number(contaId));
      }

      const dataExata = params.get("dataExata");
      if (dataExata) {
        sql += ` AND l.FIN_LANCAMENTO_DATA = ?`;
        args.push(dataExata);
      }

      if (busca.trim().length >= 3) {
        sql += ` AND (l.FIN_LANCAMENTO_DESCRICAO LIKE ? OR l.FIN_LANCAMENTO_PLACA LIKE ? OR COALESCE(pes.CAD_PESSOA_NOME, '') LIKE ?)`;
        const bLike = `%${busca.trim()}%`;
        args.push(bLike, bLike, bLike);
      }

      sql += ` ORDER BY l.FIN_LANCAMENTO_DATA DESC, l.FIN_LANCAMENTO_ID DESC LIMIT 200`;

      const result = await db.execute({ sql, args });

      const lancamentos = (result.rows as any[]).map((r) => ({
        id: Number(r.id),
        data: String(r.data),
        descricao: String(r.descricao ?? ""),
        valor: Number(r.valor),
        placa: String(r.placa ?? ""),
        contaId: Number(r.contaId),
        contaNome: String(r.contaNome),
        contaCodigo: String(r.contaCodigo),
        pessoaNome: String(r.pessoaNome),
      }));

      const totalReceitas = lancamentos.filter((l) => l.valor >= 0).reduce((a, l) => a + l.valor, 0);
      const totalDespesas = lancamentos.filter((l) => l.valor < 0).reduce((a, l) => a + Math.abs(l.valor), 0);

      return NextResponse.json({ success: true, data: { lancamentos, totalReceitas, totalDespesas, saldoTotal: totalReceitas - totalDespesas } });
    }

    // Default: agrupado (grouped by account with tree)
    const result = await db.execute({
      sql: `
        SELECT
          p.FIN_PLANO_CONTA_ID as contaId,
          p.FIN_PLANO_CONTA_NOME as contaNome,
          p.FIN_PLANO_CONTA_CODIGO as contaCodigo,
          p.FIN_PLANO_CONTA_NATUREZA as natureza,
          p.FIN_PLANO_CONTA_PAI_ID as paiId,
          COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR >= 0 THEN l.FIN_LANCAMENTO_VALOR ELSE 0 END), 0) as receitas,
          COALESCE(SUM(CASE WHEN l.FIN_LANCAMENTO_VALOR < 0 THEN ABS(l.FIN_LANCAMENTO_VALOR) ELSE 0 END), 0) as despesas,
          COALESCE(SUM(l.FIN_LANCAMENTO_VALOR), 0) as saldo,
          COUNT(*) as qtd
        FROM FIN_LANCAMENTO l
        JOIN FIN_PLANO_CONTA p ON p.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID AND p.EMPRESA_ID = l.EMPRESA_ID
        WHERE l.EMPRESA_ID = ? AND l.FIN_LANCAMENTO_DATA >= ? AND l.FIN_LANCAMENTO_DATA <= ?
        GROUP BY p.FIN_PLANO_CONTA_ID, p.FIN_PLANO_CONTA_NOME, p.FIN_PLANO_CONTA_CODIGO, p.FIN_PLANO_CONTA_NATUREZA, p.FIN_PLANO_CONTA_PAI_ID
        ORDER BY p.FIN_PLANO_CONTA_CODIGO
      `,
      args: [empresaId, dataInicio, dataFim],
    });

    const contas = (result.rows as any[]).map((r) => {
      const rootParent = getRootParent(Number(r.contaId));
      return {
        contaId: Number(r.contaId),
        contaNome: String(r.contaNome),
        contaCodigo: String(r.contaCodigo),
        natureza: String(r.natureza),
        grupoPaiNome: rootParent?.nome ?? null,
        grupoPaiCodigo: rootParent?.codigo ?? null,
        receitas: Number(r.receitas),
        despesas: Number(r.despesas),
        saldo: Number(r.saldo),
        qtd: Number(r.qtd),
      };
    });

    const totalReceitas = contas.reduce((a, c) => a + c.receitas, 0);
    const totalDespesas = contas.reduce((a, c) => a + c.despesas, 0);

    return NextResponse.json({ success: true, data: { contas, totalReceitas, totalDespesas, saldoTotal: totalReceitas - totalDespesas } });
  } catch (error) {
    console.error("Erro relatorio caixa:", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}
