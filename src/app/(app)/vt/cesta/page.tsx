import { createClient } from "@/lib/supabase/server";
import VtCestaClient from "./cesta-client";

export const dynamic = "force-dynamic";

type ObraRow = { obra: string; funcs_total: number; funcs_atual: number };
type CestaRow = { id: string; obra: string; valor: number };

export default async function VtCestaPage() {
  const supabase = await createClient();

  const [{ data: obras }, { data: cestas }] = await Promise.all([
    supabase
      .from("v_vt_obras")
      .select("obra, funcs_total, funcs_atual")
      .order("obra"),
    supabase.from("vt_cesta_obra").select("id, obra, valor"),
  ]);

  return (
    <VtCestaClient
      obras={(obras as ObraRow[]) ?? []}
      cestas={(cestas as CestaRow[]) ?? []}
    />
  );
}
