import { NextRequest, NextResponse } from "next/server";

import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";
import { db } from "@/db/client";
import { gerarIntervaloCompetencia } from "@/lib/rhPontoCalculo";

interface AjusteFechamentoPayload {
  competencia?: string;
  ajustes?: {
    idFuncionario?: string;
    HORAS_A_PAGAR_MIN?: number;
    HORAS_A_DESCONTAR_MIN?: number;
    HORAS_A_CARREGAR_MIN?: number;
    observacao?: string | null;
  }[];
}

function normalizarMinutos(valor?: number | null): number {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return 0;
  return Math.trunc(numero);
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const body = (await request.json().catch(() => null)) as AjusteFechamentoPayload | null;
  const competencia = body?.competencia ?? "";
  const intervalo = gerarIntervaloCompetencia(competencia);

  if (!intervalo) {
    return NextResponse.json(
      { success: false, error: "COMPETENCIA_INVALIDA" },
      { status: 400 }
    );
  }

  const ajustes = Array.isArray(body?.ajustes) ? body?.ajustes ?? [] : [];

  if (!ajustes.length) {
    return NextResponse.json(
      { success: false, error: "SEM_AJUSTES" },
      { status: 400 }
    );
  }

  try {
    await db.execute("BEGIN");

    for (const ajuste of ajustes) {
      const idFuncionario = ajuste?.idFuncionario;
      if (!idFuncionario) continue;

      const minutosPagar = Math.max(0, normalizarMinutos(ajuste.HORAS_A_PAGAR_MIN));
      const minutosDescontar = Math.max(0, normalizarMinutos(ajuste.HORAS_A_DESCONTAR_MIN));
      const minutosCarregar = normalizarMinutos(ajuste.HORAS_A_CARREGAR_MIN);
      const observacao = ajuste?.observacao?.toString().slice(0, 255) || null;

      const inserts: { minutos: number; tipo: string }[] = [];

      if (minutosPagar > 0) {
        inserts.push({ minutos: minutosPagar, tipo: "FECHAMENTO_PAGAR" });
      }

      if (minutosDescontar > 0) {
        inserts.push({ minutos: -Math.abs(minutosDescontar), tipo: "FECHAMENTO_DESCONTAR" });
      }

      if (minutosCarregar !== 0) {
        inserts.push({ minutos: minutosCarregar, tipo: "CARREGAR_SALDO" });
      }

      for (const insert of inserts) {
        await db.execute({
          sql: `
            INSERT INTO RH_BANCO_HORAS_AJUSTE (
              ID_EMPRESA,
              ID_FUNCIONARIO,
              COMPETENCIA,
              MINUTOS,
              TIPO_AJUSTE,
              OBSERVACAO,
              DATA_CRIACAO
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `,
          args: [
            empresaId,
            idFuncionario,
            competencia,
            insert.minutos,
            insert.tipo,
            observacao,
          ],
        });
      }
    }

    await db.execute("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    await db.execute("ROLLBACK");
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
