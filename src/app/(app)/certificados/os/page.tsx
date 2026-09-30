import { createClient } from "@/lib/supabase/server";
import type { OsModelo } from "@/lib/os/types";
import OsEmitirClient from "./os-client";

export const dynamic = "force-dynamic";

export default async function OsEmitirPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("os_modelo")
    .select("id, funcao, cbo, atividades, riscos, epis, medidas, ativo")
    .eq("ativo", true)
    .order("funcao");
  return <OsEmitirClient modelos={(data as OsModelo[]) ?? []} />;
}
