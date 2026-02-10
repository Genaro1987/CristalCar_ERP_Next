import type { Row } from "@libsql/client";

import { db } from "./client";
import {
  calcularMinutosJornadaDiaria,
  calcularMinutosTrabalhados,
  calcularSaldoDia,
  criarDataLocal,
  determinarTipoDia,
  gerarDiasDaCompetencia,
  gerarIntervaloCompetencia,
  normalizarToleranciaMinutos,
} from "@/lib/rhPontoCalculo";
import { resumirTotaisDias } from "@/lib/bancoHorasHelpers";

export type PoliticaFaltas =
  | "COMPENSAR_COM_HORAS_EXTRAS"
  | "DESCONTAR_EM_FOLHA";

export interface ParametrosCalculoBancoHoras {
  idFuncionario: string;
  empresaId: number;
  ano: number;
  mes: number;
  politicaFaltas: PoliticaFaltas;
  zerarBancoNoMes: boolean;
}

/** Busca feriados cadastrados na RH_FERIADO e retorna Set de "DD-MM" */
async function buscarFeriadosEmpresa(empresaId: number): Promise<Set<string>> {
  const resultado = await db.execute({
    sql: `SELECT FERIADO_DIA, FERIADO_MES FROM RH_FERIADO WHERE ID_EMPRESA = ? AND FERIADO_ATIVO = 1`,
    args: [empresaId],
  });
  const set = new Set<string>();
  for (const row of (resultado.rows ?? []) as Row[]) {
    const dia = String(row.FERIADO_DIA).padStart(2, "0");
    const mes = String(row.FERIADO_MES).padStart(2, "0");
    set.add(`${dia}-${mes}`);
  }
  return set;
}

/** Verifica se uma data (YYYY-MM-DD) cai em um feriado cadastrado */
function isFeriadoCadastrado(dataReferencia: string, feriadosSet: Set<string>): boolean {
  const partes = dataReferencia.split("-");
  if (partes.length < 3) return false;
  const dia = partes[2];
  const mes = partes[1];
  return feriadosSet.has(`${dia}-${mes}`);
}

export interface ResumoBancoHorasDia {
  data: string;
  diaSemana: string;
  tipoDia: "UTIL" | "SABADO" | "DOMINGO" | "FERIADO";
  jornadaPrevistaMin: number;
  trabalhadoMin: number;
  diferencaMin: number;
  classificacao:
    | "NORMAL"
    | "EXTRA_UTIL"
    | "EXTRA_100"
    | "DEVEDOR"
    | "FALTA_JUSTIFICADA"
    | "FALTA_NAO_JUSTIFICADA";
  impactoBancoMin: number;
  observacao?: string;
}

export interface MovimentoBancoHoras {
  id: number;
  idFuncionario: string;
  data: string;
  tipo: "AJUSTE_MANUAL" | "FECHAMENTO_PAGAR" | "FECHAMENTO_DESCONTAR" | "SISTEMA";
  minutos: number;
  observacao?: string | null;
}

export interface ResumoBancoHorasMes {
  funcionario: {
    id: string;
    nome: string;
    idDepartamento: number | null;
    nomeDepartamento: string | null;
    salarioBase: number;
    cargaHorariaMensalHoras: number;
    valorHora: number;
  };
  competencia: { ano: number; mes: number };
  jornada: {
    entradaManha: string | null;
    saidaManha: string | null;
    entradaTarde: string | null;
    saidaTarde: string | null;
    entradaIntervalo: string | null;
    saidaIntervalo: string | null;
    minutosPrevistos: number | null;
    toleranciaMinutos: number;
  } | null;
  saldoAnteriorMin: number;
  extrasUteisMin: number;
  extras100Min: number;
  devidasMin: number;
  ajustesManuaisMin: number;
  fechamentosMin: number;
  saldoTecnicoMin: number;
  horasPagar50Min: number;
  horasPagar100Min: number;
  horasDescontarMin: number;
  saldoFinalBancoMin: number;
  /** Detalhamento da compensação extras vs faltas */
  compensacao: {
    /** Minutos de 100% usados para abater faltas */
    consumo100Min: number;
    /** Minutos de 50% usados para abater faltas */
    consumo50Min: number;
    /** Minutos do saldo anterior usados para abater faltas */
    consumoSaldoAnteriorMin: number;
    /** Saldo anterior restante após compensação */
    saldoAnteriorRestanteMin: number;
  };
  dias: ResumoBancoHorasDia[];
  movimentos: MovimentoBancoHoras[];
}

export interface ResumoBancoHorasFuncionario {
  ID_FUNCIONARIO: string;
  NOME_FUNCIONARIO: string;
  ID_DEPARTAMENTO?: number | null;
  NOME_DEPARTAMENTO?: string | null;
  SALDO_ANTERIOR_MIN: number;
  CREDITOS_MES_MIN: number;
  DEBITOS_MES_MIN: number;
  AJUSTES_MANUAIS_MIN: number;
  AJUSTES_FECHAMENTO_MIN: number;
  HORAS_PAGAS_FDS_FERIADO_MIN: number;
  SALDO_ATUAL_MIN: number;
}

interface FuncionarioComJornada {
  id: string;
  nome: string;
  idDepartamento: number | null;
  nomeDepartamento: string | null;
  minutosJornadaDia: number | null;
  toleranciaMinutos: number;
}

function mapearFuncionarios(rows: Row[]): FuncionarioComJornada[] {
  return rows.map((row) => {
    const idDepartamento =
      row.ID_DEPARTAMENTO === null || row.ID_DEPARTAMENTO === undefined
        ? null
        : Number(row.ID_DEPARTAMENTO);

    const nomeDepartamento =
      row.NOME_DEPARTAMENTO === null || row.NOME_DEPARTAMENTO === undefined
        ? null
        : String(row.NOME_DEPARTAMENTO);

    return {
      id: String(row.ID_FUNCIONARIO),
      nome: String(row.NOME_COMPLETO),
      idDepartamento,
      nomeDepartamento,
      minutosJornadaDia:
        calcularMinutosJornadaDiaria({
          HORA_ENTRADA_MANHA: (row.HORA_ENTRADA_MANHA as string | null | undefined) ?? null,
          HORA_SAIDA_MANHA: (row.HORA_SAIDA_MANHA as string | null | undefined) ?? null,
          HORA_ENTRADA_TARDE: (row.HORA_ENTRADA_TARDE as string | null | undefined) ?? null,
          HORA_SAIDA_TARDE: (row.HORA_SAIDA_TARDE as string | null | undefined) ?? null,
          HORA_ENTRADA_INTERVALO:
            (row.HORA_ENTRADA_INTERVALO as string | null | undefined) ?? null,
          HORA_SAIDA_INTERVALO:
            (row.HORA_SAIDA_INTERVALO as string | null | undefined) ?? null,
        }) ?? null,
      toleranciaMinutos: normalizarToleranciaMinutos(
        (row.TOLERANCIA_MINUTOS as number | null | undefined) ?? 0
      ),
    };
  });
}

function construirMapaLancamentos(rows: Row[]) {
  const mapa = new Map<string, Map<string, Row>>();

  rows.forEach((row) => {
    const funcionarioId = String(row.ID_FUNCIONARIO);
    const data = String(row.DATA_REFERENCIA);

    if (!mapa.has(funcionarioId)) {
      mapa.set(funcionarioId, new Map());
    }

    mapa.get(funcionarioId)?.set(data, row);
  });

  return mapa;
}

export async function listarResumoBancoHorasPorFuncionario(
  empresaId: number,
  competencia: string,
  filtros?: { idFuncionario?: string; idDepartamento?: number }
): Promise<ResumoBancoHorasFuncionario[]> {
  const intervalo = gerarIntervaloCompetencia(competencia);

  if (!intervalo) {
    throw new Error("Competência inválida. Use o formato YYYY-MM.");
  }

  const filtrosFuncionario: string[] = ["f.ID_EMPRESA = ?", "f.ATIVO = 1"];
  const argsFuncionarios: (string | number)[] = [empresaId];

  if (filtros?.idFuncionario) {
    filtrosFuncionario.push("f.ID_FUNCIONARIO = ?");
    argsFuncionarios.push(filtros.idFuncionario);
  }

  if (Number.isFinite(filtros?.idDepartamento)) {
    filtrosFuncionario.push("f.ID_DEPARTAMENTO = ?");
    argsFuncionarios.push(Number(filtros?.idDepartamento));
  }

  const funcionariosResultado = await db.execute({
    sql: `
      SELECT f.ID_FUNCIONARIO,
             f.NOME_COMPLETO,
             f.ID_DEPARTAMENTO,
             d.NOME_DEPARTAMENTO,
             j.HORA_ENTRADA_MANHA,
             j.HORA_SAIDA_MANHA,
             j.HORA_ENTRADA_TARDE,
             j.HORA_SAIDA_TARDE,
             j.HORA_ENTRADA_INTERVALO,
             j.HORA_SAIDA_INTERVALO,
             j.TOLERANCIA_MINUTOS
        FROM RH_FUNCIONARIO f
        LEFT JOIN EMP_DEPARTAMENTO d
          ON d.ID_DEPARTAMENTO = f.ID_DEPARTAMENTO
         AND d.ID_EMPRESA = f.ID_EMPRESA
        LEFT JOIN RH_JORNADA_TRABALHO j
          ON j.ID_JORNADA = f.ID_JORNADA
         AND j.ID_EMPRESA = f.ID_EMPRESA
       WHERE ${filtrosFuncionario.join(" AND ")}
       ORDER BY f.NOME_COMPLETO
    `,
    args: argsFuncionarios,
  });

  const funcionarios = mapearFuncionarios((funcionariosResultado.rows ?? []) as Row[]);

  if (!funcionarios.length) return [];

  const idsFuncionarios = funcionarios.map((f) => f.id);
  const placeholders = idsFuncionarios.map(() => "?").join(", ");

  const ajustesResultado = await db.execute({
    sql: `
      SELECT ID_FUNCIONARIO, COMPETENCIA, MINUTOS, TIPO_AJUSTE
        FROM RH_BANCO_HORAS_AJUSTE
       WHERE ID_EMPRESA = ?
         AND COMPETENCIA <= ?
         AND ID_FUNCIONARIO IN (${placeholders})
    `,
    args: [empresaId, competencia, ...idsFuncionarios],
  });

  const ajustesRows = (ajustesResultado.rows ?? []) as Row[];
  const saldoAnteriorPorFuncionario = new Map<string, number>();
  const ajustesMesPorFuncionario = new Map<
    string,
    { manuais: number; fechamento: number }
  >();

  ajustesRows.forEach((row) => {
    const funcionarioId = String(row.ID_FUNCIONARIO);
    const comp = String(row.COMPETENCIA);
    const minutos = Number(row.MINUTOS ?? 0);
    const tipo = String(row.TIPO_AJUSTE ?? "");

    if (comp < competencia) {
      saldoAnteriorPorFuncionario.set(
        funcionarioId,
        (saldoAnteriorPorFuncionario.get(funcionarioId) ?? 0) + minutos
      );
      return;
    }

    const atual = ajustesMesPorFuncionario.get(funcionarioId) ?? { manuais: 0, fechamento: 0 };

    if (tipo === "MANUAL") {
      atual.manuais += minutos;
    } else if (tipo) {
      atual.fechamento += minutos;
    }

    ajustesMesPorFuncionario.set(funcionarioId, atual);
  });

  const lancamentosResultado = await db.execute({
    sql: `
      SELECT ID_FUNCIONARIO,
             DATA_REFERENCIA,
             ENTRADA_MANHA,
             SAIDA_MANHA,
             ENTRADA_TARDE,
             SAIDA_TARDE,
             ENTRADA_EXTRA,
             SAIDA_EXTRA,
             TIPO_OCORRENCIA,
             COALESCE(E_FERIADO, 'N') as E_FERIADO
        FROM RH_PONTO_LANCAMENTO
       WHERE ID_EMPRESA = ?
         AND DATA_REFERENCIA BETWEEN ? AND ?
         AND ID_FUNCIONARIO IN (${placeholders})
    `,
    args: [empresaId, intervalo.inicio, intervalo.fim, ...idsFuncionarios],
  });

  const diasCompetencia = gerarDiasDaCompetencia(competencia);
  const mapaLancamentos = construirMapaLancamentos((lancamentosResultado.rows ?? []) as Row[]);
  const feriadosSet = await buscarFeriadosEmpresa(empresaId);

  const resumo: ResumoBancoHorasFuncionario[] = funcionarios.map((funcionario) => {
    const ajustesFuncionario = ajustesMesPorFuncionario.get(funcionario.id) ?? {
      manuais: 0,
      fechamento: 0,
    };
    let creditos = 0;
    let debitos = 0;
    let horasPagasFeriado = 0;

    diasCompetencia.forEach((dataReferencia) => {
      const registro = mapaLancamentos.get(funcionario.id)?.get(dataReferencia);
      const tipoOcorrencia = registro?.TIPO_OCORRENCIA?.toString().toUpperCase() ?? "NORMAL";
      const eFeriadoLanc = (registro?.E_FERIADO as string | undefined) === "S";
      const eFeriadoTabela = isFeriadoCadastrado(dataReferencia, feriadosSet);
      const eFeriado = (eFeriadoLanc || eFeriadoTabela) ? "S" : "N";
      const tipoDia = determinarTipoDia(dataReferencia, eFeriado);

      const minutosTrabalhados =
        tipoOcorrencia !== "NORMAL"
          ? 0
          : calcularMinutosTrabalhados({
              entradaManha: (registro?.ENTRADA_MANHA as string | null | undefined) ?? null,
              saidaManha: (registro?.SAIDA_MANHA as string | null | undefined) ?? null,
              entradaTarde: (registro?.ENTRADA_TARDE as string | null | undefined) ?? null,
              saidaTarde: (registro?.SAIDA_TARDE as string | null | undefined) ?? null,
              entradaExtra: (registro?.ENTRADA_EXTRA as string | null | undefined) ?? null,
              saidaExtra: (registro?.SAIDA_EXTRA as string | null | undefined) ?? null,
            });

      // Férias: ignorar dia (sem débito no banco de horas)
      if (tipoOcorrencia === "FERIAS") return;

      const { saldoBancoMinutos, minutosPagosFeriadoFds } = calcularSaldoDia(
        tipoDia,
        minutosTrabalhados,
        funcionario.minutosJornadaDia,
        funcionario.toleranciaMinutos
      );

      if (saldoBancoMinutos > 0) {
        creditos += saldoBancoMinutos;
      } else {
        debitos += saldoBancoMinutos;
      }

      horasPagasFeriado += minutosPagosFeriadoFds;
    });

    const saldoAnterior = saldoAnteriorPorFuncionario.get(funcionario.id) ?? 0;
    const ajustesManuais = ajustesFuncionario.manuais;
    const ajustesFechamento = ajustesFuncionario.fechamento;
    const saldoAtual =
      saldoAnterior + creditos + debitos + ajustesManuais + ajustesFechamento;

    return {
      ID_FUNCIONARIO: funcionario.id,
      NOME_FUNCIONARIO: funcionario.nome,
      ID_DEPARTAMENTO: funcionario.idDepartamento,
      NOME_DEPARTAMENTO: funcionario.nomeDepartamento,
      SALDO_ANTERIOR_MIN: saldoAnterior,
      CREDITOS_MES_MIN: creditos,
      DEBITOS_MES_MIN: debitos,
      AJUSTES_MANUAIS_MIN: ajustesManuais,
      AJUSTES_FECHAMENTO_MIN: ajustesFechamento,
      HORAS_PAGAS_FDS_FERIADO_MIN: horasPagasFeriado,
      SALDO_ATUAL_MIN: saldoAtual,
    };
  });

  return resumo;
}

function competenciaFromParams(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function mapTipoAjuste(tipo?: string | null): MovimentoBancoHoras["tipo"] {
  const upper = (tipo ?? "").toUpperCase();

  if (upper === "AJUSTE_MANUAL" || upper === "MANUAL") return "AJUSTE_MANUAL";
  if (upper === "FECHAMENTO_PAGAR") return "FECHAMENTO_PAGAR";
  if (upper === "FECHAMENTO_DESCONTAR") return "FECHAMENTO_DESCONTAR";
  return "SISTEMA";
}

function tipoDiaDescricao(
  valor: ReturnType<typeof determinarTipoDia>
): "UTIL" | "SABADO" | "DOMINGO" | "FERIADO" {
  if (valor === "FERIADO") return "FERIADO";
  if (valor === "SABADO") return "SABADO";
  if (valor === "DOMINGO") return "DOMINGO";
  return "UTIL";
}

function diaDaSemana(data: string): string {
  const d = criarDataLocal(data);
  const nomes = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
  return nomes[d.getDay()] ?? "";
}

interface LancamentoDia {
  data: string;
  entradaManha?: string | null;
  saidaManha?: string | null;
  entradaTarde?: string | null;
  saidaTarde?: string | null;
  entradaExtra?: string | null;
  saidaExtra?: string | null;
  tipoOcorrencia?: string | null;
  eFeriado?: string | null;
}

async function buscarLancamentos(
  idFuncionario: string,
  intervalo: { inicio: string; fim: string }
): Promise<Map<string, LancamentoDia>> {
  const resultado = await db.execute({
    sql: `
      SELECT DATA_REFERENCIA,
             ENTRADA_MANHA,
             SAIDA_MANHA,
             ENTRADA_TARDE,
             SAIDA_TARDE,
             ENTRADA_EXTRA,
             SAIDA_EXTRA,
             TIPO_OCORRENCIA,
             COALESCE(E_FERIADO, 'N') AS E_FERIADO
        FROM RH_PONTO_LANCAMENTO
       WHERE ID_FUNCIONARIO = ?
         AND DATA_REFERENCIA BETWEEN ? AND ?
    `,
    args: [idFuncionario, intervalo.inicio, intervalo.fim],
  });

  const mapa = new Map<string, LancamentoDia>();
  ((resultado.rows ?? []) as Row[]).forEach((row) => {
    mapa.set(String(row.DATA_REFERENCIA), {
      data: String(row.DATA_REFERENCIA),
      entradaManha: (row.ENTRADA_MANHA as string | null | undefined) ?? null,
      saidaManha: (row.SAIDA_MANHA as string | null | undefined) ?? null,
      entradaTarde: (row.ENTRADA_TARDE as string | null | undefined) ?? null,
      saidaTarde: (row.SAIDA_TARDE as string | null | undefined) ?? null,
      entradaExtra: (row.ENTRADA_EXTRA as string | null | undefined) ?? null,
      saidaExtra: (row.SAIDA_EXTRA as string | null | undefined) ?? null,
      tipoOcorrencia: (row.TIPO_OCORRENCIA as string | null | undefined) ?? null,
      eFeriado: (row.E_FERIADO as string | null | undefined) ?? null,
    });
  });

  return mapa;
}

async function buscarMovimentos(
  idFuncionario: string,
  competencia: string
): Promise<{ movimentos: MovimentoBancoHoras[]; saldoAnterior: number; ajustesMes: number; fechamentosMes: number }>
{
  const resultado = await db.execute({
    sql: `
      SELECT ID_AJUSTE,
             COMPETENCIA,
             MINUTOS,
             TIPO_AJUSTE,
             OBSERVACAO,
             DATA_CRIACAO
        FROM RH_BANCO_HORAS_AJUSTE
       WHERE ID_FUNCIONARIO = ?
         AND COMPETENCIA <= ?
       ORDER BY DATA_CRIACAO ASC
    `,
    args: [idFuncionario, competencia],
  });

  const movimentos: MovimentoBancoHoras[] = [];
  let saldoAnterior = 0;
  let ajustesMes = 0;
  let fechamentosMes = 0;

  ((resultado.rows ?? []) as Row[]).forEach((row) => {
    const comp = String(row.COMPETENCIA);
    const minutos = Number(row.MINUTOS ?? 0);
    const movimento: MovimentoBancoHoras = {
      id: Number(row.ID_AJUSTE ?? 0),
      idFuncionario: idFuncionario,
      data: String(row.DATA_CRIACAO ?? `${comp}-01`),
      tipo: mapTipoAjuste(row.TIPO_AJUSTE as string | null | undefined),
      minutos,
      observacao: (row.OBSERVACAO as string | null | undefined) ?? null,
    };

    if (comp < competencia) {
      saldoAnterior += minutos;
    } else if (comp === competencia) {
      if (movimento.tipo === "AJUSTE_MANUAL") ajustesMes += minutos;
      if (movimento.tipo === "FECHAMENTO_PAGAR" || movimento.tipo === "FECHAMENTO_DESCONTAR") {
        fechamentosMes += minutos;
      }
      movimentos.push(movimento);
    }
  });

  return { movimentos, saldoAnterior, ajustesMes, fechamentosMes };
}

async function buscarDadosFuncionario(idFuncionario: string) {
  const resultado = await db.execute({
    sql: `
      SELECT f.ID_FUNCIONARIO,
             f.NOME_COMPLETO,
             f.ID_DEPARTAMENTO,
             d.NOME_DEPARTAMENTO,
             f.CARGA_HORARIA_MENSAL_REFERENCIA,
             f.SALARIO_BASE,
             j.HORA_ENTRADA_MANHA,
             j.HORA_SAIDA_MANHA,
             j.HORA_ENTRADA_TARDE,
             j.HORA_SAIDA_TARDE,
             j.HORA_ENTRADA_INTERVALO,
             j.HORA_SAIDA_INTERVALO,
             j.TOLERANCIA_MINUTOS
        FROM RH_FUNCIONARIO f
        LEFT JOIN EMP_DEPARTAMENTO d ON d.ID_DEPARTAMENTO = f.ID_DEPARTAMENTO
        LEFT JOIN RH_JORNADA_TRABALHO j ON j.ID_JORNADA = f.ID_JORNADA
       WHERE f.ID_FUNCIONARIO = ?
    `,
    args: [idFuncionario],
  });

  const row = (resultado.rows?.[0] ?? null) as Row | null;
  if (!row) return null;

  return {
    id: String(row.ID_FUNCIONARIO),
    nome: String(row.NOME_COMPLETO),
    idDepartamento:
      row.ID_DEPARTAMENTO === null || row.ID_DEPARTAMENTO === undefined
        ? null
        : Number(row.ID_DEPARTAMENTO),
    nomeDepartamento:
      row.NOME_DEPARTAMENTO === null || row.NOME_DEPARTAMENTO === undefined
        ? null
        : String(row.NOME_DEPARTAMENTO),
    cargaHorariaMensalHoras: Number(row.CARGA_HORARIA_MENSAL_REFERENCIA ?? 0),
    salarioBase: Number(row.SALARIO_BASE ?? 0),
    jornada: {
      HORA_ENTRADA_MANHA: (row.HORA_ENTRADA_MANHA as string | null | undefined) ?? null,
      HORA_SAIDA_MANHA: (row.HORA_SAIDA_MANHA as string | null | undefined) ?? null,
      HORA_ENTRADA_TARDE: (row.HORA_ENTRADA_TARDE as string | null | undefined) ?? null,
      HORA_SAIDA_TARDE: (row.HORA_SAIDA_TARDE as string | null | undefined) ?? null,
      HORA_ENTRADA_INTERVALO:
        (row.HORA_ENTRADA_INTERVALO as string | null | undefined) ?? null,
      HORA_SAIDA_INTERVALO: (row.HORA_SAIDA_INTERVALO as string | null | undefined) ?? null,
      TOLERANCIA_MINUTOS: (row.TOLERANCIA_MINUTOS as number | null | undefined) ?? 0,
    },
  };
}

async function buscarSalarioCompetencia(idFuncionario: string, competencia: string, fallback: number) {
  const intervalo = gerarIntervaloCompetencia(competencia);
  if (!intervalo) return fallback;

  const resultado = await db.execute({
    sql: `
      SELECT VALOR
        FROM RH_FUNCIONARIO_SALARIO
       WHERE ID_FUNCIONARIO = ?
         AND DATA_INICIO_VIGENCIA <= ?
         AND (DATA_FIM_VIGENCIA IS NULL OR DATA_FIM_VIGENCIA >= ?)
       ORDER BY DATA_INICIO_VIGENCIA DESC
       LIMIT 1
    `,
    args: [idFuncionario, intervalo.fim, intervalo.inicio],
  });

  const valor = ((resultado.rows?.[0] as Row | undefined)?.VALOR ?? null) as number | null;
  return Number.isFinite(valor) ? Number(valor) : fallback;
}

export async function calcularBancoHorasMes(
  params: ParametrosCalculoBancoHoras
): Promise<ResumoBancoHorasMes> {
  const competencia = competenciaFromParams(params.ano, params.mes);
  const intervalo = gerarIntervaloCompetencia(competencia);

  if (!intervalo) {
    throw new Error("Competência inválida");
  }

  const funcionarioBase = await buscarDadosFuncionario(params.idFuncionario);

  if (!funcionarioBase) {
    throw new Error("Funcionário não encontrado");
  }

  const salarioBase = await buscarSalarioCompetencia(
    params.idFuncionario,
    competencia,
    funcionarioBase.salarioBase
  );

  const minutosJornadaDia = calcularMinutosJornadaDiaria(funcionarioBase.jornada);
  const toleranciaMinutos = normalizarToleranciaMinutos(
    funcionarioBase.jornada?.TOLERANCIA_MINUTOS ?? 0
  );

  const dias = gerarDiasDaCompetencia(competencia);
  const lancamentos = await buscarLancamentos(params.idFuncionario, intervalo);
  const movimentosInfo = await buscarMovimentos(params.idFuncionario, competencia);
  const feriadosSet = await buscarFeriadosEmpresa(params.empresaId);

  const diasResumo: ResumoBancoHorasDia[] = dias.map((data) => {
    const registro = lancamentos.get(data);
    const tipoOcorrencia = registro?.tipoOcorrencia?.toUpperCase() ?? "NORMAL";
    const eFeriadoLanc = (registro?.eFeriado as string | undefined) === "S";
    const eFeriadoTabela = isFeriadoCadastrado(data, feriadosSet);
    const eFeriado = (eFeriadoLanc || eFeriadoTabela) ? "S" : "N";
    const tipoDiaBase = determinarTipoDia(data, eFeriado);
    const tipoDia = tipoDiaDescricao(tipoDiaBase);
    const minutosTrabalhados =
      tipoOcorrencia !== "NORMAL"
        ? 0
        : calcularMinutosTrabalhados({
            entradaManha: registro?.entradaManha,
            saidaManha: registro?.saidaManha,
            entradaTarde: registro?.entradaTarde,
            saidaTarde: registro?.saidaTarde,
            entradaExtra: registro?.entradaExtra,
            saidaExtra: registro?.saidaExtra,
          });

    // Férias: dia não conta como jornada prevista (sem débito no banco)
    const isFerias = tipoOcorrencia === "FERIAS";
    const jornadaPrevistaMin = (tipoDia === "UTIL" && !isFerias) ? minutosJornadaDia ?? 0 : 0;
    const diferencaBruta = minutosTrabalhados - jornadaPrevistaMin;
    const diferencaMin = Math.abs(diferencaBruta) <= toleranciaMinutos ? 0 : diferencaBruta;

    let classificacao: ResumoBancoHorasDia["classificacao"] = "NORMAL";
    let impactoBancoMin = 0;

    const faltaJustificada = tipoOcorrencia === "FALTA_JUSTIFICADA";
    const faltaNaoJustificada = tipoOcorrencia === "FALTA_NAO_JUSTIFICADA";

    if (isFerias) {
      // Férias: sem impacto no banco de horas
      classificacao = "NORMAL";
      impactoBancoMin = 0;
    } else if (faltaJustificada || faltaNaoJustificada) {
      classificacao = faltaJustificada ? "FALTA_JUSTIFICADA" : "FALTA_NAO_JUSTIFICADA";
      impactoBancoMin = diferencaMin < 0 ? diferencaMin : -Math.abs(jornadaPrevistaMin);
    } else if (tipoDia === "FERIADO" || tipoDia === "DOMINGO" || tipoDia === "SABADO") {
      classificacao = minutosTrabalhados > 0 ? "EXTRA_100" : "NORMAL";
      impactoBancoMin = minutosTrabalhados;
    } else if (diferencaMin > 0) {
      classificacao = "EXTRA_UTIL";
      impactoBancoMin = diferencaMin;
    } else if (diferencaMin < 0) {
      classificacao = "DEVEDOR";
      impactoBancoMin = diferencaMin;
    }

    return {
      data,
      diaSemana: diaDaSemana(data),
      tipoDia,
      jornadaPrevistaMin,
      trabalhadoMin: minutosTrabalhados,
      diferencaMin,
      classificacao,
      impactoBancoMin,
      observacao: registro?.tipoOcorrencia ?? undefined,
    };
  });

  const valorHora = funcionarioBase.cargaHorariaMensalHoras
    ? salarioBase / funcionarioBase.cargaHorariaMensalHoras
    : 0;

  const { saldoAnterior, ajustesMes, fechamentosMes, movimentos } = movimentosInfo;

  const { extras50Min: extrasUteisMin, extras100Min, devidasMin } = resumirTotaisDias(diasResumo);

  const saldoTecnicoMin =
    saldoAnterior + extrasUteisMin + extras100Min + devidasMin + ajustesMes + fechamentosMes;

  let horasPagar50Min = Math.max(0, extrasUteisMin);
  let horasPagar100Min = Math.max(0, extras100Min);
  let horasDescontarMin = Math.abs(Math.min(0, devidasMin));

  // Detalhamento da compensação
  let consumo100Min = 0;
  let consumo50Min = 0;
  let consumoSaldoAnteriorMin = 0;
  let saldoAnteriorRestanteMin = saldoAnterior;

  if (params.politicaFaltas === "COMPENSAR_COM_HORAS_EXTRAS") {
    let debito = horasDescontarMin;
    let extra100Disponivel = horasPagar100Min;
    let extraUtilDisponivel = horasPagar50Min;
    let saldoAntDisponivel = Math.max(0, saldoAnterior);

    // 1) Primeiro: abater com extras 100% (mais caras)
    consumo100Min = Math.min(extra100Disponivel, debito);
    extra100Disponivel -= consumo100Min;
    debito -= consumo100Min;

    // 2) Depois: abater com extras 50%
    consumo50Min = Math.min(extraUtilDisponivel, debito);
    extraUtilDisponivel -= consumo50Min;
    debito -= consumo50Min;

    // 3) Por último: abater com saldo anterior (se positivo)
    consumoSaldoAnteriorMin = Math.min(saldoAntDisponivel, debito);
    saldoAntDisponivel -= consumoSaldoAnteriorMin;
    debito -= consumoSaldoAnteriorMin;

    horasPagar50Min = extraUtilDisponivel;
    horasPagar100Min = extra100Disponivel;
    horasDescontarMin = debito;
    saldoAnteriorRestanteMin = saldoAnterior - consumoSaldoAnteriorMin;
  }

  const saldoFinalBancoMin = params.zerarBancoNoMes ? 0 : saldoTecnicoMin;

  return {
    funcionario: {
      id: funcionarioBase.id,
      nome: funcionarioBase.nome,
      idDepartamento: funcionarioBase.idDepartamento,
      nomeDepartamento: funcionarioBase.nomeDepartamento,
      salarioBase,
      cargaHorariaMensalHoras: funcionarioBase.cargaHorariaMensalHoras,
      valorHora,
    },
    competencia: { ano: params.ano, mes: params.mes },
    jornada: funcionarioBase.jornada
      ? {
          entradaManha: funcionarioBase.jornada.HORA_ENTRADA_MANHA,
          saidaManha: funcionarioBase.jornada.HORA_SAIDA_MANHA,
          entradaTarde: funcionarioBase.jornada.HORA_ENTRADA_TARDE,
          saidaTarde: funcionarioBase.jornada.HORA_SAIDA_TARDE,
          entradaIntervalo: funcionarioBase.jornada.HORA_ENTRADA_INTERVALO,
          saidaIntervalo: funcionarioBase.jornada.HORA_SAIDA_INTERVALO,
          minutosPrevistos: minutosJornadaDia,
          toleranciaMinutos,
        }
      : null,
    saldoAnteriorMin: saldoAnterior,
    extrasUteisMin,
    extras100Min,
    devidasMin,
    ajustesManuaisMin: ajustesMes,
    fechamentosMin: fechamentosMes,
    saldoTecnicoMin,
    horasPagar50Min,
    horasPagar100Min,
    horasDescontarMin,
    saldoFinalBancoMin,
    compensacao: {
      consumo100Min,
      consumo50Min,
      consumoSaldoAnteriorMin,
      saldoAnteriorRestanteMin,
    },
    dias: diasResumo,
    movimentos,
  };
}
