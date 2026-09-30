"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  resolverCatalogo,
  type EpiCatalogoItem,
  type EpiItem,
  type EpiModelo,
} from "@/lib/epi/types";

export default function EpiModelosClient({
  modelos,
  catalogo,
}: {
  modelos: EpiModelo[];
  catalogo: EpiCatalogoItem[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [lista, setLista] = useState<EpiModelo[]>(modelos);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [itens, setItens] = useState<EpiItem[]>([]);
  const [novoEpi, setNovoEpi] = useState("");
  const [novaFuncao, setNovaFuncao] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const filtradas = lista.filter((m) =>
    m.funcao.toLowerCase().includes(busca.trim().toLowerCase())
  );
  const modelo = lista.find((m) => m.id === sel) ?? null;

  function selecionar(m: EpiModelo) {
    setSel(m.id);
    setItens(m.itens.map((it) => ({ ...it })));
    setMsg(null);
  }

  async function salvar() {
    if (!modelo) return;
    setSalvando(true);
    const { error } = await supabase
      .from("epi_modelo")
      .update({ itens })
      .eq("id", modelo.id);
    setSalvando(false);
    if (error) {
      setMsg(`Erro ao salvar: ${error.message}`);
      return;
    }
    setLista((prev) =>
      prev.map((m) => (m.id === modelo.id ? { ...m, itens } : m))
    );
    setMsg("Modelo salvo.");
  }

  async function importarPadrao() {
    if (
      !confirm(
        "Importar/atualizar os 187 modelos padrão de EPI? As funções já existentes têm a lista de EPIs substituída pela padrão."
      )
    )
      return;
    setImportando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/epi/seed", { method: "POST" });
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
      .from("epi_modelo")
      .insert({ funcao: f, itens: [] })
      .select("id, funcao, itens, ativo")
      .single();
    if (error) {
      setMsg(`Erro: ${error.message}`);
      return;
    }
    const novo = data as EpiModelo;
    setLista((prev) =>
      [...prev, novo].sort((a, b) => a.funcao.localeCompare(b.funcao, "pt-BR"))
    );
    setNovaFuncao("");
    selecionar(novo);
  }

  const caDe = (d: string) => resolverCatalogo(d, catalogo)?.ca ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Modelos de EPI por função
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            A lista de EPIs de cada função. É o que aparece ao emitir a ficha.
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

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Lista de funções */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[70vh]">
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
                <span className="text-[11px] text-slate-400 ml-1">
                  ({m.itens.length})
                </span>
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

        {/* Editor do modelo selecionado */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {!modelo ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Selecione uma função para editar a lista de EPIs.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 font-medium w-16 text-center">Qtde</th>
                    <th className="px-3 py-2 font-medium">Descrição do EPI</th>
                    <th className="px-3 py-2 font-medium w-20 text-center">C.A</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {itens.map((it, i) => {
                    const semCa = !resolverCatalogo(it.descricao, catalogo);
                    return (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="number"
                            min={0}
                            value={it.qtd}
                            onChange={(e) =>
                              setItens((prev) =>
                                prev.map((x, j) =>
                                  j === i
                                    ? { ...x, qtd: Number(e.target.value) || 0 }
                                    : x
                                )
                              )
                            }
                            className="input w-14 text-center py-1 text-sm tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-slate-800 dark:text-slate-100">
                          {it.descricao}
                        </td>
                        <td className="px-3 py-1.5 text-center tabular-nums">
                          {semCa ? (
                            <span className="text-rose-500" title="Fora do catálogo">
                              —
                            </span>
                          ) : (
                            caDe(it.descricao) || "—"
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            onClick={() =>
                              setItens((prev) => prev.filter((_, j) => j !== i))
                            }
                            className="text-slate-400 hover:text-rose-500"
                            title="Remover"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center gap-2 p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <select
                  value={novoEpi}
                  onChange={(e) => setNovoEpi(e.target.value)}
                  className="input text-sm flex-1"
                >
                  <option value="">+ Adicionar EPI do catálogo…</option>
                  {catalogo.map((c) => (
                    <option key={c.id} value={c.descricao}>
                      {c.descricao}
                      {c.ca ? ` (C.A ${c.ca})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!novoEpi) return;
                    setItens((prev) => [...prev, { descricao: novoEpi, qtd: 1 }]);
                    setNovoEpi("");
                  }}
                  className="text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline whitespace-nowrap"
                >
                  Adicionar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {msg && <p className="text-xs text-slate-500 dark:text-slate-400">{msg}</p>}
    </div>
  );
}
