import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { db } from "@/db/client";

interface DreLinha {
  id: number;
  paiId: number | null;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "CALCULADO";
  formula?: string;
  valor: number;
  colunas: Record<string, number>;
  filhos: DreLinha[];
}

// ── Avaliador seguro de fórmulas (sem eval) ──
// Suporta: +, -, *, /, parênteses, códigos de linhas DRE
// Ex: "(1 + 2) * 3 / 4 - 5"
function avaliarFormula(formula: string, valoresPorCodigo: Map<string, number>): number {
  // Substituir códigos de linhas por seus valores
  // Códigos podem ser: "1", "1.1", "1.1.2", etc.
  let expr = formula.replace(/[A-Za-z0-9_.]+/g, (token) => {
    // Se for número puro, manter
    if (/^\d+(\.\d+)?$/.test(token)) return token;
    // Se for código de linha DRE, substituir pelo valor
    const val = valoresPorCodigo.get(token);
    if (val !== undefined) return String(val);
    return "0";
  });

  // Remover espaços
  expr = expr.replace(/\s+/g, "");

  // Parser recursivo descendente com precedência de operadores
  let pos = 0;

  function peek(): string {
    return pos < expr.length ? expr[pos] : "";
  }

  function consume(): string {
    return expr[pos++];
  }

  // Expressão: soma/subtração (menor precedência)
  function parseExpr(): number {
    let result = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      result = op === "+" ? result + right : result - right;
    }
    return result;
  }

  // Termo: multiplicação/divisão
  function parseTerm(): number {
    let result = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parseFactor();
      if (op === "*") {
        result *= right;
      } else {
        result = right !== 0 ? result / right : 0;
      }
    }
    return result;
  }

  // Fator: número, parênteses, ou número negativo
  function parseFactor(): number {
    // Número negativo (unário)
    if (peek() === "-") {
      consume();
      return -parseFactor();
    }
    // Parênteses
    if (peek() === "(") {
      consume(); // "("
      const result = parseExpr();
      if (peek() === ")") consume(); // ")"
      return result;
    }
    // Número
    let numStr = "";
    while (/[\d.]/.test(peek())) {
      numStr += consume();
    }
    return numStr ? parseFloat(numStr) : 0;
  }

  try {
    const result = parseExpr();
    return isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

// Resolve fórmulas CALCULADO após os valores normais serem computados
function resolverFormulas(linhas: DreLinha[], valoresPorCodigo: Map<string, number>): void {
  for (const linha of linhas) {
    if (linha.natureza === "CALCULADO" && linha.formula) {
      linha.valor = avaliarFormula(linha.formula, valoresPorCodigo);
    }
    if (linha.filhos.length > 0) {
      resolverFormulas(linha.filhos, valoresPorCodigo);
    }
  }
}

function resolverFormulasPorPeriodo(linhas: DreLinha[], valoresPorCodigoPeriodo: Map<string, Map<string, number>>, periodos: string[]): void {
  for (const linha of linhas) {
    if (linha.natureza === "CALCULADO" && linha.formula) {
      let totalGeral = 0;
      for (const chave of periodos) {
        const mapa = valoresPorCodigoPeriodo.get(chave);
        if (mapa) {
          const val = avaliarFormula(linha.formula, mapa);
          linha.colunas[chave] = val;
          totalGeral += val;
        }
      }
      linha.valor = totalGeral;
    }
    if (linha.filhos.length > 0) {
      resolverFormulasPorPeriodo(linha.filhos, valoresPorCodigoPeriodo, periodos);
    }
  }
}

function construirArvore(linhas: DreLinha[]): DreLinha[] {
  const mapa = new Map<number, DreLinha>();
  const raizes: DreLinha[] = [];

  linhas.forEach((linha) => {
    mapa.set(linha.id, { ...linha, filhos: [] });
  });

  mapa.forEach((linha) => {
    if (linha.paiId && mapa.has(linha.paiId)) {
      mapa.get(linha.paiId)!.filhos.push(linha);
    } else {
      raizes.push(linha);
    }
  });

  return raizes;
}

function somarFilhos(linha: DreLinha): DreLinha {
  const filhosAtualizados = linha.filhos.map(somarFilhos);
  const totalFilhosValor = filhosAtualizados.reduce((acc, item) => acc + item.valor, 0);

  const colunasAtualizadas: Record<string, number> = { ...linha.colunas };
  for (const filho of filhosAtualizados) {
    for (const [chave, val] of Object.entries(filho.colunas)) {
      colunasAtualizadas[chave] = (colunasAtualizadas[chave] ?? 0) + val;
    }
  }

  return { ...linha, filhos: filhosAtualizados, valor: linha.valor + totalFilhosValor, colunas: colunasAtualizadas };
}

type TipoVisao = "mensal" | "trimestral" | "semestral" | "anual";

function gerarPeriodos(ano: number, visao: TipoVisao): { chave: string; label: string; inicio: string; fim: string }[] {
  const periodos: { chave: string; label: string; inicio: string; fim: string }[] = [];

  if (visao === "mensal") {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const ultimoDia = new Date(ano, m, 0).getDate();
      periodos.push({
        chave: `${ano}-${mm}`,
        label: meses[m - 1],
        inicio: `${ano}-${mm}-01`,
        fim: `${ano}-${mm}-${ultimoDia}`,
      });
    }
  } else if (visao === "trimestral") {
    const labels = ["1T", "2T", "3T", "4T"];
    for (let t = 0; t < 4; t++) {
      const mesInicio = t * 3 + 1;
      const mesFim = t * 3 + 3;
      const mmInicio = String(mesInicio).padStart(2, "0");
      const mmFim = String(mesFim).padStart(2, "0");
      const ultimoDia = new Date(ano, mesFim, 0).getDate();
      periodos.push({
        chave: `${ano}-T${t + 1}`,
        label: labels[t],
        inicio: `${ano}-${mmInicio}-01`,
        fim: `${ano}-${mmFim}-${ultimoDia}`,
      });
    }
  } else if (visao === "semestral") {
    periodos.push({ chave: `${ano}-S1`, label: "1S", inicio: `${ano}-01-01`, fim: `${ano}-06-30` });
    periodos.push({ chave: `${ano}-S2`, label: "2S", inicio: `${ano}-07-01`, fim: `${ano}-12-31` });
  } else {
    periodos.push({ chave: `${ano}`, label: String(ano), inicio: `${ano}-01-01`, fim: `${ano}-12-31` });
  }

  return periodos;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const params = request.nextUrl.searchParams;
  const dataInicio = params.get("dataInicio");
  const dataFim = params.get("dataFim");
  const visao = (params.get("visao") as TipoVisao | null) ?? null;
  const anoParam = params.get("ano");
  const ano = anoParam ? Number(anoParam) : new Date().getFullYear();

  try {
    const linhasResult = await db.execute({
      sql: `
        SELECT
          FIN_ESTRUTURA_DRE_ID,
          FIN_ESTRUTURA_DRE_PAI_ID,
          FIN_ESTRUTURA_DRE_NOME,
          FIN_ESTRUTURA_DRE_CODIGO,
          FIN_ESTRUTURA_DRE_NATUREZA,
          COALESCE(FIN_ESTRUTURA_DRE_ORDEM, 0) as FIN_ESTRUTURA_DRE_ORDEM,
          FIN_ESTRUTURA_DRE_FORMULA
        FROM FIN_ESTRUTURA_DRE
        WHERE EMPRESA_ID = ?
        ORDER BY FIN_ESTRUTURA_DRE_ORDEM ASC
      `,
      args: [empresaId],
    });

    const contasResult = await db.execute({
      sql: `
        SELECT FIN_ESTRUTURA_DRE_ID, FIN_PLANO_CONTA_ID
        FROM FIN_ESTRUTURA_DRE_CONTA
        WHERE EMPRESA_ID = ?
      `,
      args: [empresaId],
    });

    const contasPorLinha = new Map<number, number[]>();
    (contasResult.rows ?? []).forEach((row: any) => {
      const linhaId = Number(row.FIN_ESTRUTURA_DRE_ID);
      if (!contasPorLinha.has(linhaId)) {
        contasPorLinha.set(linhaId, []);
      }
      contasPorLinha.get(linhaId)!.push(Number(row.FIN_PLANO_CONTA_ID));
    });

    // Period-based view (mensal, trimestral, semestral, anual)
    if (visao) {
      const periodos = gerarPeriodos(ano, visao);

      const lancResult = await db.execute({
        sql: `
          SELECT FIN_PLANO_CONTA_ID, FIN_LANCAMENTO_DATA, COALESCE(FIN_LANCAMENTO_VALOR, 0) as valor
          FROM FIN_LANCAMENTO
          WHERE EMPRESA_ID = ?
            AND FIN_LANCAMENTO_DATA >= ?
            AND FIN_LANCAMENTO_DATA <= ?
        `,
        args: [empresaId, periodos[0].inicio, periodos[periodos.length - 1].fim],
      });

      const lancRows = (lancResult.rows ?? []) as any[];
      const totaisPorPeriodo = new Map<string, Map<number, number>>();
      for (const p of periodos) {
        totaisPorPeriodo.set(p.chave, new Map());
      }

      for (const row of lancRows) {
        const contaId = Number(row.FIN_PLANO_CONTA_ID);
        const data = String(row.FIN_LANCAMENTO_DATA);
        const valor = Number(row.valor);

        for (const p of periodos) {
          if (data >= p.inicio && data <= p.fim) {
            const mapa = totaisPorPeriodo.get(p.chave)!;
            mapa.set(contaId, (mapa.get(contaId) ?? 0) + valor);
            break;
          }
        }
      }

      const linhas: DreLinha[] = (linhasResult.rows ?? []).map((linha: any) => {
        const nat = linha.FIN_ESTRUTURA_DRE_NATUREZA;
        const isCalculado = nat === "CALCULADO";
        const contas = contasPorLinha.get(Number(linha.FIN_ESTRUTURA_DRE_ID)) ?? [];
        const colunas: Record<string, number> = {};
        let totalGeral = 0;

        if (!isCalculado) {
          for (const p of periodos) {
            const mapaPeriodo = totaisPorPeriodo.get(p.chave)!;
            const total = contas.reduce((acc, contaId) => acc + (mapaPeriodo.get(contaId) ?? 0), 0);
            colunas[p.chave] = total;
            totalGeral += total;
          }
        }

        return {
          id: Number(linha.FIN_ESTRUTURA_DRE_ID),
          paiId: linha.FIN_ESTRUTURA_DRE_PAI_ID,
          nome: linha.FIN_ESTRUTURA_DRE_NOME,
          codigo: String(linha.FIN_ESTRUTURA_DRE_CODIGO || ""),
          natureza: nat,
          formula: linha.FIN_ESTRUTURA_DRE_FORMULA || undefined,
          valor: totalGeral,
          colunas,
          filhos: [],
        } as DreLinha;
      });

      const arvore = construirArvore(linhas).map(somarFilhos);

      // Resolver fórmulas CALCULADO usando valores já computados
      // Montar mapa código → valor por período
      const valoresPorCodigoPeriodo = new Map<string, Map<string, number>>();
      for (const p of periodos) {
        valoresPorCodigoPeriodo.set(p.chave, new Map());
      }
      const coletarValoresPeriodo = (items: DreLinha[]) => {
        for (const item of items) {
          if (item.codigo && item.natureza !== "CALCULADO") {
            for (const p of periodos) {
              valoresPorCodigoPeriodo.get(p.chave)!.set(item.codigo, item.colunas[p.chave] ?? 0);
            }
          }
          if (item.filhos.length > 0) coletarValoresPeriodo(item.filhos);
        }
      };
      coletarValoresPeriodo(arvore);
      resolverFormulasPorPeriodo(arvore, valoresPorCodigoPeriodo, periodos.map((p) => p.chave));

      return NextResponse.json({
        success: true,
        data: arvore,
        periodos: periodos.map((p) => ({ chave: p.chave, label: p.label })),
      });
    }

    // Fallback: simple date range (original behavior)
    let sqlLancamentos = `
      SELECT FIN_PLANO_CONTA_ID, COALESCE(SUM(FIN_LANCAMENTO_VALOR), 0) as total
      FROM FIN_LANCAMENTO
      WHERE EMPRESA_ID = ?
    `;
    const lancArgs: any[] = [empresaId];

    if (dataInicio) {
      sqlLancamentos += ` AND FIN_LANCAMENTO_DATA >= ?`;
      lancArgs.push(dataInicio);
    }
    if (dataFim) {
      sqlLancamentos += ` AND FIN_LANCAMENTO_DATA <= ?`;
      lancArgs.push(dataFim);
    }
    sqlLancamentos += ` GROUP BY FIN_PLANO_CONTA_ID`;

    const lancResult = await db.execute({ sql: sqlLancamentos, args: lancArgs });

    const totaisConta = new Map<number, number>();
    (lancResult.rows ?? []).forEach((row: any) => {
      totaisConta.set(row.FIN_PLANO_CONTA_ID, Number(row.total ?? 0));
    });

    const linhas = (linhasResult.rows ?? []).map((linha: any) => {
      const nat = linha.FIN_ESTRUTURA_DRE_NATUREZA;
      const isCalculado = nat === "CALCULADO";
      const contas = contasPorLinha.get(Number(linha.FIN_ESTRUTURA_DRE_ID)) ?? [];
      const total = isCalculado ? 0 : contas.reduce((acc, contaId) => acc + (totaisConta.get(contaId) ?? 0), 0);
      return {
        id: Number(linha.FIN_ESTRUTURA_DRE_ID),
        paiId: linha.FIN_ESTRUTURA_DRE_PAI_ID,
        nome: linha.FIN_ESTRUTURA_DRE_NOME,
        codigo: String(linha.FIN_ESTRUTURA_DRE_CODIGO || ""),
        natureza: nat,
        formula: linha.FIN_ESTRUTURA_DRE_FORMULA || undefined,
        valor: total,
        colunas: {},
        filhos: [],
      } as DreLinha;
    });

    const arvore = construirArvore(linhas).map(somarFilhos);

    // Resolver fórmulas CALCULADO
    const valoresPorCodigo = new Map<string, number>();
    const coletarValores = (items: DreLinha[]) => {
      for (const item of items) {
        if (item.codigo && item.natureza !== "CALCULADO") {
          valoresPorCodigo.set(item.codigo, item.valor);
        }
        if (item.filhos.length > 0) coletarValores(item.filhos);
      }
    };
    coletarValores(arvore);
    resolverFormulas(arvore, valoresPorCodigo);

    return NextResponse.json({ success: true, data: arvore });
  } catch (error) {
    console.error("Erro ao buscar DRE:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar DRE" },
      { status: 500 }
    );
  }
}
