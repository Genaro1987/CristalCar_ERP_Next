import { NextRequest, NextResponse } from "next/server";

import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface AjusteManualPayload {
  idFuncionario?: string;
  data?: string;
  tipo?: "AJUSTE_MANUAL";
  minutos?: number;
  observacao?: string;
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const body = (await request.json().catch(() => null)) as AjusteManualPayload | null;

  const idFuncionario = body?.idFuncionario ?? "";
  const data = body?.data ?? "";
  const minutos = Number(body?.minutos ?? 0);
  const observacao = body?.observacao?.toString().slice(0, 255) ?? null;

  if (!idFuncionario || !data || !Number.isFinite(minutos)) {
    return NextResponse.json(
      { success: false, error: "PARAMETROS_INVALIDOS" },
      { status: 400 }
    );
  }

  const competencia = data.slice(0, 7);

  try {
    const resultado = await db.execute({
      sql: `
        INSERT INTO RH_BANCO_HORAS_AJUSTE (
          ID_EMPRESA,
          ID_FUNCIONARIO,
          COMPETENCIA,
          MINUTOS,
          TIPO_AJUSTE,
          OBSERVACAO,
          DATA_CRIACAO
        ) VALUES (?, ?, ?, ?, 'AJUSTE_MANUAL', ?, COALESCE(?, datetime('now')))
      `,
      args: [empresaId, idFuncionario, competencia, minutos, observacao, data],
    });

    return NextResponse.json({
      success: true,
      data: {
        id: Number(resultado.lastInsertRowid ?? 0),
        idFuncionario,
        data,
        minutos,
        tipo: "AJUSTE_MANUAL" as const,
        observacao,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const body = (await request.json().catch(() => null)) as { idAjuste?: number } | null;
  const idAjuste = Number(body?.idAjuste);

  if (!Number.isFinite(idAjuste)) {
    return NextResponse.json(
      { success: false, error: "PARAMETROS_INVALIDOS" },
      { status: 400 }
    );
  }

  try {
    // Verificar se o ajuste pertence a empresa e é do tipo AJUSTE_MANUAL
    const verificacao = await db.execute({
      sql: `
        SELECT ID_AJUSTE 
          FROM RH_BANCO_HORAS_AJUSTE 
         WHERE ID_AJUSTE = ? 
           AND ID_EMPRESA = ? 
           AND TIPO_AJUSTE = 'AJUSTE_MANUAL'
      `,
      args: [idAjuste, empresaId],
    });

    if (!verificacao.rows?.length) {
      return NextResponse.json(
        { success: false, error: "AJUSTE_NAO_ENCONTRADO_OU_INVALIDO" },
        { status: 404 }
      );
    }

    await db.execute({
      sql: `DELETE FROM RH_BANCO_HORAS_AJUSTE WHERE ID_AJUSTE = ?`,
      args: [idAjuste],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
