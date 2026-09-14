import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TrocarSenhaClient from "./trocar-senha-client";

export const dynamic = "force-dynamic";

export default async function TrocarSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/colaborador/login");

  const { data: acesso } = await supabase
    .from("portal_acessos")
    .select("funcionario_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!acesso) redirect("/dashboard");

  return <TrocarSenhaClient />;
}
