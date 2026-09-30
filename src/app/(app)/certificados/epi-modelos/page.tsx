import { createClient } from "@/lib/supabase/server";
import type { EpiCatalogoItem, EpiModelo } from "@/lib/epi/types";
import EpiModelosClient from "./epi-modelos-client";

export const dynamic = "force-dynamic";

export default async function EpiModelosPage() {
  const supabase = await createClient();
  const [{ data: modelos }, { data: catalogo }] = await Promise.all([
    supabase.from("epi_modelo").select("id, funcao, itens, ativo").order("funcao"),
    supabase
      .from("epi_catalogo")
      .select("id, descricao, ca, validade, sinonimos, ativo")
      .eq("ativo", true)
      .order("descricao"),
  ]);
  return (
    <EpiModelosClient
      modelos={(modelos as EpiModelo[]) ?? []}
      catalogo={(catalogo as EpiCatalogoItem[]) ?? []}
    />
  );
}
