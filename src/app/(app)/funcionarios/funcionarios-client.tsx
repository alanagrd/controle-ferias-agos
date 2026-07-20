"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Funcionario, Empresa, VPeriodo, StatusFuncionario } from "@/lib/types";

type SortKey = "nome" | "codigo" | "empresa" | "obra" | "cargo" | "admissao" | "status";

const STATUS_LABEL: Record<StatusFuncionario, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  REVISAR: "A revisar",
};

const STATUS_TONE: Record<StatusFuncionario, string> = {
  ATIVO: "bg-emerald-50 text-emerald-700",
  INATIVO: "bg-slate-100 text-slate-500",
  REVISAR: "bg-amber-50 text-amber-700",
};

export default function FuncionariosClient({
  initialFuncionarios,
  empresas,
  periodos,
}: {
  initialFuncionarios: Funcionario[];
  empresas: Empresa[];
  periodos: VPeriodo[];
}) {
  const searchParams = useSearchParams();
  const [funcionarios, setFuncionarios] = useState(initialFuncionarios);
  const [periodosState, setPeriodosState] = useState(periodos);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string>("ATIVO");
  const [empresaFilter, setEmpresaFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<Funcionario | null>(null);

  const empresaById = useMemo(
    () => Object.fromEntries(empresas.map((e) => [e.id, e.nome])),
    [empresas]
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const filtered = useMemo(() => {
    let rows = funcionarios;
    if (statusFilter) rows = rows.filter((f) => f.status === statusFilter);
    if (empresaFilter)
      rows = rows.filter((f) => f.empresa_id === empresaFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (f) =>
          f.nome.toLowerCase().includes(q) ||
          (f.codigo ?? "").toLowerCase().includes(q)
      );
    }
    const dir = sortDir;
    const get = (f: Funcionario) => {
      switch (sortKey) {
        case "empresa":
          return f.empresa_id ? empresaById[f.empresa_id] ?? "" : "";
        case "codigo":
          return f.codigo ?? "";
        case "obra":
          return f.obra ?? "";
        case "cargo":
          return f.cargo ?? "";
        case "admissao":
          return f.admissao ?? "";
        case "status":
          return f.status;
        default:
          return f.nome;
      }
    };
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      return av.localeCompare(bv, "pt-BR") * dir;
    });
  }, [funcionarios, statusFilter, empresaFilter, query, sortKey, sortDir, empresaById]);

  function Arrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return <span className="ml-1 text-slate-400">{sortDir === 1 ? "▲" : "▼"}</span>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Funcionários</h1>
        <p className="text-sm text-slate-500">
          {filtered.length.toLocaleString("pt-BR")} de{" "}
          {funcionarios.length.toLocaleString("pt-BR")} registros
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou código..."
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
          <option value="REVISAR">A revisar</option>
        </select>
        <select
          value={empresaFilter}
          onChange={(e) => setEmpresaFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todas as empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 z-[1]">
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <Th onClick={() => toggleSort("codigo")}>
                  Código <Arrow col="codigo" />
                </Th>
                <Th onClick={() => toggleSort("nome")}>
                  Nome <Arrow col="nome" />
                </Th>
                <Th onClick={() => toggleSort("empresa")}>
                  Empresa <Arrow col="empresa" />
                </Th>
                <Th onClick={() => toggleSort("obra")}>
                  Obra <Arrow col="obra" />
                </Th>
                <Th onClick={() => toggleSort("cargo")}>
                  Cargo <Arrow col="cargo" />
                </Th>
                <Th onClick={() => toggleSort("admissao")}>
                  Admissão <Arrow col="admissao" />
                </Th>
                <Th onClick={() => toggleSort("status")}>
                  Status <Arrow col="status" />
                </Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => setSelected(f)}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="py-2 px-3 text-slate-500">{f.codigo || "–"}</td>
                  <td className="py-2 px-3 font-medium text-slate-900">
                    {f.nome}
                  </td>
                  <td className="py-2 px-3">
                    {f.empresa_id ? (
                      empresaById[f.empresa_id]
                    ) : (
                      <span className="text-slate-400">sem empresa</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-500">{f.obra || "–"}</td>
                  <td className="py-2 px-3 text-slate-500">{f.cargo || "–"}</td>
                  <td className="py-2 px-3 text-slate-500">
                    {f.admissao || "–"}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${STATUS_TONE[f.status]}`}
                    >
                      {STATUS_LABEL[f.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <FuncionarioModal
          funcionario={selected}
          empresas={empresas}
          periodos={periodosState.filter((p) => p.funcionario_id === selected.id)}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setFuncionarios((prev) =>
              prev.map((f) => (f.id === updated.id ? updated : f))
            );
            setSelected(updated);
          }}
          onPeriodosChanged={(novosPeriodos) => {
            setPeriodosState((prev) => [
              ...prev.filter((p) => p.funcionario_id !== selected.id),
              ...novosPeriodos,
            ]);
          }}
        />
      )}
    </div>
  );
}

function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className="py-2.5 px-3 font-medium select-none cursor-pointer hover:text-slate-900 whitespace-nowrap"
    >
      {children}
    </th>
  );
}

function FuncionarioModal({
  funcionario,
  empresas,
  periodos,
  onClose,
  onUpdated,
  onPeriodosChanged,
}: {
  funcionario: Funcionario;
  empresas: Empresa[];
  periodos: VPeriodo[];
  onClose: () => void;
  onUpdated: (f: Funcionario) => void;
  onPeriodosChanged: (p: VPeriodo[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState({
    nome: funcionario.nome,
    empresa_id: funcionario.empresa_id ?? "",
    obra: funcionario.obra ?? "",
    cargo: funcionario.cargo ?? "",
    setor: funcionario.setor ?? "",
    status: funcionario.status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lancamentos, setLancamentos] = useState<
    Record<string, { id: string; inicio: string; fim: string; dias: number; status_pagamento: string }[]>
  >({});
  const [showNovoLancamento, setShowNovoLancamento] = useState<string | null>(
    null
  );

  const loadLancamentos = useCallback(
    async (periodoId: string) => {
      const { data } = await supabase
        .from("rh_lancamentos_ferias")
        .select("id, inicio, fim, dias, status_pagamento")
        .eq("periodo_id", periodoId)
        .order("inicio", { ascending: false });
      setLancamentos((prev) => ({ ...prev, [periodoId]: data ?? [] }));
    },
    [supabase]
  );

  useEffect(() => {
    periodos.forEach((p) => loadLancamentos(p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionario.id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from("rh_funcionarios")
      .update({
        nome: form.nome,
        empresa_id: form.empresa_id || null,
        obra: form.obra || null,
        cargo: form.cargo || null,
        setor: form.setor || null,
        status: form.status,
      })
      .eq("id", funcionario.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError("Erro ao salvar: " + error.message);
      return;
    }
    if (data) onUpdated(data as Funcionario);
  }

  async function handleAddPeriodo() {
    const hoje = new Date();
    const inicioStr = window.prompt(
      "Data de início do período (AAAA-MM-DD)?",
      hoje.toISOString().slice(0, 10)
    );
    if (!inicioStr) return;
    const inicio = new Date(inicioStr);
    if (isNaN(inicio.getTime())) {
      alert("Data inválida.");
      return;
    }
    const fim = new Date(inicio);
    fim.setFullYear(fim.getFullYear() + 1);
    fim.setDate(fim.getDate() - 1);
    const dataLimite = new Date(fim);
    dataLimite.setFullYear(dataLimite.getFullYear() + 1);

    const { data, error } = await supabase
      .from("rh_periodos_aquisitivos")
      .insert({
        funcionario_id: funcionario.id,
        inicio: inicio.toISOString().slice(0, 10),
        fim: fim.toISOString().slice(0, 10),
        dias_direito: 30,
        data_limite: dataLimite.toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (error) {
      alert("Erro ao criar período: " + error.message);
      return;
    }

    const { data: refreshed } = await supabase
      .from("v_rh_periodos")
      .select(
        "id, funcionario_id, inicio, fim, dias_direito, data_limite, dias_gozados, saldo, status"
      )
      .eq("funcionario_id", funcionario.id);
    onPeriodosChanged((refreshed as VPeriodo[]) ?? []);
    void data;
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">{funcionario.nome}</h2>
            <p className="text-xs text-slate-500">
              Código: {funcionario.codigo || "não identificado"}
              {funcionario.cliente_razao_social && (
                <> · Cliente: {funcionario.cliente_razao_social}</>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome">
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as StatusFuncionario })
                }
                className="input"
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="REVISAR">A revisar</option>
              </select>
            </Field>
            <Field label="Empresa">
              <select
                value={form.empresa_id}
                onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}
                className="input"
              >
                <option value="">Sem empresa</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Obra">
              <input
                value={form.obra}
                onChange={(e) => setForm({ ...form, obra: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Cargo">
              <input
                value={form.cargo}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Setor">
              <input
                value={form.setor}
                onChange={(e) => setForm({ ...form, setor: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-slate-900 text-white text-sm rounded-lg px-4 py-1.5 hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Períodos aquisitivos
              </h3>
              <button
                onClick={handleAddPeriodo}
                className="text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md px-2 py-1"
              >
                + Novo período
              </button>
            </div>
            {periodos.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum período aquisitivo cadastrado ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {periodos.map((p) => (
                  <div
                    key={p.id}
                    className="border border-slate-200 rounded-lg p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-slate-700">
                        {p.inicio} → {p.fim}
                      </span>
                      <span className="text-xs text-slate-500">
                        Limite: {p.data_limite}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          p.status === "vencido"
                            ? "bg-red-50 text-red-700"
                            : p.status === "integral"
                            ? "bg-emerald-50 text-emerald-700"
                            : p.status === "parcial"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        Saldo: {p.saldo} dias ({p.status})
                      </span>
                    </div>

                    <div className="mt-2 pl-2 border-l-2 border-slate-100 space-y-1">
                      {(lancamentos[p.id] ?? []).map((l) => (
                        <div
                          key={l.id}
                          className="text-xs text-slate-600 flex justify-between"
                        >
                          <span>
                            {l.inicio} → {l.fim} ({l.dias} dias)
                          </span>
                          <span
                            className={
                              l.status_pagamento === "PAGO"
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }
                          >
                            {l.status_pagamento}
                          </span>
                        </div>
                      ))}
                      {showNovoLancamento === p.id ? (
                        <NovoLancamentoForm
                          periodoId={p.id}
                          onCancel={() => setShowNovoLancamento(null)}
                          onSaved={async () => {
                            setShowNovoLancamento(null);
                            await loadLancamentos(p.id);
                            const { data: refreshed } = await supabase
                              .from("v_rh_periodos")
                              .select(
                                "id, funcionario_id, inicio, fim, dias_direito, data_limite, dias_gozados, saldo, status"
                              )
                              .eq("funcionario_id", funcionario.id);
                            onPeriodosChanged((refreshed as VPeriodo[]) ?? []);
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setShowNovoLancamento(p.id)}
                          className="text-xs text-slate-500 hover:text-slate-900 mt-1"
                        >
                          + lançar gozo de férias
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NovoLancamentoForm({
  periodoId,
  onCancel,
  onSaved,
}: {
  periodoId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [statusPagamento, setStatusPagamento] = useState("PENDENTE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!inicio || !fim) {
      setError("Preencha início e fim.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("rh_lancamentos_ferias").insert({
      periodo_id: periodoId,
      inicio,
      fim,
      status_pagamento: statusPagamento,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <div className="flex flex-wrap items-end gap-2 mt-2 bg-slate-50 rounded-lg p-2">
      <div>
        <label className="block text-[10px] text-slate-500">Início</label>
        <input
          type="date"
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          className="text-xs border border-slate-300 rounded px-1.5 py-1"
        />
      </div>
      <div>
        <label className="block text-[10px] text-slate-500">Fim</label>
        <input
          type="date"
          value={fim}
          onChange={(e) => setFim(e.target.value)}
          className="text-xs border border-slate-300 rounded px-1.5 py-1"
        />
      </div>
      <div>
        <label className="block text-[10px] text-slate-500">Pagamento</label>
        <select
          value={statusPagamento}
          onChange={(e) => setStatusPagamento(e.target.value)}
          className="text-xs border border-slate-300 rounded px-1.5 py-1"
        >
          <option value="PENDENTE">Pendente</option>
          <option value="PAGO">Pago</option>
        </select>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="text-xs bg-slate-900 text-white rounded px-2 py-1 disabled:opacity-50"
      >
        Salvar
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-slate-500 hover:text-slate-800"
      >
        Cancelar
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
