import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { StatusFuncionario, StatusPeriodo } from "@/lib/types";
import DashboardClient from "./dashboard-charts";

export const dynamic = "force-dynamic";

type DashFuncionario = {
  id: string;
  nome: string;
  status: StatusFuncionario;
  cliente_razao_social: string | null;
};

type DashPeriodo = {
  id: string;
  funcionario_id: string;
  data_limite: string;
  saldo: number;
  status: StatusPeriodo;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: funcionarios }, { data: periodos }] = await Promise.all([
    fetchAllRows<DashFuncionario>((from, to) =>
      supabase
        .from("rh_funcionarios")
        .select("id, nome, status, cliente_razao_social")
        .order("id")
        .range(from, to)
    ),
    fetchAllRows<DashPeriodo>((from, to) =>
      supabase
        .from("v_rh_periodos")
        .select("id, funcionario_id, data_limite, saldo, status")
        .order("id")
        .range(from, to)
    ),
  ]);

  return (
    <DashboardClient
      funcionarios={funcionarios ?? []}
      periodos={periodos ?? []}
    />
  );
}
