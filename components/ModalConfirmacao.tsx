"use client";

import { useEffect, useRef } from "react";

interface ModalConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  textoBotaoConfirmar?: string;
  textoBotaoCancelar?: string;
  tipo?: "danger" | "warning" | "info";
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalConfirmacao({
  aberto,
  titulo,
  mensagem,
  textoBotaoConfirmar = "Confirmar",
  textoBotaoCancelar = "Cancelar",
  tipo = "danger",
  onConfirmar,
  onCancelar,
}: ModalConfirmacaoProps) {
  const refConfirmar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (aberto) {
      refConfirmar.current?.focus();
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelar();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [aberto, onCancelar]);

  if (!aberto) return null;

  const iconColor =
    tipo === "danger" ? "#dc2626" : tipo === "warning" ? "#f59e0b" : "#3b82f6";
  const btnClass =
    tipo === "danger"
      ? "button button-danger"
      : tipo === "warning"
        ? "button button-primary"
        : "button button-primary";

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
        <div className="modal-confirmacao-icon" style={{ color: iconColor }}>
          {tipo === "danger" ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
        </div>
        <h3 className="modal-confirmacao-titulo">{titulo}</h3>
        <p className="modal-confirmacao-mensagem">{mensagem}</p>
        <div className="modal-confirmacao-acoes">
          <button
            type="button"
            className="button button-secondary"
            onClick={onCancelar}
          >
            {textoBotaoCancelar}
          </button>
          <button
            ref={refConfirmar}
            type="button"
            className={btnClass}
            onClick={onConfirmar}
          >
            {textoBotaoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
