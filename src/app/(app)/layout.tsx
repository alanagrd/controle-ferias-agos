import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

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
            <nav className="flex items-center gap-1 border-b border-white/10">
              <span className="px-3.5 py-2 text-[13px] font-semibold text-white border-b-2 border-agos-green">
                Férias
              </span>
              <span className="px-3.5 py-2 text-[13px] font-semibold text-white/40 opacity-80 flex items-center gap-1.5 cursor-default">
                ASO
                <span className="text-[10px] font-normal bg-agos-orange/15 text-agos-orange border border-agos-orange/30 rounded-full px-1.5 py-0.5">
                  em breve
                </span>
              </span>
            </nav>
            <nav className="hidden sm:flex items-center gap-1 text-sm">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-md text-white/70 hover:bg-white/10 hover:text-white transition"
              >
                Dashboard
              </Link>
              <Link
                href="/funcionarios"
                className="px-3 py-1.5 rounded-md text-white/70 hover:bg-white/10 hover:text-white transition"
              >
                Funcionários
              </Link>
              <Link
                href="/importacao"
                className="px-3 py-1.5 rounded-md text-white/70 hover:bg-white/10 hover:text-white transition"
              >
                Importação mensal
              </Link>
            </nav>
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
