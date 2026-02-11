import { db } from "@/db/client";

interface AuditLogParams {
  tabela: string;
  registroId: number;
  operacao: "INSERT" | "UPDATE" | "DELETE";
  dadosAntes?: string | null;
  dadosDepois?: string | null;
  descricao?: string;
}

export async function registrarAuditLog(
  empresaId: number,
  params: AuditLogParams
): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO AUDIT_LOG (
        EMPRESA_ID, TABELA, REGISTRO_ID, OPERACAO,
        DADOS_ANTES, DADOS_DEPOIS, DESCRICAO
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        empresaId,
        params.tabela,
        params.registroId,
        params.operacao,
        params.dadosAntes || null,
        params.dadosDepois || null,
        params.descricao || null,
      ],
    });
  } catch (error) {
    // Log silently - audit failures should not block operations
    console.error("Erro ao registrar audit log:", error);
  }
}
