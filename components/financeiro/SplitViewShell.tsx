"use client";

import type { ReactNode } from "react";

interface SplitViewShellProps {
  title: string;
  subtitle: string;
  onNew: () => void;
  filters?: ReactNode;
  children: ReactNode;
  helpLink?: string;
  ctaLabel?: string;
  assinatura?: string;
}

export function SplitViewShell({
  title,
  subtitle,
  onNew,
  filters,
  children,
  helpLink,
  ctaLabel = "Novo",
  assinatura = "CHATGPT",
}: SplitViewShellProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold uppercase text-gray-900">{title}</h2>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
              {assinatura}
            </span>
          </div>
          <p className="text-sm text-gray-600">{subtitle}</p>
          {helpLink ? (
            <a
              href={helpLink}
              className="inline-flex items-center text-xs font-semibold uppercase text-orange-600 hover:text-orange-700"
            >
              Ajuda
            </a>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center justify-center rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold uppercase text-white shadow hover:bg-orange-600 focus:outline-none"
        >
          {ctaLabel}
        </button>
      </div>

      {filters ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-inner">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">{filters}</div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">{children}</div>
    </div>
  );
}
