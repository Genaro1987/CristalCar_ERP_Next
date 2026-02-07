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

interface LinhaDre {
  id: string;
  nome: string;
  codigo: string;
  natureza: "RECEITA" | "DESPESA" | "OUTROS";
  status: "ativo" | "inativo";
  tipo?: string;
  descricao?: string;
  contasVinculadas?: string[];
  filhos?: LinhaDre[];
}

interface PlanoContaOption {
  id: number;
  label: string;
}

function filtrarDre(dados: LinhaDre[], filtro: FiltroPadrao): LinhaDre[] {
  const buscaNormalizada = filtro.busca.trim().toLowerCase();

  const atendeFiltro = (item: LinhaDre) => {
    const statusOk =
      filtro.status === "todos" ||
      (filtro.status === "ativos" && item.status === "ativo") ||
      (filtro.status === "inativos" && item.status === "inativo");
    const buscaOk = buscaNormalizada
      ? `${item.codigo} ${item.nome}`.toLowerCase().includes(buscaNormalizada)
      : true;

    return statusOk && buscaOk;
  };

  return dados.flatMap((item) => {
    const filhosFiltrados = item.filhos ? filtrarDre(item.filhos, filtro) : [];
    const corresponde = atendeFiltro(item);
    if (corresponde || filhosFiltrados.length > 0) {
      return [{ ...item, filhos: filhosFiltrados }];
    }
    return [];
  });
}

export default function EstruturaDrePage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/estrutura-dre";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_ESTRUTURA_DRE";
  const nomeTela = tela?.NOME_TELA ?? "Estrutura do DRE";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [filtro, setFiltro] = useState<FiltroPadrao>({ busca: "", status: "ativos" });
  const [selecionada, setSelecionada] = useState<LinhaDre | null>(null);
  const [modalLinha, setModalLinha] = useState(false);
  const [modalConta, setModalConta] = useState(false);
  const [linhasDre, setLinhasDre] = useState<LinhaDre[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [planoContas, setPlanoContas] = useState<PlanoContaOption[]>([]);

  useEffect(() => {
    if (!empresa?.id) return;

    const buscarDre = async () => {
      try {
        setCarregando(true);
        const resposta = await fetch("/api/financeiro/estrutura-dre", {
          headers: {
            "x-empresa-id": String(empresa.id),
          },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            setLinhasDre(dados.data);
          }
        }
      } catch (erro) {
        console.error("Erro ao buscar estrutura DRE:", erro);
      } finally {
        setCarregando(false);
      }
    };

    buscarDre();
  }, [empresa?.id]);

  useEffect(() => {
    if (!empresa?.id) return;

    const carregarPlanoContas = async () => {
      try {
        const resposta = await fetch("/api/financeiro/plano-contas", {
          headers: { "x-empresa-id": String(empresa.id) },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados.success) {
            const opcoes = (dados.data ?? []).map((item: any) => ({
              id: item.FIN_PLANO_CONTA_ID,
              label: `${item.FIN_PLANO_CONTA_CODIGO} ${item.FIN_PLANO_CONTA_NOME}`,
            }));
            setPlanoContas(opcoes);
          }
        }
      } catch (erro) {
        console.error("Erro ao carregar plano de contas:", erro);
      }
    };

    carregarPlanoContas();
  }, [empresa?.id]);

  const arvoreFiltrada = useMemo(() => filtrarDre(linhasDre, filtro), [linhasDre, filtro]);

  const renderNo = (item: LinhaDre) => {
    const estaSelecionada = selecionada?.id === item.id;

    return (
      <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          className={`tree-node${estaSelecionada ? " selected" : ""}`}
          onClick={() => setSelecionada(item)}
          style={{ cursor: "pointer" }}
        >
          <div className="tree-node-header">
            <div>
              <p className="tree-node-code">{item.codigo}</p>
              <p className="tree-node-name">{item.nome}</p>
              <p className="tree-node-meta">
                Natureza: {item.natureza} {item.tipo ? `| Tipo: ${item.tipo}` : ""}
              </p>
            </div>
            <span className={item.status === "ativo" ? "badge badge-success" : "badge badge-danger"}>
              {item.status === "ativo" ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="tree-node-actions">
            <button
              type="button"
              className="button button-secondary button-compact"
              onClick={(e) => { e.stopPropagation(); setModalLinha(true); }}
            >
              Novo filho
            </button>
            <button
              type="button"
              className="button button-secondary button-compact"
              onClick={(e) => { e.stopPropagation(); setModalLinha(true); }}
            >
              Editar
            </button>
            <button
              type="button"
              className="button button-primary button-compact"
              onClick={(e) => { e.stopPropagation(); setSelecionada(item); }}
            >
              Ver detalhes
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

  const contasSelecionadas = selecionada?.contasVinculadas ?? [];

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
                    <h2>Árvore da estrutura do DRE</h2>
                    <p>Estruture linhas e conecte contas para garantir o fechamento correto do resultado.</p>
                  </div>
                  <button type="button" className="button button-primary" onClick={() => setModalLinha(true)}>
                    Nova linha
                  </button>
                </div>

                <BarraFiltros filtro={filtro} onFiltroChange={(novo) => setFiltro((f) => ({ ...f, ...novo }))} />

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {carregando ? (
                    <div className="empty-state">
                      <p>Carregando estrutura DRE...</p>
                    </div>
                  ) : arvoreFiltrada.length === 0 ? (
                    <div className="empty-state">
                      <strong>Nenhuma linha do DRE encontrada</strong>
                      <p>Ajuste os filtros ou cadastre uma nova linha.</p>
                    </div>
                  ) : (
                    arvoreFiltrada.map((item) => renderNo(item))
                  )}
                </div>
              </section>

              {/* RIGHT: Details + Linked accounts */}
              <section className="split-view-panel">
                <header className="form-section-header">
                  <h2>Linha selecionada</h2>
                  <p>Consulte a descrição da linha, natureza e comportamento antes de conectar ao plano de contas.</p>
                </header>

                {selecionada ? (
                  <div className="detail-card">
                    <div className="detail-grid">
                      <div>
                        <p className="detail-label">Código</p>
                        <p className="detail-value">{selecionada.codigo}</p>
                      </div>
                      <div>
                        <p className="detail-label">Status</p>
                        <p className="detail-value">{selecionada.status === "ativo" ? "Ativo" : "Inativo"}</p>
                      </div>
                      <div>
                        <p className="detail-label">Natureza</p>
                        <p className="detail-value">{selecionada.natureza}</p>
                      </div>
                      <div>
                        <p className="detail-label">Tipo</p>
                        <p className="detail-value">{selecionada.tipo ?? "Livre"}</p>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <p className="detail-label">Título</p>
                        <p className="detail-value">{selecionada.nome}</p>
                      </div>
                    </div>
                    <div>
                      <p className="detail-label">Regras e comentários</p>
                      <p className="detail-description">
                        {selecionada.descricao || "Sem descrição cadastrada para esta linha."}
                      </p>
                    </div>
                    <div className="button-row">
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setModalLinha(true)}
                      >
                        Editar linha
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <strong>Selecione uma linha para visualizar detalhes</strong>
                    <p>Use o painel da esquerda para navegar.</p>
                  </div>
                )}

                {/* Linked accounts section */}
                <div style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
                  <div className="section-header">
                    <div>
                      <h3>Contas vinculadas</h3>
                      <p>Plano de contas conectado a esta linha do DRE.</p>
                    </div>
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => setModalConta(true)}
                      disabled={!selecionada}
                    >
                      Vincular conta
                    </button>
                  </div>

                  {selecionada ? (
                    contasSelecionadas.length > 0 ? (
                      <div className="detail-card">
                        {contasSelecionadas.map((conta) => (
                          <div
                            key={conta}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              backgroundColor: "#ffffff",
                              fontSize: "0.9rem",
                            }}
                          >
                            <span>{conta}</span>
                            <button
                              type="button"
                              className="button button-secondary button-compact"
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <p>Nenhuma conta associada a esta linha.</p>
                      </div>
                    )
                  ) : (
                    <div className="empty-state">
                      <strong>Selecione uma linha</strong>
                      <p>Para vincular contas, selecione primeiro uma linha no painel da esquerda.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      {/* Modal: New/Edit DRE line */}
      <ModalOverlay
        aberto={modalLinha}
        onClose={() => setModalLinha(false)}
        titulo="Cadastro de linha do DRE"
      >
        <form className="form">
          <div className="form-grid two-columns">
            <div className="form-group">
              <label htmlFor="dre-linha-nome">Nome da linha *</label>
              <input
                id="dre-linha-nome"
                className="form-input"
                placeholder="Ex: Resultado Operacional"
              />
            </div>
            <div className="form-group">
              <label htmlFor="dre-linha-codigo">Código *</label>
              <input id="dre-linha-codigo" className="form-input" placeholder="1.2.1" />
            </div>
          </div>
          <div className="form-grid two-columns">
            <div className="form-group">
              <label htmlFor="dre-linha-natureza">Natureza</label>
              <select id="dre-linha-natureza" className="form-input">
                <option value="RECEITA">Receita</option>
                <option value="DESPESA">Despesa</option>
                <option value="OUTROS">Outros</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="dre-linha-tipo">Tipo</label>
              <select id="dre-linha-tipo" className="form-input">
                <option value="Fixo">Fixo</option>
                <option value="Variável">Variável</option>
                <option value="Calculado">Calculado</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="dre-linha-descricao">Descrição</label>
            <textarea
              id="dre-linha-descricao"
              className="form-input"
              style={{ minHeight: 100 }}
              placeholder="Explique como calcular e consolidar esta linha"
            />
          </div>
          <div className="form-actions departamentos-actions">
            <div className="button-row">
              <button type="button" className="button button-primary">Salvar</button>
              <button type="button" className="button button-secondary" onClick={() => setModalLinha(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </form>
      </ModalOverlay>

      {/* Modal: Link accounts */}
      <ModalOverlay
        aberto={modalConta}
        onClose={() => setModalConta(false)}
        titulo="Vincular contas ao DRE"
      >
        <form className="form">
          <div className="form-grid two-columns">
            <div className="form-group">
              <label htmlFor="dre-busca-conta">Buscar contas</label>
              <input
                id="dre-busca-conta"
                className="form-input"
                placeholder="Digite nome ou código"
              />
            </div>
            <div className="form-group" style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="button" className="button button-secondary">
                Aplicar filtro
              </button>
            </div>
          </div>

          <div>
            <p className="detail-label">Sugestões por plano de contas</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {planoContas.slice(0, 6).map((conta) => (
                <span key={conta.id} className="badge" style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
                  {conta.label}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="detail-label">Seleção atual</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {contasSelecionadas.length > 0 ? (
                contasSelecionadas.map((conta) => (
                  <span key={conta} className="badge badge-warning">
                    {conta}
                    <button
                      type="button"
                      style={{ marginLeft: 6, background: "none", border: "none", cursor: "pointer", fontWeight: 600, color: "#92400e" }}
                    >
                      remover
                    </button>
                  </span>
                ))
              ) : (
                <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>Nenhuma conta selecionada.</p>
              )}
            </div>
          </div>

          <div className="form-actions departamentos-actions">
            <div className="button-row">
              <button type="button" className="button button-primary">Salvar vínculos</button>
              <button type="button" className="button button-secondary" onClick={() => setModalConta(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </form>
      </ModalOverlay>
    </LayoutShell>
  );
}
