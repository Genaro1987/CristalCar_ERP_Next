import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

const CAMPOS = [
  "FIN_PLANO_CONTA_ID",
  "FIN_PLANO_CONTA_PAI_ID",
  "FIN_PLANO_CONTA_NATUREZA",
  "FIN_PLANO_CONTA_NOME",
  "FIN_PLANO_CONTA_CODIGO",
  "FIN_PLANO_CONTA_ATIVO",
  "FIN_PLANO_CONTA_VISIVEL_DRE",
  "FIN_PLANO_CONTA_OBRIGA_CENTRO_CUSTO",
].join(", ");

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const body = await request.json();
  const { nome, codigo, natureza, paiId, visivelDre, obrigaCentroCusto } = body;

  if (!nome || !codigo) {
    return NextResponse.json(
      { success: false, error: "Nome e código são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const verificacao = await db.execute({
      sql: `SELECT COUNT(*) as total FROM FIN_PLANO_CONTA WHERE FIN_PLANO_CONTA_CODIGO = ? AND EMPRESA_ID = ?`,
      args: [codigo, empresaId],
    });

    const total = (verificacao.rows[0] as any).total;
    if (total > 0) {
      return NextResponse.json(
        { success: false, error: `Código ${codigo} já existe` },
        { status: 400 }
      );
    }

    const resultado = await db.execute({
      sql: `
        INSERT INTO FIN_PLANO_CONTA (
          FIN_PLANO_CONTA_PAI_ID,
          FIN_PLANO_CONTA_NATUREZA,
          FIN_PLANO_CONTA_NOME,
          FIN_PLANO_CONTA_CODIGO,
          FIN_PLANO_CONTA_ATIVO,
          FIN_PLANO_CONTA_VISIVEL_DRE,
          FIN_PLANO_CONTA_OBRIGA_CENTRO_CUSTO,
          EMPRESA_ID
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `,
      args: [
        paiId || null,
        natureza || "DESPESA",
        nome,
        codigo,
        visivelDre ?? 1,
        obrigaCentroCusto ?? 0,
        empresaId,
      ],
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: String(resultado.lastInsertRowid),
          nome,
          codigo,
          natureza: natureza || "DESPESA",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar plano de conta:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar plano de conta" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  try {
    const resultado = await db.execute({
      sql: `
        SELECT ${CAMPOS}
        FROM FIN_PLANO_CONTA
        WHERE EMPRESA_ID = ?
        ORDER BY COALESCE(FIN_PLANO_CONTA_ORDEM, 0), FIN_PLANO_CONTA_CODIGO
      `,
      args: [empresaId],
    });

    return NextResponse.json({ success: true, data: resultado.rows ?? [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
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
      { success: false, error: "ID e obrigatorio" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { nome, codigo, natureza, paiId, visivelDre, obrigaCentroCusto, ativo } = body;

  try {
    const verificacao = await db.execute({
      sql: "SELECT COUNT(*) as total FROM FIN_PLANO_CONTA WHERE FIN_PLANO_CONTA_ID = ? AND EMPRESA_ID = ?",
      args: [id, empresaId],
    });

    const total = (verificacao.rows[0] as any).total;
    if (total === 0) {
      return NextResponse.json(
        { success: false, error: "Conta nao encontrada" },
        { status: 404 }
      );
    }

    await db.execute({
      sql: `
        UPDATE FIN_PLANO_CONTA
        SET
          FIN_PLANO_CONTA_NOME = COALESCE(?, FIN_PLANO_CONTA_NOME),
          FIN_PLANO_CONTA_CODIGO = COALESCE(?, FIN_PLANO_CONTA_CODIGO),
          FIN_PLANO_CONTA_NATUREZA = COALESCE(?, FIN_PLANO_CONTA_NATUREZA),
          FIN_PLANO_CONTA_PAI_ID = ?,
          FIN_PLANO_CONTA_VISIVEL_DRE = COALESCE(?, FIN_PLANO_CONTA_VISIVEL_DRE),
          FIN_PLANO_CONTA_OBRIGA_CENTRO_CUSTO = COALESCE(?, FIN_PLANO_CONTA_OBRIGA_CENTRO_CUSTO),
          FIN_PLANO_CONTA_ATIVO = COALESCE(?, FIN_PLANO_CONTA_ATIVO)
        WHERE FIN_PLANO_CONTA_ID = ? AND EMPRESA_ID = ?
      `,
      args: [
        nome ?? null,
        codigo ?? null,
        natureza ?? null,
        paiId !== undefined ? paiId : null,
        visivelDre ?? null,
        obrigaCentroCusto ?? null,
        ativo ?? null,
        id,
        empresaId,
      ],
    });

    return NextResponse.json({ success: true, message: "Conta atualizada" });
  } catch (error) {
    console.error("Erro ao atualizar plano de conta:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar plano de conta" },
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
      { success: false, error: "ID e obrigatorio" },
      { status: 400 }
    );
  }

  try {
    // Collect this account + all descendants recursively
    const descResult = await db.execute({
      sql: `
        WITH RECURSIVE descendants AS (
          SELECT FIN_PLANO_CONTA_ID FROM FIN_PLANO_CONTA WHERE FIN_PLANO_CONTA_ID = ? AND EMPRESA_ID = ?
          UNION ALL
          SELECT pc.FIN_PLANO_CONTA_ID FROM FIN_PLANO_CONTA pc
          INNER JOIN descendants d ON pc.FIN_PLANO_CONTA_PAI_ID = d.FIN_PLANO_CONTA_ID
        )
        SELECT FIN_PLANO_CONTA_ID FROM descendants
      `,
      args: [id, empresaId],
    });

    if (descResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Conta nao encontrada" },
        { status: 404 }
      );
    }

    const ids = descResult.rows.map((r: any) => r.FIN_PLANO_CONTA_ID);
    const placeholders = ids.map(() => "?").join(",");

    // Check for movements (lancamentos)
    const movResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM FIN_LANCAMENTO WHERE FIN_PLANO_CONTA_ID IN (${placeholders}) AND EMPRESA_ID = ?`,
      args: [...ids, empresaId],
    });

    const totalMov = Number((movResult.rows[0] as any).total);

    if (totalMov > 0) {
      // Has movements → inactivate all
      const stmts = ids.map((contaId: number) => ({
        sql: "UPDATE FIN_PLANO_CONTA SET FIN_PLANO_CONTA_ATIVO = 0 WHERE FIN_PLANO_CONTA_ID = ?",
        args: [contaId],
      }));
      await db.batch(stmts);

      return NextResponse.json({
        success: true,
        inativada: true,
        message: `Conta possui lancamentos. ${ids.length} conta(s) inativada(s).`,
      });
    }

    // No movements → delete linked DRE entries first, then delete accounts
    const stmts = [
      ...ids.map((contaId: number) => ({
        sql: "DELETE FROM FIN_ESTRUTURA_DRE_CONTA WHERE FIN_PLANO_CONTA_ID = ?",
        args: [contaId],
      })),
      // Delete children first (reverse order so leaves before parents)
      ...ids.reverse().map((contaId: number) => ({
        sql: "DELETE FROM FIN_PLANO_CONTA WHERE FIN_PLANO_CONTA_ID = ?",
        args: [contaId],
      })),
    ];
    await db.batch(stmts);

    return NextResponse.json({
      success: true,
      inativada: false,
      message: `${ids.length} conta(s) excluida(s) com sucesso.`,
    });
  } catch (error) {
    console.error("Erro ao excluir plano de conta:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao excluir plano de conta" },
      { status: 500 }
    );
  }
}
