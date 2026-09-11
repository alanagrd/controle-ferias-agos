import { createClient } from "@/lib/supabase/server";
import type { CertificadoModelo } from "@/lib/certificados/types";
import ModelosClient from "./modelos-client";

export const dynamic = "force-dynamic";

export default async function ModelosCertificadosPage() {
  const supabase = await createClient();
  const { data: modelos } = await supabase
    .from("certificados_modelos")
    .select("*")
    .order("norma")
    .order("nome_funcao");

  return <ModelosClient modelosIniciais={(modelos as CertificadoModelo[]) ?? []} />;
}
