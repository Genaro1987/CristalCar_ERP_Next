"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";

const cards = [
  {
    title: "Fluxo de Caixa",
    description:
      "Resumo rápido das entradas e saídas por empresa selecionada. Conectar a consolidação de lançamentos.",
  },
  {
    title: "Alertas",
    description:
      "Espaço para avisos de metas, contas a pagar/receber e apontamentos do DRE ainda em construção.",
  },
  {
    title: "Indicadores",
    description:
      "Widgets para margem, burn rate e atingimento de objetivos financeiros. Filtrar sempre por EMPRESA_ID.",
  },
];

export default function FinanceiroDashboardPage() {
  return (
    <LayoutShell>
      <HeaderBar
        codigoTela="FIN_DASHBOARD"
        nomeTela="Dashboard Financeiro"
        caminhoRota="/financeiro/dashboard"
        modulo="FINANCEIRO"
      />

      <NotificationBar
        type="info"
        message="Em construção / MVP: conectaremos os cards aos dados financeiros filtrando pela empresa ativa para evitar mistura de saldos."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded border border-gray-200 bg-gradient-to-br from-orange-50 to-gray-50 p-4 shadow"
          >
            <h2 className="text-lg font-bold text-orange-600">{card.title}</h2>
            <p className="mt-2 text-sm text-gray-700">{card.description}</p>
            <div className="mt-4 rounded border border-dashed border-orange-200 bg-white p-3 text-xs text-gray-600">
              Espaço reservado para gráficos e resumos. Garantir que cada consulta aplique EMPRESA_ID do usuário.
            </div>
          </div>
        ))}
      </div>
    </LayoutShell>
  );
}
