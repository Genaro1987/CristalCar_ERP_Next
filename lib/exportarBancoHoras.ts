import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import type { ResumoBancoHorasMes } from "@/db/rhBancoHoras";
import { minutesToDecimal, minutosParaHora } from "@/lib/rhPontoCalculo";
import {
  formatarTipoDiaParaExibicao,
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

  // Configurações de Layout
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10; // Reduzido para 10mm para aproveitar espaço
  const contentWidth = pageWidth - (margin * 2);
  let yPos = 0;

  // Cores Premium
  const colors = {
    primary: "#1e293b",    // Slate 800 - Cabeçalhos
    secondary: "#334155",  // Slate 700 - Subtítulos
    accent: "#0f766e",     // Teal 700 - Destaques
    text: "#0f172a",       // Slate 900 - Texto Principal
    textLight: "#64748b",  // Slate 500 - Texto Secundário
    bgLight: "#f8fafc",    // Slate 50 - Fundos Alternados
    border: "#e2e8f0",     // Slate 200 - Bordas
    success: "#166534",    // Green 700
    danger: "#991b1b",     // Red 800
    warning: "#b45309",    // Amber 700
    tableHeader: "#f1f5f9" // Slate 100
  };

  // --- HEADER EXECUTIVO ---
  // Barra Superior Escura
  doc.setFillColor(colors.primary);
  doc.rect(0, 0, pageWidth, 20, "F");

  // Título
  yPos = 13;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor("#ffffff");
  doc.text("REGISTRO DE PONTO", margin, yPos);

  // Nome da Empresa (Direita)
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#cbd5e1"); // Slate 300
  const empresaNome = (empresa.nome || "Empresa").toUpperCase();
  const cnpjTexto = empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : "";
  const headerRightText = empresaNome;

  const empresaWidth = doc.getTextWidth(headerRightText);
  doc.text(headerRightText, pageWidth - margin - empresaWidth, yPos);

  if (cnpjTexto) {
    const cnpjWidth = doc.getTextWidth(cnpjTexto);
    doc.setFontSize(7);
    doc.text(cnpjTexto, pageWidth - margin - cnpjWidth, yPos + 4);
  }

  yPos = 28;

  // --- INFORMAÇÕES DO COLABORADOR E PERÍODO ---
  // Layout em duas colunas implícitas
  const col1X = margin;
  const col2X = pageWidth / 2 + 5;

  // Linha 1: Nome e Competência
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(colors.textLight);
  doc.text("COLABORADOR", col1X, yPos);
  doc.text("COMPETÊNCIA", col2X, yPos);

  yPos += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(colors.text);
  doc.text(resumo.funcionario.nome.toUpperCase(), col1X, yPos);

  const meses = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  const nomeMes = meses[resumo.competencia.mes - 1];
  const compTexto = `${nomeMes} / ${resumo.competencia.ano}`;
  doc.setTextColor(colors.accent);
  doc.text(compTexto, col2X, yPos);

  yPos += 8;

  // Linha 2: Departamento e Data Emissão
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(colors.textLight);
  doc.text("DEPARTAMENTO", col1X, yPos);
  doc.text("EMISSÃO", col2X, yPos);

  yPos += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(colors.text);
  doc.text((resumo.funcionario.nomeDepartamento || "Não informado").toUpperCase(), col1X, yPos);

  const now = new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR").substring(0, 5);
  doc.text(now, col2X, yPos);

  yPos += 8;

  // --- JORNADA DE TRABALHO (SEMPRE EXIBIR) ---
  // Box Dedicado
  const boxHeight = 14;
  doc.setDrawColor(colors.accent);
  doc.setLineWidth(0.3);
  doc.setFillColor("#f0fdfa"); // Teal 50 bem suave
  doc.roundedRect(margin, yPos, contentWidth, boxHeight, 1, 1, "FD");

  const j = resumo.jornada;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(colors.accent);
  doc.text("JORNADA DE TRABALHO", margin + 3, yPos + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(colors.text);

  const jornadaY = yPos + 10;

  if (j) {
    const entrada1 = j.entradaManha || "--:--";
    const saida1 = j.saidaManha || "--:--";
    const entrada2 = j.entradaTarde || "--:--";
    const saida2 = j.saidaTarde || "--:--";
    const horario = `${entrada1} - ${saida1} | ${entrada2} - ${saida2}`;

    doc.text(`Horário: ${horario}`, margin + 3, jornadaY);

    // Distribuir Carga e Tolerância
    doc.text(`Carga Diária: ${minutosParaHora(j.minutosPrevistos)}`, margin + 60, jornadaY);
    doc.text(`Tolerância: ${j.toleranciaMinutos} min`, margin + 110, jornadaY);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(colors.textLight);
    doc.text("Jornada não configurada ou não informada para este período.", margin + 3, jornadaY);
  }

  yPos += boxHeight + 6;

  // --- RESUMO FINANCEIRO E DE HORAS ---
  // Layout Horizontal Compacto

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

  // Cards simplificados (apenas borda inferior colorida)
  const cardGap = 3;
  const cardWidth = (contentWidth - (cardGap * 3)) / 4;
  const cardHeight = 16;

  const drawCompactCard = (x: number, title: string, value: string, subValue: string | null, color: string) => {
    // Fundo
    doc.setFillColor("#ffffff");
    doc.setDrawColor(colors.border);
    doc.setLineWidth(0.1);
    doc.roundedRect(x, yPos, cardWidth, cardHeight, 1, 1, "FD");

    // Borda inferior colorida
    doc.setFillColor(color);
    doc.rect(x, yPos + cardHeight - 1, cardWidth, 1, "F");

    // Título
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.textLight);
    doc.text(title.toUpperCase(), x + 2, yPos + 5);

    // Valor
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.text);
    doc.text(value, x + 2, yPos + 10);

    // SubValor
    if (subValue) {
      doc.setFontSize(5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(colors.textLight);
      doc.text(subValue, x + 2, yPos + 13);
    }
  };

  drawCompactCard(margin, "SALDO ANTERIOR", minutosParaHora(resumo.saldoAnteriorMin), null, colors.textLight);

  const totalExtras = extrasUteisMin + extras100Min;
  drawCompactCard(margin + cardWidth + cardGap, "CRÉDITOS (EXTRAS)", minutosParaHora(totalExtras), `50%: ${minutosParaHora(extrasUteisMin)} | 100%: ${minutosParaHora(extras100Min)}`, colors.success);

  drawCompactCard(margin + (cardWidth + cardGap) * 2, "DÉBITOS (ATRASOS)", minutosParaHora(devidasMin), null, colors.danger);

  drawCompactCard(margin + (cardWidth + cardGap) * 3, "SALDO FINAL", minutosParaHora(saldoFinalBancoMin), "Após ajustes", colors.accent);

  yPos += cardHeight + 8;

  // --- TABELA DE DETALHAMENTO ---

  // Headers - centered table
  const tableWidth = 188;
  const tableStartX = (pageWidth - tableWidth) / 2;

  const cols = [
    { name: "DATA", width: 18, align: "center" },
    { name: "DIA", width: 14, align: "center" },
    { name: "TIPO", width: 30, align: "center" },
    { name: "TRAB", width: 22, align: "center" },
    { name: "SALDO", width: 22, align: "center" },
    { name: "CLASSE", width: 38, align: "center" },
    { name: "OBS", width: 44, align: "center" }
  ];

  const colX = [
    tableStartX,
    tableStartX + 18,
    tableStartX + 32,
    tableStartX + 62,
    tableStartX + 84,
    tableStartX + 106,
    tableStartX + 144
  ];

  // Header Background
  doc.setFillColor(colors.primary);
  doc.rect(tableStartX, yPos, tableWidth, 6, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#ffffff");

  cols.forEach((col, i) => {
    const x = colX[i] + col.width / 2;
    doc.text(col.name, x, yPos + 4, { align: "center" });
  });

  yPos += 7; // Espaço após header

  // Rows
  const rowHeight = 4.8; // Bem compacto
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  resumo.dias.forEach((dia, index) => {
    // Quebra de página
    if (yPos > pageHeight - 25) { // Deixa 25mm para rodapé/assinaturas na última página
      doc.addPage();
      yPos = 15;

      // Reprint Header Tabela
      doc.setFillColor(colors.primary);
      doc.rect(tableStartX, yPos, tableWidth, 6, "F");
      doc.setTextColor("#ffffff");
      doc.setFont("helvetica", "bold");
      cols.forEach((col, i) => {
        const x = colX[i] + col.width / 2;
        doc.text(col.name, x, yPos + 4, { align: "center" });
      });
      yPos += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
    }

    // Zebra Striping
    if (index % 2 === 0) {
      doc.setFillColor(colors.bgLight);
      doc.rect(tableStartX, yPos - 1, tableWidth, rowHeight, "F");
    }

    // Dados
    const dataF = dia.data.substring(8, 10) + "/" + dia.data.substring(5, 7);
    const diaSemana = dia.diaSemana.substring(0, 3);
    const tipo = formatarTipoDiaParaExibicao(dia.tipoDia);
    const trab = minutosParaHora(dia.trabalhadoMin);
    const saldo = minutosParaHora(dia.diferencaMin);
    const classif = mapearClassificacaoParaExibicao(dia.classificacao);

    // Estilos condicionais
    doc.setTextColor(colors.text);

    // Data/Dia - centered
    doc.text(dataF, colX[0] + cols[0].width / 2, yPos + 2.5, { align: "center" });
    doc.setTextColor(colors.textLight);
    doc.text(diaSemana, colX[1] + cols[1].width / 2, yPos + 2.5, { align: "center" });

    // Tipo - centered
    doc.setTextColor(colors.text);
    if (dia.tipoDia === "FERIADO") doc.setTextColor(colors.warning);
    if (dia.tipoDia === "DOMINGO") doc.setTextColor(colors.danger);
    doc.text(tipo.substr(0, 16), colX[2] + cols[2].width / 2, yPos + 2.5, { align: "center" });

    // Trabalhado - centered
    doc.setTextColor(colors.text);
    doc.text(trab, colX[3] + cols[3].width / 2, yPos + 2.5, { align: "center" });

    // Saldo - centered
    if (dia.diferencaMin > 0) doc.setTextColor(colors.success);
    else if (dia.diferencaMin < 0) doc.setTextColor(colors.danger);
    else doc.setTextColor(colors.textLight);
    doc.text(saldo, colX[4] + cols[4].width / 2, yPos + 2.5, { align: "center" });

    // Classe - centered
    doc.setTextColor(colors.text);
    doc.text(classif.substr(0, 20), colX[5] + cols[5].width / 2, yPos + 2.5, { align: "center" });

    // Obs - centered
    if (dia.observacao === "FERIAS") {
      doc.setTextColor(colors.warning);
      doc.text("FERIAS", colX[6] + cols[6].width / 2, yPos + 2.5, { align: "center" });
    } else if (dia.observacao) {
      doc.setTextColor(colors.textLight);
      const obs = dia.observacao.length > 35 ? dia.observacao.substring(0, 35) + "..." : dia.observacao;
      doc.text(obs, colX[6] + cols[6].width / 2, yPos + 2.5, { align: "center" });
    }

    yPos += rowHeight;
  });

  // --- ASSINATURAS ---
  // Tenta manter na mesma página se sobrar espaço razoável, senão quebra
  if (yPos > pageHeight - 35) {
    doc.addPage();
    yPos = 30;
  } else {
    yPos = Math.max(yPos + 10, pageHeight - 35);
  }

  const sigY = yPos + 10;
  const sigWidth = 70;

  doc.setDrawColor(colors.textLight);
  doc.setLineWidth(0.1);

  // Linha Funcionario
  doc.line(margin + 10, sigY, margin + 10 + sigWidth, sigY);
  // Linha Empresa
  doc.line(pageWidth - margin - 10 - sigWidth, sigY, pageWidth - margin - 10, sigY);

  doc.setFontSize(6);
  doc.setTextColor(colors.textLight);
  doc.text("COLABORADOR", margin + 10 + (sigWidth / 2), sigY + 4, { align: "center" });
  doc.text("EMPRESA", pageWidth - margin - 10 - (sigWidth / 2), sigY + 4, { align: "center" });

  // Disclaimer Legal
  doc.setFontSize(5);
  doc.setTextColor("#cbd5e1");
  doc.text("Este documento é um registro de ponto conferido, sujeito às normas da CLT e acordos vigentes.", pageWidth / 2, pageHeight - 8, { align: "center" });

  // Numeração de Páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6);
    doc.setTextColor(colors.textLight);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });

    // Timestamp em todas as páginas
    const now = new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR").substring(0, 5);
    doc.text(`Gerado em ${now}`, margin, pageHeight - 8);
  }

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
    dadosResumo.push([
      r.funcionario.nome,
      `${String(r.competencia.mes).padStart(2, "0")}/${r.competencia.ano}`,
      minutosParaHora(r.saldoAnteriorMin),
      minutosParaHora(extras50),
      minutosParaHora(extras100),
      minutosParaHora(devidas),
      minutosParaHora(r.ajustesManuaisMin),
      minutosParaHora(saldoFinal),
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
    const horasPagar50 = r.horasPagar50Min;
    const horasPagar100 = r.horasPagar100Min;
    const horasDescontar = r.horasDescontarMin;
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
