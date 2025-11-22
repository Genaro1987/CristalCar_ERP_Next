import { NextResponse } from "next/server";
import { db } from "@/db/client";

const EMPRESA_FIELDS = [
  "ID_EMPRESA",
  "NOME_FANTASIA",
  "RAZAO_SOCIAL",
  "CNPJ",
  "INSCRICAO_ESTADUAL",
  "INSCRICAO_MUNICIPAL",
  "REGIME_TRIBUTARIO",
  "LOGOTIPO_URL",
  "ATIVA",
  "DATA_CADASTRO",
  "DATA_ATUALIZACAO",
].join(", ");

export async function GET() {
  try {
    const result = await db.execute(`SELECT ${EMPRESA_FIELDS} FROM EMP_EMPRESA`);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const nomeFantasia = formData.get("NOME_FANTASIA")?.toString().trim();
    const razaoSocial = formData.get("RAZAO_SOCIAL")?.toString().trim();
    const cnpj = formData.get("CNPJ")?.toString().trim();

    if (!nomeFantasia || !razaoSocial || !cnpj) {
      return NextResponse.json(
        { success: false, error: "DADOS_OBRIGATORIOS_FALTANDO" },
        { status: 400 }
      );
    }

    const inscricaoEstadual = formData.get("INSCRICAO_ESTADUAL")?.toString().trim() || null;
    const inscricaoMunicipal = formData.get("INSCRICAO_MUNICIPAL")?.toString().trim() || null;
    const regimeTributario = formData.get("REGIME_TRIBUTARIO")?.toString().trim() || null;
    const ativaValor = formData.get("ATIVA")?.toString();
    const ativa = ativaValor === "0" ? 0 : 1;

    const logotipo = formData.get("LOGOTIPO");
    let logotipoUrl: string | null = null;

    if (logotipo instanceof File && logotipo.size > 0) {
      const buffer = Buffer.from(await logotipo.arrayBuffer());
      const mimeType = logotipo.type || "application/octet-stream";
      const base64 = buffer.toString("base64");
      logotipoUrl = `data:${mimeType};base64,${base64}`;
    }

    const sql = `
      INSERT INTO EMP_EMPRESA (
        NOME_FANTASIA,
        RAZAO_SOCIAL,
        CNPJ,
        INSCRICAO_ESTADUAL,
        INSCRICAO_MUNICIPAL,
        REGIME_TRIBUTARIO,
        LOGOTIPO_URL,
        ATIVA,
        DATA_CADASTRO
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    await db.execute({
      sql,
      args: [
        nomeFantasia,
        razaoSocial,
        cnpj,
        inscricaoEstadual,
        inscricaoMunicipal,
        regimeTributario,
        logotipoUrl,
        ativa,
      ],
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    const message = error?.message || "";

    if (message.includes("EMP_EMPRESA.CNPJ")) {
      return NextResponse.json(
        { success: false, error: "CNPJ_JA_CADASTRADO" },
        { status: 409 }
      );
    }

    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
