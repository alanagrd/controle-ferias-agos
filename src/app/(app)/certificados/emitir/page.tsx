import { createClient } from "@/lib/supabase/server";
import type { CertificadoModelo } from "@/lib/certificados/types";
import EmitirClient from "./emitir-client";

export const dynamic = "force-dynamic";

export default async function EmitirCertificadoPage() {
  const supabase = await createClient();
  const { data: modelos } = await supabase
    .from("certificados_modelos")
    .select("*")
    .eq("ativo", true)
    .order("norma")
    .order("nome_funcao");

  return <EmitirClient modelos={(modelos as CertificadoModelo[]) ?? []} />;
}
