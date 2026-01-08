import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface CentroCustoDB {
  FIN_CENTRO_CUSTO_ID: number;
  FIN_CENTRO_CUSTO_PAI_ID: number | null;
  FIN_CENTRO_CUSTO_NOME: string;
  FIN_CENTRO_CUSTO_CODIGO: string;
  FIN_CENTRO_CUSTO_ATIVO: 0 | 1;
  FIN_CENTRO_CUSTO_ORDEM: number;
  FIN_CENTRO_CUSTO_DESCRICAO: string | null;
}

interface CentroCustoItem {
  id: string;
  nome: string;
  codigo: string;
  status: "ativo" | "inativo";
  descricao?: string;
  ordem: number;
  filhos?: CentroCustoItem[];
}

function converterParaHierarquia(registros: CentroCustoDB[]): CentroCustoItem[] {
  const mapa = new Map<number, CentroCustoItem>();

  // Criar todos os itens
  registros.forEach((reg) => {
    mapa.set(reg.FIN_CENTRO_CUSTO_ID, {
      id: String(reg.FIN_CENTRO_CUSTO_ID),
      nome: reg.FIN_CENTRO_CUSTO_NOME,
      codigo: reg.FIN_CENTRO_CUSTO_CODIGO,
      status: reg.FIN_CENTRO_CUSTO_ATIVO === 1 ? "ativo" : "inativo",
      descricao: reg.FIN_CENTRO_CUSTO_DESCRICAO || undefined,
      ordem: reg.FIN_CENTRO_CUSTO_ORDEM,
      filhos: [],
    });
  });

  const raiz: CentroCustoItem[] = [];

  // Construir hierarquia
  registros.forEach((reg) => {
    const item = mapa.get(reg.FIN_CENTRO_CUSTO_ID);
    if (!item) return;

    if (reg.FIN_CENTRO_CUSTO_PAI_ID === null) {
      raiz.push(item);
    } else {
      const pai = mapa.get(reg.FIN_CENTRO_CUSTO_PAI_ID);
      if (pai) {
        if (!pai.filhos) pai.filhos = [];
        pai.filhos.push(item);
      }
    }
  });

  // Ordenar recursivamente
  const ordenar = (items: CentroCustoItem[]) => {
    items.sort((a, b) => a.ordem - b.ordem);
    items.forEach((item) => {
      if (item.filhos && item.filhos.length > 0) {
        ordenar(item.filhos);
      }
    });
  };

  ordenar(raiz);
  return raiz;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const id = request.nextUrl.searchParams.get("id");

  try {

    if (id) {
      // Buscar um centro específico
      const resultado = await db.execute({
        sql: `
          SELECT
            FIN_CENTRO_CUSTO_ID,
            FIN_CENTRO_CUSTO_PAI_ID,
            FIN_CENTRO_CUSTO_NOME,
            FIN_CENTRO_CUSTO_CODIGO,
            FIN_CENTRO_CUSTO_ATIVO,
            FIN_CENTRO_CUSTO_ORDEM,
            FIN_CENTRO_CUSTO_DESCRICAO
          FROM FIN_CENTRO_CUSTO
          WHERE FIN_CENTRO_CUSTO_ID = ? AND ID_EMPRESA = ?
        `,
        args: [id, empresaId],
      });

      if (resultado.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Centro de custo não encontrado" },
          { status: 404 }
        );
      }

      const registro = resultado.rows[0] as unknown as CentroCustoDB;
      const item: CentroCustoItem = {
        id: String(registro.FIN_CENTRO_CUSTO_ID),
        nome: registro.FIN_CENTRO_CUSTO_NOME,
        codigo: registro.FIN_CENTRO_CUSTO_CODIGO,
        status: registro.FIN_CENTRO_CUSTO_ATIVO === 1 ? "ativo" : "inativo",
        descricao: registro.FIN_CENTRO_CUSTO_DESCRICAO || undefined,
        ordem: registro.FIN_CENTRO_CUSTO_ORDEM,
      };

      return NextResponse.json({ success: true, data: item });
    }

    // Buscar todos os centros de custo
    const resultado = await db.execute({
      sql: `
        SELECT
          FIN_CENTRO_CUSTO_ID,
          FIN_CENTRO_CUSTO_PAI_ID,
          FIN_CENTRO_CUSTO_NOME,
          FIN_CENTRO_CUSTO_CODIGO,
          FIN_CENTRO_CUSTO_ATIVO,
          FIN_CENTRO_CUSTO_ORDEM,
          FIN_CENTRO_CUSTO_DESCRICAO
        FROM FIN_CENTRO_CUSTO
        WHERE ID_EMPRESA = ?
        ORDER BY FIN_CENTRO_CUSTO_ORDEM ASC
      `,
      args: [empresaId],
    });

    const registros = resultado.rows as unknown as CentroCustoDB[];
    const hierarquia = converterParaHierarquia(registros);

    return NextResponse.json({ success: true, data: hierarquia });
  } catch (error) {
    console.error("Erro ao buscar centros de custo:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar centros de custo" },
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
  const { nome, codigo, paiId, descricao, ordem } = body;

  if (!nome || !codigo) {
    return NextResponse.json(
      { success: false, error: "Nome e código são obrigatórios" },
      { status: 400 }
    );
  }

  try {

    // Verificar se o código já existe
    const verificacao = await db.execute({
      sql: `SELECT COUNT(*) as total FROM FIN_CENTRO_CUSTO WHERE FIN_CENTRO_CUSTO_CODIGO = ? AND ID_EMPRESA = ?`,
      args: [codigo, empresaId],
    });

    const total = (verificacao.rows[0] as any).total;
    if (total > 0) {
      return NextResponse.json(
        { success: false, error: "Código já existe" },
        { status: 400 }
      );
    }

    const resultado = await db.execute({
      sql: `
        INSERT INTO FIN_CENTRO_CUSTO (
          FIN_CENTRO_CUSTO_PAI_ID,
          FIN_CENTRO_CUSTO_NOME,
          FIN_CENTRO_CUSTO_CODIGO,
          FIN_CENTRO_CUSTO_ATIVO,
          FIN_CENTRO_CUSTO_ORDEM,
          FIN_CENTRO_CUSTO_DESCRICAO,
          ID_EMPRESA
        ) VALUES (?, ?, ?, 1, ?, ?, ?)
      `,
      args: [paiId || null, nome, codigo, ordem || 0, descricao || null, empresaId],
    });

    const novoCentro: CentroCustoItem = {
      id: String(resultado.lastInsertRowid),
      nome,
      codigo,
      status: "ativo",
      descricao,
      ordem: ordem || 0,
    };

    return NextResponse.json(
      { success: true, data: novoCentro },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar centro de custo:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar centro de custo" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, error: "ID é obrigatório" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { nome, codigo, descricao, ativo, ordem } = body;

  try {

    // Verificar se o centro existe
    const verificacao = await db.execute({
      sql: `SELECT COUNT(*) as total FROM FIN_CENTRO_CUSTO WHERE FIN_CENTRO_CUSTO_ID = ? AND ID_EMPRESA = ?`,
      args: [id, empresaId],
    });

    const total = (verificacao.rows[0] as any).total;
    if (total === 0) {
      return NextResponse.json(
        { success: false, error: "Centro de custo não encontrado" },
        { status: 404 }
      );
    }

    await db.execute({
      sql: `
        UPDATE FIN_CENTRO_CUSTO
        SET
          FIN_CENTRO_CUSTO_NOME = COALESCE(?, FIN_CENTRO_CUSTO_NOME),
          FIN_CENTRO_CUSTO_CODIGO = COALESCE(?, FIN_CENTRO_CUSTO_CODIGO),
          FIN_CENTRO_CUSTO_DESCRICAO = COALESCE(?, FIN_CENTRO_CUSTO_DESCRICAO),
          FIN_CENTRO_CUSTO_ATIVO = COALESCE(?, FIN_CENTRO_CUSTO_ATIVO),
          FIN_CENTRO_CUSTO_ORDEM = COALESCE(?, FIN_CENTRO_CUSTO_ORDEM)
        WHERE FIN_CENTRO_CUSTO_ID = ? AND ID_EMPRESA = ?
      `,
      args: [nome, codigo, descricao, ativo, ordem, id, empresaId],
    });

    return NextResponse.json({ success: true, message: "Centro de custo atualizado" });
  } catch (error) {
    console.error("Erro ao atualizar centro de custo:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar centro de custo" },
      { status: 500 }
    );
  }
}
