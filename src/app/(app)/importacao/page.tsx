import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { FuncionarioBasico, PeriodoBasico } from "./importacao-client";
import ImportacaoClient from "./importacao-client";

export const dynamic = "force-dynamic";

export default async function ImportacaoPage() {
  const supabase = await createClient();
  const [{ data: funcionarios }, { data: empresas }, { data: periodos }] =
    await Promise.all([
      fetchAllRows<FuncionarioBasico>((from, to) =>
        supabase
          .from("rh_funcionarios")
          .select(
            "id, codigo, nome, status, empresa_id, obra, setor, cargo, cliente_codigo, cliente_razao_social"
          )
          .order("id")
          .range(from, to)
      ),
      supabase.from("rh_empresas").select("id, nome").order("nome"),
      fetchAllRows<PeriodoBasico>((from, to) =>
        supabase
          .from("rh_periodos_aquisitivos")
          .select("id, funcionario_id, inicio, fim, dias_direito, data_limite")
          .order("id")
          .range(from, to)
      ),
    ]);

  return (
    <ImportacaoClient
      funcionarios={funcionarios ?? []}
      empresas={empresas ?? []}
      periodos={periodos ?? []}
    />
  );
}
