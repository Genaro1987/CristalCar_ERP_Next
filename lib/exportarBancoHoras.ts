import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import type { ResumoBancoHorasMes } from "@/db/rhBancoHoras";
import { minutesToDecimal, minutosParaHora } from "@/lib/rhPontoCalculo";
import {
  mapearClassificacaoParaExibicao,
  resumirTotaisDias,
} from "@/lib/bancoHorasHelpers";

interface DadosExportacao {
  resumo: ResumoBancoHorasMes;
  empresa: {
    nome: string;
    cnpj?: string;
    razaoSocial?: string;
    endereco?: string;
    telefone?: string;
    email?: string;
  };
  politica: "COMPENSAR_COM_HORAS_EXTRAS" | "DESCONTAR_EM_FOLHA";
  zerarBanco: boolean;
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function exportarPDF(dados: DadosExportacao) {
  const { resumo, empresa } = dados;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  let yPos = 16;

  const totaisDias = resumirTotaisDias(resumo.dias);
  const extrasUteisMin = totaisDias.extras50Min;
  const extras100Min = totaisDias.extras100Min;
  const devidasMin = totaisDias.devidasMin;
  const saldoTecnicoMin =
    resumo.saldoAnteriorMin +
    extrasUteisMin +
    extras100Min +
    devidasMin +
    resumo.ajustesManuaisMin +
    resumo.fechamentosMin;
  const saldoFinalBancoMin = dados.zerarBanco ? 0 : saldoTecnicoMin;

  // CABEÇALHO (Logo e título) - Reduzido
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BANCO DE HORAS", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  // DADOS DO FUNCIONÁRIO - Em uma linha
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Funcionário:", margin, yPos);
  doc.setFont("helvetica", "normal");
  const nomeFuncionario = resumo.funcionario.nome.substring(0, 40);
  const comp = `${String(resumo.competencia.mes).padStart(2, "0")}/${resumo.competencia.ano}`;
  doc.text(`${nomeFuncionario} | Competência: ${comp}`, margin + 24, yPos);
  yPos += 8;

  // RESUMO DO MÊS - Layout compacto
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("RESUMO DO MÊS", margin, yPos);
  yPos += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const col1 = margin;
  const col2 = margin + 60;
  const col3 = margin + 120;

  // Linha 1
  doc.text(`Saldo Ant: ${minutosParaHora(resumo.saldoAnteriorMin)}`, col1, yPos);
  doc.text(`Extras 50%: ${minutosParaHora(extrasUteisMin)}`, col2, yPos);
  doc.text(`Extras 100%: ${minutosParaHora(extras100Min)}`, col3, yPos);
  yPos += 4;

  // Linha 2
  doc.text(`Devidas: ${minutosParaHora(devidasMin)}`, col1, yPos);
  doc.text(`Ajustes: ${minutosParaHora(resumo.ajustesManuaisMin)}`, col2, yPos);
  doc.setFont("helvetica", "bold");
  doc.text(`Saldo Final: ${minutosParaHora(saldoFinalBancoMin)}`, col3, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 10;

  // VALORES - Em uma linha
  doc.setFont("helvetica", "bold");
  doc.text("Saldo por hora extra ou falta:", margin, yPos);
  doc.setFont("helvetica", "normal");
  const horasPagar50Min = Math.max(0, extrasUteisMin);
  const horasPagar100Min = Math.max(0, extras100Min);
  const horasDescontarMin = Math.abs(Math.min(0, devidasMin));
  const vp50Num = minutesToDecimal(horasPagar50Min) * resumo.funcionario.valorHora * 1.5;
  const vp100Num = minutesToDecimal(horasPagar100Min) * resumo.funcionario.valorHora * 2;
  const vdNum = minutesToDecimal(horasDescontarMin) * resumo.funcionario.valorHora;
  const subtotalNum = vp50Num + vp100Num - vdNum;
  const vp50 = formatarMoeda(vp50Num);
  const vp100 = formatarMoeda(vp100Num);
  const vd = formatarMoeda(vdNum);
  const subtotal = formatarMoeda(subtotalNum);
  doc.text(`Pagar 50%: ${vp50} | Pagar 100%: ${vp100} | Descontar: ${vd} | Subtotal: ${subtotal}`, margin + 2, yPos);
  yPos += 12;

  // DETALHAMENTO DIÁRIO - Tabela compacta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DETALHAMENTO DIÁRIO", margin, yPos);
  yPos += 6;

  // Cabeçalho da tabela
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  const tableWidth = pageWidth - margin * 2;
  const colDia = margin;
  const colTipo = colDia + 26;
  const colTrab = colTipo + 34;
  const colDif = colTrab + 34;
  const colClass = margin + tableWidth - 60;

  doc.text("Data", colDia, yPos);
  doc.text("Tipo", colTipo, yPos);
  doc.text("Trab.", colTrab, yPos);
  doc.text("Dif.", colDif, yPos);
  doc.text("Classificação", colClass, yPos);
  yPos += 4;

  // Linha da tabela
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4;

  // Dados da tabela
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  resumo.dias.forEach((dia) => {
    if (yPos > 280) return; // Para não ultrapassar o rodapé

    const dataFormatada = dia.data.substring(8, 10) + "/" + dia.data.substring(5, 7);
    doc.text(dataFormatada, colDia, yPos);
    doc.text(dia.tipoDia.substring(0, 6), colTipo, yPos);
    doc.text(minutosParaHora(dia.trabalhadoMin), colTrab, yPos);

    if (dia.diferencaMin !== 0) {
      doc.setTextColor(dia.diferencaMin > 0 ? 0 : 255, dia.diferencaMin > 0 ? 120 : 0, 0);
    }
    doc.text(minutosParaHora(dia.diferencaMin), colDif, yPos);
    doc.setTextColor(0, 0, 0);

    doc.text(mapearClassificacaoParaExibicao(dia.classificacao).substring(0, 25), colClass, yPos);
    yPos += 4;
  });

  // Espaço antes da assinatura
  yPos = Math.max(yPos + 6, 270);

  // ASSINATURAS
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const sig1X = margin + 10;
  const sig2X = pageWidth - margin - 60;
  const sigWidth = 50;

  doc.line(sig1X, yPos, sig1X + sigWidth, yPos);
  doc.line(sig2X, yPos, sig2X + sigWidth, yPos);
  yPos += 4;
  doc.text("Funcionário", sig1X + sigWidth / 2, yPos, { align: "center" });
  doc.text("Empresa", sig2X + sigWidth / 2, yPos, { align: "center" });

  // RODAPÉ - Dados da empresa
  yPos = pageHeight - 15;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  if (empresa.razaoSocial) {
    doc.text(empresa.razaoSocial, pageWidth / 2, yPos, { align: "center" });
    yPos += 3;
  }
  if (empresa.cnpj) {
    let rodape = `CNPJ: ${empresa.cnpj}`;
    if (empresa.endereco) rodape += ` | ${empresa.endereco}`;
    doc.text(rodape, pageWidth / 2, yPos, { align: "center" });
    yPos += 3;
  }
  if (empresa.telefone || empresa.email) {
    let contato = "";
    if (empresa.telefone) contato += `Tel: ${empresa.telefone}`;
    if (empresa.email) contato += (contato ? " | " : "") + `Email: ${empresa.email}`;
    doc.text(contato, pageWidth / 2, yPos, { align: "center" });
  }

  // Data e hora de emissão
  const dataHoraEmissao = new Date().toLocaleString("pt-BR");
  doc.setFontSize(6);
  doc.text(`Emitido em: ${dataHoraEmissao}`, pageWidth / 2, pageHeight - 5, { align: "center" });

  // Download
  const nomeArquivo = `banco_horas_${resumo.funcionario.nome.replace(/\s+/g, "_")}_${resumo.competencia.ano}_${String(resumo.competencia.mes).padStart(2, "0")}.pdf`;
  doc.save(nomeArquivo);
}

export function exportarExcel(dados: DadosExportacao[]) {
  const wb = XLSX.utils.book_new();

  // Planilha de resumo
  const dadosResumo: any[][] = [
    ["Banco de Horas - Resumo Mensal"],
    [],
    ["Funcionário", "Competência", "Saldo Anterior", "Extras 50%", "Extras 100%", "Devidas", "Ajustes", "Saldo Final", "Pagar 50%", "Pagar 100%", "Descontar"],
  ];

  dados.forEach((d) => {
    const r = d.resumo;
    const totais = resumirTotaisDias(r.dias);
    const extras50 = totais.extras50Min;
    const extras100 = totais.extras100Min;
    const devidas = totais.devidasMin;
    const saldoTecnico =
      r.saldoAnteriorMin + extras50 + extras100 + devidas + r.ajustesManuaisMin + r.fechamentosMin;
    const saldoFinal = d.zerarBanco ? 0 : saldoTecnico;
    const horasPagar50 = Math.max(0, extras50);
    const horasPagar100 = Math.max(0, extras100);
    const horasDescontar = Math.abs(Math.min(0, devidas));

    dadosResumo.push([
      r.funcionario.nome,
      `${String(r.competencia.mes).padStart(2, "0")}/${r.competencia.ano}`,
      minutosParaHora(r.saldoAnteriorMin),
      minutosParaHora(extras50),
      minutosParaHora(extras100),
      minutosParaHora(devidas),
      minutosParaHora(r.ajustesManuaisMin),
      minutosParaHora(saldoFinal),
      minutosParaHora(horasPagar50),
      minutosParaHora(horasPagar100),
      minutosParaHora(horasDescontar),
    ]);
  });

  const wsResumo = XLSX.utils.aoa_to_sheet(dadosResumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Planilha detalhada
  const dadosDetalhados: any[][] = [
    ["Banco de Horas - Detalhamento Diário"],
    [],
    ["Funcionário", "Data", "Dia Semana", "Tipo Dia", "Trabalhado", "Diferença", "Classificação", "Impacto Banco", "Observação"],
  ];

  dados.forEach((d) => {
    const r = d.resumo;
    r.dias.forEach((dia) => {
      dadosDetalhados.push([
        r.funcionario.nome,
        dia.data,
        dia.diaSemana,
        dia.tipoDia,
        minutosParaHora(dia.trabalhadoMin),
        minutosParaHora(dia.diferencaMin),
        mapearClassificacaoParaExibicao(dia.classificacao),
        minutosParaHora(dia.impactoBancoMin),
        dia.observacao ?? "",
      ]);
    });
  });

  const wsDetalhado = XLSX.utils.aoa_to_sheet(dadosDetalhados);
  XLSX.utils.book_append_sheet(wb, wsDetalhado, "Detalhamento");

  // Planilha de valores
  const dadosValores: any[][] = [
    ["Banco de Horas - Valores a Pagar/Descontar"],
    [],
    ["Funcionário", "Competência", "Valor Hora", "Horas Pagar 50%", "Valor Pagar 50%", "Horas Pagar 100%", "Valor Pagar 100%", "Horas Descontar", "Valor Descontar", "Total Líquido"],
  ];

  dados.forEach((d) => {
    const r = d.resumo;
    const totais = resumirTotaisDias(r.dias);
    const horasPagar50 = Math.max(0, totais.extras50Min);
    const horasPagar100 = Math.max(0, totais.extras100Min);
    const horasDescontar = Math.abs(Math.min(0, totais.devidasMin));
    const valorPagar50 = minutesToDecimal(horasPagar50) * r.funcionario.valorHora * 1.5;
    const valorPagar100 = minutesToDecimal(horasPagar100) * r.funcionario.valorHora * 2;
    const valorDescontar = minutesToDecimal(horasDescontar) * r.funcionario.valorHora;
    const totalLiquido = valorPagar50 + valorPagar100 - valorDescontar;

    dadosValores.push([
      r.funcionario.nome,
      `${String(r.competencia.mes).padStart(2, "0")}/${r.competencia.ano}`,
      r.funcionario.valorHora,
      minutosParaHora(horasPagar50),
      valorPagar50,
      minutosParaHora(horasPagar100),
      valorPagar100,
      minutosParaHora(horasDescontar),
      valorDescontar,
      totalLiquido,
    ]);
  });

  const wsValores = XLSX.utils.aoa_to_sheet(dadosValores);
  XLSX.utils.book_append_sheet(wb, wsValores, "Valores");

  // Download
  const dataAtual = new Date().toISOString().split("T")[0];
  const nomeArquivo = `banco_horas_${dataAtual}.xlsx`;
  XLSX.writeFile(wb, nomeArquivo);
}
