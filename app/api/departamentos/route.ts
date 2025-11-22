import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";
import { interpretarAtivo, normalizarTextoBasico, obterEmpresaId } from "./utils";

const CAMPOS_DEPARTAMENTO = [
  "ID_DEPARTAMENTO",
  "ID_EMPRESA",
  "NOME_DEPARTAMENTO",
  "DESCRICAO",
  "ATIVO",
  "DATA_CADASTRO",
  "DATA_ATUALIZACAO",
].join(", ");

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaId(request);

  if (!empresaId) {
    return NextResponse.json(
      { success: false, error: "EMPRESA_NAO_INFORMADA" },
      { status: 400 }
    );
  }

  try {
    const resultado = await db.execute({
      sql: `
        SELECT ${CAMPOS_DEPARTAMENTO}
        FROM EMP_DEPARTAMENTO
        WHERE ID_EMPRESA = ?
        ORDER BY ID_DEPARTAMENTO
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
  const empresaId = obterEmpresaId(request);

  if (!empresaId) {
    return NextResponse.json(
      { success: false, error: "EMPRESA_NAO_INFORMADA" },
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

    const resultado = await db.execute({
      sql: `
        INSERT INTO EMP_DEPARTAMENTO (
          ID_EMPRESA,
          NOME_DEPARTAMENTO,
          DESCRICAO,
          ATIVO,
          DATA_CADASTRO
        ) VALUES (?, ?, ?, ?, datetime('now'))
      `,
      args: [empresaId, nomeDepartamento, descricao, ativo],
    });

    const novoId = resultado.lastInsertRowid
      ? Number(resultado.lastInsertRowid)
      : undefined;

    return NextResponse.json({ success: true, id: novoId }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
