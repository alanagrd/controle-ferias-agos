import { createClient } from "@/lib/supabase/server";
import FuncionariosClient from "./funcionarios-client";

export const dynamic = "force-dynamic";

export default async function FuncionariosPage() {
  const supabase = await createClient();

  const [{ data: funcionarios }, { data: empresas }, { data: periodos }] =
    await Promise.all([
      supabase
        .from("rh_funcionarios")
        .select(
          "id, codigo, nome, empresa_id, obra, setor, cargo, admissao, demissao, status, cliente_codigo, cliente_razao_social"
        )
        .order("nome"),
      supabase.from("rh_empresas").select("id, nome").order("nome"),
      supabase
        .from("v_rh_periodos")
        .select(
          "id, funcionario_id, inicio, fim, dias_direito, data_limite, dias_gozados, saldo, status"
        ),
    ]);

  return (
    <FuncionariosClient
      initialFuncionarios={funcionarios ?? []}
      empresas={empresas ?? []}
      periodos={periodos ?? []}
    />
  );
}
