"use client";

import { useState } from "react";

interface FuncionarioOption {
  ID_FUNCIONARIO: string;
  NOME_COMPLETO: string;
}

interface ModalExportacaoProps {
  isOpen: boolean;
  onClose: () => void;
  funcionarios: FuncionarioOption[];
  onExportar: (opcoes: OpcoesExportacao) => Promise<void>;
}

export interface OpcoesExportacao {
  funcionariosSelecionados: string[];
  exportarPDF: boolean;
  exportarExcel: boolean;
  todosFuncionarios: boolean;
}

export function ModalExportacao({ isOpen, onClose, funcionarios, onExportar }: ModalExportacaoProps) {
  const [todosFuncionarios, setTodosFuncionarios] = useState(true);
  const [funcionariosSelecionados, setFuncionariosSelecionados] = useState<string[]>([]);
  const [exportarPDF, setExportarPDF] = useState(true);
  const [exportarExcel, setExportarExcel] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleToggleFuncionario = (id: string) => {
    if (funcionariosSelecionados.includes(id)) {
      setFuncionariosSelecionados(funcionariosSelecionados.filter((f) => f !== id));
    } else {
      setFuncionariosSelecionados([...funcionariosSelecionados, id]);
    }
  };

  const handleExportar = async () => {
    if (!exportarPDF && !exportarExcel) {
      alert("Selecione pelo menos um formato de exportação");
      return;
    }

    if (!todosFuncionarios && funcionariosSelecionados.length === 0) {
      alert("Selecione pelo menos um funcionário");
      return;
    }

    setLoading(true);
    try {
      await onExportar({
        funcionariosSelecionados: todosFuncionarios
          ? funcionarios.map((f) => f.ID_FUNCIONARIO)
          : funcionariosSelecionados,
        exportarPDF,
        exportarExcel,
        todosFuncionarios,
      });
      onClose();
    } catch (error) {
      console.error("Erro ao exportar:", error);
      alert("Erro ao exportar arquivos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: "16px", fontSize: "20px", fontWeight: 600 }}>
          Exportar Banco de Horas
        </h2>

        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 500 }}>
            Formatos de Exportação
          </h3>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={exportarPDF}
              onChange={(e) => setExportarPDF(e.target.checked)}
            />
            <span>PDF (Registro de Ponto com Assinatura)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={exportarExcel}
              onChange={(e) => setExportarExcel(e.target.checked)}
            />
            <span>Excel (Para Contabilidade)</span>
          </label>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: 500 }}>
            Funcionários
          </h3>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", cursor: "pointer" }}>
            <input
              type="radio"
              checked={todosFuncionarios}
              onChange={() => setTodosFuncionarios(true)}
            />
            <span>Todos os funcionários</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", cursor: "pointer" }}>
            <input
              type="radio"
              checked={!todosFuncionarios}
              onChange={() => setTodosFuncionarios(false)}
            />
            <span>Selecionar funcionários</span>
          </label>

          {!todosFuncionarios && (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "12px",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              {funcionarios.map((func) => (
                <label
                  key={func.ID_FUNCIONARIO}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 0",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={funcionariosSelecionados.includes(func.ID_FUNCIONARIO)}
                    onChange={() => handleToggleFuncionario(func.ID_FUNCIONARIO)}
                  />
                  <span>{func.NOME_COMPLETO}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={loading}
            className="button"
            style={{
              backgroundColor: "#f1f5f9",
              color: "#475569",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleExportar}
            disabled={loading}
            className="button button-primary"
          >
            {loading ? "Exportando..." : "Exportar"}
          </button>
        </div>
      </div>
    </div>
  );
}
