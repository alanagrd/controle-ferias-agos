import { createClient } from "@/lib/supabase/server";
import ImportacaoClient from "./importacao-client";

export const dynamic = "force-dynamic";

export default async function ImportacaoPage() {
  const supabase = await createClient();
  const [{ data: funcionarios }, { data: empresas }] = await Promise.all([
    supabase
      .from("rh_funcionarios")
      .select(
        "id, codigo, nome, status, empresa_id, cliente_codigo, cliente_razao_social"
      ),
    supabase.from("rh_empresas").select("id, nome").order("nome"),
  ]);

  return (
    <ImportacaoClient
      funcionarios={funcionarios ?? []}
      empresas={empresas ?? []}
    />
  );
}
