import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import modelosPadrao from "@/lib/epi/modelos-padrao.json";

export const runtime = "nodejs";

type ModeloPadrao = { funcao: string; itens: { descricao: string; qtd: number }[] };

// Importa/atualiza os modelos de EPI padrão (uma lista de EPIs por função),
// extraídos das fichas oficiais. Idempotente: on conflict (funcao) atualiza os
// itens. Só admin (RLS).
export async function POST() {
  const supabase = await createClient();
  const rows = (modelosPadrao as ModeloPadrao[]).map((m) => ({
    funcao: m.funcao.trim(),
    itens: m.itens,
    ativo: true,
  }));

  // upsert em blocos para não estourar o tamanho da requisição
  let total = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase
      .from("epi_modelo")
      .upsert(chunk, { onConflict: "funcao" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    total += chunk.length;
  }

  return NextResponse.json({ ok: true, total });
}
