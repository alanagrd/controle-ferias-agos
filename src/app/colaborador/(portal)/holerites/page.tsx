import { createClient } from "@/lib/supabase/server";
import ColaboradorHoleritesClient, {
  type HoleriteItem,
} from "./holerites-client";

export const dynamic = "force-dynamic";

export default async function ColaboradorHoleritesPage() {
  const supabase = await createClient();
  // RLS já limita aos holerites do próprio colaborador (meu_funcionario_id()).
  const { data } = await supabase
    .from("holerites")
    .select("id, competencia, liquido, obra, storage_path")
    .order("competencia", { ascending: false });

  return (
    <ColaboradorHoleritesClient holerites={(data as HoleriteItem[]) ?? []} />
  );
}
