"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { NotificationBar } from "@/components/NotificationBar";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useEmpresaSelecionada } from "@/app/_hooks/useEmpresaSelecionada";
import { useRequerEmpresaSelecionada } from "@/app/_hooks/useRequerEmpresaSelecionada";
import { useTelaFinanceira } from "@/app/financeiro/_hooks/useTelaFinanceira";

type Lancamento = {
  id: string;
  data: string;
  historico: string;
  conta: string;
  contaId: number;
  centroCusto: string;
  centroCustoId: number | null;
  pessoaId: number | null;
  pessoaNome: string;
  placa: string;
  valor: number;
  tipo: "Entrada" | "Saída";
  status: "confirmado" | "pendente";
  documento?: string;
};

type PlanoContaOption = { id: number; label: string; natureza: string };
type CentroCustoOption = { id: number; label: string };
type PessoaOption = { id: number; nome: string; tipo: string; contaReceitaId: number | null; contaDespesaId: number | null };
type FuncionarioOption = { id: string; nome: string; salarioBase: number };

/** Retorna o dia útil anterior (pula fins de semana) */
function obterDiaUtilAnterior(): string {
  const hoje = new Date();
  const dia = hoje.getDay(); // 0=Dom, 1=Seg...6=Sab
  let offset = 1;
  if (dia === 0) offset = 2; // Domingo → Sexta
  if (dia === 1) offset = 3; // Segunda → Sexta
  const anterior = new Date(hoje);
  anterior.setDate(hoje.getDate() - offset);
  return anterior.toISOString().split("T")[0];
}

export default function LancamentosPage() {
  useRequerEmpresaSelecionada();
  const { empresa } = useEmpresaSelecionada();
  const caminhoRota = "/financeiro/lancamentos";
  const { tela } = useTelaFinanceira(caminhoRota);
  const codigoTela = tela?.CODIGO_TELA ?? "FIN_LANCAMENTOS";
  const nomeTela = tela?.NOME_TELA ?? "LANCAMENTOS (CAIXA)";
  const moduloTela = tela?.MODULO ?? "FINANCEIRO";
  const caminhoTela = tela?.CAMINHO_ROTA ?? caminhoRota;

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [periodo, setPeriodo] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  });
  const [busca, setBusca] = useState("");
  const [planoContas, setPlanoContas] = useState<PlanoContaOption[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoOption[]>([]);
  const [pessoas, setPessoas] = useState<PessoaOption[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Form state
  const [selecionado, setSelecionado] = useState<Lancamento | null>(null);
  const [formData, setFormData] = useState(obterDiaUtilAnterior);
  const [formHistorico, setFormHistorico] = useState("");
  const [formContaId, setFormContaId] = useState("");
  const [formCentroId, setFormCentroId] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formTipo, setFormTipo] = useState<"Entrada" | "Saída">("Saída");
  const [formDocumento, setFormDocumento] = useState("");
  const [formPessoaId, setFormPessoaId] = useState("");
  const [formPlaca, setFormPlaca] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Modal lote salário/férias
  const [modalLote, setModalLote] = useState(false);
  const [loteFuncs, setLoteFuncs] = useState<{ id: string; nome: string; selecionado: boolean; valor: string }[]>([]);
  const [loteContaId, setLoteContaId] = useState("");
  const [loteSalvando, setLoteSalvando] = useState(false);

  const headersPadrao = useMemo<HeadersInit>(() => {
    const h: Record<string, string> = {};
    if (empresa?.id) h["x-empresa-id"] = String(empresa.id);
    return h;
  }, [empresa?.id]);

  const limparForm = useCallback(() => {
    setSelecionado(null);
    setFormData(obterDiaUtilAnterior());
    setFormHistorico("");
    setFormContaId("");
    setFormCentroId("");
    setFormValor("");
    setFormTipo("Saída");
    setFormDocumento("");
    setFormPessoaId("");
    setFormPlaca("");
  }, []);

  const preencherForm = (item: Lancamento) => {
    setSelecionado(item);
    setFormData(item.data);
    setFormHistorico(item.historico);
    setFormContaId(String(item.contaId));
    setFormCentroId(item.centroCustoId ? String(item.centroCustoId) : "");
    const absVal = Math.abs(item.valor);
    setFormValor(absVal > 0 ? absVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
    setFormTipo(item.tipo);
    setFormDocumento(item.documento ?? "");
    setFormPessoaId(item.pessoaId ? String(item.pessoaId) : "");
    setFormPlaca(item.placa ?? "");
  };

  // Buscar lançamentos (somente com filtro de período)
  const buscarLancamentos = useCallback(async () => {
    if (!empresa?.id || !periodo) return;
    setCarregando(true);
    try {
      const url = `/api/financeiro/lancamentos?periodo=${periodo}`;
      const res = await fetch(url, { headers: headersPadrao });
      const json = await res.json();
      if (res.ok && json.success) setLancamentos(json.data);
    } catch (e) {
      console.error("Erro ao buscar lançamentos:", e);
    } finally {
      setCarregando(false);
    }
  }, [empresa?.id, periodo, headersPadrao]);

  useEffect(() => {
    buscarLancamentos();
  }, [buscarLancamentos]);

  // Carregar opções
  useEffect(() => {
    if (!empresa?.id) return;
    const carregar = async () => {
      try {
        const [planosRes, centrosRes, pessoasRes, funcRes] = await Promise.all([
          fetch("/api/financeiro/plano-contas", { headers: headersPadrao }),
          fetch("/api/financeiro/centro-custo", { headers: headersPadrao }),
          fetch("/api/cadastros/pessoas", { headers: headersPadrao }),
          fetch("/api/rh/funcionarios", { headers: headersPadrao }),
        ]);
        if (planosRes.ok) {
          const json = await planosRes.json();
          if (json.success)
            setPlanoContas(
              (json.data ?? []).map((i: any) => ({
                id: i.FIN_PLANO_CONTA_ID,
                label: `${i.FIN_PLANO_CONTA_CODIGO} ${i.FIN_PLANO_CONTA_NOME}`,
                natureza: i.FIN_PLANO_CONTA_NATUREZA,
              }))
            );
        }
        if (centrosRes.ok) {
          const json = await centrosRes.json();
          if (json.success) {
            const flatten = (items: any[]): CentroCustoOption[] =>
              items.flatMap((i) => [
                { id: Number(i.id), label: `${i.codigo} ${i.nome}` },
                ...(i.filhos ? flatten(i.filhos) : []),
              ]);
            setCentrosCusto(flatten(json.data ?? []));
          }
        }
        if (pessoasRes.ok) {
          const json = await pessoasRes.json();
          if (json.success)
            setPessoas(
              (json.data ?? [])
                .filter((p: any) => p.CAD_PESSOA_ATIVO === 1)
                .map((p: any) => ({
                  id: p.CAD_PESSOA_ID,
                  nome: p.CAD_PESSOA_NOME,
                  tipo: p.CAD_PESSOA_TIPO,
                  contaReceitaId: p.CAD_PESSOA_CONTA_RECEITA_ID ?? null,
                  contaDespesaId: p.CAD_PESSOA_CONTA_DESPESA_ID ?? null,
                }))
            );
        }
        if (funcRes.ok) {
          const json = await funcRes.json();
          if (json?.data)
            setFuncionarios(
              (json.data ?? [])
                .filter((f: any) => f.ATIVO === 1)
                .map((f: any) => ({
                  id: String(f.ID_FUNCIONARIO),
                  nome: f.NOME_COMPLETO,
                  salarioBase: Number(f.SALARIO_BASE) || 0,
                }))
            );
        }
      } catch (e) {
        console.error("Erro ao carregar opções:", e);
      }
    };
    carregar();
  }, [empresa?.id, headersPadrao]);

  // Plano de contas filtrado por natureza (Entrada=RECEITA, Saída=DESPESA)
  const planoContasFiltrados = useMemo(() => {
    return planoContas.filter((c) => {
      if (formTipo === "Entrada") return c.natureza === "RECEITA";
      if (formTipo === "Saída") return c.natureza === "DESPESA";
      return true;
    });
  }, [planoContas, formTipo]);

  // Pessoa filtrada por tipo (Entrada=CLIENTE, Saída=FORNECEDOR)
  const pessoasFiltradas = useMemo(() => {
    return pessoas.filter((p) => {
      if (p.tipo === "AMBOS") return true;
      if (formTipo === "Entrada" && p.tipo === "CLIENTE") return true;
      if (formTipo === "Saída" && p.tipo === "FORNECEDOR") return true;
      return false;
    });
  }, [pessoas, formTipo]);

  // Detecta se a conta selecionada é Salário ou Férias
  const contaSalarioFerias = useMemo(() => {
    if (!formContaId) return false;
    const conta = planoContas.find((c) => String(c.id) === formContaId);
    if (!conta) return false;
    const nome = conta.label.toUpperCase();
    return nome.includes("SALÁRIO") || nome.includes("SALARIO") || nome.includes("FÉRIAS") || nome.includes("FERIAS");
  }, [formContaId, planoContas]);

  // Ao mudar tipo, limpar conta se não bater com a natureza
  useEffect(() => {
    if (!formContaId) return;
    const conta = planoContas.find((c) => String(c.id) === formContaId);
    if (!conta) return;
    if (formTipo === "Entrada" && conta.natureza !== "RECEITA") setFormContaId("");
    if (formTipo === "Saída" && conta.natureza !== "DESPESA") setFormContaId("");
  }, [formTipo, formContaId, planoContas]);

  // Ao selecionar pessoa, auto-preencher conta padrão
  const handlePessoaChange = useCallback((pessoaIdStr: string) => {
    setFormPessoaId(pessoaIdStr);
    if (!pessoaIdStr) return;
    const pessoa = pessoas.find((p) => String(p.id) === pessoaIdStr);
    if (!pessoa) return;
    if (formTipo === "Entrada" && pessoa.contaReceitaId) {
      setFormContaId(String(pessoa.contaReceitaId));
    } else if (formTipo === "Saída" && pessoa.contaDespesaId) {
      setFormContaId(String(pessoa.contaDespesaId));
    }
  }, [pessoas, formTipo]);

  // Filtro local
  const dadosFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return lancamentos.filter((item) => {
      if (b && !`${item.historico} ${item.conta} ${item.centroCusto} ${item.pessoaNome} ${item.placa}`.toLowerCase().includes(b))
        return false;
      return true;
    });
  }, [busca, lancamentos]);

  const formatadorMoeda = useMemo(
    () => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
    []
  );

  // Máscara de moeda para o campo Valor
  const formatarValorInput = (valor: string): string => {
    const num = parseFloat(valor);
    if (isNaN(num) || num === 0) return "";
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleValorChange = (raw: string) => {
    const limpo = raw.replace(/[^\d,]/g, "");
    setFormValor(limpo);
  };

  const handleValorBlur = () => {
    const num = parseFloat(formValor.replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) { setFormValor(""); return; }
    setFormValor(formatarValorInput(String(num)));
  };

  const handleValorFocus = () => {
    const num = parseFloat(formValor.replace(/\./g, "").replace(",", "."));
    if (!isNaN(num) && num > 0) setFormValor(String(num).replace(".", ","));
  };

  // Salvar lançamento individual
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa?.id) return;
    const valorNum = parseFloat(formValor.replace(/\./g, "").replace(",", ".")) || 0;
    const valorFinal = formTipo === "Saída" ? -Math.abs(valorNum) : Math.abs(valorNum);
    const payload = {
      id: selecionado?.id,
      data: formData,
      historico: formHistorico,
      contaId: Number(formContaId) || 0,
      centroCustoId: Number(formCentroId) || null,
      valor: valorFinal,
      documento: formDocumento,
      status: "confirmado",
      pessoaId: Number(formPessoaId) || null,
      placa: formPlaca || null,
    };

    setSalvando(true);
    try {
      const res = await fetch("/api/financeiro/lancamentos", {
        method: selecionado ? "PUT" : "POST",
        headers: { ...headersPadrao, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (selecionado) {
          setLancamentos((prev) => prev.map((i) => (i.id === json.data.id ? json.data : i)));
        } else {
          setLancamentos((prev) => [json.data, ...prev]);
        }
        limparForm();
        setNotification({ type: "success", message: "Lançamento salvo com sucesso" });
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao salvar" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexão" });
    } finally {
      setSalvando(false);
    }
  };

  // Abrir modal de lançamento em lote (salário/férias)
  const abrirModalLote = () => {
    setLoteFuncs(
      funcionarios.map((f) => ({
        id: f.id,
        nome: f.nome,
        selecionado: true,
        valor: String(f.salarioBase || ""),
      }))
    );
    setLoteContaId(formContaId);
    setModalLote(true);
  };

  // Salvar lote
  const handleSalvarLote = async () => {
    if (!empresa?.id) return;
    const selecionados = loteFuncs.filter((f) => f.selecionado && Number(f.valor) > 0);
    if (selecionados.length === 0) {
      setNotification({ type: "error", message: "Selecione ao menos um funcionário com valor" });
      return;
    }

    setLoteSalvando(true);
    try {
      const lote = selecionados.map((f) => ({
        data: formData,
        historico: f.nome,
        contaId: Number(loteContaId),
        centroCustoId: Number(formCentroId) || null,
        valor: -(Number(f.valor) || 0), // salário/férias = saída (negativo)
        documento: formDocumento,
        pessoaId: null,
        placa: null,
      }));

      const res = await fetch("/api/financeiro/lancamentos", {
        method: "POST",
        headers: { ...headersPadrao, "Content-Type": "application/json" },
        body: JSON.stringify({ lote }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setLancamentos((prev) => [...(json.data || []), ...prev]);
        setModalLote(false);
        limparForm();
        setNotification({ type: "success", message: `${selecionados.length} lançamentos criados com sucesso` });
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao salvar lote" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexão" });
    } finally {
      setLoteSalvando(false);
    }
  };

  const contasDespesaParaLote = useMemo(
    () => planoContas.filter((c) => c.natureza === "DESPESA"),
    [planoContas]
  );

  return (
    <LayoutShell>
      <div className="page-container financeiro-page">
        <HeaderBar
          codigoTela={codigoTela}
          nomeTela={nomeTela}
          caminhoRota={caminhoTela}
          modulo={moduloTela}
        />

        <PaginaProtegida codigoTela={codigoTela}>
        <main className="page-content-card">
          {notification && (
            <NotificationBar type={notification.type} message={notification.message} />
          )}

          <div className="departamentos-page">
            <div className="split-view">
              {/* LEFT: Form */}
              <section className="split-view-panel">
                <header className="form-section-header">
                  <h2>{selecionado ? "Editar lançamento" : "Novo lançamento"}</h2>
                  <p>
                    {selecionado
                      ? "Atualize os dados do lançamento selecionado."
                      : "Informe os dados para registrar um novo lançamento."}
                  </p>
                </header>

                <form className="form" onSubmit={handleSalvar}>
                  {/* Linha 1: Data | Tipo */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label htmlFor="lanc-data">Data *</label>
                      <input
                        id="lanc-data"
                        type="date"
                        className="form-input"
                        value={formData}
                        onChange={(e) => setFormData(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="lanc-tipo">Tipo *</label>
                      <select
                        id="lanc-tipo"
                        className="form-input"
                        value={formTipo}
                        onChange={(e) => {
                          setFormTipo(e.target.value as "Entrada" | "Saída");
                          setFormPessoaId("");
                        }}
                      >
                        <option value="Saída">Saída (Pagamento)</option>
                        <option value="Entrada">Entrada (Recebimento)</option>
                      </select>
                    </div>
                  </div>

                  {/* Linha 2: Cliente/Fornecedor (largura total) */}
                  <div className="form-group">
                    <label htmlFor="lanc-pessoa">
                      {formTipo === "Entrada" ? "Cliente" : "Fornecedor"}
                    </label>
                    <select
                      id="lanc-pessoa"
                      className="form-input"
                      value={formPessoaId}
                      onChange={(e) => handlePessoaChange(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {pessoasFiltradas.map((p) => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Linha 3: Plano de conta | Centro de custo */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label htmlFor="lanc-conta">Plano de conta *</label>
                      <select
                        id="lanc-conta"
                        className="form-input"
                        value={formContaId}
                        onChange={(e) => setFormContaId(e.target.value)}
                        required
                      >
                        <option value="">Selecione</option>
                        {planoContasFiltrados.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="lanc-centro">Centro de custo</label>
                      <select
                        id="lanc-centro"
                        className="form-input"
                        value={formCentroId}
                        onChange={(e) => setFormCentroId(e.target.value)}
                      >
                        <option value="">Nenhum</option>
                        {centrosCusto.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Linha 4: Histórico (maior) | Placa (menor) */}
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label htmlFor="lanc-historico">Histórico *</label>
                      <input
                        id="lanc-historico"
                        className="form-input"
                        value={formHistorico}
                        onChange={(e) => setFormHistorico(e.target.value)}
                        placeholder="Descrição do lançamento"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="lanc-placa">Placa</label>
                      <input
                        id="lanc-placa"
                        className="form-input"
                        value={formPlaca}
                        onChange={(e) => setFormPlaca(e.target.value.toUpperCase())}
                        placeholder="ABC-1234"
                        style={{ textTransform: "uppercase" }}
                      />
                    </div>
                  </div>

                  {/* Linha 5: Valor (moeda) | Documento */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label htmlFor="lanc-valor">Valor *</label>
                      <div style={{ position: "relative" }}>
                        <span style={{
                          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                          color: "#6b7280", fontSize: "0.85rem", pointerEvents: "none",
                        }}>R$</span>
                        <input
                          id="lanc-valor"
                          type="text"
                          inputMode="decimal"
                          className="form-input"
                          value={formValor}
                          onChange={(e) => handleValorChange(e.target.value)}
                          onBlur={handleValorBlur}
                          onFocus={handleValorFocus}
                          placeholder="0,00"
                          style={{ textAlign: "right", paddingLeft: 36 }}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="lanc-doc">Documento</label>
                      <input
                        id="lanc-doc"
                        className="form-input"
                        value={formDocumento}
                        onChange={(e) => setFormDocumento(e.target.value)}
                        placeholder="NF, recibo, referência"
                      />
                    </div>
                  </div>

                  <div className="form-actions departamentos-actions">
                    <div className="button-row">
                      <button type="submit" className="button button-primary" disabled={salvando}>
                        {salvando ? "Salvando..." : "Salvar"}
                      </button>
                      {contaSalarioFerias && !selecionado && funcionarios.length > 0 && (
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={abrirModalLote}
                        >
                          Lançar em Lote
                        </button>
                      )}
                      <button type="button" className="button button-secondary" onClick={limparForm}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                </form>
              </section>

              {/* RIGHT: List */}
              <section className="split-view-panel">
                <header className="form-section-header">
                  <h2>Lançamentos cadastrados</h2>
                  <p>
                    {periodo
                      ? `${dadosFiltrados.length} lançamento(s) em ${periodo.substring(5,7)}/${periodo.substring(0,4)}`
                      : "Selecione um período para visualizar."}
                  </p>
                </header>

                <div className="form-grid two-columns" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label htmlFor="filtro-periodo">Período</label>
                    <input
                      id="filtro-periodo"
                      type="month"
                      className="form-input"
                      value={periodo}
                      onChange={(e) => setPeriodo(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="filtro-busca">Busca</label>
                    <input
                      id="filtro-busca"
                      type="text"
                      className="form-input"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Histórico, conta, placa..."
                    />
                  </div>
                </div>

                <div className="lancamentos-scroll-area">
                {!periodo ? (
                  <div className="empty-state">
                    <strong>Selecione um período</strong>
                    <p>Informe o mês/ano no campo Período para carregar os lançamentos.</p>
                  </div>
                ) : carregando ? (
                  <div className="empty-state">
                    <p>Carregando lançamentos...</p>
                  </div>
                ) : dadosFiltrados.length === 0 ? (
                  <div className="empty-state">
                    <strong>Nenhum lançamento encontrado</strong>
                    <p>Ajuste o período ou adicione um novo lançamento.</p>
                  </div>
                ) : (
                  <table className="data-table mobile-cards" style={{ fontSize: "0.72rem", tableLayout: "fixed", width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ whiteSpace: "nowrap", width: 72 }}>Data</th>
                        <th style={{ width: "auto" }}>Histórico</th>
                        <th style={{ whiteSpace: "nowrap", width: 120 }}>Conta</th>
                        <th style={{ whiteSpace: "nowrap", width: 52 }}>Tipo</th>
                        <th style={{ textAlign: "right", whiteSpace: "nowrap", width: 88 }}>Valor</th>
                        <th style={{ textAlign: "center", whiteSpace: "nowrap", width: 80 }}>Placa</th>
                        <th style={{ textAlign: "center", whiteSpace: "nowrap", width: 70 }}>Doc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosFiltrados.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => preencherForm(item)}
                          style={{
                            cursor: "pointer",
                            backgroundColor: selecionado?.id === item.id ? "#eff6ff" : undefined,
                          }}
                        >
                          <td data-label="Data" style={{ whiteSpace: "nowrap" }}>
                            {item.data && item.data.length >= 10
                              ? `${item.data.substring(8,10)}/${item.data.substring(5,7)}/${item.data.substring(0,4)}`
                              : item.data}
                          </td>
                          <td data-label="Histórico" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.historico}
                            {item.pessoaNome && (
                              <span style={{ display: "block", fontSize: "0.65rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {item.pessoaNome}
                              </span>
                            )}
                          </td>
                          <td data-label="Conta" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.conta}</td>
                          <td data-label="Tipo">
                            <span className={item.tipo === "Entrada" ? "badge badge-success" : "badge badge-danger"} style={{ fontSize: "0.68rem", padding: "1px 5px" }}>
                              {item.tipo === "Entrada" ? "Ent" : "Saí"}
                            </span>
                          </td>
                          <td data-label="Valor" style={{ fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                            {formatadorMoeda.format(Math.abs(item.valor))}
                          </td>
                          <td data-label="Placa" style={{ textAlign: "center", whiteSpace: "nowrap", fontFamily: "monospace", letterSpacing: "-0.5px" }}>
                            {item.placa || "-"}
                          </td>
                          <td data-label="Doc" style={{ textAlign: "center", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {item.documento || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                </div>
              </section>
            </div>
          </div>
        </main>
        </PaginaProtegida>

        {/* Modal lote salário/férias */}
        {modalLote && (
          <div style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: "#fff", borderRadius: 12, padding: 24,
              width: "90%", maxWidth: 700, maxHeight: "90vh", overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "1.1rem" }}>Lançamento em Lote</h2>
              <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "0 0 16px" }}>
                Selecione os funcionários e informe o valor individual. Todos serão lançados como saída.
              </p>

              <div className="form-grid two-columns" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label>Data</label>
                  <input type="date" className="form-input" value={formData} onChange={(e) => setFormData(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Plano de conta *</label>
                  <select className="form-input" value={loteContaId} onChange={(e) => setLoteContaId(e.target.value)} required>
                    <option value="">Selecione</option>
                    {contasDespesaParaLote.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  className="button button-secondary button-compact"
                  onClick={() => setLoteFuncs((prev) => prev.map((f) => ({ ...f, selecionado: true })))}
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  className="button button-secondary button-compact"
                  onClick={() => setLoteFuncs((prev) => prev.map((f) => ({ ...f, selecionado: false })))}
                >
                  Desmarcar todos
                </button>
              </div>

              <table className="data-table" style={{ fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Funcionário</th>
                    <th style={{ width: 140, textAlign: "right" }}>Valor (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {loteFuncs.map((f, idx) => (
                    <tr key={f.id} style={{ opacity: f.selecionado ? 1 : 0.5 }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={f.selecionado}
                          onChange={(e) => {
                            const novo = [...loteFuncs];
                            novo[idx] = { ...novo[idx], selecionado: e.target.checked };
                            setLoteFuncs(novo);
                          }}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>{f.nome}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          style={{ textAlign: "right", padding: "4px 8px" }}
                          value={f.valor}
                          onChange={(e) => {
                            const novo = [...loteFuncs];
                            novo[idx] = { ...novo[idx], valor: e.target.value };
                            setLoteFuncs(novo);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb" }}>
                    <td colSpan={2}>TOTAL ({loteFuncs.filter((f) => f.selecionado && Number(f.valor) > 0).length} funcionários)</td>
                    <td style={{ textAlign: "right" }}>
                      {formatadorMoeda.format(
                        loteFuncs
                          .filter((f) => f.selecionado)
                          .reduce((acc, f) => acc + (Number(f.valor) || 0), 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setModalLote(false)}
                  disabled={loteSalvando}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleSalvarLote}
                  disabled={loteSalvando || !loteContaId}
                >
                  {loteSalvando ? "Salvando..." : "Lançar em Lote"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
