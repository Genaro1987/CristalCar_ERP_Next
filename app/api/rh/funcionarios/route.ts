import { db } from "@/db/client";
import {
  atualizarSalario,
  getSalarioAtual,
  listarHistoricoSalarios,
} from "@/db/rhSalario";
import { NextRequest, NextResponse } from "next/server";
import {
  obterEmpresaIdDaRequest,
  respostaEmpresaNaoSelecionada,
} from "@/app/api/_utils/empresa";

type FuncionarioPayload = {
  CPF?: string;
  NOME_COMPLETO?: string;
  ID_DEPARTAMENTO?: number | string;
  ID_JORNADA?: string;
  ID_PERFIL?: string | null;
  DATA_ADMISSAO?: string;
  DATA_DEMISSAO?: string | null;
  ATIVO?: number | boolean;
  SALARIO_BASE?: number | string;
  salarioBase?: number | string;
  TIPO_SALARIO?: string;
  tipoSalario?: string;
  CARGA_HORARIA_MENSAL_REFERENCIA?: number | string;
  cargaHorariaMensalReferencia?: number | string;
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
  f.ATIVO,
  f.SALARIO_BASE,
  f.TIPO_SALARIO,
  f.CARGA_HORARIA_MENSAL_REFERENCIA
`;

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

function normalizarNumero(valor: unknown, fallback: number): number {
  const numero = Number(valor ?? fallback);

  if (!Number.isFinite(numero)) return fallback;

  return numero;
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

async function buscarFuncionario(
  empresaId: number,
  id: string,
  incluirHistoricoSalarios = false
) {
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

  const funcionario = resultado.rows?.[0];

  if (!funcionario) return null;

  const salarioAtual = await getSalarioAtual(id);

  const historico = incluirHistoricoSalarios
    ? await listarHistoricoSalarios(id)
    : undefined;

  return {
    ...funcionario,
    SALARIO_BASE: salarioAtual?.VALOR ?? funcionario.SALARIO_BASE,
    SALARIO_ATUAL: salarioAtual?.VALOR ?? null,
    HISTORICO_SALARIOS: historico,
  } as typeof funcionario & {
    SALARIO_ATUAL?: number | null;
    HISTORICO_SALARIOS?: unknown[];
  };
}

export async function GET(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  const id = request.nextUrl.searchParams.get("id");
  const apenasAtivos = request.nextUrl.searchParams.get("apenasAtivos") === "true";
  const incluirHistorico =
    request.nextUrl.searchParams.get("incluirHistorico") !== "false";

  try {
    if (id) {
      const funcionario = await buscarFuncionario(
        empresaId,
        id,
        incluirHistorico
      );

      if (!funcionario) {
        return NextResponse.json(
          { success: false, error: "FUNCIONARIO_NAO_ENCONTRADO" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: funcionario });
    }

    const filtros: string[] = ["f.ID_EMPRESA = ?"];

    if (apenasAtivos) {
      filtros.push("f.ATIVO = 1");
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
        WHERE ${filtros.join(" AND ")}
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
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
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
    const salarioBase = normalizarNumero(body?.salarioBase ?? body?.SALARIO_BASE, 0);
    const tipoSalario = (body?.tipoSalario ?? body?.TIPO_SALARIO ?? "MENSALISTA")
      .toString()
      .trim()
      .toUpperCase();
    const cargaHorariaMensalReferencia = normalizarNumero(
      body?.cargaHorariaMensalReferencia ?? body?.CARGA_HORARIA_MENSAL_REFERENCIA,
      0
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

    if (tipoSalario !== "MENSALISTA") {
      return NextResponse.json(
        { success: false, error: "TIPO_SALARIO_INVALIDO" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(salarioBase) || salarioBase <= 0) {
      return NextResponse.json(
        { success: false, error: "SALARIO_INVALIDO" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(cargaHorariaMensalReferencia) || cargaHorariaMensalReferencia <= 0) {
      return NextResponse.json(
        { success: false, error: "CARGA_HORARIA_INVALIDA" },
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
          SALARIO_BASE,
          TIPO_SALARIO,
          CARGA_HORARIA_MENSAL_REFERENCIA,
          OBSERVACOES,
          CRIADO_EM,
          ATUALIZADO_EM
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'), datetime('now'))
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
        salarioBase,
        tipoSalario,
        cargaHorariaMensalReferencia,
      ],
    });

    await atualizarSalario(novoId, salarioBase);

    const funcionario = await buscarFuncionario(empresaId, novoId, true);

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
  const empresaId = obterEmpresaIdDaRequest(request);

  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
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

    const funcionarioAtual = await buscarFuncionario(empresaId, id, true);

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
    const salarioBase = normalizarNumero(
      body?.salarioBase ?? body?.SALARIO_BASE,
      Number(funcionarioAtual.SALARIO_BASE ?? 0)
    );
    const tipoSalario = (body?.tipoSalario ?? body?.TIPO_SALARIO ?? funcionarioAtual.TIPO_SALARIO ?? "MENSALISTA")
      .toString()
      .trim()
      .toUpperCase();
    const cargaHorariaMensalReferencia = normalizarNumero(
      body?.cargaHorariaMensalReferencia ?? body?.CARGA_HORARIA_MENSAL_REFERENCIA,
      Number(funcionarioAtual.CARGA_HORARIA_MENSAL_REFERENCIA ?? 0)
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

    if (tipoSalario !== "MENSALISTA") {
      return NextResponse.json(
        { success: false, error: "TIPO_SALARIO_INVALIDO" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(salarioBase) || salarioBase <= 0) {
      return NextResponse.json(
        { success: false, error: "SALARIO_INVALIDO" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(cargaHorariaMensalReferencia) || cargaHorariaMensalReferencia <= 0) {
      return NextResponse.json(
        { success: false, error: "CARGA_HORARIA_INVALIDA" },
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
    const salarioVigente = await getSalarioAtual(id);

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
               SALARIO_BASE = ?,
               TIPO_SALARIO = ?,
               CARGA_HORARIA_MENSAL_REFERENCIA = ?,
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
        salarioBase,
        tipoSalario,
        cargaHorariaMensalReferencia,
        empresaId,
        id,
      ],
    });

    if (salarioVigente?.VALOR !== salarioBase) {
      await atualizarSalario(id, salarioBase);
    }

    const funcionarioAtualizado = await buscarFuncionario(empresaId, id, true);

    return NextResponse.json({ success: true, data: funcionarioAtualizado });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "ERRO_INESPERADO" },
      { status: 500 }
    );
  }
}
