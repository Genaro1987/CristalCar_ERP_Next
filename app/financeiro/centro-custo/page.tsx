"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { useMemo, useState, useEffect } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";
import {
  BarraFiltros,
  FiltroPadrao,
  ModalOverlay,
} from "../_components/financeiro-layout";

interface CentroCustoItem {
  id: string;
  nome: string;
  codigo: string;
  status: "ativo" | "inativo";
  descricao?: string;
  filhos?: CentroCustoItem[];
}

function filtrarCentros(dados: CentroCustoItem[], filtro: FiltroPadrao): CentroCustoItem[] {
  const buscaNormalizada = filtro.busca.trim().toLowerCase();

  const atendeFiltro = (item: CentroCustoItem) => {
    const statusOk =
      filtro.status === "todos" ||
      (filtro.status === "ativos" && item.status === "ativo") ||
      (filtro.status === "inativos" && item.status === "inativo");
    const buscaOk = buscaNormalizada
      ? `${item.codigo} ${item.nome}`.toLowerCase().includes(buscaNormalizada)
      : true;
    return statusOk && buscaOk;
  };

  return dados.flatMap<CentroCustoItem>((item) => {
    const filhosFiltrados = item.filhos ? filtrarCentros(item.filhos, filtro) : [];
    const corresponde = atendeFiltro(item);
    if (corresponde || filhosFiltrados.length > 0) {
      return [{ ...item, filhos: filhosFiltrados }];
    }
    return [];
  });
}

export default function CentroCustoPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/centro-custo";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_CENTRO_CUSTO";
  const nomeTela = tela?.NOME_TELA ?? "CENTRO DE CUSTO";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "ativos" });
  const [selecionado, setSelecionado] = useState<CentroCustoItem | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState<"novo" | "editar">("novo");
  const [centros, setCentros] = useState<CentroCustoItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!empresa?.id) return;

    const buscarCentros = async () => {
      try {
        setCarregando(true);
        const resposta = await fetch("/api/financeiro/centro-custo", {
          headers: { "x-empresa-id": String(empresa.id) },
        });
        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) setCentros(dados.data);
        }
      } catch (erro) {
        console.error("Erro ao buscar centros de custo:", erro);
      } finally {
        setCarregando(false);
      }
    };
    buscarCentros();
  }, [empresa?.id]);

  const arvoreFiltrada = useMemo(() => filtrarCentros(centros, filtro), [centros, filtro]);

  const handleEditar = (item: CentroCustoItem) => {
    setSelecionado(item);
    setModoEdicao("editar");
    setModalAberto(true);
  };

  const renderNo = (item: CentroCustoItem) => {
    const estaSelecionado = selecionado?.id === item.id;

    return (
      <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          className={`tree-node${estaSelecionado ? " selected" : ""}`}
          onClick={() => setSelecionado(item)}
          style={{ cursor: "pointer" }}
        >
          <div className="tree-node-header">
            <div>
              <p className="tree-node-code">{item.codigo}</p>
              <p className="tree-node-name">{item.nome}</p>
              {item.descricao && <p className="tree-node-meta">{item.descricao}</p>}
            </div>
            <span className={item.status === "ativo" ? "badge badge-success" : "badge badge-danger"}>
              {item.status === "ativo" ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="tree-node-actions">
            <button
              type="button"
              className="button button-secondary button-compact"
              onClick={(e) => { e.stopPropagation(); handleEditar(item); }}
            >
              Editar
            </button>
          </div>
        </div>
        {item.filhos && item.filhos.length > 0 ? (
          <div className="tree-children">
            {item.filhos.map((filho) => renderNo(filho))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <LayoutShell>
      <div className="page-container financeiro-page">
        <HeaderBar
          nomeTela={nomeTela}
          codigoTela={codigoTela}
          caminhoRota={caminhoTela}
          modulo={moduloTela}
        />

        <main className="page-content-card">
          <div className="departamentos-page">
            <div className="split-view">
              {/* LEFT: Tree */}
              <section className="split-view-panel">
                <div className="section-header">
                  <div>
                    <h2>Estrutura de centros de custo</h2>
                    <p>Organize agrupamentos e mantenha a hierarquia alinhada ao orçamento.</p>
                  </div>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => { setModoEdicao("novo"); setModalAberto(true); }}
                  >
                    Novo
                  </button>
                </div>

                <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))} />

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {carregando ? (
                    <div className="empty-state">
                      <p>Carregando centros de custo...</p>
                    </div>
                  ) : arvoreFiltrada.length === 0 ? (
                    <div className="empty-state">
                      <strong>Nenhum centro de custo encontrado</strong>
                      <p>Ajuste os filtros ou cadastre um novo centro.</p>
                    </div>
                  ) : (
                    arvoreFiltrada.map((item) => renderNo(item))
                  )}
                </div>
              </section>

              {/* RIGHT: Details */}
              <section className="split-view-panel">
                <header className="form-section-header">
                  <h2>Centro selecionado</h2>
                  <p>Reveja nomes, códigos e observações para orientar lançamentos e relatórios.</p>
                </header>

                {selecionado ? (
                  <div className="detail-card">
                    <div className="detail-grid">
                      <div>
                        <p className="detail-label">Código</p>
                        <p className="detail-value">{selecionado.codigo}</p>
                      </div>
                      <div>
                        <p className="detail-label">Status</p>
                        <p className="detail-value">{selecionado.status === "ativo" ? "Ativo" : "Inativo"}</p>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <p className="detail-label">Título</p>
                        <p className="detail-value">{selecionado.nome}</p>
                      </div>
                    </div>
                    <div>
                      <p className="detail-label">Descrição</p>
                      <p className="detail-description">
                        {selecionado.descricao || "Inclua orientações para quem faz lançamentos"}
                      </p>
                    </div>
                    <div className="button-row">
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => handleEditar(selecionado)}
                      >
                        Editar centro
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <strong>Selecione um centro para visualizar detalhes</strong>
                    <p>Use o painel da esquerda para navegar.</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </main>
      </div>

      <ModalOverlay
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        titulo={modoEdicao === "novo" ? "Novo centro de custo" : "Editar centro de custo"}
      >
        <form className="form">
          <div className="form-grid two-columns">
            <div className="form-group">
              <label htmlFor="centro-nome">Nome *</label>
              <input id="centro-nome" className="form-input" placeholder="Ex: Operações Norte" />
            </div>
            <div className="form-group">
              <label htmlFor="centro-codigo">Código *</label>
              <input id="centro-codigo" className="form-input" placeholder="02.04" />
            </div>
          </div>
          <div className="form-grid two-columns">
            <div className="form-group">
              <label htmlFor="centro-status">Status</label>
              <select id="centro-status" className="form-input">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="centro-observacao">Observações</label>
            <textarea
              id="centro-observacao"
              className="form-input"
              style={{ minHeight: 100 }}
              placeholder="Regras de rateio, aprovadores ou integrações esperadas"
            />
          </div>
          <div className="form-actions departamentos-actions">
            <div className="button-row">
              <button type="button" className="button button-primary">Salvar</button>
              <button type="button" className="button button-secondary" onClick={() => setModalAberto(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </form>
      </ModalOverlay>
    </LayoutShell>
  );
}
