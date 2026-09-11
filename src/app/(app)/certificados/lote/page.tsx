import { createClient } from "@/lib/supabase/server";
import type { CertificadoModelo } from "@/lib/certificados/types";
import LoteClient from "./lote-client";

export const dynamic = "force-dynamic";

export default async function LoteCertificadoPage() {
  const supabase = await createClient();
  const [{ data: modelos }, { data: cfg }] = await Promise.all([
    supabase
      .from("certificados_modelos")
      .select("*")
      .eq("ativo", true)
      .order("norma")
      .order("nome_funcao"),
    supabase
      .from("certificados_config")
      .select("texto_frente")
      .eq("id", "default")
      .maybeSingle(),
  ]);

  return (
    <LoteClient
      modelos={(modelos as CertificadoModelo[]) ?? []}
      textoFrente={(cfg?.texto_frente as string | undefined) ?? null}
    />
  );
}
