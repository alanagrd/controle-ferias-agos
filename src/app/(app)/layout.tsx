import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ModuleTabs, ModuleSubNav } from "@/components/module-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Área administrativa: colaboradores (não-admin) nunca entram aqui.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) {
    redirect("/colaborador/holerites");
  }

  return (
    <div className="min-h-screen bg-agos-gray-light dark:bg-slate-950 transition-colors">
      {/* Cabeçalho: barra escura (identidade AGOS) + sub-barra clara.
          A barra do topo é sempre carvão, independente do tema. */}
      <header className="sticky top-0 z-20">
        <div className="bg-agos-charcoal-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="inline-block w-2 h-2 rounded-full bg-agos-green" />
              <div className="leading-none">
                <div className="font-semibold text-[15px] text-white">
                  Controle RH
                </div>
                <div className="text-[11px] text-white/40 mt-1">
                  AGOS Serviços
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0 overflow-x-auto">
              <ModuleTabs />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-white/40 hidden lg:inline">
                {user.email}
              </span>
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <ModuleSubNav />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
