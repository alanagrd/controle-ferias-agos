import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { Funcionario, RegistroAso } from "@/lib/types";
import AsoImportacaoClient from "./aso-importacao-client";

export const dynamic = "force-dynamic";

export default async function AsoImportacaoPage() {
  const supabase = await createClient();

  const [{ data: funcionarios }, { data: registros }] = await Promise.all([
    fetchAllRows<Funcionario>((from, to) =>
      supabase
        .from("rh_funcionarios")
        .select(
          "id, codigo, nome, empresa_id, obra, setor, cargo, admissao, demissao, status, cliente_codigo, cliente_razao_social"
        )
        .order("id")
        .range(from, to)
    ),
    fetchAllRows<RegistroAso>((from, to) =>
      supabase
        .from("rh_registros_aso")
        .select("id, funcionario_id, data_aso, tipo, data_vencimento, observacao, criado_em")
        .order("funcionario_id")
        .range(from, to)
    ),
  ]);

  return (
    <AsoImportacaoClient
      dbFuncionarios={funcionarios ?? []}
      dbRegistros={registros ?? []}
    />
  );
}
