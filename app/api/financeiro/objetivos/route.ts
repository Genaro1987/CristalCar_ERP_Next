import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface ObjetivoFinanceiro {
  id: string;
  titulo: string;
  periodo: "Mensal" | "Trimestral" | "Anual";
  meta: number;
  responsavel: string;
  status: "ativo" | "inativo";
  observacao?: string;
  tipoPeriodo: string | null;
  refPeriodo: string | null;
  valorTotal: number;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  try {
    const resultado = await db.execute({
      sql: `
        SELECT
          FIN_OBJETIVO_ID,
          FIN_OBJETIVO_TITULO,
          FIN_OBJETIVO_PERIODO,
          FIN_OBJETIVO_META,
          FIN_OBJETIVO_RESPONSAVEL,
          FIN_OBJETIVO_STATUS,
          FIN_OBJETIVO_OBSERVACAO,
          FIN_OBJETIVO_TIPO_PERIODO,
          FIN_OBJETIVO_REF_PERIODO,
          FIN_OBJETIVO_VALOR_TOTAL
        FROM FIN_OBJETIVO
        WHERE ID_EMPRESA = ?
        ORDER BY FIN_OBJETIVO_CRIADO_EM DESC
      `,
      args: [empresaId],
    });

    const objetivos = (resultado.rows ?? []).map((row: any) => ({
      id: String(row.FIN_OBJETIVO_ID),
      titulo: row.FIN_OBJETIVO_TITULO,
      periodo: row.FIN_OBJETIVO_PERIODO,
      meta: Number(row.FIN_OBJETIVO_META ?? 0),
      responsavel: row.FIN_OBJETIVO_RESPONSAVEL ?? "",
      status: row.FIN_OBJETIVO_STATUS === "inativo" ? "inativo" : "ativo",
      observacao: row.FIN_OBJETIVO_OBSERVACAO || undefined,
      tipoPeriodo: row.FIN_OBJETIVO_TIPO_PERIODO || null,
      refPeriodo: row.FIN_OBJETIVO_REF_PERIODO || null,
      valorTotal: Number(row.FIN_OBJETIVO_VALOR_TOTAL ?? 0),
    }));

    return NextResponse.json({ success: true, data: objetivos });
  } catch (error) {
    console.error("Erro ao buscar objetivos financeiros:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar objetivos financeiros" },
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
  const { titulo, periodo, meta, responsavel, status, observacao } = body;

  if (!titulo || !periodo) {
    return NextResponse.json(
      { success: false, error: "Título e período são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const resultado = await db.execute({
      sql: `
        INSERT INTO FIN_OBJETIVO (
          FIN_OBJETIVO_TITULO,
          FIN_OBJETIVO_PERIODO,
          FIN_OBJETIVO_META,
          FIN_OBJETIVO_RESPONSAVEL,
          FIN_OBJETIVO_STATUS,
          FIN_OBJETIVO_OBSERVACAO,
          ID_EMPRESA
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        titulo,
        periodo,
        meta ?? 0,
        responsavel ?? "",
        status ?? "ativo",
        observacao ?? null,
        empresaId,
      ],
    });

    const objetivo: ObjetivoFinanceiro = {
      id: String(resultado.lastInsertRowid),
      titulo,
      periodo,
      meta: Number(meta ?? 0),
      responsavel: responsavel ?? "",
      status: status === "inativo" ? "inativo" : "ativo",
      observacao: observacao || undefined,
    };

    return NextResponse.json({ success: true, data: objetivo }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar objetivo financeiro:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar objetivo financeiro" },
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
  const { id, titulo, periodo, meta, responsavel, status, observacao } = body;

  if (!id || !titulo || !periodo) {
    return NextResponse.json(
      { success: false, error: "ID, título e período são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    await db.execute({
      sql: `
        UPDATE FIN_OBJETIVO
        SET
          FIN_OBJETIVO_TITULO = ?,
          FIN_OBJETIVO_PERIODO = ?,
          FIN_OBJETIVO_META = ?,
          FIN_OBJETIVO_RESPONSAVEL = ?,
          FIN_OBJETIVO_STATUS = ?,
          FIN_OBJETIVO_OBSERVACAO = ?,
          FIN_OBJETIVO_ATUALIZADO_EM = datetime('now')
        WHERE FIN_OBJETIVO_ID = ? AND ID_EMPRESA = ?
      `,
      args: [
        titulo,
        periodo,
        meta ?? 0,
        responsavel ?? "",
        status ?? "ativo",
        observacao ?? null,
        id,
        empresaId,
      ],
    });

    const objetivo: ObjetivoFinanceiro = {
      id: String(id),
      titulo,
      periodo,
      meta: Number(meta ?? 0),
      responsavel: responsavel ?? "",
      status: status === "inativo" ? "inativo" : "ativo",
      observacao: observacao || undefined,
    };

    return NextResponse.json({ success: true, data: objetivo });
  } catch (error) {
    console.error("Erro ao atualizar objetivo financeiro:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar objetivo financeiro" },
      { status: 500 }
    );
  }
}
