"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Modulo = "ferias" | "aso" | "vt" | "certificados" | "holerites";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; children: NavLink[] };
type NavEntry = NavLink | NavGroup;

function isGroup(e: NavEntry): e is NavGroup {
  return "children" in e;
}

const MODULE_LINKS: Record<Modulo, NavEntry[]> = {
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
    { href: "/vt/cesta", label: "Cesta por obra" },
    { href: "/vt/importacao", label: "Importação" },
  ],
  certificados: [
    { href: "/certificados/emitir", label: "Emitir certificado" },
    { href: "/certificados/lote", label: "Emitir em lote" },
    { href: "/certificados/historico", label: "Histórico" },
    { href: "/certificados/modelos", label: "Funções / Modelos" },
    { href: "/certificados/config", label: "Configuração" },
    {
      label: "EPI",
      children: [
        { href: "/certificados/epi", label: "Ficha de EPI" },
        { href: "/certificados/epi-catalogo", label: "Catálogo EPI" },
        { href: "/certificados/epi-modelos", label: "Modelos EPI" },
      ],
    },
    {
      label: "Ordem de Serviço",
      children: [
        { href: "/certificados/os", label: "Emitir OS" },
        { href: "/certificados/os-modelos", label: "Modelos OS" },
      ],
    },
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

function rotaAtiva(pathname: string | null, href: string): boolean {
  return pathname === href || !!pathname?.startsWith(href + "/");
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

const linkBase =
  "px-3 py-2.5 text-[13px] border-b-2 whitespace-nowrap transition-colors ";
const linkAtivo =
  "border-agos-green text-agos-charcoal dark:text-white font-semibold";
const linkInativo =
  "border-transparent text-slate-500 dark:text-slate-400 hover:text-agos-charcoal dark:hover:text-slate-200 font-medium";

function GrupoNav({
  grupo,
  pathname,
}: {
  grupo: NavGroup;
  pathname: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const algumAtivo = grupo.children.some((c) => rotaAtiva(pathname, c.href));

  // fecha ao navegar
  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  // fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAberto(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [aberto]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((a) => !a)}
        className={
          linkBase +
          "inline-flex items-center gap-1 " +
          (algumAtivo ? linkAtivo : linkInativo)
        }
      >
        {grupo.label}
        <span className="text-[9px] leading-none">▾</span>
      </button>
      {aberto && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg py-1">
          {grupo.children.map((c) => {
            const isActive = rotaAtiva(pathname, c.href);
            return (
              <Link
                key={c.href}
                href={c.href}
                onClick={() => setAberto(false)}
                className={
                  "block px-3 py-2 text-[13px] " +
                  (isActive
                    ? "bg-agos-green/10 text-agos-green-dark dark:text-agos-green-light font-semibold"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60")
                }
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Sub-navegação do módulo ativo — barra clara. */
export function ModuleSubNav() {
  const pathname = usePathname();
  const active = moduloAtivo(pathname);
  return (
    <nav className="flex items-center gap-1 flex-wrap">
      {MODULE_LINKS[active].map((entry) =>
        isGroup(entry) ? (
          <GrupoNav key={entry.label} grupo={entry} pathname={pathname} />
        ) : (
          <Link
            key={entry.href}
            href={entry.href}
            className={
              linkBase + (rotaAtiva(pathname, entry.href) ? linkAtivo : linkInativo)
            }
          >
            {entry.label}
          </Link>
        )
      )}
    </nav>
  );
}
