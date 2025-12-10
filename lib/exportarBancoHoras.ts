import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import type { ResumoBancoHorasMes } from "@/db/rhBancoHoras";
import { minutosParaHora } from "@/lib/rhPontoCalculo";

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

function mapearClassificacao(classificacao: string): string {
  if (classificacao === "EXTRA_UTIL") return "HORA CRÉDITO";
  if (classificacao === "EXTRA_100") return "HORA CRÉDITO";
  if (classificacao === "DEVEDOR") return "HORA DÉBITO";
  if (classificacao.includes("FALTA")) return "FALTA";
  return classificacao;
}

export function exportarPDF(dados: DadosExportacao) {
  const { resumo, empresa } = dados;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  let yPos = 20;

  // ========== TIMBRE / CABEÇALHO ==========
  // Borda do timbre
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin, 10, pageWidth - 2 * margin, 30);

  // Logo (área reservada - pode ser adicionado posteriormente)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(empresa.nome || empresa.razaoSocial || "EMPRESA", margin + 5, 18);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (empresa.cnpj) {
    doc.text(`CNPJ: ${empresa.cnpj}`, margin + 5, 24);
  }

  // Título do documento
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FOLHA DE BANCO DE HORAS", pageWidth / 2, 22, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const comp = `${String(resumo.competencia.mes).padStart(2, "0")}/${resumo.competencia.ano}`;
  doc.text(`Competência: ${comp}`, pageWidth / 2, 30, { align: "center" });

  yPos = 48;

  // ========== DADOS DO FUNCIONÁRIO ==========
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO FUNCIONÁRIO", margin, yPos);
  yPos += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nome: ${resumo.funcionario.nome}`, margin, yPos);
  yPos += 5;
  doc.text(`Matrícula: ${resumo.funcionario.id}`, margin, yPos);
  doc.text(`Departamento: ${resumo.funcionario.nomeDepartamento || "N/A"}`, margin + 70, yPos);
  yPos += 5;

  // Linha da jornada
  const jornadaHoras = minutosParaHora(Math.abs(resumo.extrasUteisMin) || Math.abs(resumo.devidasMin) || 480);
  doc.text(`Jornada de Trabalho: ${jornadaHoras} horas`, margin, yPos);
  yPos += 8;

  // ========== RESUMO DO MÊS ==========
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RESUMO DO MÊS", margin, yPos);
  yPos += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const col1 = margin + 5;
  const col2 = margin + 60;
  const col3 = margin + 120;

  // Linha 1: Saldos
  doc.text(`Saldo Anterior:`, col1, yPos);
  doc.text(minutosParaHora(resumo.saldoAnteriorMin), col1 + 30, yPos);
  yPos += 5;

  // Linha 2: Extras
  doc.text(`Extras 50%:`, col1, yPos);
  doc.setTextColor(0, 150, 0);
  doc.text(minutosParaHora(resumo.extrasUteisMin), col1 + 30, yPos);
  doc.setTextColor(0, 0, 0);

  doc.text(`Extras 100%:`, col2, yPos);
  doc.setTextColor(0, 150, 0);
  doc.text(minutosParaHora(resumo.extras100Min), col2 + 30, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 5;

  // Linha 3: Devidas
  doc.text(`Horas Devidas:`, col1, yPos);
  doc.setTextColor(200, 0, 0);
  doc.text(minutosParaHora(resumo.devidasMin), col1 + 30, yPos);
  doc.setTextColor(0, 0, 0);

  doc.text(`Ajustes:`, col2, yPos);
  doc.text(minutosParaHora(resumo.ajustesManuaisMin + resumo.fechamentosMin), col2 + 30, yPos);
  yPos += 5;

  // Saldo Final
  doc.setFont("helvetica", "bold");
  doc.text(`Saldo Final:`, col1, yPos);
  doc.text(minutosParaHora(resumo.saldoFinalBancoMin), col1 + 30, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 8;

  // ========== VALORES A PAGAR/DESCONTAR ==========
  doc.setFont("helvetica", "bold");
  doc.text("VALORES:", margin, yPos);
  yPos += 5;

  doc.setFont("helvetica", "normal");
  const vp50 = formatarMoeda((resumo.horasPagar50Min / 60) * resumo.funcionario.valorHora * 1.5);
  const vp100 = formatarMoeda((resumo.horasPagar100Min / 60) * resumo.funcionario.valorHora * 2);
  const vd = formatarMoeda((resumo.horasDescontarMin / 60) * resumo.funcionario.valorHora);

  doc.text(`Pagar 50%: ${vp50}`, col1, yPos);
  doc.text(`Pagar 100%: ${vp100}`, col2, yPos);
  yPos += 5;
  doc.text(`Descontar: ${vd}`, col1, yPos);
  yPos += 10;

  // ========== DETALHAMENTO DIÁRIO ==========
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DETALHAMENTO DIÁRIO", margin, yPos);
  yPos += 4;

  // Cabeçalho da tabela
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const colDia = margin;
  const colTrab = margin + 20;
  const colDif = margin + 40;
  const colClass = margin + 60;

  doc.text("Data", colDia, yPos);
  doc.text("Trabalhado", colTrab, yPos);
  doc.text("Diferença", colDif, yPos);
  doc.text("Classificação", colClass, yPos);
  yPos += 2;

  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 3;

  // Dados da tabela
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);

  resumo.dias.forEach((dia) => {
    if (yPos > 240) return; // Para não ultrapassar a área de assinatura

    const dataFormatada = `${dia.data.substring(8, 10)}/${dia.data.substring(5, 7)} - ${dia.diaSemana}`;
    doc.text(dataFormatada, colDia, yPos);
    doc.text(minutosParaHora(dia.trabalhadoMin), colTrab, yPos);

    if (dia.diferencaMin !== 0) {
      doc.setTextColor(dia.diferencaMin > 0 ? 0 : 200, dia.diferencaMin > 0 ? 150 : 0, 0);
    }
    doc.text(minutosParaHora(dia.diferencaMin), colDif, yPos);
    doc.setTextColor(0, 0, 0);

    const classif = mapearClassificacao(dia.classificacao);
    doc.text(classif, colClass, yPos);
    yPos += 3;
  });

  // ========== ASSINATURAS ==========
  yPos = Math.max(yPos + 10, 250);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const sig1X = margin + 20;
  const sig2X = pageWidth - margin - 70;
  const sigWidth = 50;

  doc.line(sig1X, yPos, sig1X + sigWidth, yPos);
  doc.line(sig2X, yPos, sig2X + sigWidth, yPos);
  yPos += 4;
  doc.text("Assinatura do Funcionário", sig1X + sigWidth / 2, yPos, { align: "center" });
  doc.text("Assinatura da Empresa", sig2X + sigWidth / 2, yPos, { align: "center" });

  // ========== RODAPÉ ==========
  yPos = pageHeight - 20;
  doc.setDrawColor(0, 0, 0);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4;

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
    yPos += 3;
  }

  const dataHoraEmissao = new Date().toLocaleString("pt-BR");
  doc.setFontSize(6);
  doc.text(`Emitido em: ${dataHoraEmissao}`, pageWidth / 2, pageHeight - 8, { align: "center" });

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
