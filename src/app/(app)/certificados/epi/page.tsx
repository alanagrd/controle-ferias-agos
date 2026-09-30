import { createClient } from "@/lib/supabase/server";
import type { EpiCatalogoItem, EpiModelo } from "@/lib/epi/types";
import EpiEmitirClient from "./epi-client";

export const dynamic = "force-dynamic";

export default async function EpiEmitirPage() {
  const supabase = await createClient();
  const [{ data: modelos }, { data: catalogo }] = await Promise.all([
    supabase
      .from("epi_modelo")
      .select("id, funcao, itens, ativo")
      .eq("ativo", true)
      .order("funcao"),
    supabase
      .from("epi_catalogo")
      .select("id, descricao, ca, validade, sinonimos, ativo")
      .eq("ativo", true)
      .order("descricao"),
  ]);

  return (
    <EpiEmitirClient
      modelos={(modelos as EpiModelo[]) ?? []}
      catalogo={(catalogo as EpiCatalogoItem[]) ?? []}
    />
  );
}
