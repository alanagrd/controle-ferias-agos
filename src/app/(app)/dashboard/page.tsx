import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: ativos },
    { count: inativos },
    { count: revisar },
    { data: empresas },
    { data: vencidos },
    { data: proximos },
  ] = await Promise.all([
    supabase
      .from("rh_funcionarios")
      .select("id", { count: "exact", head: true })
      .eq("status", "ATIVO"),
    supabase
      .from("rh_funcionarios")
      .select("id", { count: "exact", head: true })
      .eq("status", "INATIVO"),
    supabase
      .from("rh_funcionarios")
      .select("id", { count: "exact", head: true })
      .eq("status", "REVISAR"),
    supabase.from("rh_empresas").select("id, nome").eq("ativa", true),
    supabase
      .from("v_rh_periodos")
      .select("id, funcionario_id, data_limite, saldo, status")
      .eq("status", "vencido"),
    supabase
      .from("v_rh_periodos")
      .select("id, funcionario_id, data_limite, saldo, status")
      .in("status", ["aberto", "parcial"])
      .lte(
        "data_limite",
        new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
      ),
  ]);

  let porEmpresa: { nome: string; total: number }[] = [];
  if (empresas && empresas.length) {
    const counts = await Promise.all(
      empresas.map(async (e) => {
        const { count } = await supabase
          .from("rh_funcionarios")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", e.id)
          .eq("status", "ATIVO");
        return { nome: e.nome, total: count ?? 0 };
      })
    );
    porEmpresa = counts
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }

  const semEmpresaCount = await supabase
    .from("rh_funcionarios")
    .select("id", { count: "exact", head: true })
    .is("empresa_id", null)
    .eq("status", "ATIVO");

  const funcionarioIds = Array.from(
    new Set(
      [...(vencidos ?? []), ...(proximos ?? [])].map((p) => p.funcionario_id)
    )
  );
  let nomesPorId: Record<string, string> = {};
  if (funcionarioIds.length) {
    const { data: nomes } = await supabase
      .from("rh_funcionarios")
      .select("id, nome")
      .in("id", funcionarioIds);
    nomesPorId = Object.fromEntries((nomes ?? []).map((n) => [n.id, n.nome]));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Visão geral
        </h1>
        <p className="text-sm text-slate-500">
          Dados em tempo real do cadastro de funcionários e férias.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi label="Ativos" value={ativos ?? 0} tone="slate" />
        <Kpi label="Inativos" value={inativos ?? 0} tone="slate" />
        <Kpi label="A revisar" value={revisar ?? 0} tone="amber" />
        <Kpi
          label="Sem empresa identificada"
          value={semEmpresaCount.count ?? 0}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">
            Funcionários ativos por empresa
          </h2>
          {porEmpresa.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum dado disponível.</p>
          ) : (
            <ul className="space-y-2">
              {porEmpresa.map((e) => (
                <li
                  key={e.nome}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-700">{e.nome}</span>
                  <span className="font-medium text-slate-900">
                    {e.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
            Períodos vencidos
            <span className="text-xs font-normal bg-red-50 text-red-700 rounded-full px-2 py-0.5">
              {vencidos?.length ?? 0}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Já passaram da data limite (fim do período + 12 meses).
          </p>
          {!vencidos || vencidos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum período vencido.</p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto">
              {vencidos.slice(0, 20).map((p) => (
                <li key={p.id} className="text-sm flex justify-between">
                  <Link
                    href={`/funcionarios?q=${encodeURIComponent(
                      nomesPorId[p.funcionario_id] ?? ""
                    )}`}
                    className="text-slate-700 hover:text-slate-900 hover:underline truncate max-w-[70%]"
                  >
                    {nomesPorId[p.funcionario_id] ?? "—"}
                  </Link>
                  <span className="text-red-600 text-xs shrink-0">
                    {p.data_limite}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
            Vencendo nos próximos 60 dias
            <span className="text-xs font-normal bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">
              {proximos?.length ?? 0}
            </span>
          </h2>
          {!proximos || proximos.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum período vencendo em breve.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 font-medium">Funcionário</th>
                    <th className="py-2 font-medium">Data limite</th>
                    <th className="py-2 font-medium">Saldo (dias)</th>
                  </tr>
                </thead>
                <tbody>
                  {proximos
                    .sort((a, b) => a.data_limite.localeCompare(b.data_limite))
                    .slice(0, 30)
                    .map((p) => (
                      <tr key={p.id} className="border-b border-slate-50">
                        <td className="py-1.5">
                          <Link
                            href={`/funcionarios?q=${encodeURIComponent(
                              nomesPorId[p.funcionario_id] ?? ""
                            )}`}
                            className="hover:underline"
                          >
                            {nomesPorId[p.funcionario_id] ?? "—"}
                          </Link>
                        </td>
                        <td className="py-1.5 text-amber-700">
                          {p.data_limite}
                        </td>
                        <td className="py-1.5">{p.saldo}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "amber";
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`text-2xl font-semibold mt-1 ${
          tone === "amber" ? "text-amber-600" : "text-slate-900"
        }`}
      >
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}
