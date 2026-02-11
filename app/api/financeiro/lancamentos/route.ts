import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { registrarAuditLog } from "@/app/api/_utils/auditLog";
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
  FIN_LANCAMENTO_PESSOA_ID: number | null;
  FIN_LANCAMENTO_PLACA: string | null;
  CONTA_CODIGO: string;
  CONTA_NOME: string;
  CENTRO_CUSTO_CODIGO: string | null;
  CENTRO_CUSTO_NOME: string | null;
  PESSOA_NOME: string | null;
}

interface Lancamento {
  id: string;
  data: string;
  historico: string;
  conta: string;
  contaId: number;
  centroCusto: string;
  centroCustoId: number | null;
  pessoaId: number | null;
  pessoaNome: string;
  placa: string;
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
    contaId: reg.FIN_PLANO_CONTA_ID,
    centroCusto: reg.CENTRO_CUSTO_CODIGO && reg.CENTRO_CUSTO_NOME
      ? `${reg.CENTRO_CUSTO_CODIGO} ${reg.CENTRO_CUSTO_NOME}`
      : "-",
    centroCustoId: reg.FIN_CENTRO_CUSTO_ID,
    pessoaId: reg.FIN_LANCAMENTO_PESSOA_ID ?? null,
    pessoaNome: reg.PESSOA_NOME ?? "",
    placa: reg.FIN_LANCAMENTO_PLACA ?? "",
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
            l.FIN_LANCAMENTO_PESSOA_ID,
            pc.FIN_PLANO_CONTA_CODIGO as CONTA_CODIGO,
            pc.FIN_PLANO_CONTA_NOME as CONTA_NOME,
            cc.FIN_CENTRO_CUSTO_CODIGO as CENTRO_CUSTO_CODIGO,
            cc.FIN_CENTRO_CUSTO_NOME as CENTRO_CUSTO_NOME,
            pes.CAD_PESSOA_NOME as PESSOA_NOME,
            l.FIN_LANCAMENTO_PLACA
          FROM FIN_LANCAMENTO l
          INNER JOIN FIN_PLANO_CONTA pc ON pc.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID
          LEFT JOIN FIN_CENTRO_CUSTO cc ON cc.FIN_CENTRO_CUSTO_ID = l.FIN_CENTRO_CUSTO_ID
          LEFT JOIN CAD_PESSOA pes ON pes.CAD_PESSOA_ID = l.FIN_LANCAMENTO_PESSOA_ID
          WHERE l.FIN_LANCAMENTO_ID = ? AND l.EMPRESA_ID = ?
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
        l.FIN_LANCAMENTO_PESSOA_ID,
        pc.FIN_PLANO_CONTA_CODIGO as CONTA_CODIGO,
        pc.FIN_PLANO_CONTA_NOME as CONTA_NOME,
        cc.FIN_CENTRO_CUSTO_CODIGO as CENTRO_CUSTO_CODIGO,
        cc.FIN_CENTRO_CUSTO_NOME as CENTRO_CUSTO_NOME,
        pes.CAD_PESSOA_NOME as PESSOA_NOME,
        l.FIN_LANCAMENTO_PLACA
      FROM FIN_LANCAMENTO l
      INNER JOIN FIN_PLANO_CONTA pc ON pc.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID
      LEFT JOIN FIN_CENTRO_CUSTO cc ON cc.FIN_CENTRO_CUSTO_ID = l.FIN_CENTRO_CUSTO_ID
      LEFT JOIN CAD_PESSOA pes ON pes.CAD_PESSOA_ID = l.FIN_LANCAMENTO_PESSOA_ID
      WHERE l.EMPRESA_ID = ?
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
  const { data, historico, contaId, centroCustoId, valor, documento, status, pessoaId, placa, lote } = body;

  // Lançamento em lote (salário/férias)
  if (Array.isArray(lote) && lote.length > 0) {
    try {
      const resultados: Lancamento[] = [];
      for (const item of lote) {
        const res = await db.execute({
          sql: `INSERT INTO FIN_LANCAMENTO (FIN_LANCAMENTO_DATA, FIN_LANCAMENTO_HISTORICO, FIN_LANCAMENTO_VALOR, FIN_PLANO_CONTA_ID, FIN_CENTRO_CUSTO_ID, FIN_LANCAMENTO_DOCUMENTO, FIN_LANCAMENTO_STATUS, FIN_LANCAMENTO_PESSOA_ID, FIN_LANCAMENTO_PLACA, EMPRESA_ID)
                VALUES (?, ?, ?, ?, ?, ?, 'confirmado', ?, ?, ?)`,
          args: [item.data, item.historico, item.valor, item.contaId, item.centroCustoId || null, item.documento || null, item.pessoaId || null, item.placa || null, empresaId],
        });
        const insertId = Number(res.lastInsertRowid);
        const reg = await db.execute({
          sql: `SELECT l.*, pc.FIN_PLANO_CONTA_CODIGO as CONTA_CODIGO, pc.FIN_PLANO_CONTA_NOME as CONTA_NOME, cc.FIN_CENTRO_CUSTO_CODIGO as CENTRO_CUSTO_CODIGO, cc.FIN_CENTRO_CUSTO_NOME as CENTRO_CUSTO_NOME, pes.CAD_PESSOA_NOME as PESSOA_NOME
                FROM FIN_LANCAMENTO l
                INNER JOIN FIN_PLANO_CONTA pc ON pc.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID
                LEFT JOIN FIN_CENTRO_CUSTO cc ON cc.FIN_CENTRO_CUSTO_ID = l.FIN_CENTRO_CUSTO_ID
                LEFT JOIN CAD_PESSOA pes ON pes.CAD_PESSOA_ID = l.FIN_LANCAMENTO_PESSOA_ID
                WHERE l.FIN_LANCAMENTO_ID = ?`,
          args: [insertId],
        });
        if (reg.rows[0]) resultados.push(converterLancamento(reg.rows[0] as unknown as LancamentoDB));
      }
      return NextResponse.json({ success: true, data: resultados, lote: true }, { status: 201 });
    } catch (error) {
      console.error("Erro ao criar lançamentos em lote:", error);
      return NextResponse.json({ success: false, error: "Erro ao criar lançamentos em lote" }, { status: 500 });
    }
  }

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
          FIN_LANCAMENTO_PESSOA_ID,
          FIN_LANCAMENTO_PLACA,
          EMPRESA_ID
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [data, historico, valor, contaId, centroCustoId || null, documento || null, status || 'confirmado', pessoaId || null, placa || null, empresaId],
    });

    const lancamentoId = resultado.lastInsertRowid;
    if (lancamentoId === undefined) {
      throw new Error("ID do lançamento não retornado após inserção.");
    }

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
          l.FIN_LANCAMENTO_PESSOA_ID,
          pc.FIN_PLANO_CONTA_CODIGO as CONTA_CODIGO,
          pc.FIN_PLANO_CONTA_NOME as CONTA_NOME,
          cc.FIN_CENTRO_CUSTO_CODIGO as CENTRO_CUSTO_CODIGO,
          cc.FIN_CENTRO_CUSTO_NOME as CENTRO_CUSTO_NOME,
          pes.CAD_PESSOA_NOME as PESSOA_NOME
        FROM FIN_LANCAMENTO l
        INNER JOIN FIN_PLANO_CONTA pc ON pc.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID
        LEFT JOIN FIN_CENTRO_CUSTO cc ON cc.FIN_CENTRO_CUSTO_ID = l.FIN_CENTRO_CUSTO_ID
        LEFT JOIN CAD_PESSOA pes ON pes.CAD_PESSOA_ID = l.FIN_LANCAMENTO_PESSOA_ID
        WHERE l.FIN_LANCAMENTO_ID = ?
      `,
      args: [lancamentoId],
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

  const body = await request.json();
  const { id, data, historico, contaId, centroCustoId, valor, documento, status, pessoaId, placa } = body;

  if (!id || !data || !historico || !contaId || valor === undefined) {
    return NextResponse.json(
      { success: false, error: "ID, data, histórico, conta e valor são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    // Capture "before" state for audit log
    const anteResult = await db.execute({
      sql: `SELECT * FROM FIN_LANCAMENTO WHERE FIN_LANCAMENTO_ID = ? AND EMPRESA_ID = ?`,
      args: [id, empresaId],
    });
    const dadosAntes = anteResult.rows.length > 0
      ? JSON.stringify({
          data: (anteResult.rows[0] as any).FIN_LANCAMENTO_DATA,
          historico: (anteResult.rows[0] as any).FIN_LANCAMENTO_HISTORICO,
          valor: (anteResult.rows[0] as any).FIN_LANCAMENTO_VALOR,
          contaId: (anteResult.rows[0] as any).FIN_PLANO_CONTA_ID,
          centroCustoId: (anteResult.rows[0] as any).FIN_CENTRO_CUSTO_ID,
          documento: (anteResult.rows[0] as any).FIN_LANCAMENTO_DOCUMENTO,
          status: (anteResult.rows[0] as any).FIN_LANCAMENTO_STATUS,
          pessoaId: (anteResult.rows[0] as any).FIN_LANCAMENTO_PESSOA_ID,
          placa: (anteResult.rows[0] as any).FIN_LANCAMENTO_PLACA,
        })
      : null;

    await db.execute({
      sql: `
        UPDATE FIN_LANCAMENTO
        SET
          FIN_LANCAMENTO_DATA = ?,
          FIN_LANCAMENTO_HISTORICO = ?,
          FIN_LANCAMENTO_VALOR = ?,
          FIN_PLANO_CONTA_ID = ?,
          FIN_CENTRO_CUSTO_ID = ?,
          FIN_LANCAMENTO_DOCUMENTO = ?,
          FIN_LANCAMENTO_STATUS = ?,
          FIN_LANCAMENTO_PESSOA_ID = ?,
          FIN_LANCAMENTO_PLACA = ?,
          FIN_LANCAMENTO_ATUALIZADO_EM = datetime('now')
        WHERE FIN_LANCAMENTO_ID = ? AND EMPRESA_ID = ?
      `,
      args: [
        data,
        historico,
        valor,
        contaId,
        centroCustoId || null,
        documento || null,
        status || "confirmado",
        pessoaId || null,
        placa || null,
        id,
        empresaId,
      ],
    });

    // Register audit log for update
    await registrarAuditLog(empresaId, {
      tabela: "FIN_LANCAMENTO",
      registroId: Number(id),
      operacao: "UPDATE",
      dadosAntes,
      dadosDepois: JSON.stringify({
        data, historico, valor, contaId,
        centroCustoId: centroCustoId || null,
        documento: documento || null,
        status: status || "confirmado",
        pessoaId: pessoaId || null,
        placa: placa || null,
      }),
      descricao: `Alteração de lançamento: ${historico}`,
    });

    const lancamentoResult = await db.execute({
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
          l.FIN_LANCAMENTO_PESSOA_ID,
          pc.FIN_PLANO_CONTA_CODIGO as CONTA_CODIGO,
          pc.FIN_PLANO_CONTA_NOME as CONTA_NOME,
          cc.FIN_CENTRO_CUSTO_CODIGO as CENTRO_CUSTO_CODIGO,
          cc.FIN_CENTRO_CUSTO_NOME as CENTRO_CUSTO_NOME,
          pes.CAD_PESSOA_NOME as PESSOA_NOME
        FROM FIN_LANCAMENTO l
        INNER JOIN FIN_PLANO_CONTA pc ON pc.FIN_PLANO_CONTA_ID = l.FIN_PLANO_CONTA_ID
        LEFT JOIN FIN_CENTRO_CUSTO cc ON cc.FIN_CENTRO_CUSTO_ID = l.FIN_CENTRO_CUSTO_ID
        LEFT JOIN CAD_PESSOA pes ON pes.CAD_PESSOA_ID = l.FIN_LANCAMENTO_PESSOA_ID
        WHERE l.FIN_LANCAMENTO_ID = ? AND l.EMPRESA_ID = ?
      `,
      args: [id, empresaId],
    });

    if (lancamentoResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Lançamento não encontrado" },
        { status: 404 }
      );
    }

    const registro = lancamentoResult.rows[0] as unknown as LancamentoDB;
    const lancamentoAtualizado = converterLancamento(registro);

    return NextResponse.json({ success: true, data: lancamentoAtualizado });
  } catch (error) {
    console.error("Erro ao atualizar lançamento:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar lançamento" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
      sql: `SELECT COUNT(*) as total FROM FIN_LANCAMENTO WHERE FIN_LANCAMENTO_ID = ? AND EMPRESA_ID = ?`,
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
        WHERE FIN_LANCAMENTO_ID = ? AND EMPRESA_ID = ?
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
    // Capture "before" state for audit log
    const anteResult = await db.execute({
      sql: `SELECT * FROM FIN_LANCAMENTO WHERE FIN_LANCAMENTO_ID = ? AND EMPRESA_ID = ?`,
      args: [id, empresaId],
    });

    if (anteResult.rows.length > 0) {
      const reg = anteResult.rows[0] as any;
      const dadosAntes = JSON.stringify({
        data: reg.FIN_LANCAMENTO_DATA,
        historico: reg.FIN_LANCAMENTO_HISTORICO,
        valor: reg.FIN_LANCAMENTO_VALOR,
        contaId: reg.FIN_PLANO_CONTA_ID,
        centroCustoId: reg.FIN_CENTRO_CUSTO_ID,
        documento: reg.FIN_LANCAMENTO_DOCUMENTO,
        status: reg.FIN_LANCAMENTO_STATUS,
        pessoaId: reg.FIN_LANCAMENTO_PESSOA_ID,
        placa: reg.FIN_LANCAMENTO_PLACA,
      });

      await db.execute({
        sql: `DELETE FROM FIN_LANCAMENTO WHERE FIN_LANCAMENTO_ID = ? AND EMPRESA_ID = ?`,
        args: [id, empresaId],
      });

      // Register audit log for deletion
      await registrarAuditLog(empresaId, {
        tabela: "FIN_LANCAMENTO",
        registroId: Number(id),
        operacao: "DELETE",
        dadosAntes,
        descricao: `Exclusão de lançamento: ${reg.FIN_LANCAMENTO_HISTORICO}`,
      });
    } else {
      await db.execute({
        sql: `DELETE FROM FIN_LANCAMENTO WHERE FIN_LANCAMENTO_ID = ? AND EMPRESA_ID = ?`,
        args: [id, empresaId],
      });
    }

    return NextResponse.json({ success: true, message: "Lançamento excluído" });
  } catch (error) {
    console.error("Erro ao excluir lançamento:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao excluir lançamento" },
      { status: 500 }
    );
  }
}
