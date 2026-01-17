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
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {subtitulo}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
          <p className="text-sm text-gray-600">
            Explore, filtre e organize os cadastros com dados reais do financeiro.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`grid grid-cols-1 gap-4 ${exibirBusca ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {exibirBusca ? (
          <div className="form-group md:col-span-2">
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
      <p className="mt-3 text-xs text-gray-600">
        Use os filtros para validar hierarquias, status e preenchimentos obrigatórios antes de liberar cadastros para o time.
      </p>
    </div>
  );
}

interface SplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export function SplitView({ left, right }: SplitViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr,1fr]">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">{left}</div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">{right}</div>
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
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr,1.1fr,1fr]">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">{esquerda}</div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">{centro}</div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">{direita}</div>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Formulário</p>
            <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="button button-secondary button-compact"
          >
            Fechar
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
