import { createClient } from "@/lib/supabase/server";
import type { EpiCatalogoItem } from "@/lib/epi/types";
import EpiCatalogoClient from "./epi-catalogo-client";

export const dynamic = "force-dynamic";

export default async function EpiCatalogoPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("epi_catalogo")
    .select("id, descricao, ca, validade, sinonimos, ativo")
    .order("descricao");
  return <EpiCatalogoClient itens={(data as EpiCatalogoItem[]) ?? []} />;
}
