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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-bold text-[19px] leading-tight text-slate-900 dark:text-slate-100">
              Controle RH
            </h1>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              Agos Serviços — Módulo RH
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <nav className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
              <span className="px-3.5 py-2 text-[13px] font-semibold text-slate-900 dark:text-slate-100 border-b-2 border-blue-500">
                Férias
              </span>
              <span className="px-3.5 py-2 text-[13px] font-semibold text-slate-400 dark:text-slate-600 opacity-60 flex items-center gap-1.5 cursor-default">
                ASO
                <span className="text-[10px] font-normal bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-0.5">
                  em breve
                </span>
              </span>
            </nav>
            <nav className="hidden sm:flex items-center gap-1 text-sm">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition"
              >
                Dashboard
              </Link>
              <Link
                href="/funcionarios"
                className="px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition"
              >
                Funcionários
              </Link>
              <Link
                href="/importacao"
                className="px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition"
              >
                Importação mensal
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
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
