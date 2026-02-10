import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { obterEmpresaIdDaRequest } from "@/app/api/_utils/empresa";

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return NextResponse.json({ success: false, error: "Empresa nao informada" }, { status: 400 });

  const tipo = request.nextUrl.searchParams.get("tipo"); // CLIENTE, FORNECEDOR or null (all)

  let sql = `SELECT * FROM CAD_PESSOA WHERE EMPRESA_ID = ?`;
  const args: any[] = [empresaId];

  if (tipo === "CLIENTE") {
    sql += ` AND CAD_PESSOA_TIPO IN ('CLIENTE', 'AMBOS')`;
  } else if (tipo === "FORNECEDOR") {
    sql += ` AND CAD_PESSOA_TIPO IN ('FORNECEDOR', 'AMBOS')`;
  }

  sql += ` ORDER BY CAD_PESSOA_NOME`;

  try {
    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Erro ao listar pessoas:", error);
    return NextResponse.json({ success: false, error: "Erro ao listar" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return NextResponse.json({ success: false, error: "Empresa nao informada" }, { status: 400 });

  const body = await request.json();
  const { nome, documento, tipo, endereco, cidade, uf, cep, telefone, email, observacao } = body;

  if (!nome?.trim()) {
    return NextResponse.json({ success: false, error: "Nome e obrigatorio" }, { status: 400 });
  }

  try {
    const result = await db.execute({
      sql: `INSERT INTO CAD_PESSOA (EMPRESA_ID, CAD_PESSOA_NOME, CAD_PESSOA_DOCUMENTO, CAD_PESSOA_TIPO, CAD_PESSOA_ENDERECO, CAD_PESSOA_CIDADE, CAD_PESSOA_UF, CAD_PESSOA_CEP, CAD_PESSOA_TELEFONE, CAD_PESSOA_EMAIL, CAD_PESSOA_OBSERVACAO)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [empresaId, nome.trim(), documento || null, tipo || "AMBOS", endereco || null, cidade || null, uf || null, cep || null, telefone || null, email || null, observacao || null],
    });

    return NextResponse.json({ success: true, id: Number(result.lastInsertRowid), message: "Cadastro criado com sucesso" }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar pessoa:", error);
    return NextResponse.json({ success: false, error: "Erro ao criar cadastro" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return NextResponse.json({ success: false, error: "Empresa nao informada" }, { status: 400 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "ID nao informado" }, { status: 400 });

  const body = await request.json();
  const { nome, documento, tipo, endereco, cidade, uf, cep, telefone, email, observacao, ativo } = body;

  if (!nome?.trim()) {
    return NextResponse.json({ success: false, error: "Nome e obrigatorio" }, { status: 400 });
  }

  try {
    await db.execute({
      sql: `UPDATE CAD_PESSOA SET
              CAD_PESSOA_NOME = ?, CAD_PESSOA_DOCUMENTO = ?, CAD_PESSOA_TIPO = ?,
              CAD_PESSOA_ENDERECO = ?, CAD_PESSOA_CIDADE = ?, CAD_PESSOA_UF = ?, CAD_PESSOA_CEP = ?,
              CAD_PESSOA_TELEFONE = ?, CAD_PESSOA_EMAIL = ?, CAD_PESSOA_OBSERVACAO = ?,
              CAD_PESSOA_ATIVO = ?, CAD_PESSOA_ATUALIZADO_EM = datetime('now')
            WHERE CAD_PESSOA_ID = ? AND EMPRESA_ID = ?`,
      args: [nome.trim(), documento || null, tipo || "AMBOS", endereco || null, cidade || null, uf || null, cep || null, telefone || null, email || null, observacao || null, ativo ?? 1, Number(id), empresaId],
    });
    return NextResponse.json({ success: true, message: "Cadastro atualizado" });
  } catch (error) {
    console.error("Erro ao atualizar pessoa:", error);
    return NextResponse.json({ success: false, error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) return NextResponse.json({ success: false, error: "Empresa nao informada" }, { status: 400 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "ID nao informado" }, { status: 400 });

  try {
    // Check if used in lancamentos
    const usado = await db.execute({
      sql: `SELECT 1 FROM FIN_LANCAMENTO WHERE FIN_LANCAMENTO_PESSOA_ID = ? AND EMPRESA_ID = ? LIMIT 1`,
      args: [Number(id), empresaId],
    });

    if (usado.rows.length > 0) {
      // Inactivate instead of delete
      await db.execute({
        sql: `UPDATE CAD_PESSOA SET CAD_PESSOA_ATIVO = 0, CAD_PESSOA_ATUALIZADO_EM = datetime('now') WHERE CAD_PESSOA_ID = ? AND EMPRESA_ID = ?`,
        args: [Number(id), empresaId],
      });
      return NextResponse.json({ success: true, inativada: true, message: "Cadastro inativado (possui lancamentos vinculados)" });
    }

    await db.execute({
      sql: `DELETE FROM CAD_PESSOA WHERE CAD_PESSOA_ID = ? AND EMPRESA_ID = ?`,
      args: [Number(id), empresaId],
    });
    return NextResponse.json({ success: true, message: "Cadastro excluido" });
  } catch (error) {
    console.error("Erro ao excluir pessoa:", error);
    return NextResponse.json({ success: false, error: "Erro ao excluir" }, { status: 500 });
  }
}
