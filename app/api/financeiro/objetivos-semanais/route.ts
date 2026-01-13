import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface ObjetivoSemanal {
  id: string;
  objetivoId: string;
  objetivo: string;
  semana: string;
  metaSemanal: number;
  responsavel: string;
  status: "pendente" | "andamento" | "concluido";
  observacao?: string;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const objetivoId = request.nextUrl.searchParams.get("objetivoId");

  try {
    let sql = `
      SELECT
        os.FIN_OBJETIVO_SEMANAL_ID,
        os.FIN_OBJETIVO_ID,
        o.FIN_OBJETIVO_TITULO,
        os.FIN_OBJETIVO_SEMANA,
        os.FIN_OBJETIVO_META_SEMANAL,
        os.FIN_OBJETIVO_RESPONSAVEL,
        os.FIN_OBJETIVO_STATUS,
        os.FIN_OBJETIVO_OBSERVACAO
      FROM FIN_OBJETIVO_SEMANAL os
      INNER JOIN FIN_OBJETIVO o ON o.FIN_OBJETIVO_ID = os.FIN_OBJETIVO_ID
      WHERE os.ID_EMPRESA = ?
    `;

    const args: any[] = [empresaId];

    if (objetivoId) {
      sql += " AND os.FIN_OBJETIVO_ID = ?";
      args.push(objetivoId);
    }

    sql += " ORDER BY os.FIN_OBJETIVO_SEMANA ASC";

    const resultado = await db.execute({
      sql,
      args,
    });

    const itens = (resultado.rows ?? []).map((row: any) => ({
      id: String(row.FIN_OBJETIVO_SEMANAL_ID),
      objetivoId: String(row.FIN_OBJETIVO_ID),
      objetivo: row.FIN_OBJETIVO_TITULO,
      semana: row.FIN_OBJETIVO_SEMANA,
      metaSemanal: Number(row.FIN_OBJETIVO_META_SEMANAL ?? 0),
      responsavel: row.FIN_OBJETIVO_RESPONSAVEL ?? "",
      status: row.FIN_OBJETIVO_STATUS ?? "pendente",
      observacao: row.FIN_OBJETIVO_OBSERVACAO || undefined,
    })) satisfies ObjetivoSemanal[];

    return NextResponse.json({ success: true, data: itens });
  } catch (error) {
    console.error("Erro ao buscar objetivos semanais:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar objetivos semanais" },
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
  const { objetivoId, semana, metaSemanal, responsavel, status, observacao } = body;

  if (!objetivoId || !semana) {
    return NextResponse.json(
      { success: false, error: "Objetivo e semana são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const resultado = await db.execute({
      sql: `
        INSERT INTO FIN_OBJETIVO_SEMANAL (
          FIN_OBJETIVO_ID,
          FIN_OBJETIVO_SEMANA,
          FIN_OBJETIVO_META_SEMANAL,
          FIN_OBJETIVO_RESPONSAVEL,
          FIN_OBJETIVO_STATUS,
          FIN_OBJETIVO_OBSERVACAO,
          ID_EMPRESA
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        objetivoId,
        semana,
        metaSemanal ?? 0,
        responsavel ?? "",
        status ?? "pendente",
        observacao ?? null,
        empresaId,
      ],
    });

    const objetivoResult = await db.execute({
      sql: `
        SELECT FIN_OBJETIVO_TITULO
        FROM FIN_OBJETIVO
        WHERE FIN_OBJETIVO_ID = ? AND ID_EMPRESA = ?
      `,
      args: [objetivoId, empresaId],
    });

    const objetivoTitulo = (objetivoResult.rows[0] as any)?.FIN_OBJETIVO_TITULO ?? "";

    const item: ObjetivoSemanal = {
      id: String(resultado.lastInsertRowid),
      objetivoId: String(objetivoId),
      objetivo: objetivoTitulo,
      semana,
      metaSemanal: Number(metaSemanal ?? 0),
      responsavel: responsavel ?? "",
      status: status ?? "pendente",
      observacao: observacao || undefined,
    };

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar objetivo semanal:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar objetivo semanal" },
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
  const { id, objetivoId, semana, metaSemanal, responsavel, status, observacao } = body;

  if (!id || !objetivoId || !semana) {
    return NextResponse.json(
      { success: false, error: "ID, objetivo e semana são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    await db.execute({
      sql: `
        UPDATE FIN_OBJETIVO_SEMANAL
        SET
          FIN_OBJETIVO_ID = ?,
          FIN_OBJETIVO_SEMANA = ?,
          FIN_OBJETIVO_META_SEMANAL = ?,
          FIN_OBJETIVO_RESPONSAVEL = ?,
          FIN_OBJETIVO_STATUS = ?,
          FIN_OBJETIVO_OBSERVACAO = ?,
          FIN_OBJETIVO_SEMANAL_ATUALIZADO_EM = datetime('now')
        WHERE FIN_OBJETIVO_SEMANAL_ID = ? AND ID_EMPRESA = ?
      `,
      args: [
        objetivoId,
        semana,
        metaSemanal ?? 0,
        responsavel ?? "",
        status ?? "pendente",
        observacao ?? null,
        id,
        empresaId,
      ],
    });

    const objetivoResult = await db.execute({
      sql: `
        SELECT FIN_OBJETIVO_TITULO
        FROM FIN_OBJETIVO
        WHERE FIN_OBJETIVO_ID = ? AND ID_EMPRESA = ?
      `,
      args: [objetivoId, empresaId],
    });

    const objetivoTitulo = (objetivoResult.rows[0] as any)?.FIN_OBJETIVO_TITULO ?? "";

    const item: ObjetivoSemanal = {
      id: String(id),
      objetivoId: String(objetivoId),
      objetivo: objetivoTitulo,
      semana,
      metaSemanal: Number(metaSemanal ?? 0),
      responsavel: responsavel ?? "",
      status: status ?? "pendente",
      observacao: observacao || undefined,
    };

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("Erro ao atualizar objetivo semanal:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar objetivo semanal" },
      { status: 500 }
    );
  }
}
