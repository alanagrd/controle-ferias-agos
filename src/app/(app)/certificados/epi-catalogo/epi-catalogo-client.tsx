"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { caVencido, type EpiCatalogoItem } from "@/lib/epi/types";

export default function EpiCatalogoClient({
  itens,
}: {
  itens: EpiCatalogoItem[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<EpiCatalogoItem[]>(itens);
  const [novo, setNovo] = useState({ descricao: "", ca: "", validade: "" });
  const [msg, setMsg] = useState<string | null>(null);

  async function salvar(id: string, patch: Partial<EpiCatalogoItem>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("epi_catalogo").update(patch).eq("id", id);
    if (error) setMsg(`Erro ao salvar: ${error.message}`);
  }

  async function adicionar() {
    const d = novo.descricao.trim();
    if (!d) return;
    const { data, error } = await supabase
      .from("epi_catalogo")
      .insert({
        descricao: d,
        ca: novo.ca.trim() || null,
        validade: novo.validade || null,
      })
      .select("id, descricao, ca, validade, sinonimos, ativo")
      .single();
    if (error) {
      setMsg(`Erro ao adicionar: ${error.message}`);
      return;
    }
    setRows((prev) =>
      [...prev, data as EpiCatalogoItem].sort((a, b) =>
        a.descricao.localeCompare(b.descricao, "pt-BR")
      )
    );
    setNovo({ descricao: "", ca: "", validade: "" });
  }

  const vencidos = rows.filter((r) => caVencido(r.validade)).length;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Catálogo de EPIs (C.A)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Cadastro central do C.A e validade de cada EPI. As Fichas de EPI puxam
            o C.A daqui. Atualize aqui quando um C.A vencer.
          </p>
        </div>
        {vencidos > 0 && (
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            {vencidos} C.A vencido(s)
          </span>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="px-3 py-2 font-medium">Descrição do EPI</th>
              <th className="px-3 py-2 font-medium w-28">C.A</th>
              <th className="px-3 py-2 font-medium w-40">Validade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => {
              const venc = caVencido(r.validade);
              return (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-1.5 text-slate-800 dark:text-slate-100">
                    {r.descricao}
                    {r.sinonimos?.length > 0 && (
                      <span className="block text-[10.5px] text-slate-400">
                        sinônimos: {r.sinonimos.join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      defaultValue={r.ca ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== (r.ca ?? null)) salvar(r.id, { ca: v });
                      }}
                      className="input w-24 py-1 text-sm"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        defaultValue={r.validade ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value || null;
                          if (v !== (r.validade ?? null))
                            salvar(r.id, { validade: v });
                        }}
                        className={`input py-1 text-sm ${
                          venc ? "text-rose-600 dark:text-rose-400" : ""
                        }`}
                      />
                      {venc && (
                        <span className="text-[10px] font-semibold text-rose-500">
                          vencido
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <td className="px-3 py-2">
                <input
                  value={novo.descricao}
                  onChange={(e) => setNovo((n) => ({ ...n, descricao: e.target.value }))}
                  className="input w-full py-1 text-sm"
                  placeholder="Novo EPI (descrição)"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  value={novo.ca}
                  onChange={(e) => setNovo((n) => ({ ...n, ca: e.target.value }))}
                  className="input w-24 py-1 text-sm"
                  placeholder="C.A"
                />
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={novo.validade}
                    onChange={(e) => setNovo((n) => ({ ...n, validade: e.target.value }))}
                    className="input py-1 text-sm"
                  />
                  <button
                    onClick={adicionar}
                    className="text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline"
                  >
                    Adicionar
                  </button>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-4">
        <span>Data de validade em branco = sem validade.</span>
        {msg && <span className="text-rose-500">{msg}</span>}
      </div>
    </div>
  );
}
