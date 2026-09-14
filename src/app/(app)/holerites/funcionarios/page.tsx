import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import HoleritesFuncionariosClient, {
  type FuncStatus,
} from "./funcionarios-client";

export const dynamic = "force-dynamic";

function ultimosMeses(n: number): string[] {
  const hoje = new Date();
  const meses: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return meses;
}

export default async function HoleritesFuncionariosPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string; competencia?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) redirect("/colaborador/holerites");

  const { obra: obraParam, competencia: compParam } = await searchParams;

  // Lista de obras (distinct de ativos).
  const { data: obrasRows } = await fetchAllRows<{ obra: string | null }>(
    (from, to) =>
      supabase
        .from("rh_funcionarios")
        .select("obra")
        .eq("status", "ATIVO")
        .order("obra")
        .range(from, to)
  );
  const obras = Array.from(
    new Set((obrasRows ?? []).map((r) => r.obra).filter((o): o is string => !!o))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  // Competências: últimos 12 meses + as que já têm holerite.
  const { data: compRows } = await supabase
    .from("holerites")
    .select("competencia")
    .order("competencia", { ascending: false });
  const compsHolerite = Array.from(
    new Set(
      ((compRows as { competencia: string }[]) ?? []).map((r) =>
        r.competencia.slice(0, 7)
      )
    )
  );
  const competencias = Array.from(
    new Set([...ultimosMeses(12), ...compsHolerite])
  ).sort((a, b) => b.localeCompare(a));

  const competencia = compParam ?? competencias[0];
  const obra = obraParam ?? "";

  let funcionarios: FuncStatus[] = [];
  if (obra) {
    const { data: funcs } = await fetchAllRows<{
      id: string;
      codigo: string | null;
      nome: string;
    }>((from, to) =>
      supabase
        .from("rh_funcionarios")
        .select("id, codigo, nome")
        .eq("status", "ATIVO")
        .eq("obra", obra)
        .order("nome")
        .range(from, to)
    );
    const ids = (funcs ?? []).map((f) => f.id);

    const holeritePorFunc = new Map<
      string,
      { storage_path: string; liquido: number | null }
    >();
    if (ids.length > 0) {
      const { data: hs } = await supabase
        .from("holerites")
        .select("funcionario_id, storage_path, liquido")
        .eq("competencia", `${competencia}-01`)
        .in("funcionario_id", ids);
      for (const h of (hs as {
        funcionario_id: string;
        storage_path: string;
        liquido: number | null;
      }[]) ?? []) {
        holeritePorFunc.set(h.funcionario_id, {
          storage_path: h.storage_path,
          liquido: h.liquido,
        });
      }
    }

    funcionarios = (funcs ?? []).map((f) => {
      const h = holeritePorFunc.get(f.id);
      return {
        id: f.id,
        codigo: f.codigo ? f.codigo.padStart(6, "0") : "—",
        nome: f.nome,
        temHolerite: !!h,
        storagePath: h?.storage_path ?? null,
        liquido: h?.liquido ?? null,
      };
    });
  }

  return (
    <HoleritesFuncionariosClient
      obras={obras}
      competencias={competencias}
      obra={obra}
      competencia={competencia}
      funcionarios={funcionarios}
    />
  );
}
