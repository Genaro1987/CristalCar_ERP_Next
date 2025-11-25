import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";

type TelaPerfilPayload = {
  telas?: {
    ID_TELA: number;
    PODE_ACESSAR?: boolean | number;
    PODE_CONSULTAR?: boolean | number;
    PODE_EDITAR?: boolean | number;
  }[];
};

function obterEmpresaId(request: NextRequest): number | null {
  const headerId = request.headers.get("x-empresa-id");
  const queryId = request.nextUrl.searchParams.get("empresaId");
  const valor = headerId ?? queryId;

  if (!valor) return null;

  const parsed = Number(valor);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function verificarPerfilDaEmpresa(
  idPerfil: string,
  empresaId: number
): Promise<boolean> {
  const resultado = await db.execute({
    sql: `
      SELECT 1
      FROM SEG_PERFIL
      WHERE ID_PERFIL = ? AND ID_EMPRESA = ?
      LIMIT 1
    `,
    args: [idPerfil, empresaId],
  });

  return Boolean(resultado.rows?.length);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const empresaId = obterEmpresaId(request);
  const idPerfil = params.id;

  if (!empresaId) {
    return NextResponse.json(
      { success: false, error: "EMPRESA_NAO_INFORMADA" },
      { status: 400 }
    );
  }

  if (!idPerfil) {
    return NextResponse.json(
      { success: false, error: "PERFIL_NAO_INFORMADO" },
      { status: 400 }
    );
  }

  try {
    const perfilValido = await verificarPerfilDaEmpresa(idPerfil, empresaId);

    if (!perfilValido) {
      return NextResponse.json(
        { success: false, error: "PERFIL_NAO_ENCONTRADO" },
        { status: 404 }
      );
    }

    const telasCatalogo = await db.execute({
      sql: `
        SELECT ID_TELA, CODIGO_TELA, NOME_TELA, MODULO
        FROM CORE_TELA
        WHERE ATIVA = 1
          AND CODIGO_TELA != 'CAD007_RH_PONTO'
        ORDER BY MODULO, CODIGO_TELA
      `,
    });

    const permissoes = await db.execute({
      sql: `
        SELECT ID_TELA, PODE_ACESSAR, PODE_CONSULTAR, PODE_EDITAR
        FROM SEG_PERFIL_TELA
        WHERE ID_PERFIL = ?
      `,
      args: [idPerfil],
    });

    const mapaPermissoes = new Map<
      number,
      { PODE_ACESSAR: boolean; PODE_CONSULTAR: boolean; PODE_EDITAR: boolean }
    >();

    for (const row of permissoes.rows ?? []) {
      const idTela = Number(row.ID_TELA);
      const podeAcessar = row.PODE_ACESSAR === 1 || row.PODE_ACESSAR === "1";
      const podeConsultar =
        row.PODE_CONSULTAR === 1 || row.PODE_CONSULTAR === "1";
      const podeEditar = row.PODE_EDITAR === 1 || row.PODE_EDITAR === "1";
      if (Number.isFinite(idTela)) {
        mapaPermissoes.set(idTela, {
          PODE_ACESSAR: podeAcessar,
          PODE_CONSULTAR: podeConsultar,
          PODE_EDITAR: podeEditar,
        });
      }
    }

    const data = (telasCatalogo.rows ?? []).map((tela) => ({
      ID_TELA: tela.ID_TELA as number,
      CODIGO_TELA: tela.CODIGO_TELA as string,
      NOME_TELA: tela.NOME_TELA as string,
      MODULO: tela.MODULO as string,
      ...
        mapaPermissoes.get(Number(tela.ID_TELA)) ?? {
          PODE_ACESSAR: false,
          PODE_CONSULTAR: false,
          PODE_EDITAR: false,
        },
    }));

    return NextResponse.json({ success: true, data });
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
  { params }: { params: { id: string } }
) {
  const empresaId = obterEmpresaId(request);
  const idPerfil = params.id;

  if (!empresaId) {
    return NextResponse.json(
      { success: false, error: "EMPRESA_NAO_INFORMADA" },
      { status: 400 }
    );
  }

  if (!idPerfil) {
    return NextResponse.json(
      { success: false, error: "PERFIL_NAO_INFORMADO" },
      { status: 400 }
    );
  }

  try {
    const perfilValido = await verificarPerfilDaEmpresa(idPerfil, empresaId);

    if (!perfilValido) {
      return NextResponse.json(
        { success: false, error: "PERFIL_NAO_ENCONTRADO" },
        { status: 404 }
      );
    }

    const body = (await request.json().catch(() => null)) as TelaPerfilPayload | null;
    const telasPayload = Array.isArray(body?.telas) ? body?.telas : [];

    const todasTelas = await db.execute({
      sql: `
        SELECT ID_TELA
        FROM CORE_TELA
      `,
    });

    const idsValidos = new Set(
      (todasTelas.rows ?? []).map((row) => Number(row.ID_TELA)).filter((n) =>
        Number.isFinite(n)
      )
    );

    await db.execute({
      sql: `DELETE FROM SEG_PERFIL_TELA WHERE ID_PERFIL = ?`,
      args: [idPerfil],
    });

    for (const tela of telasPayload) {
      const idTela = Number(tela.ID_TELA);
      const acessoMarcado = tela.PODE_ACESSAR === true || tela.PODE_ACESSAR === 1;
      const consultaMarcada =
        tela.PODE_CONSULTAR === true || tela.PODE_CONSULTAR === 1;
      const edicaoMarcada = tela.PODE_EDITAR === true || tela.PODE_EDITAR === 1;

      if (!idsValidos.has(idTela)) {
        continue;
      }

      let podeAcessar = acessoMarcado || consultaMarcada || edicaoMarcada;
      let podeConsultar = podeAcessar ? consultaMarcada : false;
      let podeEditar = podeAcessar ? edicaoMarcada : false;

      if (podeEditar) {
        podeConsultar = true;
        podeAcessar = true;
      }

      if (!podeAcessar) {
        podeConsultar = false;
        podeEditar = false;
      }

      if (!podeAcessar) {
        continue;
      }

      await db.execute({
        sql: `
          INSERT INTO SEG_PERFIL_TELA (
            ID_PERFIL,
            ID_TELA,
            PODE_ACESSAR,
            PODE_CONSULTAR,
            PODE_EDITAR,
            CRIADO_EM,
            ATUALIZADO_EM
          ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
        args: [
          idPerfil,
          idTela,
          podeAcessar ? 1 : 0,
          podeConsultar ? 1 : 0,
          podeEditar ? 1 : 0,
        ],
      });
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
