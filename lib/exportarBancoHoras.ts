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
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = 0; // Cursor vertical

  // Cores
  const colors = {
    primary: "#0f172a",    // Dark Slate
    accent: "#f97316",     // Orange Brand
    text: "#1e293b",       // Slate 800
    textLight: "#64748b",  // Slate 500
    bgLight: "#f8fafc",    // Slate 50
    border: "#e2e8f0",     // Slate 200
    success: "#059669",    // Emerald 600
    danger: "#dc2626",     // Red 600
    tableHeader: "#f1f5f9" // Slate 100
  };

  // --- HEADER PREMIUM ---
  // Faixa escura no topo
  doc.setFillColor(colors.primary);
  doc.rect(0, 0, pageWidth, 24, "F");

  // Título e Logo
  yPos = 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor("#ffffff");
  doc.text("EXTRATO DE BANCO DE HORAS", margin, yPos);

  // Nome da Empresa no Header (direita)
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#cbd5e1"); // Slate 300
  const empresaNome = (empresa.nome || "Empresa").toUpperCase();
  const empresaWidth = doc.getTextWidth(empresaNome);
  doc.text(empresaNome, pageWidth - margin - empresaWidth, yPos);

  yPos = 36;

  // --- INFO DO COLABORADOR E PERÍODO ---
  // Box de fundo suave
  doc.setFillColor(colors.bgLight);
  doc.setDrawColor(colors.border);
  doc.roundedRect(margin, yPos, contentWidth, 24, 2, 2, "FD");

  const infoY = yPos + 8;

  // Coluna 1: Funcionário
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(colors.textLight);
  doc.text("COLABORADOR", margin + 5, infoY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(colors.text);
  doc.text(resumo.funcionario.nome.toUpperCase(), margin + 5, infoY + 6);

  // Coluna 2: Cargo/Departamento (Simulado ou vazio se não tiver)
  // ...

  // Coluna 3: Competência (Alinhado à direita)
  const compLabel = "COMPETÊNCIA";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(colors.textLight);
  const compLabelWidth = doc.getTextWidth(compLabel);
  doc.text(compLabel, pageWidth - margin - 5 - compLabelWidth, infoY);

  const meses = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  const nomeMes = meses[resumo.competencia.mes - 1];
  const compTexto = `${nomeMes} ${resumo.competencia.ano}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(colors.accent); // Destaque na cor da marca
  const compTextoWidth = doc.getTextWidth(compTexto);
  doc.text(compTexto, pageWidth - margin - 5 - compTextoWidth, infoY + 6);

  yPos += 32;

  // --- JORNADA DE TRABALHO (NOVO) ---
  if (resumo.jornada) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(colors.primary);
    doc.text("JORNADA DE TRABALHO PREVISTA", margin, yPos);
    yPos += 5;

    // Box da jornada
    doc.setDrawColor(colors.border);
    doc.setFillColor("#ffffff");
    doc.roundedRect(margin, yPos, contentWidth, 14, 1, 1, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.text);

    // Formatar horários
    const j = resumo.jornada;
    const entrada1 = j.entradaManha || "--:--";
    const saida1 = j.saidaManha || "--:--";
    const entrada2 = j.entradaTarde || "--:--";
    const saida2 = j.saidaTarde || "--:--";

    const textoJornada = `${entrada1} - ${saida1} | ${entrada2} - ${saida2}`;
    const textoCarga = `Carga Diária: ${minutosParaHora(j.minutosPrevistos)}`;
    const textoTolerancia = `Tolerância: ${j.toleranciaMinutos} min`;

    // Ícones simulados com texto (•)
    const paddingJornada = 5;
    const jornadaY = yPos + 9;

    doc.text(`Horário: ${textoJornada}`, margin + paddingJornada, jornadaY);

    // Calcular posições para distribuir
    const textCargaWidth = doc.getTextWidth(textoCarga);
    const textTolWidth = doc.getTextWidth(textoTolerancia);

    // Centralizado visualmente no espaço restante ou fixo
    doc.text(textoCarga, pageWidth / 2 - (textCargaWidth / 2), jornadaY);
    doc.text(textoTolerancia, pageWidth - margin - paddingJornada - textTolWidth, jornadaY);

    yPos += 22;
  } else {
    // Se não tiver jornada, avança menos
    yPos += 6;
  }

  // --- RESUMO FINANCEIRO E DE HORAS ---
  // Layout de Cards

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

  // Título da seção
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(colors.primary);
  doc.text("RESUMO DE SALDOS", margin, yPos);
  yPos += 5;

  const cardGap = 4;
  const cardWidth = (contentWidth - (cardGap * 3)) / 4;
  const cardHeight = 24;

  // Função helper para desenhar card
  const drawCard = (x: number, title: string, value: string, subValue: string | null, type: 'neutral' | 'success' | 'danger' | 'highlight') => {
    let bgColor = "#ffffff";
    let borderColor = colors.border;
    let textColor = colors.text;

    if (type === 'success') {
      bgColor = "#f0fdf4"; borderColor = "#86efac"; textColor = "#166534";
    } else if (type === 'danger') {
      bgColor = "#fef2f2"; borderColor = "#fca5a5"; textColor = "#991b1b";
    } else if (type === 'highlight') {
      bgColor = "#fff7ed"; borderColor = "#fdba74";
    }

    doc.setFillColor(bgColor);
    doc.setDrawColor(borderColor);
    doc.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, "FD");

    // Title
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.textLight);
    doc.text(title.toUpperCase(), x + 3, yPos + 6);

    // Value
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textColor);
    doc.text(value, x + 3, yPos + 14);

    // SubValue
    if (subValue) {
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(colors.textLight);
      doc.text(subValue, x + 3, yPos + 20);
    }
  };

  // Card 1: Saldo Anterior
  drawCard(margin, "Saldo Anterior", minutosParaHora(resumo.saldoAnteriorMin), null, 'neutral');

  // Card 2: Créditos (Extras)
  const totalExtras = extrasUteisMin + extras100Min;
  drawCard(margin + cardWidth + cardGap, "Créditos", minutosParaHora(totalExtras), `50%: ${minutosParaHora(extrasUteisMin)} | 100%: ${minutosParaHora(extras100Min)}`, 'success');

  // Card 3: Débitos (Atrasos/Faltas)
  drawCard(margin + (cardWidth + cardGap) * 2, "Débitos", minutosParaHora(devidasMin), null, 'danger');

  // Card 4: Saldo Final
  drawCard(margin + (cardWidth + cardGap) * 3, "Saldo Final", minutosParaHora(saldoFinalBancoMin), "Após ajustes", 'highlight');

  yPos += cardHeight + 10;

  // --- TABELA DE DETALHAMENTO ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(colors.primary);
  doc.text("EXTRATO DIÁRIO", margin, yPos);
  yPos += 5;

  // Definição de colunas
  const cols = [
    { name: "DATA", width: 15, align: "left" },
    { name: "DIA", width: 10, align: "left" },
    { name: "TIPO", width: 30, align: "left" },
    { name: "TRABALHADO", width: 25, align: "center" },
    { name: "SALDO", width: 20, align: "center" },
    { name: "CLASSIFICAÇÃO", width: 30, align: "left" },
    { name: "OBSERVAÇÃO", width: 50, align: "left" } // O restante
  ];

  const colX = [
    margin,
    margin + 18,
    margin + 28,
    margin + 60,
    margin + 85,
    margin + 105,
    margin + 140
  ];

  // Header da Tabela
  doc.setFillColor(colors.tableHeader);
  doc.rect(margin, yPos, contentWidth, 8, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.text);

  cols.forEach((col, i) => {
    // Ajuste fino para alinhar center se precisar
    let x = colX[i];
    if (col.align === "center") x += (col.width / 2) - 3; // Aproximação grosseira
    doc.text(col.name, x, yPos + 5);
  });

  yPos += 8;

  // Linhas da Tabela
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  resumo.dias.forEach((dia, index) => {
    // Verificar quebra de página
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 20; // Margem topo nova página

      // Redesenhar header tabela
      doc.setFont("helvetica", "bold");
      doc.setFillColor(colors.tableHeader);
      doc.rect(margin, yPos, contentWidth, 8, "F");
      doc.setTextColor(colors.text);
      cols.forEach((col, i) => {
        let x = colX[i];
        if (col.align === "center") x += (col.width / 2) - 3;
        doc.text(col.name, x, yPos + 5);
      });
      yPos += 8;
      doc.setFont("helvetica", "normal");
    }

    // Zebra striping opcional
    if (index % 2 !== 0) {
      doc.setFillColor("#f8fafc");
      doc.rect(margin, yPos, contentWidth, 6, "F");
    }

    const dataF = dia.data.substring(8, 10) + "/" + dia.data.substring(5, 7);
    const diaSemana = dia.diaSemana.substring(0, 3);
    const tipo = formatarTipoDiaParaExibicao(dia.tipoDia);
    const trab = minutosParaHora(dia.trabalhadoMin);
    const saldo = minutosParaHora(dia.diferencaMin);
    const classif = mapearClassificacaoParaExibicao(dia.classificacao);

    // Cor do texto
    doc.setTextColor(colors.text);

    // Data e Sem
    doc.text(dataF, colX[0], yPos + 4);
    doc.setTextColor(colors.textLight);
    doc.text(diaSemana, colX[1], yPos + 4);

    // Tipo
    doc.setTextColor(colors.text);
    if (dia.tipoDia === "FERIADO") doc.setTextColor(colors.accent);
    if (dia.tipoDia === "DOMINGO") doc.setTextColor(colors.danger);
    doc.text(tipo.substr(0, 15), colX[2], yPos + 4);

    // Trabalhado
    doc.setTextColor(colors.text);
    doc.text(trab, colX[3] + 8, yPos + 4, { align: "center" });

    // Saldo
    if (dia.diferencaMin > 0) doc.setTextColor(colors.success);
    else if (dia.diferencaMin < 0) doc.setTextColor(colors.danger);
    else doc.setTextColor(colors.textLight);

    doc.text(saldo, colX[4] + 6, yPos + 4, { align: "center" });

    // Classificação
    doc.setTextColor(colors.text);
    doc.text(classif.substr(0, 18), colX[5], yPos + 4);

    // Observação (Truncada)
    if (dia.observacao === "FERIAS") {
      doc.setTextColor(colors.accent);
      doc.text("FÉRIAS", colX[6], yPos + 4);
    } else if (dia.observacao) {
      doc.setTextColor(colors.textLight);
      const obs = dia.observacao.length > 35 ? dia.observacao.substring(0, 35) + "..." : dia.observacao;
      doc.text(obs, colX[6], yPos + 4);
    }

    yPos += 6;
  });

  // --- FOOTER / ASSINATURAS ---
  // Garantir espaço
  if (yPos > pageHeight - 50) {
    doc.addPage();
    yPos = 40;
  } else {
    yPos = Math.max(yPos + 15, pageHeight - 50); // Empurra para baixo se tiver espaço
  }

  const sigY = yPos + 15;
  const sigWidth = 70;

  doc.setDrawColor(colors.textLight);
  doc.setLineWidth(0.1);

  // Linha Funcionario
  doc.line(margin + 10, sigY, margin + 10 + sigWidth, sigY);

  // Linha Empresa
  doc.line(pageWidth - margin - 10 - sigWidth, sigY, pageWidth - margin - 10, sigY);

  doc.setFontSize(7);
  doc.setTextColor(colors.textLight);
  doc.text("ASSINATURA DO COLABORADOR", margin + 10 + (sigWidth / 2), sigY + 4, { align: "center" });
  doc.text("ASSINATURA DA EMPRESA", pageWidth - margin - 10 - (sigWidth / 2), sigY + 4, { align: "center" });

  // Rodapé da página
  const footerY = pageHeight - 10;
  doc.setFontSize(6);
  doc.setTextColor("#94a3b8");
  const now = new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR");
  doc.text(`Gerado em ${now} via CristalCar ERP`, margin, footerY);
  doc.text("Página 1 de 1", pageWidth - margin, footerY, { align: "right" });

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
