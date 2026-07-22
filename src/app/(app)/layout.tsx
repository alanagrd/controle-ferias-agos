import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ModuleNav } from "@/components/module-nav";

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

  return (
    <div className="min-h-screen bg-agos-gray-light dark:bg-slate-950 transition-colors">
      {/* Navbar sempre em carvão escuro (identidade AGOS), independente do
          tema claro/escuro escolhido pelo usuário para o resto da tela. */}
      <header className="bg-agos-charcoal-dark sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-bold text-[19px] leading-tight text-white">
              Controle RH
            </h1>
            <p className="text-[12.5px] text-white/60">
              Agos Serviços — Módulo RH
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <ModuleNav />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60 hidden sm:inline">
              {user.email}
            </span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
