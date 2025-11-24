import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";
import { interpretarAtivo, normalizarTextoBasico } from "../utils";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

const CAMPOS_DEPARTAMENTO = [
  "ID_DEPARTAMENTO",
  "ID_EMPRESA",
  "NOME_DEPARTAMENTO",
  "DESCRICAO",
  "ATIVO",
  "DATA_CADASTRO",
  "DATA_ATUALIZACAO",
].join(", ");

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const empresaId = obterEmpresaIdDaRequest(request);
  const idDepartamento = Number(context.params.id);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  if (!Number.isFinite(idDepartamento) || idDepartamento <= 0) {
    return NextResponse.json(
      { success: false, error: "ID_INVALIDO" },
      { status: 400 }
    );
  }

  try {
    const resultado = await db.execute({
      sql: `
        SELECT ${CAMPOS_DEPARTAMENTO}
        FROM EMP_DEPARTAMENTO
        WHERE ID_DEPARTAMENTO = ? AND ID_EMPRESA = ?
      `,
      args: [idDepartamento, empresaId],
    });

    const departamento = resultado.rows?.[0];

    if (!departamento) {
      return NextResponse.json(
        { success: false, error: "DEPARTAMENTO_NAO_ENCONTRADO" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: departamento });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const empresaId = obterEmpresaIdDaRequest(request);
  const idDepartamento = Number(context.params.id);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  if (!Number.isFinite(idDepartamento) || idDepartamento <= 0) {
    return NextResponse.json(
      { success: false, error: "ID_INVALIDO" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const nomeDepartamento = normalizarTextoBasico(
      body?.NOME_DEPARTAMENTO?.toString() ?? ""
    );
    const descricaoNormalizada = normalizarTextoBasico(
      body?.DESCRICAO?.toString() ?? ""
    );
    const descricao = descricaoNormalizada || null;
    const ativo = interpretarAtivo(body?.ATIVO);

    if (!nomeDepartamento) {
      return NextResponse.json(
        { success: false, error: "NOME_DEPARTAMENTO_OBRIGATORIO" },
        { status: 400 }
      );
    }

    const atualizado = await db.execute({
      sql: `
        UPDATE EMP_DEPARTAMENTO
        SET NOME_DEPARTAMENTO = ?,
            DESCRICAO = ?,
            ATIVO = ?,
            DATA_ATUALIZACAO = datetime('now')
        WHERE ID_DEPARTAMENTO = ? AND ID_EMPRESA = ?
      `,
      args: [nomeDepartamento, descricao, ativo, idDepartamento, empresaId],
    });

    if ((atualizado.rowsAffected ?? 0) === 0) {
      return NextResponse.json(
        { success: false, error: "DEPARTAMENTO_NAO_ENCONTRADO" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
