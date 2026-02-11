import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const tabela = request.nextUrl.searchParams.get("tabela");
  const operacao = request.nextUrl.searchParams.get("operacao");
  const dataInicio = request.nextUrl.searchParams.get("dataInicio");
  const dataFim = request.nextUrl.searchParams.get("dataFim");
  const busca = request.nextUrl.searchParams.get("busca");
  const limite = parseInt(request.nextUrl.searchParams.get("limite") || "100");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

  try {
    let sql = `
      SELECT
        AUDIT_LOG_ID, TABELA, REGISTRO_ID, OPERACAO,
        DADOS_ANTES, DADOS_DEPOIS, DESCRICAO,
        DATA_OPERACAO, REVERTIDO, DATA_REVERSAO
      FROM AUDIT_LOG
      WHERE EMPRESA_ID = ?
    `;
    const args: any[] = [empresaId];

    if (tabela) {
      sql += ` AND TABELA = ?`;
      args.push(tabela);
    }

    if (operacao) {
      sql += ` AND OPERACAO = ?`;
      args.push(operacao);
    }

    if (dataInicio) {
      sql += ` AND DATA_OPERACAO >= ?`;
      args.push(dataInicio);
    }

    if (dataFim) {
      sql += ` AND DATA_OPERACAO <= ? || ' 23:59:59'`;
      args.push(dataFim);
    }

    if (busca) {
      sql += ` AND (DESCRICAO LIKE ? OR DADOS_ANTES LIKE ? OR DADOS_DEPOIS LIKE ?)`;
      const buscaLike = `%${busca}%`;
      args.push(buscaLike, buscaLike, buscaLike);
    }

    // Count total
    const countSql = sql.replace(
      /SELECT[\s\S]*?FROM/,
      "SELECT COUNT(*) as total FROM"
    );
    const countResult = await db.execute({ sql: countSql, args });
    const total = (countResult.rows[0] as any).total;

    sql += ` ORDER BY DATA_OPERACAO DESC, AUDIT_LOG_ID DESC`;
    sql += ` LIMIT ? OFFSET ?`;
    args.push(limite, offset);

    const resultado = await db.execute({ sql, args });

    const registros = resultado.rows.map((row: any) => ({
      id: row.AUDIT_LOG_ID,
      tabela: row.TABELA,
      registroId: row.REGISTRO_ID,
      operacao: row.OPERACAO,
      dadosAntes: row.DADOS_ANTES ? JSON.parse(row.DADOS_ANTES) : null,
      dadosDepois: row.DADOS_DEPOIS ? JSON.parse(row.DADOS_DEPOIS) : null,
      descricao: row.DESCRICAO,
      dataOperacao: row.DATA_OPERACAO,
      revertido: row.REVERTIDO === 1,
      dataReversao: row.DATA_REVERSAO,
    }));

    return NextResponse.json({
      success: true,
      data: registros,
      total,
      limite,
      offset,
    });
  } catch (error) {
    console.error("Erro ao consultar audit log:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao consultar log de auditoria" },
      { status: 500 }
    );
  }
}
