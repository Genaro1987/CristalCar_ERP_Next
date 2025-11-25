import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

interface LancamentoDiaPayload {
  dataReferencia?: string;
  entradaManha?: string | null;
  saidaManha?: string | null;
  entradaTarde?: string | null;
  saidaTarde?: string | null;
  entradaExtra?: string | null;
  saidaExtra?: string | null;
  statusDia?: string | null;
  observacao?: string | null;
}

interface PontoPayload {
  empresaId?: number;
  funcionarioId?: string;
  competencia?: string;
  dias?: LancamentoDiaPayload[];
}

function obterEmpresaDaRequestOuQuery(request: NextRequest): number | null {
  const headerId = obterEmpresaIdDaRequest(request);
  const queryId = Number(request.nextUrl.searchParams.get("empresaId") ?? 0);
  const queryValido = Number.isFinite(queryId) && queryId > 0 ? queryId : null;

  if (headerId && queryValido && headerId !== queryValido) return null;

  return headerId ?? queryValido;
}

function intervaloCompetencia(competencia?: string | null):
  | { inicio: string; fim: string }
  | null {
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return null;

  const [anoStr, mesStr] = competencia.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  if (!Number.isFinite(ano) || !Number.isFinite(mes)) return null;

  const ultimoDia = new Date(ano, mes, 0).getDate();

  return {
    inicio: `${competencia}-01`,
    fim: `${competencia}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

function normalizarHorario(valor?: string | null): string | null {
  if (!valor) return null;
  const texto = valor.toString().trim();
  if (!texto) return null;

  if (!/^\d{2}:\d{2}$/.test(texto)) {
    return "INVALIDO";
  }

  return texto;
}

function devePersistirDia(payload: LancamentoDiaPayload): boolean {
  const status = (payload.statusDia ?? "NORMAL").toString().trim().toUpperCase();
  const observacao = payload.observacao?.toString().trim();
  const horarios = [
    payload.entradaManha,
    payload.saidaManha,
    payload.entradaTarde,
    payload.saidaTarde,
    payload.entradaExtra,
    payload.saidaExtra,
  ].filter(Boolean);

  if (horarios.length > 0) return true;
  if (status && status !== "NORMAL") return true;
  if (observacao) return true;

  return false;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaDaRequestOuQuery(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const funcionarioId = request.nextUrl.searchParams.get("funcionarioId");
  const competencia = request.nextUrl.searchParams.get("competencia");
  const intervalo = intervaloCompetencia(competencia);

  if (!funcionarioId || !intervalo) {
    return NextResponse.json(
      { success: false, error: "PARAMETROS_INVALIDOS" },
      { status: 400 }
    );
  }

  try {
    const resultado = await db.execute({
      sql: `
        SELECT
          DATA_REFERENCIA as dataReferencia,
          ENTRADA_MANHA as entradaManha,
          SAIDA_MANHA as saidaManha,
          ENTRADA_TARDE as entradaTarde,
          SAIDA_TARDE as saidaTarde,
          ENTRADA_EXTRA as entradaExtra,
          SAIDA_EXTRA as saidaExtra,
          STATUS_DIA as statusDia,
          OBSERVACAO as observacao
        FROM RH_PONTO_LANCAMENTO
        WHERE ID_EMPRESA = ?
          AND ID_FUNCIONARIO = ?
          AND DATA_REFERENCIA BETWEEN ? AND ?
        ORDER BY DATA_REFERENCIA
      `,
      args: [empresaId, funcionarioId, intervalo.inicio, intervalo.fim],
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
  const empresaId = obterEmpresaDaRequestOuQuery(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const body = (await request.json().catch(() => null)) as PontoPayload | null;

  const funcionarioId = body?.funcionarioId ?? request.nextUrl.searchParams.get("funcionarioId") ?? "";
  const competencia = body?.competencia ?? request.nextUrl.searchParams.get("competencia") ?? "";
  const intervalo = intervaloCompetencia(competencia);

  if (!funcionarioId || !intervalo || !Array.isArray(body?.dias)) {
    return NextResponse.json(
      { success: false, error: "PARAMETROS_INVALIDOS" },
      { status: 400 }
    );
  }

  const dias = body?.dias ?? [];

  try {
    await db.execute("BEGIN");

    await db.execute({
      sql: `
        DELETE FROM RH_PONTO_LANCAMENTO
         WHERE ID_EMPRESA = ?
           AND ID_FUNCIONARIO = ?
           AND DATA_REFERENCIA BETWEEN ? AND ?
      `,
      args: [empresaId, funcionarioId, intervalo.inicio, intervalo.fim],
    });

    for (const dia of dias) {
      if (!dia?.dataReferencia || !dia.dataReferencia.startsWith(competencia)) continue;

      const entradaManha = normalizarHorario(dia.entradaManha ?? null);
      const saidaManha = normalizarHorario(dia.saidaManha ?? null);
      const entradaTarde = normalizarHorario(dia.entradaTarde ?? null);
      const saidaTarde = normalizarHorario(dia.saidaTarde ?? null);
      const entradaExtra = normalizarHorario(dia.entradaExtra ?? null);
      const saidaExtra = normalizarHorario(dia.saidaExtra ?? null);
      const statusDia = (dia.statusDia ?? "NORMAL").toString().trim().toUpperCase();
      const observacao = dia.observacao?.toString().trim() || null;

      if (
        [entradaManha, saidaManha, entradaTarde, saidaTarde, entradaExtra, saidaExtra].includes(
          "INVALIDO"
        )
      ) {
        await db.execute("ROLLBACK");
        return NextResponse.json(
          { success: false, error: "HORARIO_INVALIDO" },
          { status: 400 }
        );
      }

      if (
        !devePersistirDia({
          ...dia,
          statusDia,
          observacao: observacao ?? undefined,
          entradaManha: entradaManha === "INVALIDO" ? undefined : entradaManha,
          saidaManha: saidaManha === "INVALIDO" ? undefined : saidaManha,
          entradaTarde: entradaTarde === "INVALIDO" ? undefined : entradaTarde,
          saidaTarde: saidaTarde === "INVALIDO" ? undefined : saidaTarde,
          entradaExtra: entradaExtra === "INVALIDO" ? undefined : entradaExtra,
          saidaExtra: saidaExtra === "INVALIDO" ? undefined : saidaExtra,
        })
      ) {
        continue;
      }

      await db.execute({
        sql: `
          INSERT INTO RH_PONTO_LANCAMENTO (
            ID_EMPRESA,
            ID_FUNCIONARIO,
            DATA_REFERENCIA,
            ENTRADA_MANHA,
            SAIDA_MANHA,
            ENTRADA_TARDE,
            SAIDA_TARDE,
            ENTRADA_EXTRA,
            SAIDA_EXTRA,
            STATUS_DIA,
            OBSERVACAO
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          empresaId,
          funcionarioId,
          dia.dataReferencia,
          entradaManha,
          saidaManha,
          entradaTarde,
          saidaTarde,
          entradaExtra,
          saidaExtra,
          statusDia || "NORMAL",
          observacao,
        ],
      });
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
