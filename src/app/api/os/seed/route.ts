import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import modelosPadrao from "@/lib/os/modelos-padrao.json";
import type { OsRisco } from "@/lib/os/types";

export const runtime = "nodejs";

type ModeloPadrao = {
  funcao: string;
  cbo: string | null;
  atividades: string;
  riscos: OsRisco[];
  epis: string;
  medidas: string[];
};

// Importa/atualiza os modelos de Ordem de Serviço padrão (por função).
// Idempotente: on conflict (funcao). Só admin (RLS).
export async function POST() {
  const supabase = await createClient();
  const rows = (modelosPadrao as ModeloPadrao[]).map((m) => ({
    funcao: m.funcao.trim(),
    cbo: m.cbo || null,
    atividades: m.atividades || null,
    riscos: m.riscos ?? [],
    epis: m.epis || null,
    medidas: m.medidas ?? [],
    ativo: true,
  }));

  let total = 0;
  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40);
    const { error } = await supabase
      .from("os_modelo")
      .upsert(chunk, { onConflict: "funcao" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    total += chunk.length;
  }
  return NextResponse.json({ ok: true, total });
}
