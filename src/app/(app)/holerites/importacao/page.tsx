import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HoleritesImportacaoClient from "./importacao-client";

export const dynamic = "force-dynamic";

export default async function HoleritesImportacaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Área administrativa: só admin. Colaborador (portal) não entra aqui.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) redirect("/colaborador/holerites");

  return <HoleritesImportacaoClient />;
}
