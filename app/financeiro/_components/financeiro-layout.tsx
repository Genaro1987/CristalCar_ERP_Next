"use client";

import { useHelpContext } from "@/components/LayoutShell";
import { useMemo } from "react";

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
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              Ajuda
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNovo}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
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
}

export function BarraFiltros({ filtro, onFiltroChange, exibirNatureza = false }: BarraFiltrosProps) {
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700 md:col-span-2">
          Busca
          <input
            type="text"
            value={filtro.busca}
            onChange={(e) => onFiltroChange({ busca: e.target.value })}
            placeholder="Nome, código ou palavra-chave"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          Status
          <select
            value={filtro.status}
            onChange={(e) => onFiltroChange({ status: e.target.value as StatusFiltro })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
          >
            {opcoesStatus.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </label>

        {exibirNatureza ? (
          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            Natureza
            <select
              value={filtro.natureza ?? ""}
              onChange={(e) => onFiltroChange({ natureza: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-inner focus:border-orange-500 focus:outline-none"
            >
              <option value="">Todas</option>
              <option value="RECEITA">Receita</option>
              <option value="DESPESA">Despesa</option>
            </select>
          </label>
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
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Formulário</p>
            <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Fechar
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
