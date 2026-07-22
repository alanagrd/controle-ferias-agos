import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { StatusFuncionario, VAso } from "@/lib/types";
import AsoDashboardClient from "./aso-dashboard-charts";

export const dynamic = "force-dynamic";

type DashFuncionario = {
  id: string;
  nome: string;
  status: StatusFuncionario;
  cliente_razao_social: string | null;
};

export default async function AsoDashboardPage() {
  const supabase = await createClient();

  const [{ data: funcionarios }, { data: registros }] = await Promise.all([
    fetchAllRows<DashFuncionario>((from, to) =>
      supabase
        .from("rh_funcionarios")
        .select("id, nome, status, cliente_razao_social")
        .order("id")
        .range(from, to)
    ),
    fetchAllRows<VAso>((from, to) =>
      supabase
        .from("v_rh_aso")
        .select(
          "funcionario_id, registro_id, data_aso, tipo, data_vencimento, dias_para_vencer, status"
        )
        .order("funcionario_id")
        .range(from, to)
    ),
  ]);

  return (
    <AsoDashboardClient
      funcionarios={funcionarios ?? []}
      registros={registros ?? []}
    />
  );
}
