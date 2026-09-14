"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Modulo = "ferias" | "aso" | "vt" | "certificados" | "holerites";

const MODULE_LINKS: Record<Modulo, { href: string; label: string }[]> = {
  ferias: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/funcionarios", label: "Funcionários" },
    { href: "/importacao", label: "Importação mensal" },
  ],
  aso: [
    { href: "/aso/dashboard", label: "Dashboard" },
    { href: "/aso/funcionarios", label: "Funcionários" },
    { href: "/aso/importacao", label: "Importação mensal" },
  ],
  vt: [
    { href: "/vt/dashboard", label: "Dashboard" },
    { href: "/vt/funcionarios", label: "Funcionários & VT" },
    { href: "/vt/apontamento", label: "Apontamento" },
    { href: "/vt/lancamentos", label: "Lançamentos avulsos" },
    { href: "/vt/importacao", label: "Importação" },
  ],
  certificados: [
    { href: "/certificados/emitir", label: "Emitir certificado" },
    { href: "/certificados/lote", label: "Emitir em lote" },
    { href: "/certificados/historico", label: "Histórico" },
    { href: "/certificados/modelos", label: "Funções / Modelos" },
    { href: "/certificados/config", label: "Configuração" },
  ],
  holerites: [
    { href: "/holerites/funcionarios", label: "Funcionários" },
    { href: "/holerites/importacao", label: "Importação" },
    { href: "/holerites/acessos", label: "Acessos" },
  ],
};

const MODULE_TABS: { id: Modulo; href: string; label: string }[] = [
  { id: "ferias", href: "/dashboard", label: "Férias" },
  { id: "aso", href: "/aso/dashboard", label: "ASO" },
  { id: "vt", href: "/vt/dashboard", label: "VT" },
  { id: "certificados", href: "/certificados/emitir", label: "Certificados" },
  { id: "holerites", href: "/holerites/funcionarios", label: "Holerites" },
];

function moduloAtivo(pathname: string | null): Modulo {
  if (pathname?.startsWith("/aso")) return "aso";
  if (pathname?.startsWith("/vt")) return "vt";
  if (pathname?.startsWith("/certificados")) return "certificados";
  if (pathname?.startsWith("/holerites")) return "holerites";
  return "ferias";
}

/** Abas de módulo — barra escura do topo. */
export function ModuleTabs() {
  const active = moduloAtivo(usePathname());
  return (
    <nav className="flex items-center gap-0.5">
      {MODULE_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={
            "px-3 py-1.5 text-[13px] rounded-full transition-colors whitespace-nowrap " +
            (active === tab.id
              ? "bg-white/12 text-white font-semibold"
              : "text-white/50 hover:text-white/90 hover:bg-white/5 font-medium")
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** Sub-navegação do módulo ativo — barra clara. */
export function ModuleSubNav() {
  const pathname = usePathname();
  const active = moduloAtivo(pathname);
  return (
    <nav className="flex items-center gap-1 overflow-x-auto -mb-px">
      {MODULE_LINKS[active].map((link) => {
        const isActive =
          pathname === link.href || pathname?.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              "px-3 py-2.5 text-[13px] border-b-2 whitespace-nowrap transition-colors " +
              (isActive
                ? "border-agos-green text-agos-charcoal dark:text-white font-semibold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-agos-charcoal dark:hover:text-slate-200 font-medium")
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
