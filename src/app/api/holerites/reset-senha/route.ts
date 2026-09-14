import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reseta a senha do colaborador de volta para o CPF (só dígitos) e força a
// troca no próximo acesso. Só admin.
export async function POST(req: NextRequest) {
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

  const body = (await req.json().catch(() => null)) as {
    funcionarioId?: string;
  } | null;
  const funcionarioId = body?.funcionarioId;
  if (!funcionarioId) {
    return NextResponse.json(
      { error: "funcionarioId é obrigatório." },
      { status: 400 }
    );
  }

  const { data: pa } = await admin
    .from("portal_acessos")
    .select("auth_user_id, cpf")
    .eq("funcionario_id", funcionarioId)
    .maybeSingle();
  if (!pa) {
    return NextResponse.json(
      { error: "Acesso não encontrado para este funcionário." },
      { status: 404 }
    );
  }
  const acesso = pa as { auth_user_id: string; cpf: string | null };
  if (!acesso.cpf) {
    return NextResponse.json(
      {
        error:
          "CPF não disponível para este acesso. Reimporte um holerite desta pessoa para habilitar o reset.",
      },
      { status: 400 }
    );
  }

  const { error: uErr } = await admin.auth.admin.updateUserById(
    acesso.auth_user_id,
    { password: acesso.cpf }
  );
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  await admin
    .from("portal_acessos")
    .update({ senha_temporaria: true })
    .eq("funcionario_id", funcionarioId);

  return NextResponse.json({ ok: true });
}
