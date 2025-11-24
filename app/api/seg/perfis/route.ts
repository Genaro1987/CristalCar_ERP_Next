import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

type PerfilPayload = {
  NOME_PERFIL?: string;
  DESCRICAO?: string | null;
  ATIVO?: number;
};

const CAMPOS_PERFIL = [
  "ID_PERFIL",
  "ID_EMPRESA",
  "NOME_PERFIL",
  "DESCRICAO",
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

async function gerarProximoIdPerfil(empresaId: number): Promise<string> {
  const resultado = await db.execute({
    sql: `
      SELECT ID_PERFIL
      FROM SEG_PERFIL
      WHERE ID_EMPRESA = ?
      ORDER BY ID_PERFIL DESC
      LIMIT 1
    `,
    args: [empresaId],
  });

  const ultimoId = resultado.rows?.[0]?.ID_PERFIL as string | undefined;

  if (!ultimoId) {
    return "PER-001";
  }

  const numeroAtual = Number(ultimoId.replace(/[^0-9]/g, ""));
  const proximoNumero = Number.isFinite(numeroAtual) ? numeroAtual + 1 : 1;
  return `PER-${String(proximoNumero).padStart(3, "0")}`;
}

async function buscarPerfil(
  empresaId: number,
  idPerfil: string
): Promise<Record<string, unknown> | null> {
  const resultado = await db.execute({
    sql: `
      SELECT ${CAMPOS_PERFIL}
      FROM SEG_PERFIL
      WHERE ID_EMPRESA = ? AND ID_PERFIL = ?
    `,
    args: [empresaId, idPerfil],
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
        SELECT ${CAMPOS_PERFIL}
        FROM SEG_PERFIL
        WHERE ID_EMPRESA = ?
        ORDER BY ID_PERFIL
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
    const body = (await request.json().catch(() => null)) as PerfilPayload | null;

    const nomePerfil = normalizarTextoBasico(body?.NOME_PERFIL?.toString() ?? "");
    const descricaoNormalizada = normalizarDescricao(body?.DESCRICAO?.toString() ?? "");
    const descricao = descricaoNormalizada || null;
    const ativo = interpretarAtivo(body?.ATIVO);

    if (!nomePerfil) {
      return NextResponse.json(
        { success: false, error: "NOME_PERFIL_OBRIGATORIO" },
        { status: 400 }
      );
    }

    const novoId = await gerarProximoIdPerfil(empresaId);

    await db.execute({
      sql: `
        INSERT INTO SEG_PERFIL (
          ID_PERFIL,
          ID_EMPRESA,
          NOME_PERFIL,
          DESCRICAO,
          ATIVO,
          CRIADO_EM,
          ATUALIZADO_EM
        ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
      args: [novoId, empresaId, nomePerfil, descricao, ativo],
    });

    const perfilCriado = await buscarPerfil(empresaId, novoId);

    return NextResponse.json({ success: true, data: perfilCriado }, { status: 201 });
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
  const idPerfil = request.nextUrl.searchParams.get("id")?.toString();

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  if (!idPerfil) {
    return NextResponse.json(
      { success: false, error: "PERFIL_NAO_INFORMADO" },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as PerfilPayload | null;

    const nomePerfil = normalizarTextoBasico(body?.NOME_PERFIL?.toString() ?? "");
    const descricaoNormalizada = normalizarDescricao(body?.DESCRICAO?.toString() ?? "");
    const descricao = descricaoNormalizada || null;
    const ativo = interpretarAtivo(body?.ATIVO);

    if (!nomePerfil) {
      return NextResponse.json(
        { success: false, error: "NOME_PERFIL_OBRIGATORIO" },
        { status: 400 }
      );
    }

    const atualizado = await db.execute({
      sql: `
        UPDATE SEG_PERFIL
        SET NOME_PERFIL = ?,
            DESCRICAO = ?,
            ATIVO = ?,
            ATUALIZADO_EM = datetime('now')
        WHERE ID_PERFIL = ? AND ID_EMPRESA = ?
      `,
      args: [nomePerfil, descricao, ativo, idPerfil, empresaId],
    });

    if ((atualizado.rowsAffected ?? 0) === 0) {
      return NextResponse.json(
        { success: false, error: "PERFIL_NAO_ENCONTRADO" },
        { status: 404 }
      );
    }

    const perfilAtualizado = await buscarPerfil(empresaId, idPerfil);

    return NextResponse.json({ success: true, data: perfilAtualizado });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
