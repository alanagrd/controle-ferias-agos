"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Funcionario, Empresa, VPeriodo, StatusFuncionario } from "@/lib/types";
import {
  PERIODO_STATUS_BADGE_CLASS,
  PERIODO_STATUS_LABEL,
  PERIODO_STATUS_LABEL_LONG,
  PERIODO_STATUS_MAP,
  PERIODO_STATUS_ORDER,
  fmtDate,
} from "@/lib/status";

type SortKey =
  | "nome"
  | "cliente"
  | "status"
  | "periodo_inicio"
  | "saldo"
  | "data_limite"
  | "status_periodo";

const FUNCIONARIO_LEVEL_KEYS = new Set<SortKey>(["nome", "cliente", "status"]);

const STATUS_LABEL: Record<StatusFuncionario, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  REVISAR: "A revisar",
};

const STATUS_TONE: Record<StatusFuncionario, string> = {
  ATIVO: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400",
  INATIVO: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  REVISAR: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
};

type Row = { f: Funcionario; p: VPeriodo | null };

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
  const [busca, setBusca] = useState(searchParams.get("q") ?? "");
  const [clienteFilter, setClienteFilter] = useState("");
  const [obraFilter, setObraFilter] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [statusPeriodoFilter, setStatusPeriodoFilter] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<Funcionario | null>(null);
  const [showNovoFuncionario, setShowNovoFuncionario] = useState(false);

  const periodosPorFuncionario = useMemo(() => {
    const map: Record<string, VPeriodo[]> = {};
    periodosState.forEach((p) => {
      if (!map[p.funcionario_id]) map[p.funcionario_id] = [];
      map[p.funcionario_id].push(p);
    });
    return map;
  }, [periodosState]);

  const allRows = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    funcionarios.forEach((f) => {
      const fPeriodos = periodosPorFuncionario[f.id] ?? [];
      if (fPeriodos.length === 0) {
        rows.push({ f, p: null });
      } else {
        fPeriodos.forEach((p) => rows.push({ f, p }));
      }
    });
    return rows;
  }, [funcionarios, periodosPorFuncionario]);

  const clientes = useMemo(
    () =>
      Array.from(
        new Set(
          funcionarios
            .map((f) => f.cliente_razao_social)
            .filter((c): c is string => !!c)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [funcionarios]
  );

  const obras = useMemo(
    () =>
      Array.from(
        new Set(funcionarios.map((f) => f.obra).filter((o): o is string => !!o))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [funcionarios]
  );

  const meses = useMemo(() => {
    const set = new Set<string>();
    periodosState.forEach((p) => set.add(p.data_limite.slice(0, 7)));
    return Array.from(set).sort();
  }, [periodosState]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  // Filtro de cliente por texto livre — aceita vários clientes de uma vez
  // separados por vírgula (ex.: "GEOSONDA, DRV"), cada termo casando por
  // substring (case-insensitive) em vez de exigir o nome exato.
  const clienteFilterTerms = useMemo(
    () =>
      clienteFilter
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    [clienteFilter]
  );

  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (!mostrarInativos && r.f.status === "INATIVO") return false;
      if (clienteFilterTerms.length > 0) {
        const cliente = (r.f.cliente_razao_social || "").toUpperCase();
        if (!clienteFilterTerms.some((term) => cliente.includes(term))) return false;
      }
      if (obraFilter && r.f.obra !== obraFilter) return false;
      if (busca.trim()) {
        const q = busca.trim().toUpperCase();
        if (!r.f.nome.toUpperCase().includes(q)) return false;
      }
      if (mesFilter) {
        if (!r.p || r.p.data_limite.slice(0, 7) !== mesFilter) return false;
      }
      if (statusPeriodoFilter) {
        if (!r.p || PERIODO_STATUS_MAP[r.p.status] !== statusPeriodoFilter) return false;
      }
      return true;
    });
  }, [
    allRows,
    mostrarInativos,
    clienteFilterTerms,
    obraFilter,
    busca,
    mesFilter,
    statusPeriodoFilter,
  ]);

  const sorted = useMemo(() => {
    const dir = sortDir;
    const getter = (r: Row): string | number => {
      switch (sortKey) {
        case "cliente":
          return r.f.cliente_razao_social || "";
        case "status":
          return r.f.status || "";
        case "periodo_inicio":
          return r.p ? r.p.inicio : "";
        case "saldo":
          return r.p ? r.p.saldo : -1;
        case "data_limite":
          return r.p ? r.p.data_limite : "";
        case "status_periodo":
          return r.p ? r.p.status : "";
        default:
          return r.f.nome || "";
      }
    };
    return [...filtered].sort((a, b) => {
      const va = getter(a);
      const vb = getter(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const agrupar = FUNCIONARIO_LEVEL_KEYS.has(sortKey);

  const groups = useMemo(() => {
    const result: Row[][] = [];
    let i = 0;
    while (i < sorted.length) {
      let span = 1;
      if (agrupar) {
        while (i + span < sorted.length && sorted[i + span].f.id === sorted[i].f.id) {
          span++;
        }
      }
      result.push(sorted.slice(i, i + span));
      i += span;
    }
    return result;
  }, [sorted, agrupar]);

  const funcionariosUnicos = useMemo(
    () => new Set(sorted.map((r) => r.f.id)).size,
    [sorted]
  );

  // `sorted` includes one row per funcionário even when no período matched
  // (r.p === null), so counting sorted.length overstates "período(s)" — it
  // was counting rendered table rows, not periods actually found.
  const periodosContados = useMemo(
    () => sorted.filter((r) => r.p !== null).length,
    [sorted]
  );


  async function handleExportXlsx() {
    const XLSX = await import("xlsx");
    const rows = filtered.map((r) => ({
      Nome: r.f.nome,
      Cliente: r.f.cliente_razao_social || "",
      "Obra/Projeto": r.f.obra || "",
      Setor: r.f.setor || "",
      Cargo: r.f.cargo || "",
      "Status Cadastro": r.f.status,
      "Início Período": r.p ? fmtDate(r.p.inicio) : "",
      "Fim Período": r.p ? fmtDate(r.p.fim) : "",
      "Dias Gozados": r.p ? r.p.dias_gozados : "",
      Saldo: r.p ? r.p.saldo : "",
      "Data Limite": r.p ? fmtDate(r.p.data_limite) : "",
      "Status Período": r.p ? PERIODO_STATUS_LABEL[PERIODO_STATUS_MAP[r.p.status]] : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Controle de Ferias");
    XLSX.writeFile(wb, "controle_ferias_export.xlsx");
  }

  async function handleExportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTableMod = await import("jspdf-autotable");
    const autoTable = autoTableMod.default;

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Controle de Férias - Relatório", 14, 14);
    doc.setFontSize(9);
    const hoje = new Date();
    const geradoEm = `${String(hoje.getDate()).padStart(2, "0")}/${String(
      hoje.getMonth() + 1
    ).padStart(2, "0")}/${hoje.getFullYear()}`;
    doc.text(
      `Cliente: ${clienteFilter || "Todos"}  |  Obra/Projeto: ${
        obraFilter || "Todas"
      }  |  Mês de vencimento: ${mesFilter || "Todos"}  |  Gerado em: ${geradoEm}`,
      14,
      20
    );

    const rows = filtered.map((r) => [
      r.f.nome,
      r.f.cliente_razao_social || "-",
      r.f.obra || "-",
      r.f.status,
      r.p ? `${fmtDate(r.p.inicio)} - ${fmtDate(r.p.fim)}` : "-",
      r.p ? String(r.p.saldo) : "-",
      r.p ? fmtDate(r.p.data_limite) : "-",
      r.p ? PERIODO_STATUS_LABEL[PERIODO_STATUS_MAP[r.p.status]] : "-",
    ]);

    autoTable(doc, {
      startY: 26,
      head: [
        [
          "Nome",
          "Cliente",
          "Obra/Projeto",
          "Status Cadastro",
          "Período",
          "Saldo",
          "Data Limite",
          "Status Período",
        ],
      ],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [91, 140, 255] },
    });
    doc.save("controle_ferias_export.pdf");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Funcionários
        </h1>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-2">
          <Field label="Cliente">
            <input
              list="clientes-list"
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              placeholder="Digite um ou mais clientes, separados por vírgula"
              className="input min-w-[260px]"
            />
            <datalist id="clientes-list">
              {clientes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Buscar nome">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite um nome..."
              className="input w-full"
            />
          </Field>
        </div>
        <Field label="Obra / projeto">
          <select
            value={obraFilter}
            onChange={(e) => setObraFilter(e.target.value)}
            className="input min-w-[150px]"
          >
            <option value="">Todas</option>
            {obras.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mês de vencimento">
          <select
            value={mesFilter}
            onChange={(e) => setMesFilter(e.target.value)}
            className="input min-w-[150px]"
          >
            <option value="">Todos</option>
            {meses.map((ym) => {
              const [y, m] = ym.split("-");
              return (
                <option key={ym} value={ym}>
                  {m}/{y}
                </option>
              );
            })}
          </select>
        </Field>
        <Field label="Status do período">
          <select
            value={statusPeriodoFilter}
            onChange={(e) => setStatusPeriodoFilter(e.target.value)}
            className="input min-w-[150px]"
          >
            <option value="">Todos</option>
            {PERIODO_STATUS_ORDER.map((k) => (
              <option key={k} value={k}>
                {PERIODO_STATUS_LABEL_LONG[k]}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 pb-2">
          <input
            type="checkbox"
            checked={mostrarInativos}
            onChange={(e) => setMostrarInativos(e.target.checked)}
          />
          Mostrar inativos
        </label>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setShowNovoFuncionario(true)}
            className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-3.5 py-2"
          >
            + Novo funcionário
          </button>
          <button
            onClick={handleExportXlsx}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Exportar Excel
          </button>
          <button
            onClick={handleExportPdf}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Clique em um funcionário na tabela para editar o cadastro, lançar um
        novo gozo de férias ou abrir um novo período aquisitivo. O filtro de
        obra/projeto por enquanto só tem dado para os clientes que já enviaram
        esse detalhe no export — os demais ganham essa granularidade quando
        recebermos o mesmo tipo de planilha.
      </p>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 pt-3 text-xs text-slate-500 dark:text-slate-400">
          {funcionariosUnicos.toLocaleString("pt-BR")} funcionário(s) ·{" "}
          {periodosContados.toLocaleString("pt-BR")} período(s) — um mesmo
          funcionário pode ter até 2 períodos aquisitivos abertos ao mesmo
          tempo
        </div>
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-[1]">
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <Th onClick={() => toggleSort("nome")}>
                  Nome <Arrow col="nome" sortKey={sortKey} sortDir={sortDir} />
                </Th>
                <Th onClick={() => toggleSort("cliente")}>
                  Cliente <Arrow col="cliente" sortKey={sortKey} sortDir={sortDir} />
                </Th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                  Setor / Cargo
                </th>
                <Th onClick={() => toggleSort("status")}>
                  Status cadastro <Arrow col="status" sortKey={sortKey} sortDir={sortDir} />
                </Th>
                <Th onClick={() => toggleSort("periodo_inicio")}>
                  Período <Arrow col="periodo_inicio" sortKey={sortKey} sortDir={sortDir} />
                </Th>
                <Th onClick={() => toggleSort("saldo")}>
                  Saldo <Arrow col="saldo" sortKey={sortKey} sortDir={sortDir} />
                </Th>
                <Th onClick={() => toggleSort("data_limite")}>
                  Data limite <Arrow col="data_limite" sortKey={sortKey} sortDir={sortDir} />
                </Th>
                <Th onClick={() => toggleSort("status_periodo")}>
                  Status período <Arrow col="status_periodo" sortKey={sortKey} sortDir={sortDir} />
                </Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const span = group.length;
                const f = group[0].f;
                return group.map((row, j) => {
                  const p = row.p;
                  const periodoStatusKey = p ? PERIODO_STATUS_MAP[p.status] : null;
                  return (
                    <tr
                      key={`${f.id}-${p?.id ?? "none"}`}
                      onClick={() => setSelected(f)}
                      className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                    >
                      {j === 0 && (
                        <>
                          <td
                            rowSpan={span}
                            className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100 align-top"
                          >
                            {f.nome}
                            {span > 1 && (
                              <span className="ml-2 text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 text-slate-500 dark:text-slate-400">
                                {span} períodos
                              </span>
                            )}
                            {f.codigo && (
                              <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                                #{f.codigo}
                              </span>
                            )}
                          </td>
                          <td
                            rowSpan={span}
                            className="py-2 px-3 text-slate-700 dark:text-slate-300 align-top"
                          >
                            {f.cliente_razao_social || (
                              <span className="text-slate-400 dark:text-slate-500">
                                sem cliente
                              </span>
                            )}
                            {f.obra && (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                {" "}
                                · {f.obra}
                              </span>
                            )}
                          </td>
                          <td
                            rowSpan={span}
                            className="py-2 px-3 text-slate-500 dark:text-slate-400 align-top"
                          >
                            {f.setor || "–"}{" "}
                            <span className="text-slate-400 dark:text-slate-500">
                              / {f.cargo || "–"}
                            </span>
                          </td>
                          <td rowSpan={span} className="py-2 px-3 align-top">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${STATUS_TONE[f.status]}`}
                            >
                              {STATUS_LABEL[f.status]}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                        {p ? `${fmtDate(p.inicio)} – ${fmtDate(p.fim)}` : "–"}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                        {p ? `${p.saldo}/${p.dias_direito}` : "–"}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                        {p ? fmtDate(p.data_limite) : "–"}
                      </td>
                      <td className="py-2 px-3">
                        {periodoStatusKey ? (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${PERIODO_STATUS_BADGE_CLASS[periodoStatusKey]}`}
                          >
                            {PERIODO_STATUS_LABEL[periodoStatusKey]}
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
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

      {showNovoFuncionario && (
        <NovoFuncionarioModal
          onClose={() => setShowNovoFuncionario(false)}
          onCreated={(novo) => {
            setFuncionarios((prev) =>
              [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
            );
            setShowNovoFuncionario(false);
          }}
        />
      )}
    </div>
  );
}

function Arrow({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey;
  sortKey: SortKey;
  sortDir: 1 | -1;
}) {
  if (sortKey !== col) return null;
  return <span className="ml-1 text-agos-green">{sortDir === 1 ? "▲" : "▼"}</span>;
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
      className="py-2.5 px-3 font-medium select-none cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
    >
      {children}
    </th>
  );
}

function NovoFuncionarioModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (f: Funcionario) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState("");
  const [setor, setSetor] = useState("");
  const [cargo, setCargo] = useState("");
  const [admissao, setAdmissao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!nome.trim()) {
      setError("Informe o nome do funcionário.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from("rh_funcionarios")
      .insert({
        nome: nome.trim(),
        cliente_razao_social: cliente.trim() || null,
        setor: setor.trim() || null,
        cargo: cargo.trim() || null,
        admissao: admissao || null,
        status: "ATIVO",
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError("Erro ao salvar: " + error.message);
      return;
    }
    if (data) onCreated(data as Funcionario);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            Novo funcionário
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cadastro manual — útil para incluir alguém que ainda não veio na
            planilha de importação.
          </p>
          <Field label="Nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input w-full"
            />
          </Field>
          <Field label="Cliente">
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Ex: GEOSONDA"
              className="input w-full"
            />
          </Field>
          <Field label="Setor">
            <input
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              className="input w-full"
            />
          </Field>
          <Field label="Cargo">
            <input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              className="input w-full"
            />
          </Field>
          <Field label="Data de admissão">
            <input
              type="date"
              value={admissao}
              onChange={(e) => setAdmissao(e.target.value)}
              className="input w-full"
            />
          </Field>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-agos-green hover:bg-agos-green-dark text-white text-sm rounded-lg px-4 py-1.5 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar funcionário"}
            </button>
          </div>
        </div>
      </div>
    </div>
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
    cliente_razao_social: funcionario.cliente_razao_social ?? "",
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
        cliente_razao_social: form.cliente_razao_social || null,
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

  async function handleDeleteLancamento(periodoId: string, lancamentoId: string) {
    if (
      !window.confirm(
        "Excluir este lançamento de gozo de férias? Essa ação não pode ser desfeita."
      )
    )
      return;
    const { error } = await supabase
      .from("rh_lancamentos_ferias")
      .delete()
      .eq("id", lancamentoId);
    if (error) {
      alert("Erro ao excluir: " + error.message);
      return;
    }
    await loadLancamentos(periodoId);
    const { data: refreshed } = await supabase
      .from("v_rh_periodos")
      .select(
        "id, funcionario_id, inicio, fim, dias_direito, data_limite, dias_gozados, saldo, status"
      )
      .eq("funcionario_id", funcionario.id);
    onPeriodosChanged((refreshed as VPeriodo[]) ?? []);
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
        className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              {funcionario.nome}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Código: {funcionario.codigo || "não identificado"}
              {funcionario.cliente_razao_social && (
                <> · Cliente: {funcionario.cliente_razao_social}</>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-lg leading-none"
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
            <Field label="Cliente">
              <input
                value={form.cliente_razao_social}
                onChange={(e) =>
                  setForm({ ...form, cliente_razao_social: e.target.value })
                }
                className="input"
              />
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
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-agos-green text-white text-sm rounded-lg px-4 py-1.5 hover:bg-agos-green-dark disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Períodos aquisitivos
              </h3>
              <button
                onClick={handleAddPeriodo}
                className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1"
              >
                + Novo período
              </button>
            </div>
            {periodos.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum período aquisitivo cadastrado ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {periodos.map((p) => {
                  const statusKey = PERIODO_STATUS_MAP[p.status];
                  return (
                    <div
                      key={p.id}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-slate-700 dark:text-slate-300">
                          {fmtDate(p.inicio)} → {fmtDate(p.fim)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Limite: {fmtDate(p.data_limite)}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${PERIODO_STATUS_BADGE_CLASS[statusKey]}`}
                        >
                          Saldo: {p.saldo} dias ({PERIODO_STATUS_LABEL[statusKey]})
                        </span>
                      </div>

                      <div className="mt-2 pl-2 border-l-2 border-slate-100 dark:border-slate-800 space-y-1">
                        {(lancamentos[p.id] ?? []).map((l) => (
                          <div
                            key={l.id}
                            className="text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between gap-2"
                          >
                            <span>
                              {fmtDate(l.inicio)} → {fmtDate(l.fim)} ({l.dias} dias)
                            </span>
                            <span className="flex items-center gap-2">
                              <span
                                className={
                                  l.status_pagamento === "PAGO"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-amber-600 dark:text-amber-400"
                                }
                              >
                                {l.status_pagamento}
                              </span>
                              <button
                                onClick={() => handleDeleteLancamento(p.id, l.id)}
                                title="Excluir lançamento"
                                className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                              >
                                ✕
                              </button>
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
                            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mt-1"
                          >
                            + lançar gozo de férias
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
    <div className="flex flex-wrap items-end gap-2 mt-2 bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
      <div>
        <label className="block text-[10px] text-slate-500 dark:text-slate-400">
          Início
        </label>
        <input
          type="date"
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded px-1.5 py-1"
        />
      </div>
      <div>
        <label className="block text-[10px] text-slate-500 dark:text-slate-400">
          Fim
        </label>
        <input
          type="date"
          value={fim}
          onChange={(e) => setFim(e.target.value)}
          className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded px-1.5 py-1"
        />
      </div>
      <div>
        <label className="block text-[10px] text-slate-500 dark:text-slate-400">
          Pagamento
        </label>
        <select
          value={statusPagamento}
          onChange={(e) => setStatusPagamento(e.target.value)}
          className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded px-1.5 py-1"
        >
          <option value="PENDENTE">Pendente</option>
          <option value="PAGO">Pago</option>
        </select>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="text-xs bg-agos-green text-white rounded px-2 py-1 disabled:opacity-50"
      >
        Salvar
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
      >
        Cancelar
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 w-full">{error}</p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
