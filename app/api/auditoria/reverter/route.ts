import { NextRequest, NextResponse } from "next/server";
import { obterEmpresaIdDaRequest, respostaEmpresaNaoSelecionada } from "@/app/api/_utils/empresa";
import { registrarAuditLog } from "@/app/api/_utils/auditLog";
import { db } from "@/db/client";

export async function POST(request: NextRequest) {
  const empresaId = obterEmpresaIdDaRequest(request);
  if (!empresaId) {
    return respostaEmpresaNaoSelecionada();
  }

  try {
    const body = await request.json();
    const { auditLogId } = body;

    if (!auditLogId) {
      return NextResponse.json(
        { success: false, error: "ID do log de auditoria é obrigatório" },
        { status: 400 }
      );
    }

    // Fetch the audit log entry
    const logResult = await db.execute({
      sql: `SELECT * FROM AUDIT_LOG WHERE AUDIT_LOG_ID = ? AND EMPRESA_ID = ?`,
      args: [auditLogId, empresaId],
    });

    if (logResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Registro de auditoria não encontrado" },
        { status: 404 }
      );
    }

    const logEntry = logResult.rows[0] as any;

    if (logEntry.REVERTIDO === 1) {
      return NextResponse.json(
        { success: false, error: "Este registro já foi revertido" },
        { status: 400 }
      );
    }

    const tabela = logEntry.TABELA;
    const operacao = logEntry.OPERACAO;
    const registroId = logEntry.REGISTRO_ID;
    const dadosAntes = logEntry.DADOS_ANTES ? JSON.parse(logEntry.DADOS_ANTES) : null;

    // Handle reversion based on operation type and table
    if (tabela === "FIN_LANCAMENTO") {
      if (operacao === "DELETE" && dadosAntes) {
        // Restore deleted record
        await db.execute({
          sql: `INSERT INTO FIN_LANCAMENTO (
            FIN_LANCAMENTO_ID, FIN_LANCAMENTO_DATA, FIN_LANCAMENTO_HISTORICO,
            FIN_LANCAMENTO_VALOR, FIN_PLANO_CONTA_ID, FIN_CENTRO_CUSTO_ID,
            FIN_LANCAMENTO_DOCUMENTO, FIN_LANCAMENTO_STATUS,
            FIN_LANCAMENTO_PESSOA_ID, FIN_LANCAMENTO_PLACA, EMPRESA_ID
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            registroId,
            dadosAntes.data,
            dadosAntes.historico,
            dadosAntes.valor,
            dadosAntes.contaId,
            dadosAntes.centroCustoId || null,
            dadosAntes.documento || null,
            dadosAntes.status || "confirmado",
            dadosAntes.pessoaId || null,
            dadosAntes.placa || null,
            empresaId,
          ],
        });
      } else if (operacao === "UPDATE" && dadosAntes) {
        // Restore previous values
        await db.execute({
          sql: `UPDATE FIN_LANCAMENTO SET
            FIN_LANCAMENTO_DATA = ?,
            FIN_LANCAMENTO_HISTORICO = ?,
            FIN_LANCAMENTO_VALOR = ?,
            FIN_PLANO_CONTA_ID = ?,
            FIN_CENTRO_CUSTO_ID = ?,
            FIN_LANCAMENTO_DOCUMENTO = ?,
            FIN_LANCAMENTO_STATUS = ?,
            FIN_LANCAMENTO_PESSOA_ID = ?,
            FIN_LANCAMENTO_PLACA = ?,
            FIN_LANCAMENTO_ATUALIZADO_EM = datetime('now')
          WHERE FIN_LANCAMENTO_ID = ? AND EMPRESA_ID = ?`,
          args: [
            dadosAntes.data,
            dadosAntes.historico,
            dadosAntes.valor,
            dadosAntes.contaId,
            dadosAntes.centroCustoId || null,
            dadosAntes.documento || null,
            dadosAntes.status || "confirmado",
            dadosAntes.pessoaId || null,
            dadosAntes.placa || null,
            registroId,
            empresaId,
          ],
        });
      } else if (operacao === "INSERT") {
        // Remove the inserted record
        await db.execute({
          sql: `DELETE FROM FIN_LANCAMENTO WHERE FIN_LANCAMENTO_ID = ? AND EMPRESA_ID = ?`,
          args: [registroId, empresaId],
        });
      }
    } else if (tabela === "RH_PONTO_LANCAMENTO") {
      if (operacao === "DELETE" && dadosAntes) {
        await db.execute({
          sql: `INSERT INTO RH_PONTO_LANCAMENTO (
            RH_PONTO_ID, ID_FUNCIONARIO, RH_PONTO_DATA,
            RH_PONTO_ENTRADA, RH_PONTO_SAIDA_ALMOCO, RH_PONTO_VOLTA_ALMOCO,
            RH_PONTO_SAIDA, RH_PONTO_OBSERVACAO, EMPRESA_ID
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            registroId,
            dadosAntes.funcionarioId,
            dadosAntes.data,
            dadosAntes.entrada || null,
            dadosAntes.saidaAlmoco || null,
            dadosAntes.voltaAlmoco || null,
            dadosAntes.saida || null,
            dadosAntes.observacao || null,
            empresaId,
          ],
        });
      } else if (operacao === "UPDATE" && dadosAntes) {
        await db.execute({
          sql: `UPDATE RH_PONTO_LANCAMENTO SET
            RH_PONTO_ENTRADA = ?,
            RH_PONTO_SAIDA_ALMOCO = ?,
            RH_PONTO_VOLTA_ALMOCO = ?,
            RH_PONTO_SAIDA = ?,
            RH_PONTO_OBSERVACAO = ?
          WHERE RH_PONTO_ID = ? AND EMPRESA_ID = ?`,
          args: [
            dadosAntes.entrada || null,
            dadosAntes.saidaAlmoco || null,
            dadosAntes.voltaAlmoco || null,
            dadosAntes.saida || null,
            dadosAntes.observacao || null,
            registroId,
            empresaId,
          ],
        });
      }
    }

    // Mark audit log as reverted
    await db.execute({
      sql: `UPDATE AUDIT_LOG SET REVERTIDO = 1, DATA_REVERSAO = datetime('now')
            WHERE AUDIT_LOG_ID = ?`,
      args: [auditLogId],
    });

    // Register the reversion itself as audit log
    await registrarAuditLog(empresaId, {
      tabela,
      registroId,
      operacao: "UPDATE",
      dadosAntes: logEntry.DADOS_DEPOIS,
      dadosDepois: logEntry.DADOS_ANTES,
      descricao: `Reversão do log #${auditLogId} (${operacao} em ${tabela})`,
    });

    return NextResponse.json({
      success: true,
      message: "Operação revertida com sucesso",
    });
  } catch (error) {
    console.error("Erro ao reverter operação:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao reverter operação" },
      { status: 500 }
    );
  }
}
