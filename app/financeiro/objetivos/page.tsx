"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";

const objetivos = [
  {
    titulo: "Receita Mensal",
    descricao: "Meta consolidada por empresa, alinhada ao DRE e ao fluxo de caixa.",
  },
  {
    titulo: "Margem",
    descricao: "Indicador para acompanhar margem de contribuição por centro de custo.",
  },
  {
    titulo: "Investimentos",
    descricao: "Planejamento de CAPEX/OPEX com vínculo a contas e centros de custo.",
  },
];

export default function ObjetivosPage() {
  return (
    <LayoutShell>
      <HeaderBar
        codigoTela="FIN_OBJETIVOS"
        nomeTela="Objetivos Financeiros"
        caminhoRota="/financeiro/objetivos"
        modulo="FINANCEIRO"
      />

      <NotificationBar
        type="info"
        message="Em construção / MVP: cadastros e acompanhamentos de objetivos ainda serão conectados ao backend multiempresa."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {objetivos.map((objetivo) => (
          <div key={objetivo.titulo} className="rounded border border-gray-200 bg-white p-4 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-orange-600">{objetivo.titulo}</h2>
              <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">EMPRESA_ID</span>
            </div>
            <p className="mt-2 text-sm text-gray-700">{objetivo.descricao}</p>
            <div className="mt-3 rounded border border-dashed border-gray-200 bg-orange-50/40 p-3 text-xs text-gray-700">
              Espaço para cards de progresso e metas semanais/mensais. Filtrar sempre pela empresa ativa.
            </div>
          </div>
        ))}
      </div>
    </LayoutShell>
  );
}
