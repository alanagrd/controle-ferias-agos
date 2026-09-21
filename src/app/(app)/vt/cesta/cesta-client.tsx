"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtMoeda } from "@/lib/status-vt";

type ObraRow = { obra: string; funcs_total: number; funcs_atual: number };
type CestaRow = { id: string; obra: string; valor: number };

type Status = "saving" | "ok" | "err" | undefined;

function parseMoeda(s: string): number | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  let norm = t.replace(/[^0-9.,]/g, "");
  // Se tem vírgula, o ponto é separador de milhar (padrão pt-BR).
  if (norm.includes(",")) norm = norm.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

function fmtNum(v: number): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function VtCestaClient({
  obras,
  cestas,
}: {
  obras: ObraRow[];
  cestas: CestaRow[];
}) {
  const supabase = createClient();

  const cestaByNorm = useMemo(() => {
    const m = new Map<string, number>();
    cestas.forEach((c) => m.set(c.obra.trim().toUpperCase(), c.valor));
    return m;
  }, [cestas]);

  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    obras.forEach((r) => {
      const v = cestaByNorm.get(r.obra.toUpperCase());
      o[r.obra] = v != null ? fmtNum(v) : "";
    });
    return o;
  });
  const [saved, setSaved] = useState<Record<string, number | null>>(() => {
    const o: Record<string, number | null> = {};
    obras.forEach((r) => {
      o[r.obra] = cestaByNorm.get(r.obra.toUpperCase()) ?? null;
    });
    return o;
  });
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return obras;
    return obras.filter((r) => r.obra.toLowerCase().includes(q));
  }, [obras, busca]);

  const cadastradas = useMemo(
    () => obras.filter((r) => saved[r.obra] != null).length,
    [obras, saved]
  );
  const totalMes = useMemo(
    () =>
      obras.reduce(
        (acc, r) => acc + (saved[r.obra] ?? 0) * (r.funcs_atual ?? 0),
        0
      ),
    [obras, saved]
  );

  async function salvar(obra: string) {
    const valor = parseMoeda(vals[obra] ?? "");
    const anterior = saved[obra] ?? null;
    if (valor === anterior) {
      // reformata o texto mesmo sem mudança de valor
      setVals((v) => ({ ...v, [obra]: valor != null ? fmtNum(valor) : "" }));
      return;
    }
    setStatus((s) => ({ ...s, [obra]: "saving" }));
    try {
      if (valor === null) {
        const { error } = await supabase
          .from("vt_cesta_obra")
          .delete()
          .eq("obra", obra);
        if (error) throw error;
        setSaved((s) => ({ ...s, [obra]: null }));
        setVals((v) => ({ ...v, [obra]: "" }));
      } else {
        const { error } = await supabase
          .from("vt_cesta_obra")
          .upsert({ obra, valor }, { onConflict: "obra" });
        if (error) throw error;
        setSaved((s) => ({ ...s, [obra]: valor }));
        setVals((v) => ({ ...v, [obra]: fmtNum(valor) }));
      }
      setStatus((s) => ({ ...s, [obra]: "ok" }));
      setTimeout(
        () => setStatus((s) => ({ ...s, [obra]: undefined })),
        1500
      );
    } catch {
      setStatus((s) => ({ ...s, [obra]: "err" }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Cesta básica por obra
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Cadastre o valor da cesta de cada obra. Na exportação da planilha de
            VT, o sistema preenche a coluna <strong>Cesta</strong> com esse valor
            para todos os funcionários da obra. Obras sem valor ficam em branco.
          </p>
        </div>
        <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="text-right">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {cadastradas}/{obras.length}
            </div>
            <div className="text-slate-500 dark:text-slate-400">
              obras cadastradas
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {fmtMoeda(totalMes)}
            </div>
            <div className="text-slate-500 dark:text-slate-400">
              estimativa do mês
            </div>
          </div>
        </div>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar obra…"
        className="input w-full max-w-xs text-sm"
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="px-4 py-2.5 font-medium">Obra</th>
              <th className="px-4 py-2.5 font-medium text-right">
                Funcionários
              </th>
              <th className="px-4 py-2.5 font-medium text-right w-48">
                Cesta (R$)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtradas.map((r) => {
              const st = status[r.obra];
              return (
                <tr
                  key={r.obra}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                    {r.obra}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {r.funcs_atual}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-slate-400">R$</span>
                      <input
                        value={vals[r.obra] ?? ""}
                        onChange={(e) =>
                          setVals((v) => ({ ...v, [r.obra]: e.target.value }))
                        }
                        onBlur={() => salvar(r.obra)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        inputMode="decimal"
                        placeholder="—"
                        className="input w-28 text-right text-sm py-1 tabular-nums"
                      />
                      <span className="w-4 text-center text-xs">
                        {st === "saving" && (
                          <span className="text-slate-400">…</span>
                        )}
                        {st === "ok" && (
                          <span className="text-emerald-500">✓</span>
                        )}
                        {st === "err" && (
                          <span className="text-rose-500" title="Erro ao salvar">
                            !
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  Nenhuma obra encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
