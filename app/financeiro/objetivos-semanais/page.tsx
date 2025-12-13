"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { NotificationBar } from "@/components/NotificationBar";

const semanas = [
  { semana: "Semana 1", foco: "Receitas", observacao: "Priorizar campanhas digitais" },
  { semana: "Semana 2", foco: "Custos", observacao: "Revisar contratos e insumos" },
  { semana: "Semana 3", foco: "Caixa", observacao: "Ajustar prazos de pagamento" },
];

export default function ObjetivosSemanaisPage() {
  return (
    <LayoutShell>
      <HeaderBar
        codigoTela="FIN_OBJETIVOS_SEMANAIS"
        nomeTela="Objetivos Semanais"
        caminhoRota="/financeiro/objetivos-semanais"
        modulo="FINANCEIRO"
      />

      <NotificationBar
        type="info"
        message="Em construção / MVP: acompanhamento semanal será filtrado por ID_EMPRESA e integrado às metas gerais."
      />

      <div className="rounded border border-gray-200 bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-orange-600">Roadmap semanal</h2>
          <span className="rounded bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">Multiempresa</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {semanas.map((item) => (
            <div key={item.semana} className="rounded border border-dashed border-gray-200 bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-800">{item.semana}</p>
              <p className="text-xs text-gray-600">Foco: {item.foco}</p>
              <p className="mt-1 text-xs text-gray-600">Observação: {item.observacao}</p>
              <div className="mt-2 rounded bg-white p-2 text-[11px] text-gray-600">
                Placeholder para metas semanais por empresa/centro de custo.
              </div>
            </div>
          ))}
        </div>
      </div>
    </LayoutShell>
  );
}
