"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtMoeda } from "@/lib/status-vt";

type ObraRow = { obra: string; funcs_total: number; funcs_atual: number };
type CestaRow = {
  id: string;
  obra: string;
  valor: number | null;
  modo: string | null;
  percentual: number | null;
};

type Modo = "valor" | "salario_pct";
type Registro = { modo: Modo; valor: number | null; percentual: number | null };
type Status = "saving" | "ok" | "err" | undefined;

function parseMoeda(s: string): number | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  let norm = t.replace(/[^0-9.,]/g, "");
  if (norm.includes(",")) norm = norm.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

function parsePct(s: string): number {
  const n = parseMoeda(s);
  return n != null && n > 0 ? n : 6;
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

  const regByNorm = useMemo(() => {
    const m = new Map<string, Registro>();
    cestas.forEach((c) =>
      m.set(c.obra.trim().toUpperCase(), {
        modo: c.modo === "salario_pct" ? "salario_pct" : "valor",
        valor: c.valor,
        percentual: c.percentual,
      })
    );
    return m;
  }, [cestas]);

  const initial = (r: ObraRow): Registro =>
    regByNorm.get(r.obra.toUpperCase()) ?? {
      modo: "valor",
      valor: null,
      percentual: null,
    };

  const [modos, setModos] = useState<Record<string, Modo>>(() => {
    const o: Record<string, Modo> = {};
    obras.forEach((r) => (o[r.obra] = initial(r).modo));
    return o;
  });
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    obras.forEach((r) => {
      const v = initial(r).valor;
      o[r.obra] = v != null ? fmtNum(v) : "";
    });
    return o;
  });
  const [pcts, setPcts] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    obras.forEach((r) => {
      const p = initial(r).percentual;
      o[r.obra] = p != null ? String(p) : "6";
    });
    return o;
  });
  const [saved, setSaved] = useState<Record<string, Registro | null>>(() => {
    const o: Record<string, Registro | null> = {};
    obras.forEach((r) => {
      o[r.obra] = regByNorm.get(r.obra.toUpperCase()) ?? null;
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
  const obras6pct = useMemo(
    () => obras.filter((r) => saved[r.obra]?.modo === "salario_pct").length,
    [obras, saved]
  );
  const totalMesFixo = useMemo(
    () =>
      obras.reduce((acc, r) => {
        const s = saved[r.obra];
        if (s?.modo === "valor" && s.valor != null)
          return acc + s.valor * (r.funcs_atual ?? 0);
        return acc;
      }, 0),
    [obras, saved]
  );

  function mesmoRegistro(a: Registro | null, b: Registro | null): boolean {
    if (a == null || b == null) return a === b;
    return a.modo === b.modo && a.valor === b.valor && a.percentual === b.percentual;
  }

  async function persistir(obra: string, reg: Registro) {
    if (mesmoRegistro(reg, saved[obra] ?? null)) {
      if (reg.modo === "valor")
        setVals((v) => ({
          ...v,
          [obra]: reg.valor != null ? fmtNum(reg.valor) : "",
        }));
      return;
    }
    setStatus((s) => ({ ...s, [obra]: "saving" }));
    try {
      // modo "valor" sem valor = remover cesta da obra
      if (reg.modo === "valor" && reg.valor == null) {
        const { error } = await supabase
          .from("vt_cesta_obra")
          .delete()
          .eq("obra", obra);
        if (error) throw error;
        setSaved((s) => ({ ...s, [obra]: null }));
      } else {
        const { error } = await supabase.from("vt_cesta_obra").upsert(
          {
            obra,
            modo: reg.modo,
            valor: reg.modo === "valor" ? reg.valor : null,
            percentual: reg.modo === "salario_pct" ? reg.percentual : null,
          },
          { onConflict: "obra" }
        );
        if (error) throw error;
        setSaved((s) => ({ ...s, [obra]: reg }));
        if (reg.modo === "valor")
          setVals((v) => ({
            ...v,
            [obra]: reg.valor != null ? fmtNum(reg.valor) : "",
          }));
      }
      setStatus((s) => ({ ...s, [obra]: "ok" }));
      setTimeout(() => setStatus((s) => ({ ...s, [obra]: undefined })), 1500);
    } catch {
      setStatus((s) => ({ ...s, [obra]: "err" }));
    }
  }

  function salvarValor(obra: string) {
    persistir(obra, {
      modo: "valor",
      valor: parseMoeda(vals[obra] ?? ""),
      percentual: null,
    });
  }
  function salvarPct(obra: string) {
    persistir(obra, {
      modo: "salario_pct",
      valor: null,
      percentual: parsePct(pcts[obra] ?? "6"),
    });
  }
  function trocarModo(obra: string, modo: Modo) {
    setModos((m) => ({ ...m, [obra]: modo }));
    if (modo === "salario_pct")
      persistir(obra, {
        modo,
        valor: null,
        percentual: parsePct(pcts[obra] ?? "6"),
      });
    else
      persistir(obra, {
        modo,
        valor: parseMoeda(vals[obra] ?? ""),
        percentual: null,
      });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Cesta básica por obra
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Defina a cesta de cada obra: um <strong>valor fixo</strong> em R$, ou{" "}
            <strong>% do salário</strong> (ex.: Sudre e Quita-107 = 6%). Na
            exportação, o sistema preenche a coluna Cesta por funcionário — no
            modo %, converte horista para mensal (salário ≤ 50 × 220) e aplica o
            percentual; e faz o <strong>proporcional</strong> para quem foi
            admitido dentro do mês.
          </p>
        </div>
        <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="text-right">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {cadastradas}/{obras.length}
            </div>
            <div className="text-slate-500 dark:text-slate-400">cadastradas</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {obras6pct}
            </div>
            <div className="text-slate-500 dark:text-slate-400">a % salário</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {fmtMoeda(totalMesFixo)}
            </div>
            <div className="text-slate-500 dark:text-slate-400">
              mês (valor fixo)
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
              <th className="px-4 py-2.5 font-medium text-right">Funcionários</th>
              <th className="px-4 py-2.5 font-medium w-36">Tipo</th>
              <th className="px-4 py-2.5 font-medium text-right w-52">Cesta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtradas.map((r) => {
              const st = status[r.obra];
              const modo = modos[r.obra] ?? "valor";
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
                    <select
                      value={modo}
                      onChange={(e) =>
                        trocarModo(r.obra, e.target.value as Modo)
                      }
                      className="input text-xs py-1 w-full"
                    >
                      <option value="valor">R$ fixo</option>
                      <option value="salario_pct">% salário</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      {modo === "valor" ? (
                        <>
                          <span className="text-xs text-slate-400">R$</span>
                          <input
                            value={vals[r.obra] ?? ""}
                            onChange={(e) =>
                              setVals((v) => ({
                                ...v,
                                [r.obra]: e.target.value,
                              }))
                            }
                            onBlur={() => salvarValor(r.obra)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                (e.target as HTMLInputElement).blur();
                            }}
                            inputMode="decimal"
                            placeholder="—"
                            className="input w-24 text-right text-sm py-1 tabular-nums"
                          />
                        </>
                      ) : (
                        <>
                          <input
                            value={pcts[r.obra] ?? "6"}
                            onChange={(e) =>
                              setPcts((p) => ({
                                ...p,
                                [r.obra]: e.target.value,
                              }))
                            }
                            onBlur={() => salvarPct(r.obra)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                (e.target as HTMLInputElement).blur();
                            }}
                            inputMode="decimal"
                            className="input w-14 text-right text-sm py-1 tabular-nums"
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            % do salário
                          </span>
                        </>
                      )}
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
                  colSpan={4}
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
