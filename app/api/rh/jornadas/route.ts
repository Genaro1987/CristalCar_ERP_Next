import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

type JornadaPayload = {
  NOME_JORNADA?: string;
  DESCRICAO?: string | null;
  CARGA_SEMANAL_HORAS?: number;
  HORA_ENTRADA_MANHA?: string | null;
  HORA_SAIDA_MANHA?: string | null;
  HORA_ENTRADA_TARDE?: string | null;
  HORA_SAIDA_TARDE?: string | null;
  HORA_ENTRADA_INTERVALO?: string | null;
  HORA_SAIDA_INTERVALO?: string | null;
  ATIVO?: number;
};

const CAMPOS_JORNADA = [
  "ID_JORNADA",
  "ID_EMPRESA",
  "NOME_JORNADA",
  "DESCRICAO",
  "CARGA_SEMANAL_HORAS",
  "HORA_ENTRADA_MANHA",
  "HORA_SAIDA_MANHA",
  "HORA_ENTRADA_TARDE",
  "HORA_SAIDA_TARDE",
  "HORA_ENTRADA_INTERVALO",
  "HORA_SAIDA_INTERVALO",
  "ATIVO",
  "CRIADO_EM",
  "ATUALIZADO_EM",
].join(", ");

function removerAcentosPreservandoEspaco(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizarTextoBasico(valor: string): string {
  const semAcento = removerAcentosPreservandoEspaco(valor ?? "");

  return semAcento.toUpperCase().replace(/[^A-Z0-9 ]/g, "");
}

function normalizarDescricao(valor: string): string {
  const semAcento = removerAcentosPreservandoEspaco(valor ?? "");

  return semAcento.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 100);
}

function interpretarAtivo(valor: unknown): 0 | 1 {
  if (valor === 0 || valor === "0" || valor === false) {
    return 0;
  }

  return 1;
}

function normalizarHorario(valor: unknown): string | null {
  if (!valor) return null;
  const texto = valor.toString().trim();
  return texto || null;
}

async function gerarProximoIdJornada(empresaId: number): Promise<string> {
  const resultado = await db.execute({
    sql: `
      SELECT ID_JORNADA
      FROM RH_JORNADA_TRABALHO
      WHERE ID_EMPRESA = ?
      ORDER BY ID_JORNADA DESC
      LIMIT 1
    `,
    args: [empresaId],
  });

  const ultimoId = resultado.rows?.[0]?.ID_JORNADA as string | undefined;

  if (!ultimoId) {
    return "JOR-001";
  }

  const numeroAtual = Number(ultimoId.replace(/[^0-9]/g, ""));
  const proximoNumero = Number.isFinite(numeroAtual) ? numeroAtual + 1 : 1;
  return `JOR-${String(proximoNumero).padStart(3, "0")}`;
}

async function buscarJornada(
  empresaId: number,
  idJornada: string
): Promise<Record<string, unknown> | null> {
  const resultado = await db.execute({
    sql: `
      SELECT ${CAMPOS_JORNADA}
      FROM RH_JORNADA_TRABALHO
      WHERE ID_EMPRESA = ? AND ID_JORNADA = ?
    `,
    args: [empresaId, idJornada],
  });

  return resultado.rows?.[0] ?? null;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  try {
    const resultado = await db.execute({
      sql: `
        SELECT ${CAMPOS_JORNADA}
        FROM RH_JORNADA_TRABALHO
        WHERE ID_EMPRESA = ?
        ORDER BY ID_JORNADA
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

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  try {
    const body = (await request.json().catch(() => null)) as JornadaPayload | null;

    const nomeJornada = normalizarTextoBasico(body?.NOME_JORNADA?.toString() ?? "");
    const descricaoNormalizada = normalizarDescricao(
      body?.DESCRICAO?.toString() ?? ""
    );
    const descricao = descricaoNormalizada || null;
    const cargaSemanal = Number(body?.CARGA_SEMANAL_HORAS ?? 0);
    const horaEntradaManha = normalizarHorario(body?.HORA_ENTRADA_MANHA);
    const horaSaidaManha = normalizarHorario(body?.HORA_SAIDA_MANHA);
    const horaEntradaTarde = normalizarHorario(body?.HORA_ENTRADA_TARDE);
    const horaSaidaTarde = normalizarHorario(body?.HORA_SAIDA_TARDE);
    const horaEntradaIntervalo = normalizarHorario(body?.HORA_ENTRADA_INTERVALO);
    const horaSaidaIntervalo = normalizarHorario(body?.HORA_SAIDA_INTERVALO);
    const ativo = interpretarAtivo(body?.ATIVO);

    if (!nomeJornada) {
      return NextResponse.json(
        { success: false, error: "NOME_JORNADA_OBRIGATORIO" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(cargaSemanal) || cargaSemanal <= 0) {
      return NextResponse.json(
        { success: false, error: "CARGA_SEMANAL_INVALIDA" },
        { status: 400 }
      );
    }

    if (!horaEntradaManha || !horaSaidaManha) {
      return NextResponse.json(
        { success: false, error: "HORARIO_OBRIGATORIO" },
        { status: 400 }
      );
    }

    const novoId = await gerarProximoIdJornada(empresaId);

    await db.execute({
      sql: `
        INSERT INTO RH_JORNADA_TRABALHO (
          ID_JORNADA,
          ID_EMPRESA,
          NOME_JORNADA,
          DESCRICAO,
          CARGA_SEMANAL_HORAS,
      HORA_ENTRADA_MANHA,
      HORA_SAIDA_MANHA,
      HORA_ENTRADA_TARDE,
      HORA_SAIDA_TARDE,
      HORA_ENTRADA_INTERVALO,
      HORA_SAIDA_INTERVALO,
      ATIVO,
      CRIADO_EM,
      ATUALIZADO_EM
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
      args: [
        novoId,
        empresaId,
        nomeJornada,
        descricao,
        cargaSemanal,
        horaEntradaManha,
        horaSaidaManha,
        horaEntradaTarde,
        horaSaidaTarde,
        horaEntradaIntervalo,
        horaSaidaIntervalo,
        ativo,
      ],
    });

    const jornadaCriada = await buscarJornada(empresaId, novoId);

    return NextResponse.json(
      { success: true, data: jornadaCriada },
      { status: 201 }
    );
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
  const idJornada = request.nextUrl.searchParams.get("id")?.toString();

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  if (!idJornada) {
    return NextResponse.json(
      { success: false, error: "JORNADA_NAO_INFORMADA" },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as JornadaPayload | null;

    const nomeJornada = normalizarTextoBasico(body?.NOME_JORNADA?.toString() ?? "");
    const descricaoNormalizada = normalizarDescricao(
      body?.DESCRICAO?.toString() ?? ""
    );
    const descricao = descricaoNormalizada || null;
    const cargaSemanal = Number(body?.CARGA_SEMANAL_HORAS ?? 0);
    const horaEntradaManha = normalizarHorario(body?.HORA_ENTRADA_MANHA);
    const horaSaidaManha = normalizarHorario(body?.HORA_SAIDA_MANHA);
    const horaEntradaTarde = normalizarHorario(body?.HORA_ENTRADA_TARDE);
    const horaSaidaTarde = normalizarHorario(body?.HORA_SAIDA_TARDE);
    const horaEntradaIntervalo = normalizarHorario(body?.HORA_ENTRADA_INTERVALO);
    const horaSaidaIntervalo = normalizarHorario(body?.HORA_SAIDA_INTERVALO);
    const ativo = interpretarAtivo(body?.ATIVO);

    if (!nomeJornada) {
      return NextResponse.json(
        { success: false, error: "NOME_JORNADA_OBRIGATORIO" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(cargaSemanal) || cargaSemanal <= 0) {
      return NextResponse.json(
        { success: false, error: "CARGA_SEMANAL_INVALIDA" },
        { status: 400 }
      );
    }

    if (!horaEntradaManha || !horaSaidaManha) {
      return NextResponse.json(
        { success: false, error: "HORARIO_OBRIGATORIO" },
        { status: 400 }
      );
    }

    const atualizado = await db.execute({
      sql: `
        UPDATE RH_JORNADA_TRABALHO
        SET NOME_JORNADA = ?,
            DESCRICAO = ?,
            CARGA_SEMANAL_HORAS = ?,
            HORA_ENTRADA_MANHA = ?,
            HORA_SAIDA_MANHA = ?,
            HORA_ENTRADA_TARDE = ?,
            HORA_SAIDA_TARDE = ?,
            HORA_ENTRADA_INTERVALO = ?,
            HORA_SAIDA_INTERVALO = ?,
            ATIVO = ?,
            ATUALIZADO_EM = datetime('now')
        WHERE ID_JORNADA = ? AND ID_EMPRESA = ?
      `,
      args: [
        nomeJornada,
        descricao,
        cargaSemanal,
        horaEntradaManha,
        horaSaidaManha,
        horaEntradaTarde,
        horaSaidaTarde,
        horaEntradaIntervalo,
        horaSaidaIntervalo,
        ativo,
        idJornada,
        empresaId,
      ],
    });

    if ((atualizado.rowsAffected ?? 0) === 0) {
      return NextResponse.json(
        { success: false, error: "JORNADA_NAO_ENCONTRADA" },
        { status: 404 }
      );
    }

    const jornadaAtualizada = await buscarJornada(empresaId, idJornada);

    return NextResponse.json({ success: true, data: jornadaAtualizada });
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
  const idJornada = request.nextUrl.searchParams.get("id")?.toString();

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  if (!idJornada) {
    return NextResponse.json(
      { success: false, error: "JORNADA_NAO_INFORMADA" },
      { status: 400 }
    );
  }

  try {
    const resultado = await db.execute({
      sql: `
        UPDATE RH_JORNADA_TRABALHO
        SET ATIVO = 0,
            ATUALIZADO_EM = datetime('now')
        WHERE ID_JORNADA = ? AND ID_EMPRESA = ?
      `,
      args: [idJornada, empresaId],
    });

    if ((resultado.rowsAffected ?? 0) === 0) {
      return NextResponse.json(
        { success: false, error: "JORNADA_NAO_ENCONTRADA" },
        { status: 404 }
      );
    }

    const jornadaAtualizada = await buscarJornada(empresaId, idJornada);

    return NextResponse.json({ success: true, data: jornadaAtualizada });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
