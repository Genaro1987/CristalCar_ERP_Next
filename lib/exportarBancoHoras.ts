import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import type { ResumoBancoHorasMes } from "@/db/rhBancoHoras";
import { minutosParaHora } from "@/lib/rhPontoCalculo";

interface DadosExportacao {
  resumo: ResumoBancoHorasMes;
  empresa: {
    nome: string;
    cnpj?: string;
  };
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
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 20;

  // Cabeçalho
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("REGISTRO DE PONTO E BANCO DE HORAS", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  // Dados da empresa
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(empresa.nome, pageWidth / 2, yPos, { align: "center" });
  yPos += 5;
  if (empresa.cnpj) {
    doc.text(`CNPJ: ${empresa.cnpj}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 10;
  } else {
    yPos += 5;
  }

  // Dados do funcionário
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("FUNCIONÁRIO", 15, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nome: ${resumo.funcionario.nome}`, 15, yPos);
  yPos += 5;
  doc.text(`Departamento: ${resumo.funcionario.nomeDepartamento ?? "-"}`, 15, yPos);
  yPos += 5;
  doc.text(`Competência: ${String(resumo.competencia.mes).padStart(2, "0")}/${resumo.competencia.ano}`, 15, yPos);
  yPos += 10;

  // Resumo do mês
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RESUMO DO MÊS", 15, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const resumoItens = [
    ["Saldo Anterior", minutosParaHora(resumo.saldoAnteriorMin)],
    ["Horas Extras 50%", minutosParaHora(resumo.extrasUteisMin)],
    ["Horas Extras 100%", minutosParaHora(resumo.extras100Min)],
    ["Horas Devidas", minutosParaHora(resumo.devidasMin)],
    ["Ajustes Manuais", minutosParaHora(resumo.ajustesManuaisMin)],
    ["Saldo Final", minutosParaHora(resumo.saldoFinalBancoMin)],
  ];

  resumoItens.forEach(([label, valor]) => {
    doc.text(`${label}:`, 20, yPos);
    doc.text(valor, 70, yPos);
    yPos += 5;
  });
  yPos += 5;

  // Valores a pagar/descontar
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("VALORES", 15, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const valores = [
    ["Horas a Pagar 50%", minutosParaHora(resumo.horasPagar50Min), formatarMoeda((resumo.horasPagar50Min / 60) * resumo.funcionario.valorHora * 1.5)],
    ["Horas a Pagar 100%", minutosParaHora(resumo.horasPagar100Min), formatarMoeda((resumo.horasPagar100Min / 60) * resumo.funcionario.valorHora * 2)],
    ["Horas a Descontar", minutosParaHora(resumo.horasDescontarMin), formatarMoeda((resumo.horasDescontarMin / 60) * resumo.funcionario.valorHora)],
  ];

  valores.forEach(([label, horas, valor]) => {
    doc.text(`${label}:`, 20, yPos);
    doc.text(`${horas} = ${valor}`, 70, yPos);
    yPos += 5;
  });
  yPos += 10;

  // Tabela de detalhamento diário
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DETALHAMENTO DIÁRIO", 15, yPos);
  yPos += 6;

  // Cabeçalho da tabela
  doc.setFontSize(8);
  const colWidths = [25, 20, 20, 20, 20, 40];
  const headers = ["Data", "Tipo", "Jornada", "Trab.", "Dif.", "Classificação"];
  let xPos = 15;
  headers.forEach((header, i) => {
    doc.text(header, xPos, yPos);
    xPos += colWidths[i];
  });
  yPos += 5;

  // Linha separadora
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 4;

  // Dados da tabela
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  resumo.dias.forEach((dia) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }

    xPos = 15;
    const dataFormatada = dia.data.substring(8, 10) + "/" + dia.data.substring(5, 7);
    doc.text(dataFormatada, xPos, yPos);
    xPos += colWidths[0];
    doc.text(dia.tipoDia.substring(0, 6), xPos, yPos);
    xPos += colWidths[1];
    doc.text(minutosParaHora(dia.jornadaPrevistaMin), xPos, yPos);
    xPos += colWidths[2];
    doc.text(minutosParaHora(dia.trabalhadoMin), xPos, yPos);
    xPos += colWidths[3];
    doc.text(minutosParaHora(dia.diferencaMin), xPos, yPos);
    xPos += colWidths[4];
    doc.text(dia.classificacao.substring(0, 12), xPos, yPos);

    yPos += 4;
  });

  yPos += 10;

  // Assinaturas
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const sigWidth = 70;
  const sig1X = 20;
  const sig2X = pageWidth - sigWidth - 20;

  doc.line(sig1X, yPos, sig1X + sigWidth, yPos);
  doc.line(sig2X, yPos, sig2X + sigWidth, yPos);
  yPos += 5;
  doc.text("Funcionário", sig1X + sigWidth / 2, yPos, { align: "center" });
  doc.text("Empresa", sig2X + sigWidth / 2, yPos, { align: "center" });

  // Data e hora de emissão
  yPos += 10;
  const dataHoraEmissao = new Date().toLocaleString("pt-BR");
  doc.setFontSize(7);
  doc.text(`Emitido em: ${dataHoraEmissao}`, pageWidth / 2, yPos, { align: "center" });

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
    ["Funcionário", "Departamento", "Competência", "Saldo Anterior", "Extras 50%", "Extras 100%", "Devidas", "Ajustes", "Saldo Final", "Pagar 50%", "Pagar 100%", "Descontar"],
  ];

  dados.forEach((d) => {
    const r = d.resumo;
    dadosResumo.push([
      r.funcionario.nome,
      r.funcionario.nomeDepartamento ?? "-",
      `${String(r.competencia.mes).padStart(2, "0")}/${r.competencia.ano}`,
      minutosParaHora(r.saldoAnteriorMin),
      minutosParaHora(r.extrasUteisMin),
      minutosParaHora(r.extras100Min),
      minutosParaHora(r.devidasMin),
      minutosParaHora(r.ajustesManuaisMin),
      minutosParaHora(r.saldoFinalBancoMin),
      minutosParaHora(r.horasPagar50Min),
      minutosParaHora(r.horasPagar100Min),
      minutosParaHora(r.horasDescontarMin),
    ]);
  });

  const wsResumo = XLSX.utils.aoa_to_sheet(dadosResumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Planilha detalhada
  const dadosDetalhados: any[][] = [
    ["Banco de Horas - Detalhamento Diário"],
    [],
    ["Funcionário", "Departamento", "Data", "Dia Semana", "Tipo Dia", "Jornada", "Trabalhado", "Diferença", "Classificação", "Impacto Banco", "Observação"],
  ];

  dados.forEach((d) => {
    const r = d.resumo;
    r.dias.forEach((dia) => {
      dadosDetalhados.push([
        r.funcionario.nome,
        r.funcionario.nomeDepartamento ?? "-",
        dia.data,
        dia.diaSemana,
        dia.tipoDia,
        minutosParaHora(dia.jornadaPrevistaMin),
        minutosParaHora(dia.trabalhadoMin),
        minutosParaHora(dia.diferencaMin),
        dia.classificacao,
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
    const valorPagar50 = (r.horasPagar50Min / 60) * r.funcionario.valorHora * 1.5;
    const valorPagar100 = (r.horasPagar100Min / 60) * r.funcionario.valorHora * 2;
    const valorDescontar = (r.horasDescontarMin / 60) * r.funcionario.valorHora;
    const totalLiquido = valorPagar50 + valorPagar100 - valorDescontar;

    dadosValores.push([
      r.funcionario.nome,
      `${String(r.competencia.mes).padStart(2, "0")}/${r.competencia.ano}`,
      r.funcionario.valorHora,
      minutosParaHora(r.horasPagar50Min),
      valorPagar50,
      minutosParaHora(r.horasPagar100Min),
      valorPagar100,
      minutosParaHora(r.horasDescontarMin),
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
