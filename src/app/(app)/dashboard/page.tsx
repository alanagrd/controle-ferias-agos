import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./dashboard-charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: funcionarios }, { data: periodos }] = await Promise.all([
    supabase
      .from("rh_funcionarios")
      .select("id, nome, status, cliente_razao_social"),
    supabase
      .from("v_rh_periodos")
      .select("id, funcionario_id, data_limite, saldo, status"),
  ]);

  return (
    <DashboardClient
      funcionarios={funcionarios ?? []}
      periodos={periodos ?? []}
    />
  );
}
