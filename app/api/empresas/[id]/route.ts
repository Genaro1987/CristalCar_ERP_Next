import { db } from "@/db/client";
import { NextResponse } from "next/server";

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

const sanitizeCnpj = (value: string) => value.replace(/\D/g, "");

async function buscarEmpresa(id: number) {
  const resultado = await db.execute({
    sql: `SELECT ${EMPRESA_FIELDS} FROM EMP_EMPRESA WHERE ID_EMPRESA = ?`,
    args: [id],
  });

  return resultado.rows?.[0] ?? null;
}

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    const id = Number(context.params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "ID_INVALIDO" },
        { status: 400 }
      );
    }

    const empresa = await buscarEmpresa(id);

    if (!empresa) {
      return NextResponse.json(
        { success: false, error: "EMPRESA_NAO_ENCONTRADA" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, empresa });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: { params: { id: string } }) {
  try {
    const id = Number(context.params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "ID_INVALIDO" },
        { status: 400 }
      );
    }

    const empresaAtual = await buscarEmpresa(id);

    if (!empresaAtual) {
      return NextResponse.json(
        { success: false, error: "EMPRESA_NAO_ENCONTRADA" },
        { status: 404 }
      );
    }

    const formData = await request.formData();

    const nomeFantasia = formData.get("NOME_FANTASIA")?.toString().trim();
    const razaoSocial = formData.get("RAZAO_SOCIAL")?.toString().trim();
    const cnpjBruto = formData.get("CNPJ")?.toString().trim();

    if (!nomeFantasia || !razaoSocial || !cnpjBruto) {
      return NextResponse.json(
        { success: false, error: "DADOS_OBRIGATORIOS_FALTANDO" },
        { status: 400 }
      );
    }

    const cnpj = sanitizeCnpj(cnpjBruto);

    if (cnpj.length !== 14) {
      return NextResponse.json(
        { success: false, error: "CNPJ_INVALIDO" },
        { status: 400 }
      );
    }

    const inscricaoEstadual =
      formData.get("INSCRICAO_ESTADUAL")?.toString().trim() || null;
    const inscricaoMunicipal =
      formData.get("INSCRICAO_MUNICIPAL")?.toString().trim() || null;
    const regimeTributario =
      formData.get("REGIME_TRIBUTARIO")?.toString().trim() || null;
    const ativa = formData.get("ATIVA")?.toString() === "1" ? 1 : 0;

    const logotipo = formData.get("LOGOTIPO");
    let logotipoUrl = empresaAtual.LOGOTIPO_URL as string | null;

    if (logotipo instanceof File && logotipo.size > 0) {
      const buffer = Buffer.from(await logotipo.arrayBuffer());
      const mimeType = logotipo.type || "application/octet-stream";
      const base64 = buffer.toString("base64");
      logotipoUrl = `data:${mimeType};base64,${base64}`;
    }

    await db.execute({
      sql: `
        UPDATE EMP_EMPRESA
        SET NOME_FANTASIA = ?,
            RAZAO_SOCIAL = ?,
            CNPJ = ?,
            INSCRICAO_ESTADUAL = ?,
            INSCRICAO_MUNICIPAL = ?,
            REGIME_TRIBUTARIO = ?,
            LOGOTIPO_URL = ?,
            ATIVA = ?,
            DATA_ATUALIZACAO = datetime('now')
        WHERE ID_EMPRESA = ?
      `,
      args: [
        nomeFantasia,
        razaoSocial,
        cnpj,
        inscricaoEstadual,
        inscricaoMunicipal,
        regimeTributario,
        logotipoUrl,
        ativa,
        id,
      ],
    });

    return NextResponse.json({ success: true });
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
