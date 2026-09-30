import { createClient } from "@/lib/supabase/server";
import type { OsModelo } from "@/lib/os/types";
import OsModelosClient from "./os-modelos-client";

export const dynamic = "force-dynamic";

export default async function OsModelosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("os_modelo")
    .select("id, funcao, cbo, atividades, riscos, epis, medidas, ativo")
    .order("funcao");
  return <OsModelosClient modelos={(data as OsModelo[]) ?? []} />;
}
