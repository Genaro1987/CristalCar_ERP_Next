import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

// Auto-ensure formula/ref100 columns exist (idempotent)
let _schemaReady = false;
async function ensureSchema() {
  if (_schemaReady) return;
  // Check if columns exist by trying a simple SELECT
  try {
    await db.execute({ sql: "SELECT FIN_ESTRUTURA_DRE_FORMULA, FIN_ESTRUTURA_DRE_REFERENCIA_100 FROM FIN_ESTRUTURA_DRE LIMIT 1", args: [] });
    _schemaReady = true;
    return;
  } catch (_e) {
    // Columns don't exist, add them
  }
  try {
    await db.execute({ sql: "ALTER TABLE FIN_ESTRUTURA_DRE ADD COLUMN FIN_ESTRUTURA_DRE_FORMULA TEXT", args: [] });
  } catch (_e) { /* column already exists */ }
  try {
    await db.execute({ sql: "ALTER TABLE FIN_ESTRUTURA_DRE ADD COLUMN FIN_ESTRUTURA_DRE_REFERENCIA_100 INTEGER DEFAULT 0", args: [] });
  } catch (_e) { /* column already exists */ }
  _schemaReady = true;
}

interface EstruturaDreDB {
  FIN_ESTRUTURA_DRE_ID: number;
  FIN_ESTRUTURA_DRE_PAI_ID: number | null;
  FIN_ESTRUTURA_DRE_NOME: string;
  FIN_ESTRUTURA_DRE_CODIGO: string;
  FIN_ESTRUTURA_DRE_NATUREZA: "RECEITA" | "DESPESA" | "CALCULADO";
  FIN_ESTRUTURA_DRE_ATIVO: 0 | 1;
  FIN_ESTRUTURA_DRE_ORDEM: number;
  FIN_ESTRUTURA_DRE_TIPO: string | null;
  FIN_ESTRUTURA_DRE_DESCRICAO: string | null;
  FIN_ESTRUTURA_DRE_FORMULA: string | null;
  FIN_ESTRUTURA_DRE_REFERENCIA_100: 0 | 1;
}

interface LinhaDre {
  id: string;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "CALCULADO";
  status: "ativo" | "inativo";
  tipo?: string;
  descricao?: string;
  formula?: string;
  referencia100?: boolean;
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
      formula: reg.FIN_ESTRUTURA_DRE_FORMULA || undefined,
      referencia100: reg.FIN_ESTRUTURA_DRE_REFERENCIA_100 === 1,
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
  await ensureSchema();
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const id = request.nextUrl.searchParams.get("id");

  try {
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
            FIN_ESTRUTURA_DRE_DESCRICAO,
            FIN_ESTRUTURA_DRE_FORMULA,
            FIN_ESTRUTURA_DRE_REFERENCIA_100
          FROM FIN_ESTRUTURA_DRE
          WHERE FIN_ESTRUTURA_DRE_ID = ? AND EMPRESA_ID = ?
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
        formula: registro.FIN_ESTRUTURA_DRE_FORMULA || undefined,
        referencia100: registro.FIN_ESTRUTURA_DRE_REFERENCIA_100 === 1,
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
          FIN_ESTRUTURA_DRE_DESCRICAO,
          FIN_ESTRUTURA_DRE_FORMULA,
          FIN_ESTRUTURA_DRE_REFERENCIA_100
        FROM FIN_ESTRUTURA_DRE
        WHERE EMPRESA_ID = ?
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
        WHERE dre.EMPRESA_ID = ?
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
  } catch (error: any) {
    console.error("Erro ao buscar estrutura do DRE:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar estrutura do DRE: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await ensureSchema();
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const body = await request.json();
  const { nome, codigo, natureza, paiId, tipo, descricao, ordem, formula, referencia100 } = body;

  if (!nome || !codigo || !natureza) {
    return NextResponse.json(
      { success: false, error: "Nome, código e natureza são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    // Verificar se o código já existe
    const verificacao = await db.execute({
      sql: `SELECT COUNT(*) as total FROM FIN_ESTRUTURA_DRE WHERE FIN_ESTRUTURA_DRE_CODIGO = ? AND EMPRESA_ID = ?`,
      args: [codigo, empresaId],
    });

    const total = (verificacao.rows[0] as any).total;
    if (total > 0) {
      return NextResponse.json(
        { success: false, error: "Código já existe" },
        { status: 400 }
      );
    }

    // If marking as ref100, clear any existing ref100 for this empresa
    if (referencia100) {
      await db.execute({
        sql: `UPDATE FIN_ESTRUTURA_DRE SET FIN_ESTRUTURA_DRE_REFERENCIA_100 = 0 WHERE EMPRESA_ID = ? AND FIN_ESTRUTURA_DRE_REFERENCIA_100 = 1`,
        args: [empresaId],
      });
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
          FIN_ESTRUTURA_DRE_FORMULA,
          FIN_ESTRUTURA_DRE_REFERENCIA_100,
          EMPRESA_ID
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `,
      args: [paiId || null, nome, codigo, natureza, ordem || 0, tipo || null, descricao || null, formula || null, referencia100 ? 1 : 0, empresaId],
    });

    const novaLinha: LinhaDre = {
      id: String(resultado.lastInsertRowid),
      nome,
      codigo,
      natureza,
      status: "ativo",
      tipo,
      descricao,
      formula,
      referencia100: !!referencia100,
    };

    return NextResponse.json(
      { success: true, data: novaLinha },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Erro ao criar linha do DRE:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar linha do DRE: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  await ensureSchema();
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
  const { nome, codigo, natureza, tipo, descricao, ativo, ordem, formula, referencia100 } = body;

  try {
    // Verificar se a linha existe
    const verificacao = await db.execute({
      sql: `SELECT COUNT(*) as total FROM FIN_ESTRUTURA_DRE WHERE FIN_ESTRUTURA_DRE_ID = ? AND EMPRESA_ID = ?`,
      args: [id, empresaId],
    });

    const total = (verificacao.rows[0] as any).total;
    if (total === 0) {
      return NextResponse.json(
        { success: false, error: "Linha do DRE não encontrada" },
        { status: 404 }
      );
    }

    // If marking as ref100, clear any existing ref100 for this empresa
    if (referencia100 !== undefined && referencia100) {
      await db.execute({
        sql: `UPDATE FIN_ESTRUTURA_DRE SET FIN_ESTRUTURA_DRE_REFERENCIA_100 = 0 WHERE EMPRESA_ID = ? AND FIN_ESTRUTURA_DRE_REFERENCIA_100 = 1 AND FIN_ESTRUTURA_DRE_ID != ?`,
        args: [empresaId, id],
      });
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
          FIN_ESTRUTURA_DRE_ORDEM = COALESCE(?, FIN_ESTRUTURA_DRE_ORDEM),
          FIN_ESTRUTURA_DRE_FORMULA = ?,
          FIN_ESTRUTURA_DRE_REFERENCIA_100 = COALESCE(?, FIN_ESTRUTURA_DRE_REFERENCIA_100)
        WHERE FIN_ESTRUTURA_DRE_ID = ? AND EMPRESA_ID = ?
      `,
      args: [nome ?? null, codigo ?? null, natureza ?? null, tipo ?? null, descricao ?? null, ativo ?? null, ordem ?? null, formula !== undefined ? (formula || null) : null, referencia100 !== undefined ? (referencia100 ? 1 : 0) : null, id, empresaId],
    });

    return NextResponse.json({ success: true, message: "Linha do DRE atualizada" });
  } catch (error: any) {
    console.error("Erro ao atualizar linha do DRE:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar linha do DRE: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, error: "ID e obrigatorio" },
      { status: 400 }
    );
  }

  try {
    // Collect this DRE line + all descendants recursively
    const descResult = await db.execute({
      sql: `
        WITH RECURSIVE descendants AS (
          SELECT FIN_ESTRUTURA_DRE_ID FROM FIN_ESTRUTURA_DRE WHERE FIN_ESTRUTURA_DRE_ID = ? AND EMPRESA_ID = ?
          UNION ALL
          SELECT d2.FIN_ESTRUTURA_DRE_ID FROM FIN_ESTRUTURA_DRE d2
          INNER JOIN descendants dd ON d2.FIN_ESTRUTURA_DRE_PAI_ID = dd.FIN_ESTRUTURA_DRE_ID
        )
        SELECT FIN_ESTRUTURA_DRE_ID FROM descendants
      `,
      args: [id, empresaId],
    });

    if (descResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Linha do DRE nao encontrada" },
        { status: 404 }
      );
    }

    const ids = descResult.rows.map((r: any) => r.FIN_ESTRUTURA_DRE_ID);
    const placeholders = ids.map(() => "?").join(",");

    // Check for movements: linked plano_contas that have lancamentos
    const movResult = await db.execute({
      sql: `
        SELECT COUNT(*) as total FROM FIN_LANCAMENTO fl
        WHERE fl.FIN_PLANO_CONTA_ID IN (
          SELECT dc.FIN_PLANO_CONTA_ID FROM FIN_ESTRUTURA_DRE_CONTA dc
          WHERE dc.FIN_ESTRUTURA_DRE_ID IN (${placeholders})
        ) AND fl.EMPRESA_ID = ?
      `,
      args: [...ids, empresaId],
    });

    const totalMov = Number((movResult.rows[0] as any).total);

    if (totalMov > 0) {
      // Has movements → inactivate all
      const stmts = ids.map((dreId: number) => ({
        sql: "UPDATE FIN_ESTRUTURA_DRE SET FIN_ESTRUTURA_DRE_ATIVO = 0 WHERE FIN_ESTRUTURA_DRE_ID = ?",
        args: [dreId],
      }));
      await db.batch(stmts);

      return NextResponse.json({
        success: true,
        inativada: true,
        message: `Linha do DRE possui contas com lancamentos. ${ids.length} linha(s) inativada(s).`,
      });
    }

    // No movements → remove linked accounts first, then delete DRE lines
    const stmts = [
      ...ids.map((dreId: number) => ({
        sql: "DELETE FROM FIN_ESTRUTURA_DRE_CONTA WHERE FIN_ESTRUTURA_DRE_ID = ?",
        args: [dreId],
      })),
      ...ids.reverse().map((dreId: number) => ({
        sql: "DELETE FROM FIN_ESTRUTURA_DRE WHERE FIN_ESTRUTURA_DRE_ID = ?",
        args: [dreId],
      })),
    ];
    await db.batch(stmts);

    return NextResponse.json({
      success: true,
      inativada: false,
      message: `${ids.length} linha(s) do DRE excluida(s) com sucesso.`,
    });
  } catch (error: any) {
    console.error("Erro ao excluir linha do DRE:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao excluir linha do DRE: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
