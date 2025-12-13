"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";

const filtros = [
  "Período",
  "Plano de Conta",
  "Centro de Custo",
  "Forma de Pagamento",
];

const colunas = [
  "Data",
  "Histórico",
  "Conta",
  "Centro de Custo",
  "Valor",
];

export default function LancamentosPage() {
  return (
    <LayoutShell>
      <HeaderBar
        codigoTela="FIN_LANCAMENTOS"
        nomeTela="Lançamentos (Caixa)"
        caminhoRota="/financeiro/lancamentos"
        modulo="FINANCEIRO"
      />

      <NotificationBar
        type="info"
        message="Em construção / MVP: os lançamentos serão exibidos filtrando por ID_EMPRESA e respeitando permissões da tela."
      />

      <div className="rounded border border-gray-200 bg-white p-4 shadow">
        <h2 className="text-base font-semibold text-orange-600">Filtros principais</h2>
        <p className="text-sm text-gray-600">
          Cada filtro deve aplicar automaticamente o contexto da empresa ativa. Selecione a empresa antes de incluir dados.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {filtros.map((filtro) => (
            <div
              key={filtro}
              className="rounded border border-dashed border-orange-200 bg-orange-50/40 p-3 text-sm text-gray-700"
            >
              {filtro} (placeholder)
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-4 shadow-inner">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Tabela de lançamentos</h3>
          <span className="rounded bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            ID_EMPRESA obrigatório
          </span>
        </div>
        <div className="overflow-x-auto rounded border border-dashed border-gray-200 bg-white p-3 text-xs text-gray-700">
          <div className="mb-2 flex gap-4 text-gray-500">
            {colunas.map((coluna) => (
              <span key={coluna} className="font-semibold text-gray-700">
                {coluna}
              </span>
            ))}
          </div>
          <p className="text-gray-500">
            Linhas fictícias serão substituídas por dados reais após integrar as APIs financeiras com filtro por ID_EMPRESA e
            validação de permissão.
          </p>
        </div>
      </div>
    </LayoutShell>
  );
}
