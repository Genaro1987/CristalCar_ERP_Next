import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface LancamentoDB {
  FIN_LANCAMENTO_ID: number;
  FIN_LANCAMENTO_DATA: string;
  FIN_LANCAMENTO_HISTORICO: string;
  FIN_LANCAMENTO_VALOR: number;
  FIN_LANCAMENTO_DOCUMENTO: string | null;
  FIN_LANCAMENTO_STATUS: string;
  FIN_PLANO_CONTA_ID: number;
  FIN_CENTRO_CUSTO_ID: number | null;
  CONTA_CODIGO: string;
  CONTA_NOME: string;
  CENTRO_CUSTO_CODIGO: string | null;
  CENTRO_CUSTO_NOME: string | null;
}

interface Lancamento {
  id: string;
  data: string;
  historico: string;
  conta: string;
  centroCusto: string;
  valor: number;
  tipo: "Entrada" | "Saída";
  status: "confirmado" | "pendente";
  documento?: string;
}

function converterLancamento(reg: LancamentoDB): Lancamento {
  return {
    id: String(reg.FIN_LANCAMENTO_ID),
    data: reg.FIN_LANCAMENTO_DATA,
    historico: reg.FIN_LANCAMENTO_HISTORICO,
    conta: `${reg.CONTA_CODIGO} ${reg.CONTA_NOME}`,
    centroCusto: reg.CENTRO_CUSTO_CODIGO && reg.CENTRO_CUSTO_NOME
      ? `${reg.CENTRO_CUSTO_CODIGO} ${reg.CENTRO_CUSTO_NOME}`
      : "-",
    valor: reg.FIN_LANCAMENTO_VALOR,
    tipo: reg.FIN_LANCAMENTO_VALOR >= 0 ? "Entrada" : "Saída",
    status: reg.FIN_LANCAMENTO_STATUS === "confirmado" ? "confirmado" : "pendente",
    documento: reg.FIN_LANCAMENTO_DOCUMENTO || undefined,
  };
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const id = request.nextUrl.searchParams.get("id");
  const periodo = request.nextUrl.searchParams.get("periodo"); // formato: YYYY-MM

  try {
    if (id) {
      // Buscar um lançamento específico
      const resultado = await db.execute({
        sql: `
          SELECT
            l.FIN_LANCAMENTO_ID,
            l.FIN_LANCAMENTO_DATA,
            l.FIN_LANCAMENTO_HISTORICO,
            l.FIN_LANCAMENTO_VALOR,
            l.FIN_LANCAMENTO_DOCUMENTO,
            COALESCE(l.FIN_LANCAMENTO_STATUS, 'confirmado') as FIN_LANCAMENTO_STATUS,
            l.FIN_PLANO_CONTA_ID,
            l.FIN_CENTRO_CUSTO_ID,
            pc.FIN_PLANO_CONTA_CODIGO as CONTA_CODIGO,
            pc.FIN_PLANO_CONTA_NOME as CONTA_NOME,
            cc.FIN_CENTRO_CUSTO_CODIGO as CENTRO_CUSTO_CODIGO,
            cc.FIN_CENTRO_CUSTO_NOME as CENTRO_CUSTO_NOME
          FROM FIN_LANCAMENTO l
          INNER JOIN FIN_PLANO_CONTA pc ON pc.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID
          LEFT JOIN FIN_CENTRO_CUSTO cc ON cc.FIN_CENTRO_CUSTO_ID = l.FIN_CENTRO_CUSTO_ID
          WHERE l.FIN_LANCAMENTO_ID = ? AND l.ID_EMPRESA = ?
        `,
        args: [id, empresaId],
      });

      if (resultado.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Lançamento não encontrado" },
          { status: 404 }
        );
      }

      const registro = resultado.rows[0] as unknown as LancamentoDB;
      const lancamento = converterLancamento(registro);

      return NextResponse.json({ success: true, data: lancamento });
    }

    // Buscar todos os lançamentos
    let sql = `
      SELECT
        l.FIN_LANCAMENTO_ID,
        l.FIN_LANCAMENTO_DATA,
        l.FIN_LANCAMENTO_HISTORICO,
        l.FIN_LANCAMENTO_VALOR,
        l.FIN_LANCAMENTO_DOCUMENTO,
        COALESCE(l.FIN_LANCAMENTO_STATUS, 'confirmado') as FIN_LANCAMENTO_STATUS,
        l.FIN_PLANO_CONTA_ID,
        l.FIN_CENTRO_CUSTO_ID,
        pc.FIN_PLANO_CONTA_CODIGO as CONTA_CODIGO,
        pc.FIN_PLANO_CONTA_NOME as CONTA_NOME,
        cc.FIN_CENTRO_CUSTO_CODIGO as CENTRO_CUSTO_CODIGO,
        cc.FIN_CENTRO_CUSTO_NOME as CENTRO_CUSTO_NOME
      FROM FIN_LANCAMENTO l
      INNER JOIN FIN_PLANO_CONTA pc ON pc.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID
      LEFT JOIN FIN_CENTRO_CUSTO cc ON cc.FIN_CENTRO_CUSTO_ID = l.FIN_CENTRO_CUSTO_ID
      WHERE l.ID_EMPRESA = ?
    `;

    const args: any[] = [empresaId];

    if (periodo) {
      sql += ` AND strftime('%Y-%m', l.FIN_LANCAMENTO_DATA) = ?`;
      args.push(periodo);
    }

    sql += ` ORDER BY l.FIN_LANCAMENTO_DATA DESC, l.FIN_LANCAMENTO_ID DESC`;

    const resultado = await db.execute({
      sql,
      args,
    });

    const registros = resultado.rows as unknown as LancamentoDB[];
    const lancamentos = registros.map(converterLancamento);

    return NextResponse.json({ success: true, data: lancamentos });
  } catch (error) {
    console.error("Erro ao buscar lançamentos:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar lançamentos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const body = await request.json();
  const { data, historico, contaId, centroCustoId, valor, documento, status } = body;

  if (!data || !historico || !contaId || valor === undefined) {
    return NextResponse.json(
      { success: false, error: "Data, histórico, conta e valor são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const resultado = await db.execute({
      sql: `
        INSERT INTO FIN_LANCAMENTO (
          FIN_LANCAMENTO_DATA,
          FIN_LANCAMENTO_HISTORICO,
          FIN_LANCAMENTO_VALOR,
          FIN_PLANO_CONTA_ID,
          FIN_CENTRO_CUSTO_ID,
          FIN_LANCAMENTO_DOCUMENTO,
          FIN_LANCAMENTO_STATUS,
          ID_EMPRESA
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [data, historico, valor, contaId, centroCustoId || null, documento || null, status || 'confirmado', empresaId],
    });

    // Buscar o lançamento criado com joins
    const lancamentoResult = await db.execute({
      sql: `
        SELECT
          l.FIN_LANCAMENTO_ID,
          l.FIN_LANCAMENTO_DATA,
          l.FIN_LANCAMENTO_HISTORICO,
          l.FIN_LANCAMENTO_VALOR,
          l.FIN_LANCAMENTO_DOCUMENTO,
          l.FIN_LANCAMENTO_STATUS,
          l.FIN_PLANO_CONTA_ID,
          l.FIN_CENTRO_CUSTO_ID,
          pc.FIN_PLANO_CONTA_CODIGO as CONTA_CODIGO,
          pc.FIN_PLANO_CONTA_NOME as CONTA_NOME,
          cc.FIN_CENTRO_CUSTO_CODIGO as CENTRO_CUSTO_CODIGO,
          cc.FIN_CENTRO_CUSTO_NOME as CENTRO_CUSTO_NOME
        FROM FIN_LANCAMENTO l
        INNER JOIN FIN_PLANO_CONTA pc ON pc.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID
        LEFT JOIN FIN_CENTRO_CUSTO cc ON cc.FIN_CENTRO_CUSTO_ID = l.FIN_CENTRO_CUSTO_ID
        WHERE l.FIN_LANCAMENTO_ID = ?
      `,
      args: [resultado.lastInsertRowid],
    });

    const registro = lancamentoResult.rows[0] as unknown as LancamentoDB;
    const novoLancamento = converterLancamento(registro);

    return NextResponse.json(
      { success: true, data: novoLancamento },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar lançamento:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar lançamento" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, error: "ID é obrigatório" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { data, historico, contaId, centroCustoId, valor, documento, status } = body;

  try {
    // Verificar se o lançamento existe
    const verificacao = await db.execute({
      sql: `SELECT COUNT(*) as total FROM FIN_LANCAMENTO WHERE FIN_LANCAMENTO_ID = ? AND ID_EMPRESA = ?`,
      args: [id, empresaId],
    });

    const total = (verificacao.rows[0] as any).total;
    if (total === 0) {
      return NextResponse.json(
        { success: false, error: "Lançamento não encontrado" },
        { status: 404 }
      );
    }

    await db.execute({
      sql: `
        UPDATE FIN_LANCAMENTO
        SET
          FIN_LANCAMENTO_DATA = COALESCE(?, FIN_LANCAMENTO_DATA),
          FIN_LANCAMENTO_HISTORICO = COALESCE(?, FIN_LANCAMENTO_HISTORICO),
          FIN_LANCAMENTO_VALOR = COALESCE(?, FIN_LANCAMENTO_VALOR),
          FIN_PLANO_CONTA_ID = COALESCE(?, FIN_PLANO_CONTA_ID),
          FIN_CENTRO_CUSTO_ID = COALESCE(?, FIN_CENTRO_CUSTO_ID),
          FIN_LANCAMENTO_DOCUMENTO = COALESCE(?, FIN_LANCAMENTO_DOCUMENTO),
          FIN_LANCAMENTO_STATUS = COALESCE(?, FIN_LANCAMENTO_STATUS)
        WHERE FIN_LANCAMENTO_ID = ? AND ID_EMPRESA = ?
      `,
      args: [data, historico, valor, contaId, centroCustoId, documento, status, id, empresaId],
    });

    return NextResponse.json({ success: true, message: "Lançamento atualizado" });
  } catch (error) {
    console.error("Erro ao atualizar lançamento:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar lançamento" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, error: "ID é obrigatório" },
      { status: 400 }
    );
  }

  try {
    await db.execute({
      sql: `DELETE FROM FIN_LANCAMENTO WHERE FIN_LANCAMENTO_ID = ? AND ID_EMPRESA = ?`,
      args: [id, empresaId],
    });

    return NextResponse.json({ success: true, message: "Lançamento excluído" });
  } catch (error) {
    console.error("Erro ao excluir lançamento:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao excluir lançamento" },
      { status: 500 }
    );
  }
}
