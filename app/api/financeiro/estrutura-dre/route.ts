import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaSelecionada } from "@/lib/api-helper";
import { getDbConnection } from "@/lib/db";

interface EstruturaDreDB {
  FIN_ESTRUTURA_DRE_ID: number;
  FIN_ESTRUTURA_DRE_PAI_ID: number | null;
  FIN_ESTRUTURA_DRE_NOME: string;
  FIN_ESTRUTURA_DRE_CODIGO: string;
  FIN_ESTRUTURA_DRE_NATUREZA: "RECEITA" | "DESPESA" | "OUTROS";
  FIN_ESTRUTURA_DRE_ATIVO: 0 | 1;
  FIN_ESTRUTURA_DRE_ORDEM: number;
  FIN_ESTRUTURA_DRE_TIPO: string | null;
  FIN_ESTRUTURA_DRE_DESCRICAO: string | null;
}

interface LinhaDre {
  id: string;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "OUTROS";
  status: "ativo" | "inativo";
  tipo?: string;
  descricao?: string;
  contasVinculadas?: string[];
  filhos?: LinhaDre[];
}

function converterParaHierarquia(registros: EstruturaDreDB[], contasMap: Map<number, string[]>): LinhaDre[] {
  const mapa = new Map<number, LinhaDre>();

  // Criar todos os itens
  registros.forEach((reg) => {
    mapa.set(reg.FIN_ESTRUTURA_DRE_ID, {
      id: String(reg.FIN_ESTRUTURA_DRE_ID),
      nome: reg.FIN_ESTRUTURA_DRE_NOME,
      codigo: reg.FIN_ESTRUTURA_DRE_CODIGO,
      natureza: reg.FIN_ESTRUTURA_DRE_NATUREZA,
      status: reg.FIN_ESTRUTURA_DRE_ATIVO === 1 ? "ativo" : "inativo",
      tipo: reg.FIN_ESTRUTURA_DRE_TIPO || undefined,
      descricao: reg.FIN_ESTRUTURA_DRE_DESCRICAO || undefined,
      contasVinculadas: contasMap.get(reg.FIN_ESTRUTURA_DRE_ID) || [],
      filhos: [],
    });
  });

  const raiz: LinhaDre[] = [];

  // Construir hierarquia
  registros.forEach((reg) => {
    const item = mapa.get(reg.FIN_ESTRUTURA_DRE_ID);
    if (!item) return;

    if (reg.FIN_ESTRUTURA_DRE_PAI_ID === null) {
      raiz.push(item);
    } else {
      const pai = mapa.get(reg.FIN_ESTRUTURA_DRE_PAI_ID);
      if (pai) {
        if (!pai.filhos) pai.filhos = [];
        pai.filhos.push(item);
      }
    }
  });

  // Ordenar recursivamente
  const ordenar = (items: LinhaDre[]) => {
    items.sort((a, b) => {
      const ordemA = registros.find(r => String(r.FIN_ESTRUTURA_DRE_ID) === a.id)?.FIN_ESTRUTURA_DRE_ORDEM || 0;
      const ordemB = registros.find(r => String(r.FIN_ESTRUTURA_DRE_ID) === b.id)?.FIN_ESTRUTURA_DRE_ORDEM || 0;
      return ordemA - ordemB;
    });
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
  try {
    const empresaId = obterEmpresaIdDaRequest(request);
    if (!empresaId) {
      return respostaEmpresaSelecionada();
    }

    const id = request.nextUrl.searchParams.get("id");
    const db = await getDbConnection();

    if (id) {
      // Buscar uma linha específica
      const resultado = await db.execute({
        sql: `
          SELECT
            FIN_ESTRUTURA_DRE_ID,
            FIN_ESTRUTURA_DRE_PAI_ID,
            FIN_ESTRUTURA_DRE_NOME,
            FIN_ESTRUTURA_DRE_CODIGO,
            FIN_ESTRUTURA_DRE_NATUREZA,
            FIN_ESTRUTURA_DRE_ATIVO,
            FIN_ESTRUTURA_DRE_ORDEM,
            FIN_ESTRUTURA_DRE_TIPO,
            FIN_ESTRUTURA_DRE_DESCRICAO
          FROM FIN_ESTRUTURA_DRE
          WHERE FIN_ESTRUTURA_DRE_ID = ? AND ID_EMPRESA = ?
        `,
        args: [id, empresaId],
      });

      if (resultado.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Linha do DRE não encontrada" },
          { status: 404 }
        );
      }

      const registro = resultado.rows[0] as unknown as EstruturaDreDB;

      // Buscar contas vinculadas
      const contasResult = await db.execute({
        sql: `
          SELECT pc.FIN_PLANO_CONTA_CODIGO || ' ' || pc.FIN_PLANO_CONTA_NOME as conta
          FROM FIN_ESTRUTURA_DRE_CONTA dc
          INNER JOIN FIN_PLANO_CONTA pc ON pc.FIN_PLANO_CONTA_ID = dc.FIN_PLANO_CONTA_ID
          WHERE dc.FIN_ESTRUTURA_DRE_ID = ?
        `,
        args: [id],
      });

      const contas = contasResult.rows.map((row: any) => row.conta);

      const item: LinhaDre = {
        id: String(registro.FIN_ESTRUTURA_DRE_ID),
        nome: registro.FIN_ESTRUTURA_DRE_NOME,
        codigo: registro.FIN_ESTRUTURA_DRE_CODIGO,
        natureza: registro.FIN_ESTRUTURA_DRE_NATUREZA,
        status: registro.FIN_ESTRUTURA_DRE_ATIVO === 1 ? "ativo" : "inativo",
        tipo: registro.FIN_ESTRUTURA_DRE_TIPO || undefined,
        descricao: registro.FIN_ESTRUTURA_DRE_DESCRICAO || undefined,
        contasVinculadas: contas,
      };

      return NextResponse.json({ success: true, data: item });
    }

    // Buscar toda a estrutura do DRE
    const resultado = await db.execute({
      sql: `
        SELECT
          FIN_ESTRUTURA_DRE_ID,
          FIN_ESTRUTURA_DRE_PAI_ID,
          FIN_ESTRUTURA_DRE_NOME,
          FIN_ESTRUTURA_DRE_CODIGO,
          FIN_ESTRUTURA_DRE_NATUREZA,
          FIN_ESTRUTURA_DRE_ATIVO,
          FIN_ESTRUTURA_DRE_ORDEM,
          FIN_ESTRUTURA_DRE_TIPO,
          FIN_ESTRUTURA_DRE_DESCRICAO
        FROM FIN_ESTRUTURA_DRE
        WHERE ID_EMPRESA = ?
        ORDER BY FIN_ESTRUTURA_DRE_ORDEM ASC
      `,
      args: [empresaId],
    });

    // Buscar todas as contas vinculadas
    const contasResult = await db.execute({
      sql: `
        SELECT
          dc.FIN_ESTRUTURA_DRE_ID,
          pc.FIN_PLANO_CONTA_CODIGO || ' ' || pc.FIN_PLANO_CONTA_NOME as conta
        FROM FIN_ESTRUTURA_DRE_CONTA dc
        INNER JOIN FIN_PLANO_CONTA pc ON pc.FIN_PLANO_CONTA_ID = dc.FIN_PLANO_CONTA_ID
        INNER JOIN FIN_ESTRUTURA_DRE dre ON dre.FIN_ESTRUTURA_DRE_ID = dc.FIN_ESTRUTURA_DRE_ID
        WHERE dre.ID_EMPRESA = ?
      `,
      args: [empresaId],
    });

    // Organizar contas por linha do DRE
    const contasMap = new Map<number, string[]>();
    contasResult.rows.forEach((row: any) => {
      const dreId = row.FIN_ESTRUTURA_DRE_ID;
      if (!contasMap.has(dreId)) {
        contasMap.set(dreId, []);
      }
      contasMap.get(dreId)!.push(row.conta);
    });

    const registros = resultado.rows as unknown as EstruturaDreDB[];
    const hierarquia = converterParaHierarquia(registros, contasMap);

    return NextResponse.json({ success: true, data: hierarquia });
  } catch (error) {
    console.error("Erro ao buscar estrutura do DRE:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar estrutura do DRE" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const empresaId = obterEmpresaIdDaRequest(request);
    if (!empresaId) {
      return respostaEmpresaSelecionada();
    }

    const body = await request.json();
    const { nome, codigo, natureza, paiId, tipo, descricao, ordem } = body;

    if (!nome || !codigo || !natureza) {
      return NextResponse.json(
        { success: false, error: "Nome, código e natureza são obrigatórios" },
        { status: 400 }
      );
    }

    const db = await getDbConnection();

    // Verificar se o código já existe
    const verificacao = await db.execute({
      sql: `SELECT COUNT(*) as total FROM FIN_ESTRUTURA_DRE WHERE FIN_ESTRUTURA_DRE_CODIGO = ? AND ID_EMPRESA = ?`,
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
        INSERT INTO FIN_ESTRUTURA_DRE (
          FIN_ESTRUTURA_DRE_PAI_ID,
          FIN_ESTRUTURA_DRE_NOME,
          FIN_ESTRUTURA_DRE_CODIGO,
          FIN_ESTRUTURA_DRE_NATUREZA,
          FIN_ESTRUTURA_DRE_ATIVO,
          FIN_ESTRUTURA_DRE_ORDEM,
          FIN_ESTRUTURA_DRE_TIPO,
          FIN_ESTRUTURA_DRE_DESCRICAO,
          ID_EMPRESA
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
      `,
      args: [paiId || null, nome, codigo, natureza, ordem || 0, tipo || null, descricao || null, empresaId],
    });

    const novaLinha: LinhaDre = {
      id: String(resultado.lastInsertRowid),
      nome,
      codigo,
      natureza,
      status: "ativo",
      tipo,
      descricao,
    };

    return NextResponse.json(
      { success: true, data: novaLinha },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar linha do DRE:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar linha do DRE" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const empresaId = obterEmpresaIdDaRequest(request);
    if (!empresaId) {
      return respostaEmpresaSelecionada();
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID é obrigatório" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nome, codigo, natureza, tipo, descricao, ativo, ordem } = body;

    const db = await getDbConnection();

    // Verificar se a linha existe
    const verificacao = await db.execute({
      sql: `SELECT COUNT(*) as total FROM FIN_ESTRUTURA_DRE WHERE FIN_ESTRUTURA_DRE_ID = ? AND ID_EMPRESA = ?`,
      args: [id, empresaId],
    });

    const total = (verificacao.rows[0] as any).total;
    if (total === 0) {
      return NextResponse.json(
        { success: false, error: "Linha do DRE não encontrada" },
        { status: 404 }
      );
    }

    await db.execute({
      sql: `
        UPDATE FIN_ESTRUTURA_DRE
        SET
          FIN_ESTRUTURA_DRE_NOME = COALESCE(?, FIN_ESTRUTURA_DRE_NOME),
          FIN_ESTRUTURA_DRE_CODIGO = COALESCE(?, FIN_ESTRUTURA_DRE_CODIGO),
          FIN_ESTRUTURA_DRE_NATUREZA = COALESCE(?, FIN_ESTRUTURA_DRE_NATUREZA),
          FIN_ESTRUTURA_DRE_TIPO = COALESCE(?, FIN_ESTRUTURA_DRE_TIPO),
          FIN_ESTRUTURA_DRE_DESCRICAO = COALESCE(?, FIN_ESTRUTURA_DRE_DESCRICAO),
          FIN_ESTRUTURA_DRE_ATIVO = COALESCE(?, FIN_ESTRUTURA_DRE_ATIVO),
          FIN_ESTRUTURA_DRE_ORDEM = COALESCE(?, FIN_ESTRUTURA_DRE_ORDEM)
        WHERE FIN_ESTRUTURA_DRE_ID = ? AND ID_EMPRESA = ?
      `,
      args: [nome, codigo, natureza, tipo, descricao, ativo, ordem, id, empresaId],
    });

    return NextResponse.json({ success: true, message: "Linha do DRE atualizada" });
  } catch (error) {
    console.error("Erro ao atualizar linha do DRE:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar linha do DRE" },
      { status: 500 }
    );
  }
}
