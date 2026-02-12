"use client";

import LayoutShell from "@/components/LayoutShell";
import { HeaderBar } from "@/components/HeaderBar";
import { PaginaProtegida } from "@/components/PaginaProtegida";
import { NotificationBar } from "@/components/NotificationBar";
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
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
  tipo: "Entrada" | "Saida";
  status: "confirmado" | "pendente";
  documento?: string;
};

type PlanoContaOption = { id: number; label: string; natureza: string };
type CentroCustoOption = { id: number; label: string };
type PessoaOption = { id: number; nome: string; tipo: string; contaReceitaId: number | null; contaDespesaId: number | null };
type FuncionarioOption = { id: string; nome: string; salarioBase: number };

/** Retorna o dia util anterior (pula fins de semana) */
function obterDiaUtilAnterior(): string {
  const hoje = new Date();
  const dia = hoje.getDay(); // 0=Dom, 1=Seg...6=Sab
  let offset = 1;
  if (dia === 0) offset = 2; // Domingo -> Sexta
  if (dia === 1) offset = 3; // Segunda -> Sexta
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
  const [filtroNatureza, setFiltroNatureza] = useState<"RECEITA" | "DESPESA" | "">("");
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
  const [formTipo, setFormTipo] = useState<"Entrada" | "Saida">("Saida");
  const [formDocumento, setFormDocumento] = useState("");
  const [formPessoaId, setFormPessoaId] = useState("");
  const [formPlaca, setFormPlaca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Modal cadastro rapido de pessoa
  const [modalPessoa, setModalPessoa] = useState(false);
  const [novaPessoaNome, setNovaPessoaNome] = useState("");
  const [novaPessoaDoc, setNovaPessoaDoc] = useState("");
  const [novaPessoaTipo, setNovaPessoaTipo] = useState<"CLIENTE" | "FORNECEDOR" | "AMBOS">("AMBOS");
  const [novaPessoaTel, setNovaPessoaTel] = useState("");
  const [salvandoPessoa, setSalvandoPessoa] = useState(false);

  // Modal lote salario/ferias
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
    setFormTipo("Saida");
    setFormDocumento("");
    setFormPessoaId("");
    setFormPlaca("");
  }, []);

  const preencherForm = (item: Lancamento) => {
    if (!podeEditar(item.data)) {
      setNotification({ type: "error", message: "Lancamento com mais de 21 dias nao pode ser editado" });
      return;
    }
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

  // Data limite para edicao/exclusao (hoje - 21 dias)
  const dataLimiteEdicao = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 21);
    return d.toISOString().split("T")[0];
  }, []);

  // Verifica se um lancamento pode ser editado/excluido (dentro dos 21 dias)
  const podeEditar = useCallback((dataLanc: string) => {
    if (!dataLanc || dataLanc.length < 10) return false;
    return dataLanc >= dataLimiteEdicao;
  }, [dataLimiteEdicao]);

  // Buscar lancamentos (natureza obrigatorio + busca com 3+ chars)
  const buscarLancamentos = useCallback(async () => {
    if (!empresa?.id || !filtroNatureza) return;
    if (busca.length > 0 && busca.length < 3) return;
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      params.set("natureza", filtroNatureza);
      if (busca.length >= 3) params.set("busca", busca);
      const url = `/api/financeiro/lancamentos?${params.toString()}`;
      const res = await fetch(url, { headers: headersPadrao });
      const json = await res.json();
      if (res.ok && json.success) setLancamentos(json.data);
    } catch (e) {
      console.error("Erro ao buscar lancamentos:", e);
    } finally {
      setCarregando(false);
    }
  }, [empresa?.id, filtroNatureza, busca, headersPadrao]);

  useEffect(() => {
    if (!filtroNatureza) {
      setLancamentos([]);
      return;
    }
    if (busca.length > 0 && busca.length < 3) return;
    const timer = setTimeout(() => {
      buscarLancamentos();
    }, busca.length >= 3 ? 400 : 0);
    return () => clearTimeout(timer);
  }, [filtroNatureza, busca, buscarLancamentos]);

  // Carregar opcoes
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
        console.error("Erro ao carregar opcoes:", e);
      }
    };
    carregar();
  }, [empresa?.id, headersPadrao]);

  // Plano de contas filtrado por natureza (Entrada=RECEITA, Saida=DESPESA)
  const planoContasFiltrados = useMemo(() => {
    return planoContas.filter((c) => {
      if (formTipo === "Entrada") return c.natureza === "RECEITA";
      if (formTipo === "Saida") return c.natureza === "DESPESA";
      return true;
    });
  }, [planoContas, formTipo]);

  // Pessoa filtrada por tipo (Entrada=CLIENTE, Saida=FORNECEDOR)
  const pessoasFiltradas = useMemo(() => {
    return pessoas.filter((p) => {
      if (p.tipo === "AMBOS") return true;
      if (formTipo === "Entrada" && p.tipo === "CLIENTE") return true;
      if (formTipo === "Saida" && p.tipo === "FORNECEDOR") return true;
      return false;
    });
  }, [pessoas, formTipo]);

  // Detecta se a conta selecionada e Salario ou Ferias
  const contaSalarioFerias = useMemo(() => {
    if (!formContaId) return false;
    const conta = planoContas.find((c) => String(c.id) === formContaId);
    if (!conta) return false;
    const nome = conta.label.toUpperCase();
    return nome.includes("SALARIO") || nome.includes("FERIAS");
  }, [formContaId, planoContas]);

  // Ao mudar tipo, limpar conta se nao bater com a natureza
  useEffect(() => {
    if (!formContaId) return;
    const conta = planoContas.find((c) => String(c.id) === formContaId);
    if (!conta) return;
    if (formTipo === "Entrada" && conta.natureza !== "RECEITA") setFormContaId("");
    if (formTipo === "Saida" && conta.natureza !== "DESPESA") setFormContaId("");
  }, [formTipo, formContaId, planoContas]);

  // Ao selecionar pessoa, auto-preencher conta padrao
  const handlePessoaChange = useCallback((pessoaIdStr: string) => {
    setFormPessoaId(pessoaIdStr);
    if (!pessoaIdStr) return;
    const pessoa = pessoas.find((p) => String(p.id) === pessoaIdStr);
    if (!pessoa) return;
    if (formTipo === "Entrada" && pessoa.contaReceitaId) {
      setFormContaId(String(pessoa.contaReceitaId));
    } else if (formTipo === "Saida" && pessoa.contaDespesaId) {
      setFormContaId(String(pessoa.contaDespesaId));
    }
  }, [pessoas, formTipo]);

  // Ordenacao da tabela
  type SortKey = "data" | "historico" | "conta" | "valor" | "placa" | "documento";
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "data" ? "desc" : "asc");
    }
  };

  const dadosOrdenados = useMemo(() => {
    const arr = [...lancamentos];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sortKey) {
        case "data": va = a.data; vb = b.data; break;
        case "historico": va = a.historico.toLowerCase(); vb = b.historico.toLowerCase(); break;
        case "conta": va = a.conta.toLowerCase(); vb = b.conta.toLowerCase(); break;
        case "valor": va = Math.abs(a.valor); vb = Math.abs(b.valor); return (va - vb) * dir;
        case "placa": va = a.placa || ""; vb = b.placa || ""; break;
        case "documento": va = a.documento || ""; vb = b.documento || ""; break;
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [lancamentos, sortKey, sortDir]);

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return " \u2195";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  // Colunas redimensionaveis
  const colDefs: { key: SortKey; label: string; initWidth: number }[] = [
    { key: "data", label: "Data", initWidth: 62 },
    { key: "historico", label: "Historico", initWidth: 0 },
    { key: "conta", label: "Conta", initWidth: 130 },
    { key: "valor", label: "Valor", initWidth: 100 },
    { key: "placa", label: "Placa", initWidth: 78 },
    { key: "documento", label: "Doc", initWidth: 68 },
  ];

  const [colWidths, setColWidths] = useState<number[]>(() => colDefs.map((c) => c.initWidth));
  const resizingRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null);

  const onResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).parentElement;
    const startW = th ? th.getBoundingClientRect().width : colWidths[colIdx];
    resizingRef.current = { colIdx, startX: e.clientX, startW };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = ev.clientX - resizingRef.current.startX;
      const newW = Math.max(40, resizingRef.current.startW + diff);
      setColWidths((prev) => {
        const next = [...prev];
        next[resizingRef.current!.colIdx] = newW;
        return next;
      });
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [colWidths]);

  const formatadorMoeda = useMemo(
    () => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
    []
  );

  // Mascara de moeda para o campo Valor
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

  // Remove acentos e cedilha do texto
  const removerAcentos = (texto: string): string => {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u00e7/g, "c").replace(/\u00c7/g, "C");
  };

  const handleHistoricoChange = (valor: string) => {
    setFormHistorico(removerAcentos(valor));
  };

  // Excluir lancamento
  const handleExcluir = async () => {
    if (!selecionado || !empresa?.id) return;
    if (!podeEditar(selecionado.data)) {
      setNotification({ type: "error", message: "Lancamento com mais de 21 dias nao pode ser excluido" });
      return;
    }
    if (!window.confirm("Tem certeza que deseja excluir este lancamento?")) return;
    setExcluindo(true);
    try {
      const res = await fetch(`/api/financeiro/lancamentos?id=${selecionado.id}`, {
        method: "DELETE",
        headers: headersPadrao,
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setLancamentos((prev) => prev.filter((i) => i.id !== selecionado.id));
        limparForm();
        setNotification({ type: "success", message: "Lancamento excluido com sucesso" });
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao excluir" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexao" });
    } finally {
      setExcluindo(false);
    }
  };

  // Salvar lancamento individual
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa?.id) return;
    if (selecionado && !podeEditar(selecionado.data)) {
      setNotification({ type: "error", message: "Lancamento com mais de 21 dias nao pode ser editado" });
      return;
    }
    const valorNum = parseFloat(formValor.replace(/\./g, "").replace(",", ".")) || 0;
    const valorFinal = formTipo === "Saida" ? -Math.abs(valorNum) : Math.abs(valorNum);
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
        setNotification({ type: "success", message: "Lancamento salvo com sucesso" });
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao salvar" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexao" });
    } finally {
      setSalvando(false);
    }
  };

  // Abrir modal de lancamento em lote (salario/ferias)
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
      setNotification({ type: "error", message: "Selecione ao menos um funcionario com valor" });
      return;
    }

    setLoteSalvando(true);
    try {
      const lote = selecionados.map((f) => ({
        data: formData,
        historico: f.nome,
        contaId: Number(loteContaId),
        centroCustoId: Number(formCentroId) || null,
        valor: -(Number(f.valor) || 0), // salario/ferias = saida (negativo)
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
        setNotification({ type: "success", message: `${selecionados.length} lancamentos criados com sucesso` });
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao salvar lote" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexao" });
    } finally {
      setLoteSalvando(false);
    }
  };

  // Abrir modal de cadastro rapido de pessoa
  const abrirModalPessoa = () => {
    setNovaPessoaNome("");
    setNovaPessoaDoc("");
    setNovaPessoaTipo(formTipo === "Entrada" ? "CLIENTE" : formTipo === "Saida" ? "FORNECEDOR" : "AMBOS");
    setNovaPessoaTel("");
    setModalPessoa(true);
  };

  // Salvar nova pessoa via modal
  const handleSalvarPessoa = async () => {
    if (!empresa?.id || !novaPessoaNome.trim()) return;
    setSalvandoPessoa(true);
    try {
      const res = await fetch("/api/cadastros/pessoas", {
        method: "POST",
        headers: { ...headersPadrao, "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: novaPessoaNome.trim(),
          documento: novaPessoaDoc || null,
          tipo: novaPessoaTipo,
          telefone: novaPessoaTel || null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const novaPessoa: PessoaOption = {
          id: json.id,
          nome: novaPessoaNome.trim(),
          tipo: novaPessoaTipo,
          contaReceitaId: null,
          contaDespesaId: null,
        };
        setPessoas((prev) => [...prev, novaPessoa]);
        setFormPessoaId(String(json.id));
        setModalPessoa(false);
        setNotification({ type: "success", message: `${novaPessoaTipo === "CLIENTE" ? "Cliente" : novaPessoaTipo === "FORNECEDOR" ? "Fornecedor" : "Pessoa"} cadastrado(a) com sucesso` });
      } else {
        setNotification({ type: "error", message: json.error || "Erro ao cadastrar" });
      }
    } catch {
      setNotification({ type: "error", message: "Erro de conexao" });
    } finally {
      setSalvandoPessoa(false);
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
                  <h2>{selecionado ? "Editar lancamento" : "Novo lancamento"}</h2>
                  <p>
                    {selecionado
                      ? "Atualize os dados do lancamento selecionado."
                      : "Informe os dados para registrar um novo lancamento."}
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
                          setFormTipo(e.target.value as "Entrada" | "Saida");
                          setFormPessoaId("");
                        }}
                      >
                        <option value="Saida">Saida (Pagamento)</option>
                        <option value="Entrada">Entrada (Recebimento)</option>
                      </select>
                    </div>
                  </div>

                  {/* Linha 2: Cliente/Fornecedor + botao novo */}
                  <div className="form-group">
                    <label htmlFor="lanc-pessoa">
                      {formTipo === "Entrada" ? "Cliente" : "Fornecedor"}
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        id="lanc-pessoa"
                        className="form-input"
                        value={formPessoaId}
                        onChange={(e) => handlePessoaChange(e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="">Selecione</option>
                        {pessoasFiltradas.map((p) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={abrirModalPessoa}
                        className="button button-secondary"
                        title={`Cadastrar novo ${formTipo === "Entrada" ? "cliente" : "fornecedor"}`}
                        style={{ padding: "6px 10px", fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}
                      >
                        +
                      </button>
                    </div>
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

                  {/* Linha 4: Historico (maior) | Placa (menor) */}
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label htmlFor="lanc-historico">Historico *</label>
                      <input
                        id="lanc-historico"
                        className="form-input"
                        value={formHistorico}
                        onChange={(e) => handleHistoricoChange(e.target.value)}
                        placeholder="Descricao do lancamento (sem acentos)"
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
                        placeholder="NF, recibo, referencia"
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
                          Lancar em Lote
                        </button>
                      )}
                      <button type="button" className="button button-secondary" onClick={limparForm}>
                        Cancelar
                      </button>
                      {selecionado && (
                        <button
                          type="button"
                          className="button"
                          onClick={handleExcluir}
                          disabled={excluindo}
                          style={{
                            backgroundColor: "#dc2626",
                            color: "#fff",
                            border: "none",
                          }}
                        >
                          {excluindo ? "Excluindo..." : "Excluir"}
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </section>

              {/* RIGHT: List */}
              <section className="split-view-panel">
                <header className="form-section-header">
                  <h2>Lancamentos cadastrados</h2>
                  <p>
                    {filtroNatureza
                      ? `${dadosOrdenados.length} lancamento(s) encontrado(s)`
                      : "Selecione o tipo para visualizar."}
                  </p>
                </header>

                <div className="form-grid two-columns" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label htmlFor="filtro-natureza">Tipo *</label>
                    <select
                      id="filtro-natureza"
                      className="form-input"
                      value={filtroNatureza}
                      onChange={(e) => setFiltroNatureza(e.target.value as "RECEITA" | "DESPESA" | "")}
                    >
                      <option value="">Selecione</option>
                      <option value="DESPESA">Despesa (Saida)</option>
                      <option value="RECEITA">Receita (Entrada)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="filtro-busca">Busca (min. 3 caracteres)</label>
                    <input
                      id="filtro-busca"
                      type="text"
                      className="form-input"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Descricao, conta, placa, doc, valor..."
                    />
                  </div>
                </div>

                <div className="lancamentos-scroll-area">
                {!filtroNatureza ? (
                  <div className="empty-state">
                    <strong>Selecione o tipo</strong>
                    <p>Escolha Despesa ou Receita para carregar os lancamentos.</p>
                  </div>
                ) : (busca.length > 0 && busca.length < 3) ? (
                  <div className="empty-state">
                    <p>Digite ao menos 3 caracteres para buscar.</p>
                  </div>
                ) : carregando ? (
                  <div className="empty-state">
                    <p>Carregando lancamentos...</p>
                  </div>
                ) : dadosOrdenados.length === 0 ? (
                  <div className="empty-state">
                    <strong>Nenhum lancamento encontrado</strong>
                    <p>Ajuste a busca ou adicione um novo lancamento.</p>
                  </div>
                ) : (
                  <table className="data-table mobile-cards" style={{ fontSize: "0.7rem", tableLayout: "fixed", width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                    <colgroup>
                      {colDefs.map((col, i) => (
                        <col key={col.key} style={colWidths[i] > 0 ? { width: colWidths[i] } : undefined} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        {colDefs.map((col, i) => {
                          const align = col.key === "valor" ? "right" : col.key === "placa" || col.key === "documento" ? "center" : "left";
                          const isLast = i === colDefs.length - 1;
                          return (
                            <th
                              key={col.key}
                              onClick={() => handleSort(col.key)}
                              style={{
                                whiteSpace: "nowrap", cursor: "pointer", userSelect: "none",
                                textAlign: align, position: "relative", paddingRight: 14,
                                borderRight: isLast ? "none" : "1px solid #d1d5db",
                              }}
                              title={`Ordenar por ${col.label}`}
                            >
                              {col.label}{sortIcon(col.key)}
                              {!isLast && (
                                <span
                                  onMouseDown={(e) => onResizeStart(e, i)}
                                  style={{
                                    position: "absolute", right: -3, top: 4, bottom: 4, width: 6,
                                    cursor: "col-resize", zIndex: 2,
                                    borderRadius: 3,
                                    backgroundColor: "#94a3b8",
                                    opacity: 0.4,
                                    transition: "opacity 0.15s",
                                  }}
                                  onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "1"; (e.target as HTMLElement).style.backgroundColor = "#3b82f6"; }}
                                  onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "0.4"; (e.target as HTMLElement).style.backgroundColor = "#94a3b8"; }}
                                />
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {dadosOrdenados.map((item) => {
                        const editavel = podeEditar(item.data);
                        return (
                        <tr
                          key={item.id}
                          onClick={() => preencherForm(item)}
                          style={{
                            cursor: editavel ? "pointer" : "not-allowed",
                            backgroundColor: selecionado?.id === item.id ? "#eff6ff" : undefined,
                            opacity: editavel ? 1 : 0.55,
                          }}
                          title={editavel ? "Clique para editar" : "Lancamento com mais de 21 dias (somente leitura)"}
                        >
                          <td data-label="Data" style={{ whiteSpace: "nowrap", borderRight: "1px solid #e5e7eb" }}>
                            {item.data && item.data.length >= 10
                              ? `${item.data.substring(8,10)}/${item.data.substring(5,7)}`
                              : item.data}
                          </td>
                          <td data-label="Historico" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRight: "1px solid #e5e7eb" }}>
                            {item.historico}
                            {item.pessoaNome && (
                              <span style={{ display: "block", fontSize: "0.63rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {item.pessoaNome}
                              </span>
                            )}
                          </td>
                          <td data-label="Conta" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderRight: "1px solid #e5e7eb" }}>{item.conta}</td>
                          <td data-label="Valor" style={{
                            fontWeight: 600, textAlign: "right", whiteSpace: "nowrap",
                            color: item.tipo === "Entrada" ? "#16a34a" : "#dc2626",
                            borderRight: "1px solid #e5e7eb",
                          }}>
                            {item.tipo === "Entrada" ? "+" : "-"}{formatadorMoeda.format(Math.abs(item.valor))}
                          </td>
                          <td data-label="Placa" style={{ textAlign: "center", whiteSpace: "nowrap", borderRight: "1px solid #e5e7eb" }}>
                            {item.placa || "-"}
                          </td>
                          <td data-label="Doc" style={{ textAlign: "center", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {item.documento || "-"}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                </div>
              </section>
            </div>
          </div>
        </main>
        </PaginaProtegida>

        {/* Modal cadastro rapido de pessoa */}
        {modalPessoa && (
          <div style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: "#fff", borderRadius: 12, padding: 24,
              width: "90%", maxWidth: 440,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "1.1rem" }}>
                Novo {novaPessoaTipo === "CLIENTE" ? "Cliente" : novaPessoaTipo === "FORNECEDOR" ? "Fornecedor" : "Cadastro"}
              </h2>
              <p style={{ color: "#6b7280", fontSize: "0.82rem", margin: "0 0 16px" }}>
                Cadastro rapido. Dados complementares podem ser preenchidos depois.
              </p>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Nome / Razao Social *</label>
                <input
                  className="form-input"
                  value={novaPessoaNome}
                  onChange={(e) => setNovaPessoaNome(e.target.value)}
                  placeholder="Nome completo ou razao social"
                  autoFocus
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label>CPF / CNPJ</label>
                  <input
                    className="form-input"
                    value={novaPessoaDoc}
                    onChange={(e) => setNovaPessoaDoc(e.target.value)}
                    placeholder="Documento"
                  />
                </div>
                <div className="form-group">
                  <label>Tipo *</label>
                  <select
                    className="form-input"
                    value={novaPessoaTipo}
                    onChange={(e) => setNovaPessoaTipo(e.target.value as "CLIENTE" | "FORNECEDOR" | "AMBOS")}
                  >
                    <option value="FORNECEDOR">Fornecedor</option>
                    <option value="CLIENTE">Cliente</option>
                    <option value="AMBOS">Ambos</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Telefone</label>
                <input
                  className="form-input"
                  value={novaPessoaTel}
                  onChange={(e) => setNovaPessoaTel(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setModalPessoa(false)}
                  disabled={salvandoPessoa}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleSalvarPessoa}
                  disabled={salvandoPessoa || !novaPessoaNome.trim()}
                >
                  {salvandoPessoa ? "Salvando..." : "Cadastrar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal lote salario/ferias */}
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
              <h2 style={{ margin: "0 0 4px", fontSize: "1.1rem" }}>Lancamento em Lote</h2>
              <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "0 0 16px" }}>
                Selecione os funcionarios e informe o valor individual. Todos serao lancados como saida.
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
                    <th>Funcionario</th>
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
                    <td colSpan={2}>TOTAL ({loteFuncs.filter((f) => f.selecionado && Number(f.valor) > 0).length} funcionarios)</td>
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
                  {loteSalvando ? "Salvando..." : "Lancar em Lote"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
