import { db } from "@/db/client";
import { NextRequest, NextResponse } from "next/server";

type FuncionarioPayload = {
  CPF?: string;
  NOME_COMPLETO?: string;
  ID_DEPARTAMENTO?: number | string;
  ID_JORNADA?: string;
  ID_PERFIL?: string | null;
  DATA_ADMISSAO?: string;
  DATA_DEMISSAO?: string | null;
  ATIVO?: number | boolean;
};

const CAMPOS_RETORNO = `
  f.ID_FUNCIONARIO,
  f.CPF,
  f.NOME_COMPLETO,
  f.ID_DEPARTAMENTO,
  d.NOME_DEPARTAMENTO,
  f.ID_JORNADA,
  j.NOME_JORNADA,
  f.ID_PERFIL,
  p.NOME_PERFIL,
  f.DATA_ADMISSAO,
  f.DATA_DEMISSAO,
  f.ATIVO
`;

function obterEmpresaId(request: NextRequest): number | null {
  const headerId = request.headers.get("x-empresa-id");
  const queryId = request.nextUrl.searchParams.get("empresaId");
  const valor = headerId ?? queryId;

  if (!valor) return null;

  const parsed = Number(valor);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function removerAcentosPreservandoEspaco(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizarTextoBasico(valor: string): string {
  const semAcento = removerAcentosPreservandoEspaco(valor ?? "");
  return semAcento.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim();
}

function limparCpf(valor: string): string {
  return (valor ?? "").replace(/\D/g, "").slice(0, 11);
}

function cpfValido(valor: string): boolean {
  return limparCpf(valor).length === 11;
}

function interpretarAtivo(valor: unknown): 0 | 1 {
  if (valor === 0 || valor === "0" || valor === false) {
    return 0;
  }
  return 1;
}

function validarDataIso(valor?: string | null): string | null {
  if (!valor) return null;
  const texto = valor.toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  return texto;
}

async function gerarProximoIdFuncionario(empresaId: number): Promise<string> {
  const resultado = await db.execute({
    sql: `
      SELECT ID_FUNCIONARIO
      FROM RH_FUNCIONARIO
      WHERE ID_EMPRESA = ?
      ORDER BY ID_FUNCIONARIO DESC
      LIMIT 1
    `,
    args: [empresaId],
  });

  const ultimoId = resultado.rows?.[0]?.ID_FUNCIONARIO as string | undefined;

  if (!ultimoId) {
    return "FUN-001";
  }

  const numeroAtual = Number(ultimoId.replace(/[^0-9]/g, ""));
  const proximoNumero = Number.isFinite(numeroAtual) ? numeroAtual + 1 : 1;

  return `FUN-${String(proximoNumero).padStart(3, "0")}`;
}

async function buscarFuncionario(empresaId: number, id: string) {
  const resultado = await db.execute({
    sql: `
      SELECT ${CAMPOS_RETORNO}
      FROM RH_FUNCIONARIO f
      LEFT JOIN EMP_DEPARTAMENTO d
        ON d.ID_DEPARTAMENTO = f.ID_DEPARTAMENTO
       AND d.ID_EMPRESA = f.ID_EMPRESA
      LEFT JOIN RH_JORNADA_TRABALHO j
        ON j.ID_JORNADA = f.ID_JORNADA
       AND j.ID_EMPRESA = f.ID_EMPRESA
      LEFT JOIN SEG_PERFIL p
        ON p.ID_PERFIL = f.ID_PERFIL
       AND p.ID_EMPRESA = f.ID_EMPRESA
      WHERE f.ID_EMPRESA = ? AND f.ID_FUNCIONARIO = ?
      LIMIT 1
    `,
    args: [empresaId, id],
  });

  return resultado.rows?.[0] ?? null;
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaId(request);

  if (!empresaId) {
    return NextResponse.json(
      { success: false, error: "EMPRESA_NAO_INFORMADA" },
      { status: 400 }
    );
  }

  const id = request.nextUrl.searchParams.get("id");

  try {
    if (id) {
      const funcionario = await buscarFuncionario(empresaId, id);

      if (!funcionario) {
        return NextResponse.json(
          { success: false, error: "FUNCIONARIO_NAO_ENCONTRADO" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: funcionario });
    }

    const resultado = await db.execute({
      sql: `
        SELECT ${CAMPOS_RETORNO}
        FROM RH_FUNCIONARIO f
        LEFT JOIN EMP_DEPARTAMENTO d
          ON d.ID_DEPARTAMENTO = f.ID_DEPARTAMENTO
         AND d.ID_EMPRESA = f.ID_EMPRESA
        LEFT JOIN RH_JORNADA_TRABALHO j
          ON j.ID_JORNADA = f.ID_JORNADA
         AND j.ID_EMPRESA = f.ID_EMPRESA
        LEFT JOIN SEG_PERFIL p
          ON p.ID_PERFIL = f.ID_PERFIL
         AND p.ID_EMPRESA = f.ID_EMPRESA
        WHERE f.ID_EMPRESA = ?
        ORDER BY f.ID_FUNCIONARIO
      `,
      args: [empresaId],
    });

    return NextResponse.json({ success: true, data: resultado.rows ?? [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaId(request);

  if (!empresaId) {
    return NextResponse.json(
      { success: false, error: "EMPRESA_NAO_INFORMADA" },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as FuncionarioPayload | null;

    const cpfLimpo = limparCpf(body?.CPF ?? "");
    const nomeNormalizado = normalizarTextoBasico(body?.NOME_COMPLETO ?? "");
    const idDepartamento = Number(body?.ID_DEPARTAMENTO ?? 0);
    const idJornada = (body?.ID_JORNADA ?? "").toString().trim();
    const idPerfil = (body?.ID_PERFIL ?? "").toString().trim() || null;
    const dataAdmissao = validarDataIso(body?.DATA_ADMISSAO);
    const dataDemissao = validarDataIso(body?.DATA_DEMISSAO);

    if (!nomeNormalizado) {
      return NextResponse.json(
        { success: false, error: "NOME_OBRIGATORIO" },
        { status: 400 }
      );
    }

    if (!cpfValido(cpfLimpo)) {
      return NextResponse.json(
        { success: false, error: "CPF_INVALIDO" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(idDepartamento) || idDepartamento <= 0) {
      return NextResponse.json(
        { success: false, error: "DEPARTAMENTO_OBRIGATORIO" },
        { status: 400 }
      );
    }

    if (!idJornada) {
      return NextResponse.json(
        { success: false, error: "JORNADA_OBRIGATORIA" },
        { status: 400 }
      );
    }

    if (!dataAdmissao) {
      return NextResponse.json(
        { success: false, error: "DATA_ADMISSAO_OBRIGATORIA" },
        { status: 400 }
      );
    }

    if (dataDemissao && new Date(dataDemissao) < new Date(dataAdmissao)) {
      return NextResponse.json(
        { success: false, error: "DATA_DEMISSAO_INVALIDA" },
        { status: 400 }
      );
    }

    const cpfExistente = await db.execute({
      sql: `
        SELECT ID_FUNCIONARIO
        FROM RH_FUNCIONARIO
        WHERE ID_EMPRESA = ? AND CPF = ?
        LIMIT 1
      `,
      args: [empresaId, cpfLimpo],
    });

    if (cpfExistente.rows?.length) {
      return NextResponse.json(
        { success: false, error: "CPF_JA_CADASTRADO" },
        { status: 409 }
      );
    }

    const novoId = await gerarProximoIdFuncionario(empresaId);
    const ativo = dataDemissao ? 0 : interpretarAtivo(body?.ATIVO ?? 1);

    await db.execute({
      sql: `
        INSERT INTO RH_FUNCIONARIO (
          ID_FUNCIONARIO,
          ID_EMPRESA,
          ID_DEPARTAMENTO,
          ID_JORNADA,
          ID_PERFIL,
          CPF,
          NOME_COMPLETO,
          DATA_ADMISSAO,
          DATA_DEMISSAO,
          ATIVO,
          OBSERVACOES,
          CRIADO_EM,
          ATUALIZADO_EM
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'), datetime('now'))
      `,
      args: [
        novoId,
        empresaId,
        idDepartamento,
        idJornada,
        idPerfil,
        cpfLimpo,
        nomeNormalizado,
        dataAdmissao,
        dataDemissao,
        ativo,
      ],
    });

    const funcionario = await buscarFuncionario(empresaId, novoId);

    return NextResponse.json({ success: true, data: funcionario }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const empresaId = obterEmpresaId(request);

  if (!empresaId) {
    return NextResponse.json(
      { success: false, error: "EMPRESA_NAO_INFORMADA" },
      { status: 400 }
    );
  }

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, error: "ID_NAO_INFORMADO" },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as FuncionarioPayload | null;

    const funcionarioAtual = await buscarFuncionario(empresaId, id);

    if (!funcionarioAtual) {
      return NextResponse.json(
        { success: false, error: "FUNCIONARIO_NAO_ENCONTRADO" },
        { status: 404 }
      );
    }

    const cpfLimpo = limparCpf(body?.CPF ?? (funcionarioAtual.CPF as string));
    const nomeNormalizado = normalizarTextoBasico(
      body?.NOME_COMPLETO ?? (funcionarioAtual.NOME_COMPLETO as string)
    );
    const idDepartamento = Number(
      body?.ID_DEPARTAMENTO ?? (funcionarioAtual.ID_DEPARTAMENTO as number)
    );
    const idJornada = (body?.ID_JORNADA ?? (funcionarioAtual.ID_JORNADA as string))
      .toString()
      .trim();
    const idPerfil = (body?.ID_PERFIL ?? funcionarioAtual.ID_PERFIL ?? "").toString().trim();
    const dataAdmissao = validarDataIso(
      body?.DATA_ADMISSAO ?? (funcionarioAtual.DATA_ADMISSAO as string)
    );
    const dataDemissao = validarDataIso(
      body?.DATA_DEMISSAO ?? (funcionarioAtual.DATA_DEMISSAO as string | null)
    );

    if (!nomeNormalizado) {
      return NextResponse.json(
        { success: false, error: "NOME_OBRIGATORIO" },
        { status: 400 }
      );
    }

    if (!cpfValido(cpfLimpo)) {
      return NextResponse.json(
        { success: false, error: "CPF_INVALIDO" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(idDepartamento) || idDepartamento <= 0) {
      return NextResponse.json(
        { success: false, error: "DEPARTAMENTO_OBRIGATORIO" },
        { status: 400 }
      );
    }

    if (!idJornada) {
      return NextResponse.json(
        { success: false, error: "JORNADA_OBRIGATORIA" },
        { status: 400 }
      );
    }

    if (!dataAdmissao) {
      return NextResponse.json(
        { success: false, error: "DATA_ADMISSAO_OBRIGATORIA" },
        { status: 400 }
      );
    }

    if (dataDemissao && new Date(dataDemissao) < new Date(dataAdmissao)) {
      return NextResponse.json(
        { success: false, error: "DATA_DEMISSAO_INVALIDA" },
        { status: 400 }
      );
    }

    const cpfExistente = await db.execute({
      sql: `
        SELECT ID_FUNCIONARIO
        FROM RH_FUNCIONARIO
        WHERE ID_EMPRESA = ? AND CPF = ? AND ID_FUNCIONARIO <> ?
        LIMIT 1
      `,
      args: [empresaId, cpfLimpo, id],
    });

    if (cpfExistente.rows?.length) {
      return NextResponse.json(
        { success: false, error: "CPF_JA_CADASTRADO" },
        { status: 409 }
      );
    }

    const ativo = dataDemissao ? 0 : interpretarAtivo(body?.ATIVO ?? funcionarioAtual.ATIVO);

    await db.execute({
      sql: `
        UPDATE RH_FUNCIONARIO
           SET ID_DEPARTAMENTO = ?,
               ID_JORNADA = ?,
               ID_PERFIL = ?,
               CPF = ?,
               NOME_COMPLETO = ?,
               DATA_ADMISSAO = ?,
               DATA_DEMISSAO = ?,
               ATIVO = ?,
               ATUALIZADO_EM = datetime('now')
         WHERE ID_EMPRESA = ? AND ID_FUNCIONARIO = ?
      `,
      args: [
        idDepartamento,
        idJornada,
        idPerfil || null,
        cpfLimpo,
        nomeNormalizado,
        dataAdmissao,
        dataDemissao,
        ativo,
        empresaId,
        id,
      ],
    });

    const funcionarioAtualizado = await buscarFuncionario(empresaId, id);

    return NextResponse.json({ success: true, data: funcionarioAtualizado });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
