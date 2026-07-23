"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Funcionario, RegistroAso, StatusFuncionario, TipoAso } from "@/lib/types";
import { fmtDate } from "@/lib/status";
import {
  ASO_STATUS_BADGE_CLASS,
  ASO_STATUS_LABEL,
  TIPO_ASO_LABEL,
  type StatusAso,
} from "@/lib/status-aso";

type SortKey = "nome" | "cliente" | "vencimento" | "status";

const STATUS_CADASTRO_LABEL: Record<StatusFuncionario, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  REVISAR: "A revisar",
};

type Row = {
  f: Funcionario;
  vigente: RegistroAso | null;
  statusAso: StatusAso | null;
};

function diasParaVencer(dataVencimento: string): number {
  const alvo = new Date(dataVencimento + "T00:00:00");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export default function AsoFuncionariosClient({
  initialFuncionarios,
  registros,
}: {
  initialFuncionarios: Funcionario[];
  registros: RegistroAso[];
}) {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [funcionarios] = useState(initialFuncionarios);
  const [registrosState, setRegistrosState] = useState(registros);
  const [busca, setBusca] = useState(searchParams.get("q") ?? "");
  const [clienteFilter, setClienteFilter] = useState("");
  const [obraFilter, setObraFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | StatusAso>("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [modalFuncionario, setModalFuncionario] = useState<Funcionario | null>(
    null
  );
  const [modalRegistroExistente, setModalRegistroExistente] =
    useState<RegistroAso | null>(null);

  const vigentePorFuncionario = useMemo(() => {
    const map: Record<string, RegistroAso> = {};
    registrosState.forEach((r) => {
      const atual = map[r.funcionario_id];
      if (!atual || r.data_aso > atual.data_aso) map[r.funcionario_id] = r;
    });
    return map;
  }, [registrosState]);

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

  const clienteFilterTerms = useMemo(
    () =>
      clienteFilter
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    [clienteFilter]
  );

  const allRows = useMemo<Row[]>(() => {
    return funcionarios.map((f) => {
      const vigente = vigentePorFuncionario[f.id] ?? null;
      const statusAso: StatusAso | null = vigente
        ? diasParaVencer(vigente.data_vencimento) > 0
          ? "valido"
          : "vencido"
        : null;
      return { f, vigente, statusAso };
    });
  }, [funcionarios, vigentePorFuncionario]);

  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (!mostrarInativos && r.f.status === "INATIVO") return false;
      if (clienteFilterTerms.length > 0) {
        const cliente = (r.f.cliente_razao_social || "").toUpperCase();
        if (!clienteFilterTerms.some((term) => cliente.includes(term)))
          return false;
      }
      if (obraFilter && r.f.obra !== obraFilter) return false;
      if (busca.trim()) {
        const q = busca.trim().toUpperCase();
        if (!r.f.nome.toUpperCase().includes(q)) return false;
      }
      if (statusFilter && r.statusAso !== statusFilter) return false;
      return true;
    });
  }, [allRows, mostrarInativos, clienteFilterTerms, obraFilter, busca, statusFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir;
    const getter = (r: Row): string | number => {
      switch (sortKey) {
        case "cliente":
          return r.f.cliente_razao_social || "";
        case "vencimento":
          return r.vigente ? r.vigente.data_vencimento : "";
        case "status":
          return r.statusAso || "";
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  async function handleDeleteRegistro(registro: RegistroAso) {
    if (
      !window.confirm(
        "Excluir este registro de ASO? Essa ação não pode ser desfeita."
      )
    )
      return;
    const { error } = await supabase
      .from("rh_registros_aso")
      .delete()
      .eq("id", registro.id);
    if (error) {
      alert("Erro ao excluir: " + error.message);
      return;
    }
    setRegistrosState((prev) => prev.filter((r) => r.id !== registro.id));
  }

  function handleRegistroCriado(registro: RegistroAso) {
    setRegistrosState((prev) => [...prev, registro]);
    setModalFuncionario(null);
    setModalRegistroExistente(null);
  }

  function handleRegistroAtualizado(registro: RegistroAso) {
    setRegistrosState((prev) =>
      prev.map((r) => (r.id === registro.id ? registro : r))
    );
    setModalFuncionario(null);
    setModalRegistroExistente(null);
  }

  function abrirModalLancar(f: Funcionario) {
    setModalRegistroExistente(null);
    setModalFuncionario(f);
  }

  function abrirModalEditar(f: Funcionario, registro: RegistroAso) {
    setModalRegistroExistente(registro);
    setModalFuncionario(f);
  }

  async function handleExportXlsx() {
    const XLSX = await import("xlsx");
    const rows = sorted.map((r) => ({
      Nome: r.f.nome,
      Função: r.f.cargo || "",
      Cliente: r.f.cliente_razao_social || "",
      "Obra/C.Custo": r.f.obra || "",
      "Status Cadastro": r.f.status,
      "Data ASO": r.vigente ? fmtDate(r.vigente.data_aso) : "",
      Vencimento: r.vigente ? fmtDate(r.vigente.data_vencimento) : "",
      "Status ASO": r.statusAso ? ASO_STATUS_LABEL[r.statusAso] : "Sem registro",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Controle de ASO");
    XLSX.writeFile(wb, "controle_aso_export.xlsx");
  }

  async function handleExportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTableMod = await import("jspdf-autotable");
    const autoTable = autoTableMod.default;

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Controle de ASO - Relatório", 14, 14);
    doc.setFontSize(9);
    const hoje = new Date();
    const geradoEm = `${String(hoje.getDate()).padStart(2, "0")}/${String(
      hoje.getMonth() + 1
    ).padStart(2, "0")}/${hoje.getFullYear()}`;
    doc.text(
      `Cliente: ${clienteFilter || "Todos"}  |  Obra/C.Custo: ${
        obraFilter || "Todas"
      }  |  Status: ${statusFilter ? ASO_STATUS_LABEL[statusFilter] : "Todos"}  |  Gerado em: ${geradoEm}`,
      14,
      20
    );

    const rows = sorted.map((r) => [
      r.f.nome,
      r.f.cargo || "-",
      r.f.cliente_razao_social || "-",
      r.f.obra || "-",
      r.f.status,
      r.vigente ? fmtDate(r.vigente.data_aso) : "-",
      r.vigente ? fmtDate(r.vigente.data_vencimento) : "-",
      r.statusAso ? ASO_STATUS_LABEL[r.statusAso] : "Sem registro",
    ]);

    autoTable(doc, {
      startY: 26,
      head: [
        [
          "Nome",
          "Função",
          "Cliente",
          "Obra/C.Custo",
          "Status Cadastro",
          "Data ASO",
          "Vencimento",
          "Status ASO",
        ],
      ],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [139, 171, 62] },
    });
    doc.save("controle_aso_export.pdf");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Funcionários — ASO
        </h1>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-2">
          <Field label="Cliente">
            <input
              list="clientes-list-aso"
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              placeholder="Digite um ou mais clientes, separados por vírgula"
              className="input min-w-[260px]"
            />
            <datalist id="clientes-list-aso">
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
        <Field label="Obra / C.Custo">
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
        <Field label="Status">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | StatusAso)}
            className="input min-w-[150px]"
          >
            <option value="">Todos</option>
            <option value="valido">Válido</option>
            <option value="vencido">Vencido</option>
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

        <div className="flex gap-2 ml-auto pb-0">
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

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 pt-3 text-xs text-slate-500 dark:text-slate-400">
          {sorted.length.toLocaleString("pt-BR")} funcionário(s)
        </div>
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-[1]">
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <Th onClick={() => toggleSort("nome")}>
                  Nome <Arrow col="nome" sortKey={sortKey} sortDir={sortDir} />
                </Th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                  Função
                </th>
                <Th onClick={() => toggleSort("cliente")}>
                  Cliente <Arrow col="cliente" sortKey={sortKey} sortDir={sortDir} />
                </Th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                  Obra / C.Custo
                </th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                  Data ASO
                </th>
                <Th onClick={() => toggleSort("vencimento")}>
                  Vencimento{" "}
                  <Arrow col="vencimento" sortKey={sortKey} sortDir={sortDir} />
                </Th>
                <Th onClick={() => toggleSort("status")}>
                  Status <Arrow col="status" sortKey={sortKey} sortDir={sortDir} />
                </Th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.f.id}
                  className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                    {r.f.nome}
                    {r.f.status !== "ATIVO" && (
                      <span className="ml-2 text-[10px] font-normal text-slate-400">
                        ({STATUS_CADASTRO_LABEL[r.f.status]})
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {r.f.cargo || "–"}
                  </td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {r.f.cliente_razao_social || "–"}
                  </td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {r.f.obra || "–"}
                  </td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {r.vigente ? fmtDate(r.vigente.data_aso) : "–"}
                  </td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {r.vigente ? fmtDate(r.vigente.data_vencimento) : "–"}
                  </td>
                  <td className="py-2 px-3">
                    {r.statusAso ? (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ASO_STATUS_BADGE_CLASS[r.statusAso]}`}
                      >
                        {ASO_STATUS_LABEL[r.statusAso]}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Sem registro</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => abrirModalLancar(r.f)}
                        className="text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline"
                      >
                        + Lançar exame
                      </button>
                      {r.vigente && (
                        <>
                          <button
                            onClick={() =>
                              abrirModalEditar(r.f, r.vigente as RegistroAso)
                            }
                            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteRegistro(r.vigente as RegistroAso)}
                            title="Excluir registro"
                            className="text-slate-400 hover:text-red-500 text-sm px-1"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 px-3 text-slate-500 dark:text-slate-400">
                    Nenhum funcionário encontrado com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalFuncionario && (
        <LancarExameModal
          funcionario={modalFuncionario}
          registroExistente={modalRegistroExistente}
          onClose={() => {
            setModalFuncionario(null);
            setModalRegistroExistente(null);
          }}
          onCreated={handleRegistroCriado}
          onUpdated={handleRegistroAtualizado}
        />
      )}
    </div>
  );
}

function LancarExameModal({
  funcionario,
  registroExistente,
  onClose,
  onCreated,
  onUpdated,
}: {
  funcionario: Funcionario;
  registroExistente: RegistroAso | null;
  onClose: () => void;
  onCreated: (r: RegistroAso) => void;
  onUpdated: (r: RegistroAso) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const editando = !!registroExistente;
  const [dataAso, setDataAso] = useState(
    registroExistente?.data_aso ?? new Date().toISOString().slice(0, 10)
  );
  const [tipo, setTipo] = useState<TipoAso>(registroExistente?.tipo ?? "PERIODICO");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!dataAso) {
      setError("Informe a data do exame.");
      return;
    }
    const vencimento = new Date(dataAso + "T00:00:00");
    vencimento.setDate(vencimento.getDate() + 365);
    const dataVencimento = vencimento.toISOString().slice(0, 10);

    setSaving(true);
    setError(null);

    if (editando && registroExistente) {
      const { data, error } = await supabase
        .from("rh_registros_aso")
        .update({ data_aso: dataAso, tipo, data_vencimento: dataVencimento })
        .eq("id", registroExistente.id)
        .select()
        .single();
      setSaving(false);
      if (error) {
        setError("Erro ao salvar: " + error.message);
        return;
      }
      if (data) onUpdated(data as RegistroAso);
      return;
    }

    const { data, error } = await supabase
      .from("rh_registros_aso")
      .insert({
        funcionario_id: funcionario.id,
        data_aso: dataAso,
        tipo,
        data_vencimento: dataVencimento,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError("Erro ao salvar: " + error.message);
      return;
    }
    if (data) onCreated(data as RegistroAso);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 w-full max-w-sm"
      >
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
          {editando ? "Editar registro de ASO" : "Lançar exame ASO"}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          {funcionario.nome}
        </p>

        <div className="space-y-3">
          <Field label="Data do exame">
            <input
              type="date"
              value={dataAso}
              onChange={(e) => setDataAso(e.target.value)}
              className="input w-full"
            />
          </Field>
          <Field label="Tipo de exame">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoAso)}
              className="input w-full"
            >
              {(Object.keys(TIPO_ASO_LABEL) as TipoAso[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_ASO_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-3.5 py-2 disabled:opacity-60"
          >
            {saving ? "Salvando..." : editando ? "Salvar alterações" : "Salvar lançamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </span>
      {children}
    </label>
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
      className="py-2.5 px-3 font-medium select-none cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
    >
      {children}
    </th>
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
  if (col !== sortKey) return null;
  return <span>{sortDir === 1 ? "▲" : "▼"}</span>;
}
