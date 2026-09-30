"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OsModelo, OsRisco } from "@/lib/os/types";

type Edit = {
  cbo: string;
  atividades: string;
  epis: string;
  medidas: string; // uma por linha
  riscos: { grupo: string; fatores: string }[]; // fatores: um por linha
};

function paraEdit(m: OsModelo): Edit {
  return {
    cbo: m.cbo ?? "",
    atividades: m.atividades ?? "",
    epis: m.epis ?? "",
    medidas: (m.medidas ?? []).join("\n"),
    riscos: (m.riscos ?? []).map((r) => ({
      grupo: r.grupo,
      fatores: r.fatores.join("\n"),
    })),
  };
}

export default function OsModelosClient({ modelos }: { modelos: OsModelo[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [lista, setLista] = useState<OsModelo[]>(modelos);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [ed, setEd] = useState<Edit | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novaFuncao, setNovaFuncao] = useState("");

  const filtradas = lista.filter((m) =>
    m.funcao.toLowerCase().includes(busca.trim().toLowerCase())
  );
  const modelo = lista.find((m) => m.id === sel) ?? null;

  function selecionar(m: OsModelo) {
    setSel(m.id);
    setEd(paraEdit(m));
    setMsg(null);
  }

  async function salvar() {
    if (!modelo || !ed) return;
    setSalvando(true);
    const riscos: OsRisco[] = ed.riscos
      .map((r) => ({
        grupo: r.grupo.trim(),
        fatores: r.fatores
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
      }))
      .filter((r) => r.grupo || r.fatores.length);
    const medidas = ed.medidas
      .split("\n")
      .map((m) => m.trim())
      .filter(Boolean);
    const patch = {
      cbo: ed.cbo.trim() || null,
      atividades: ed.atividades.trim() || null,
      epis: ed.epis.trim() || null,
      medidas,
      riscos,
    };
    const { error } = await supabase
      .from("os_modelo")
      .update(patch)
      .eq("id", modelo.id);
    setSalvando(false);
    if (error) {
      setMsg(`Erro ao salvar: ${error.message}`);
      return;
    }
    setLista((prev) =>
      prev.map((m) => (m.id === modelo.id ? { ...m, ...patch } : m))
    );
    setMsg("Modelo salvo.");
  }

  async function importarPadrao() {
    if (
      !confirm(
        "Importar/atualizar os 188 modelos padrão de Ordem de Serviço? As funções já existentes têm o conteúdo substituído pelo padrão."
      )
    )
      return;
    setImportando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/os/seed", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Erro ao importar.");
      setMsg(`${j.total} modelos importados/atualizados. Atualizando…`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao importar.");
    } finally {
      setImportando(false);
    }
  }

  async function criarFuncao() {
    const f = novaFuncao.trim().toUpperCase();
    if (!f) return;
    const { data, error } = await supabase
      .from("os_modelo")
      .insert({ funcao: f })
      .select("id, funcao, cbo, atividades, riscos, epis, medidas, ativo")
      .single();
    if (error) {
      setMsg(`Erro: ${error.message}`);
      return;
    }
    const novo = data as OsModelo;
    setLista((prev) =>
      [...prev, novo].sort((a, b) => a.funcao.localeCompare(b.funcao, "pt-BR"))
    );
    setNovaFuncao("");
    selecionar(novo);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Modelos de Ordem de Serviço
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Conteúdo por função: CBO, atividades, riscos, EPIs e medidas. As
            orientações e o termo são padrão (iguais para todos).
          </p>
        </div>
        <button
          onClick={importarPadrao}
          disabled={importando}
          className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-60"
        >
          {importando ? "Importando…" : "Importar modelos padrão"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[75vh]">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar função…"
              className="input w-full text-sm py-1"
            />
          </div>
          <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filtradas.map((m) => (
              <button
                key={m.id}
                onClick={() => selecionar(m)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                  sel === m.id
                    ? "bg-agos-green/10 text-agos-green-dark dark:text-agos-green-light font-semibold"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {m.funcao}
                {m.riscos.length === 0 && (
                  <span className="text-[11px] text-amber-500 ml-1">sem riscos</span>
                )}
              </button>
            ))}
            {lista.length === 0 && (
              <div className="p-4 text-xs text-slate-400">
                Nenhum modelo. Clique em “Importar modelos padrão”.
              </div>
            )}
          </div>
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <input
              value={novaFuncao}
              onChange={(e) => setNovaFuncao(e.target.value)}
              placeholder="Nova função"
              className="input flex-1 text-sm py-1"
            />
            <button
              onClick={criarFuncao}
              className="text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline"
            >
              Criar
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800">
          {!modelo || !ed ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Selecione uma função para editar.
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {modelo.funcao}
                </span>
                <button
                  onClick={salvar}
                  disabled={salvando}
                  className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-60"
                >
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
              </div>

              <label className="block max-w-[220px]">
                <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  CBO
                </span>
                <input
                  value={ed.cbo}
                  onChange={(e) => setEd({ ...ed, cbo: e.target.value })}
                  className="input w-full text-sm py-1"
                />
              </label>

              <label className="block">
                <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  Atividades
                </span>
                <textarea
                  value={ed.atividades}
                  onChange={(e) => setEd({ ...ed, atividades: e.target.value })}
                  rows={4}
                  className="input w-full text-sm"
                />
              </label>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Riscos (grupo → fatores, um por linha)
                  </span>
                  <button
                    onClick={() =>
                      setEd({
                        ...ed,
                        riscos: [...ed.riscos, { grupo: "", fatores: "" }],
                      })
                    }
                    className="text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline"
                  >
                    + grupo
                  </button>
                </div>
                <div className="space-y-2">
                  {ed.riscos.map((r, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start"
                    >
                      <input
                        value={r.grupo}
                        onChange={(e) =>
                          setEd({
                            ...ed,
                            riscos: ed.riscos.map((x, j) =>
                              j === i ? { ...x, grupo: e.target.value } : x
                            ),
                          })
                        }
                        placeholder="Grupo (ex.: FÍSICO)"
                        className="input text-sm py-1"
                      />
                      <textarea
                        value={r.fatores}
                        onChange={(e) =>
                          setEd({
                            ...ed,
                            riscos: ed.riscos.map((x, j) =>
                              j === i ? { ...x, fatores: e.target.value } : x
                            ),
                          })
                        }
                        rows={2}
                        placeholder="Um fator por linha"
                        className="input text-sm"
                      />
                      <button
                        onClick={() =>
                          setEd({
                            ...ed,
                            riscos: ed.riscos.filter((_, j) => j !== i),
                          })
                        }
                        className="text-slate-400 hover:text-rose-500 text-sm pt-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  EPIs necessários
                </span>
                <textarea
                  value={ed.epis}
                  onChange={(e) => setEd({ ...ed, epis: e.target.value })}
                  rows={2}
                  className="input w-full text-sm"
                />
              </label>

              <label className="block">
                <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  Medidas preventivas (uma por linha)
                </span>
                <textarea
                  value={ed.medidas}
                  onChange={(e) => setEd({ ...ed, medidas: e.target.value })}
                  rows={4}
                  className="input w-full text-sm"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {msg && <p className="text-xs text-slate-500 dark:text-slate-400">{msg}</p>}
    </div>
  );
}
