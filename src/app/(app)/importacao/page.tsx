import { createClient } from "@/lib/supabase/server";
import ImportacaoClient from "./importacao-client";

export const dynamic = "force-dynamic";

export default async function ImportacaoPage() {
  const supabase = await createClient();
  const [{ data: funcionarios }, { data: empresas }, { data: periodos }] =
    await Promise.all([
      supabase
        .from("rh_funcionarios")
        .select(
          "id, codigo, nome, status, empresa_id, obra, setor, cargo, cliente_codigo, cliente_razao_social"
        ),
      supabase.from("rh_empresas").select("id, nome").order("nome"),
      supabase
        .from("rh_periodos_aquisitivos")
        .select("id, funcionario_id, inicio, fim, dias_direito, data_limite"),
    ]);

  return (
    <ImportacaoClient
      funcionarios={funcionarios ?? []}
      empresas={empresas ?? []}
      periodos={periodos ?? []}
    />
  );
}
