"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Modulo = "ferias" | "aso" | "vt";

const MODULE_LINKS: Record<
  Modulo,
  { href: string; label: string }[]
> = {
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
    { href: "/vt/lancamentos", label: "Lançamentos avulsos" },
    { href: "/vt/importacao", label: "Importar apontamento" },
  ],
};

const MODULE_TABS: { id: Modulo; href: string; label: string }[] = [
  { id: "ferias", href: "/dashboard", label: "Férias" },
  { id: "aso", href: "/aso/dashboard", label: "ASO" },
  { id: "vt", href: "/vt/dashboard", label: "VT" },
];

export function ModuleNav() {
  const pathname = usePathname();
  const activeModule: Modulo = pathname?.startsWith("/aso")
    ? "aso"
    : pathname?.startsWith("/vt")
    ? "vt"
    : "ferias";

  return (
    <>
      <nav className="flex items-center gap-1 border-b border-white/10">
        {MODULE_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={
              activeModule === tab.id
                ? "px-3.5 py-2 text-[13px] font-semibold text-white border-b-2 border-agos-green"
                : "px-3.5 py-2 text-[13px] font-semibold text-white/40 hover:text-white/70"
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <nav className="hidden sm:flex items-center gap-1 text-sm">
        {MODULE_LINKS[activeModule].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="px-3 py-1.5 rounded-md text-white/70 hover:bg-white/10 hover:text-white transition"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
