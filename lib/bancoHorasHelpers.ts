import type { ResumoBancoHorasDia } from "@/db/rhBancoHoras";

export interface TotaisBancoHoras {
  extras50Min: number;
  extras100Min: number;
  devidasMin: number;
}

export function resumirTotaisDias(dias: ResumoBancoHorasDia[]): TotaisBancoHoras {
  return dias.reduce<TotaisBancoHoras>(
    (totais, dia) => {
      const impacto = dia.impactoBancoMin;
      const classif = dia.classificacao;

      if (impacto > 0 && classif === "EXTRA_UTIL") {
        totais.extras50Min += impacto;
      } else if (impacto > 0 && classif === "EXTRA_100") {
        totais.extras100Min += impacto;
      } else if (impacto < 0) {
        totais.devidasMin += impacto;
      }

      return totais;
    },
    { extras50Min: 0, extras100Min: 0, devidasMin: 0 }
  );
}

export function mapearClassificacaoParaExibicao(classificacao: ResumoBancoHorasDia["classificacao"]): string {
  if (classificacao === "EXTRA_UTIL" || classificacao === "EXTRA_100") {
    return "Hora Extra";
  }
  if (classificacao === "DEVEDOR" || classificacao === "FALTA_JUSTIFICADA" || classificacao === "FALTA_NAO_JUSTIFICADA") {
    return "Devedor";
  }
  return "Normal";
}

export function formatarTipoDiaParaExibicao(tipoDia?: string | null): string {
  const tipoNormalizado = (tipoDia ?? "").trim().toUpperCase();

  if (tipoNormalizado === "DOMING" || tipoNormalizado === "DOMINGO") {
    return "DOMINGO";
  }

  if (tipoNormalizado === "SABADO") {
    return "SÁBADO";
  }

  if (tipoNormalizado === "UTIL") {
    return "ÚTIL";
  }

  if (tipoNormalizado === "FERIADO") {
    return "FERIADO";
  }

  return tipoDia ?? "";
}

export function formatarObservacaoParaExibicao(obs?: string | null): string {
  if (!obs) return "";
  const upper = obs.trim().toUpperCase();
  if (upper === "FERIAS") return "Férias";
  if (upper === "FALTA_JUSTIFICADA") return "Falta Just.";
  if (upper === "FALTA_NAO_JUSTIFICADA") return "Falta N/Just.";
  if (upper === "NORMAL") return "";
  return obs;
}
