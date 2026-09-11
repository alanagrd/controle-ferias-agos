import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEXTO_FRENTE } from "@/lib/certificados/pdf";
import ConfigClient from "./config-client";

export const dynamic = "force-dynamic";

export default async function ConfigCertificadosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("certificados_config")
    .select("texto_frente")
    .eq("id", "default")
    .maybeSingle();

  const texto =
    (data?.texto_frente as string | undefined)?.trim() || DEFAULT_TEXTO_FRENTE;

  return <ConfigClient textoInicial={texto} />;
}
