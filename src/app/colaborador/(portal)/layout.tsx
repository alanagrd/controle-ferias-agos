import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ColaboradorLogout from "./logout";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/colaborador/login");

  // É colaborador? (tem vínculo em portal_acessos). Admin não tem → manda pro RH.
  const { data: acesso } = await supabase
    .from("portal_acessos")
    .select("senha_temporaria")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!acesso) redirect("/dashboard");
  if (acesso.senha_temporaria) redirect("/colaborador/trocar-senha");

  return (
    <div className="min-h-screen bg-agos-gray-light dark:bg-slate-950">
      <header className="bg-agos-charcoal-dark sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-[17px] text-white">
              Portal do Colaborador
            </h1>
            <p className="text-[12px] text-white/60">AGOS Serviços</p>
          </div>
          <ColaboradorLogout />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
