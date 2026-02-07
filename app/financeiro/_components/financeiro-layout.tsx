"use client";

import { useHelpContext } from "@/components/LayoutShell";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type StatusFiltro = "todos" | "ativos" | "inativos";

export interface FiltroPadrao {
  busca: string;
  status: StatusFiltro;
  natureza?: string;
}

interface FinanceiroHeaderProps {
  titulo: string;
  subtitulo: string;
  onNovo: () => void;
  codigoAjuda?: string;
  nomeAjuda?: string;
}

export function FinanceiroPageHeader({
  titulo,
  subtitulo,
  onNovo,
  codigoAjuda,
  nomeAjuda,
}: FinanceiroHeaderProps) {
  const { abrirAjuda } = useHelpContext();

  return (
    <header className="page-header-wrapper">
      <div className="page-header-card">
        <div>
          <p className="detail-label">{subtitulo}</p>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#111827", margin: 0 }}>{titulo}</h1>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "2px 0 0" }}>
            Explore, filtre e organize os cadastros com dados reais do financeiro.
          </p>
        </div>
        <div className="button-row">
          {codigoAjuda ? (
            <button
              type="button"
              onClick={() => abrirAjuda(codigoAjuda, nomeAjuda ?? titulo)}
              className="button button-secondary"
            >
              Ajuda
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNovo}
            className="button button-primary"
          >
            Novo
          </button>
        </div>
      </div>
    </header>
  );
}

interface BarraFiltrosProps {
  filtro: FiltroPadrao;
  onFiltroChange: (novoFiltro: Partial<FiltroPadrao>) => void;
  exibirNatureza?: boolean;
  exibirBusca?: boolean;
}

export function BarraFiltros({
  filtro,
  onFiltroChange,
  exibirNatureza = false,
  exibirBusca = true,
}: BarraFiltrosProps) {
  const opcoesStatus = useMemo(
    () => [
      { label: "Todos", value: "todos" },
      { label: "Ativos", value: "ativos" },
      { label: "Inativos", value: "inativos" },
    ],
    []
  );

  return (
    <div className="detail-card">
      <div className="form-grid two-columns">
        {exibirBusca ? (
          <div className="form-group">
            <label htmlFor="financeiro-busca">Busca</label>
            <input
              id="financeiro-busca"
              type="text"
              value={filtro.busca}
              onChange={(e) => onFiltroChange({ busca: e.target.value })}
              placeholder="Nome, código ou palavra-chave"
              className="form-input"
            />
          </div>
        ) : null}

        <div className="form-group">
          <label htmlFor="financeiro-status">Status</label>
          <select
            id="financeiro-status"
            value={filtro.status}
            onChange={(e) => onFiltroChange({ status: e.target.value as StatusFiltro })}
            className="form-input"
          >
            {opcoesStatus.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </div>

        {exibirNatureza ? (
          <div className="form-group">
            <label htmlFor="financeiro-natureza">Natureza</label>
            <select
              id="financeiro-natureza"
              value={filtro.natureza ?? ""}
              onChange={(e) => onFiltroChange({ natureza: e.target.value })}
              className="form-input"
            >
              <option value="">Todas</option>
              <option value="RECEITA">Receita</option>
              <option value="DESPESA">Despesa</option>
            </select>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface SplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export function SplitView({ left, right }: SplitViewProps) {
  return (
    <div className="split-view">
      <div className="split-view-panel">{left}</div>
      <div className="split-view-panel">{right}</div>
    </div>
  );
}

interface DreLayoutProps {
  esquerda: React.ReactNode;
  centro: React.ReactNode;
  direita: React.ReactNode;
}

export function DreSplitView({ esquerda, centro, direita }: DreLayoutProps) {
  return (
    <div className="split-view" style={{ gridTemplateColumns: undefined }}>
      <div className="split-view-panel">{esquerda}</div>
      <div className="split-view-panel">{centro}</div>
      <div className="split-view-panel">{direita}</div>
    </div>
  );
}

export interface ModalProps {
  aberto: boolean;
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function ModalOverlay({ aberto, titulo, onClose, children }: ModalProps) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!aberto) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [aberto, onClose]);

  if (!aberto || !montado) return null;

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="form-section-header">
          <div>
            <p className="detail-label">Formulário</p>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", margin: 0 }}>{titulo}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="button button-secondary button-compact"
          >
            Fechar
          </button>
        </header>
        <div style={{ padding: "20px 24px" }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
