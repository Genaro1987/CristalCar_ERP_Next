import type { Row } from "@libsql/client";

import { db } from "./client";
import {
  calcularMinutosJornadaDiaria,
  calcularMinutosTrabalhados,
  calcularSaldoDia,
  determinarTipoDia,
  gerarDiasDaCompetencia,
  gerarIntervaloCompetencia,
  normalizarToleranciaMinutos,
} from "@/lib/rhPontoCalculo";

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

    return {
      id: String(row.ID_FUNCIONARIO),
      nome: String(row.NOME_COMPLETO),
      idDepartamento,
      nomeDepartamento:
        row.NOME_DEPARTAMENTO === null || row.NOME_DEPARTAMENTO === undefined
          ? null
          : String(row.NOME_DEPARTAMENTO),
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
      const eFeriado = (registro?.E_FERIADO as string | undefined) === "S" ? "S" : "N";
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
