import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Marca a senha do colaborador logado como definitiva (senha_temporaria=false).
// A troca de senha em si é feita no cliente via supabase.auth.updateUser — aqui
// só viramos o flag da própria linha, com escopo controlado pelo servidor.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Serviço indisponível no momento." },
      { status: 500 }
    );
  }

  const { error } = await admin
    .from("portal_acessos")
    .update({
      senha_temporaria: false,
      ultimo_acesso: new Date().toISOString(),
    })
    .eq("auth_user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
