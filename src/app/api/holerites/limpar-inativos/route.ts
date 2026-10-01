import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Apaga os PDFs de holerites de funcionários INATIVOS do Storage (economiza
// espaço), MANTENDO o registro no banco (zera storage_path). Só admin.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 }
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." },
      { status: 500 }
    );
  }

  // Holerites de inativos que ainda têm arquivo.
  const { data: alvos, error } = await admin
    .from("holerites")
    .select("id, storage_path, rh_funcionarios!inner(status)")
    .eq("rh_funcionarios.status", "INATIVO")
    .not("storage_path", "is", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const linhas = (alvos ?? []) as { id: string; storage_path: string }[];
  const paths = linhas.map((l) => l.storage_path).filter(Boolean);
  if (paths.length === 0) {
    return NextResponse.json({ ok: true, removidos: 0 });
  }

  // Remove os arquivos do Storage em lotes.
  let removidos = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { error: rmErr } = await admin.storage.from("holerites").remove(chunk);
    if (rmErr) {
      return NextResponse.json(
        { error: `Falha no Storage: ${rmErr.message}` },
        { status: 500 }
      );
    }
    removidos += chunk.length;
  }

  // Zera o storage_path (mantém o registro: competência, líquido, obra).
  const ids = linhas.map((l) => l.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { error: upErr } = await admin
      .from("holerites")
      .update({ storage_path: null })
      .in("id", chunk);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, removidos });
}
