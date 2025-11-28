export type FlagSimNao = 'S' | 'N';

export type TipoDia = 'DIA_UTIL' | 'FIM_DE_SEMANA' | 'FERIADO';

export function parseHoraParaMinutos(hora?: string | null): number | null {
  if (!hora || !hora.includes(':')) return null;

  const [h, m] = hora.split(':').map(Number);

  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

  return h * 60 + m;
}

export function minutosParaHora(minutos?: number | null): string {
  if (!Number.isFinite(minutos)) return '00:00';

  const total = minutos ?? 0;
  const sinal = total < 0 ? '-' : '';
  const valorAbsoluto = Math.abs(total);
  const horas = Math.floor(valorAbsoluto / 60);
  const min = valorAbsoluto % 60;

  return `${sinal}${String(horas).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function normalizarToleranciaMinutos(valor?: number | null): number {
  const numero = Number(valor ?? 0);

  if (!Number.isFinite(numero) || numero <= 0) {
    return 0;
  }

  return Math.max(0, Math.trunc(numero));
}

function diff(inicio: number | null, fim: number | null) {
  return inicio != null && fim != null && fim > inicio ? fim - inicio : 0;
}

export function calcularMinutosTrabalhados(dia: {
  entradaManha?: string | null;
  saidaManha?: string | null;
  entradaTarde?: string | null;
  saidaTarde?: string | null;
  entradaExtra?: string | null;
  saidaExtra?: string | null;
}): number {
  const em = parseHoraParaMinutos(dia.entradaManha);
  const sm = parseHoraParaMinutos(dia.saidaManha);
  const et = parseHoraParaMinutos(dia.entradaTarde);
  const st = parseHoraParaMinutos(dia.saidaTarde);
  const ei = parseHoraParaMinutos(dia.entradaExtra);
  const si = parseHoraParaMinutos(dia.saidaExtra);

  return diff(em, sm) + diff(et, st) - diff(ei, si);
}

export function determinarTipoDia(dataReferencia: string, eFeriado?: FlagSimNao): TipoDia {
  if (eFeriado === 'S') {
    return 'FERIADO';
  }

  const data = new Date(dataReferencia);
  const diaSemana = data.getDay();

  if (diaSemana === 0 || diaSemana === 6) {
    return 'FIM_DE_SEMANA';
  }

  return 'DIA_UTIL';
}

export function calcularMinutosJornadaDiaria(jornada?: {
  HORA_ENTRADA_MANHA?: string | null;
  HORA_SAIDA_MANHA?: string | null;
  HORA_ENTRADA_TARDE?: string | null;
  HORA_SAIDA_TARDE?: string | null;
  HORA_ENTRADA_INTERVALO?: string | null;
  HORA_SAIDA_INTERVALO?: string | null;
}): number | null {
  if (!jornada) return null;

  const em = parseHoraParaMinutos(jornada.HORA_ENTRADA_MANHA);
  const sm = parseHoraParaMinutos(jornada.HORA_SAIDA_MANHA);
  const et = parseHoraParaMinutos(jornada.HORA_ENTRADA_TARDE);
  const st = parseHoraParaMinutos(jornada.HORA_SAIDA_TARDE);
  const ei = parseHoraParaMinutos(jornada.HORA_ENTRADA_INTERVALO);
  const si = parseHoraParaMinutos(jornada.HORA_SAIDA_INTERVALO);

  return diff(em, sm) + diff(et, st) - diff(ei, si);
}

export function calcularSaldoDia(
  tipoDia: TipoDia,
  minutosTrabalhados: number,
  minutosJornadaDia: number | null,
  toleranciaMinutos: number
): {
  saldoBancoMinutos: number;
  minutosPagosFeriadoFds: number;
  minutosExtrasExibicao: number;
} {
  if (tipoDia !== 'DIA_UTIL') {
    const horasPagas = Math.max(0, minutosTrabalhados);
    return {
      saldoBancoMinutos: 0,
      minutosPagosFeriadoFds: horasPagas,
      minutosExtrasExibicao: horasPagas,
    };
  }

  if (!minutosJornadaDia || minutosJornadaDia <= 0) {
    return {
      saldoBancoMinutos: 0,
      minutosPagosFeriadoFds: 0,
      minutosExtrasExibicao: 0,
    };
  }

  const diferenca = minutosTrabalhados - minutosJornadaDia;
  const tolerancia = normalizarToleranciaMinutos(toleranciaMinutos);

  if (Math.abs(diferenca) <= tolerancia) {
    return {
      saldoBancoMinutos: 0,
      minutosPagosFeriadoFds: 0,
      minutosExtrasExibicao: 0,
    };
  }

  const saldoBancoMinutos =
    diferenca > 0 ? diferenca - tolerancia : diferenca + tolerancia;

  return {
    saldoBancoMinutos,
    minutosPagosFeriadoFds: 0,
    minutosExtrasExibicao: saldoBancoMinutos > 0 ? saldoBancoMinutos : 0,
  };
}

export function gerarIntervaloCompetencia(competencia?: string | null):
  | { inicio: string; fim: string }
  | null {
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return null;

  const [anoStr, mesStr] = competencia.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  if (!Number.isFinite(ano) || !Number.isFinite(mes)) return null;

  const ultimoDia = new Date(ano, mes, 0).getDate();

  return {
    inicio: `${competencia}-01`,
    fim: `${competencia}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

export function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

export function gerarDiasDaCompetencia(competencia: string): string[] {
  const intervalo = gerarIntervaloCompetencia(competencia);

  if (!intervalo) return [];

  const datas: string[] = [];
  const [anoStr, mesStr] = competencia.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const ultimoDia = new Date(ano, mes, 0).getDate();

  for (let dia = 1; dia <= ultimoDia; dia++) {
    datas.push(`${competencia}-${String(dia).padStart(2, '0')}`);
  }

  return datas;
}
