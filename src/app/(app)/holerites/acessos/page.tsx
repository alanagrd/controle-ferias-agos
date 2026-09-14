import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import AcessosClient, { type AcessoRow } from "./acessos-client";

export const dynamic = "force-dynamic";

export default async function HoleritesAcessosPage() {
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

  const { data } = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase
      .from("portal_acessos")
      .select(
        "funcionario_id, senha_temporaria, ultimo_acesso, cpf, rh_funcionarios(nome, codigo)"
      )
      .order("criado_em", { ascending: false })
      .range(from, to)
  );

  const acessos: AcessoRow[] = (data ?? []).map((row) => {
    const f = row.rh_funcionarios as
      | { nome: string; codigo: string | null }
      | { nome: string; codigo: string | null }[]
      | null;
    const func = Array.isArray(f) ? f[0] ?? null : f;
    return {
      funcionarioId: row.funcionario_id as string,
      nome: func?.nome ?? "—",
      codigo: func?.codigo ? String(func.codigo).padStart(6, "0") : "—",
      senhaTemporaria: !!row.senha_temporaria,
      ultimoAcesso: (row.ultimo_acesso as string | null) ?? null,
      temCpf: !!row.cpf,
    };
  });

  return <AcessosClient acessos={acessos} />;
}
