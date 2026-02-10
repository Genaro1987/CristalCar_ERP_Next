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
  referencia100?: boolean;
  valor: number;
  colunas: Record<string, number>;
  filhos: DreLinha[];
}

// ── Avaliador seguro de fórmulas (sem eval) ──
// Suporta: +, -, *, /, parênteses, códigos de linhas DRE
function avaliarFormula(formula: string, valoresPorCodigo: Map<string, number>): number {
  let expr = formula.replace(/[A-Za-z0-9_.]+/g, (token) => {
    // Primeiro tentar como código de linha DRE (ex: "1", "1.1", "6")
    const val = valoresPorCodigo.get(token);
    if (val !== undefined) return String(val);
    // Se não for código e for número puro, manter como literal
    if (/^\d+(\.\d+)?$/.test(token)) return token;
    return "0";
  });

  expr = expr.replace(/\s+/g, "");

  let pos = 0;

  function peek(): string {
    return pos < expr.length ? expr[pos] : "";
  }

  function consume(): string {
    return expr[pos++];
  }

  function parseExpr(): number {
    let result = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      result = op === "+" ? result + right : result - right;
    }
    return result;
  }

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

  function parseFactor(): number {
    if (peek() === "-") {
      consume();
      return -parseFactor();
    }
    if (peek() === "(") {
      consume();
      const result = parseExpr();
      if (peek() === ")") consume();
      return result;
    }
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

function gerarPeriodosRange(
  mesInicio: string,
  mesFim: string,
  visao: TipoVisao
): { chave: string; label: string; inicio: string; fim: string }[] {
  const periodos: { chave: string; label: string; inicio: string; fim: string }[] = [];

  const [anoIni, mesIni] = mesInicio.split("-").map(Number);
  const [anoFin, mesFin] = mesFim.split("-").map(Number);

  const mesesNome = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  if (visao === "mensal") {
    let a = anoIni, m = mesIni;
    while (a < anoFin || (a === anoFin && m <= mesFin)) {
      const mm = String(m).padStart(2, "0");
      const ultimoDia = new Date(a, m, 0).getDate();
      const label = anoIni === anoFin ? mesesNome[m - 1] : `${mesesNome[m - 1]}/${String(a).slice(2)}`;
      periodos.push({
        chave: `${a}-${mm}`,
        label,
        inicio: `${a}-${mm}-01`,
        fim: `${a}-${mm}-${ultimoDia}`,
      });
      m++;
      if (m > 12) { m = 1; a++; }
    }
  } else if (visao === "trimestral") {
    // Start from the trimester containing mesInicio
    let a = anoIni;
    let tInicio = Math.ceil(mesIni / 3);
    const tFim = Math.ceil(mesFin / 3);
    const aFim = anoFin;

    let t = tInicio;
    while (a < aFim || (a === aFim && t <= tFim)) {
      const mIni = (t - 1) * 3 + 1;
      const mFin = t * 3;
      const mmIni = String(mIni).padStart(2, "0");
      const mmFin = String(mFin).padStart(2, "0");
      const ultimoDia = new Date(a, mFin, 0).getDate();
      const label = anoIni === anoFin ? `${t}T` : `${t}T/${String(a).slice(2)}`;
      periodos.push({
        chave: `${a}-T${t}`,
        label,
        inicio: `${a}-${mmIni}-01`,
        fim: `${a}-${mmFin}-${ultimoDia}`,
      });
      t++;
      if (t > 4) { t = 1; a++; }
    }
  } else if (visao === "semestral") {
    let a = anoIni;
    let sInicio = mesIni <= 6 ? 1 : 2;
    const sFim = mesFin <= 6 ? 1 : 2;
    const aFim = anoFin;

    let s = sInicio;
    while (a < aFim || (a === aFim && s <= sFim)) {
      const mIni = s === 1 ? 1 : 7;
      const mFin = s === 1 ? 6 : 12;
      const mmIni = String(mIni).padStart(2, "0");
      const ultimoDia = new Date(a, mFin, 0).getDate();
      const label = anoIni === anoFin ? `${s}S` : `${s}S/${String(a).slice(2)}`;
      periodos.push({
        chave: `${a}-S${s}`,
        label,
        inicio: `${a}-${mmIni}-01`,
        fim: `${a}-${String(mFin).padStart(2, "0")}-${ultimoDia}`,
      });
      s++;
      if (s > 2) { s = 1; a++; }
    }
  } else {
    // anual
    for (let a = anoIni; a <= anoFin; a++) {
      periodos.push({
        chave: `${a}`,
        label: String(a),
        inicio: `${a}-01-01`,
        fim: `${a}-12-31`,
      });
    }
  }

  return periodos;
}

// Find the referencia100 code from the tree
function encontrarRef100(linhas: DreLinha[]): string | null {
  for (const linha of linhas) {
    if (linha.referencia100) return linha.codigo;
    if (linha.filhos.length > 0) {
      const found = encontrarRef100(linha.filhos);
      if (found) return found;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const params = request.nextUrl.searchParams;
  const mesInicio = params.get("mesInicio");
  const mesFim = params.get("mesFim");
  const visao = (params.get("visao") as TipoVisao | null) ?? "mensal";

  // Fallback: dataInicio/dataFim for backward compat
  const dataInicio = params.get("dataInicio");
  const dataFim = params.get("dataFim");

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
          FIN_ESTRUTURA_DRE_FORMULA,
          COALESCE(FIN_ESTRUTURA_DRE_REFERENCIA_100, 0) as FIN_ESTRUTURA_DRE_REFERENCIA_100
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

    // Period-based view with month range
    if (mesInicio && mesFim) {
      const periodos = gerarPeriodosRange(mesInicio, mesFim, visao);

      if (periodos.length === 0) {
        return NextResponse.json({ success: true, data: [], periodos: [] });
      }

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
          referencia100: Number(linha.FIN_ESTRUTURA_DRE_REFERENCIA_100) === 1,
          valor: totalGeral,
          colunas,
          filhos: [],
        } as DreLinha;
      });

      const arvore = construirArvore(linhas).map(somarFilhos);

      // Resolver fórmulas CALCULADO
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

      // Find ref100 code
      const ref100Codigo = encontrarRef100(arvore);

      return NextResponse.json({
        success: true,
        data: arvore,
        periodos: periodos.map((p) => ({ chave: p.chave, label: p.label })),
        referencia100Codigo: ref100Codigo,
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
        referencia100: Number(linha.FIN_ESTRUTURA_DRE_REFERENCIA_100) === 1,
        valor: total,
        colunas: {},
        filhos: [],
      } as DreLinha;
    });

    const arvore = construirArvore(linhas).map(somarFilhos);

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

    const ref100Codigo = encontrarRef100(arvore);

    return NextResponse.json({ success: true, data: arvore, referencia100Codigo: ref100Codigo });
  } catch (error) {
    console.error("Erro ao buscar DRE:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar DRE" },
      { status: 500 }
    );
  }
}
