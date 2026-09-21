import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  construirPlanilhaVtBuffer,
  type LinhaPlanilhaVt,
} from "@/lib/export-planilha-vt";

// exceljs usa APIs do Node (streams); toda a geração — e a coleta dos dados —
// roda no servidor (rápido/confiável), evitando travar o navegador e o
// problema de URL gigante do `.in()` com centenas de matrículas.
export const runtime = "nodejs";

type FcRow = {
  id: string;
  funcionario_id: string;
  obra_snapshot: string | null;
  valor_diario: number | null;
  dias_uteis: number | null;
  vr_valor: number | null;
};
type FuncRow = {
  id: string;
  codigo: string | null;
  nome: string;
  cliente_codigo: string | null;
  admissao: string | null;
  salario: number | null;
};
type AptRow = { func_comp_id: string; cesta_basica: number | null };
type LancRow = { func_comp_id: string; motivo: string | null; valor: number };
type CestaRow = {
  obra: string;
  valor: number | null;
  modo: string | null;
  percentual: number | null;
};

// Regras de conversão de salário horista → mensal para a cesta de 6%.
const SALARIO_HORISTA_LIMITE = 50; // acima disso já é salário mensal
const HORAS_MES = 220;

function calcCestaFunc(
  reg: CestaRow | undefined,
  salario: number | null,
  admissao: string | null,
  ano: number,
  mes: number
): number | null {
  if (!reg) return null;
  let base: number | null;
  if (reg.modo === "salario_pct") {
    if (salario == null) return null; // sem salário não dá pra calcular 6%
    const mensal =
      salario > SALARIO_HORISTA_LIMITE ? salario : salario * HORAS_MES;
    base = mensal * ((reg.percentual ?? 6) / 100);
  } else {
    base = reg.valor;
  }
  if (base == null) return null;
  // Proporcional para quem foi admitido dentro do mês da competência:
  // (valor cheio / 30) × dias, contando do dia da admissão até o dia 30.
  if (admissao) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(admissao);
    if (m) {
      const ay = Number(m[1]);
      const am = Number(m[2]);
      const ad = Number(m[3]);
      if (ay === ano && am === mes) {
        const dia = Math.min(ad, 30);
        const dias = Math.max(0, 30 - dia + 1);
        base = (base / 30) * dias;
      }
    }
  }
  return Math.round(base * 100) / 100;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    competenciaId?: string;
    obra?: string;
  };
  const { competenciaId, obra } = body;
  if (!competenciaId) {
    return NextResponse.json(
      { error: "competenciaId é obrigatório." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: comp } = await supabase
    .from("vt_competencias")
    .select("ano, mes")
    .eq("id", competenciaId)
    .single();
  if (!comp) {
    return NextResponse.json(
      { error: "Competência não encontrada." },
      { status: 404 }
    );
  }

  const [
    { data: funcComp },
    { data: funcionarios },
    { data: apontamentos },
    { data: lancamentos },
    { data: cestas },
  ] = await Promise.all([
    fetchAllRows<FcRow>((from, to) =>
      supabase
        .from("vt_funcionario_competencia")
        .select("id, funcionario_id, obra_snapshot, valor_diario, dias_uteis, vr_valor")
        .eq("competencia_id", competenciaId)
        .eq("status_no_mes", "ATIVO")
        .order("id")
        .range(from, to)
    ),
    fetchAllRows<FuncRow>((from, to) =>
      supabase
        .from("rh_funcionarios")
        .select("id, codigo, nome, cliente_codigo, admissao, salario")
        .order("id")
        .range(from, to)
    ),
    // Apontamento e lançamentos (poucos milhares) — filtrados em memória
    // pelos func_comp desta competência, evitando um `.in()` gigante.
    fetchAllRows<AptRow>((from, to) =>
      supabase
        .from("vt_apontamento")
        .select("func_comp_id, cesta_basica")
        .order("func_comp_id")
        .range(from, to)
    ),
    fetchAllRows<LancRow>((from, to) =>
      supabase
        .from("vt_lancamentos")
        .select("func_comp_id, motivo, valor")
        .order("func_comp_id")
        .range(from, to)
    ),
    // Cadastro de Cesta Básica por obra (poucas dezenas de linhas).
    supabase.from("vt_cesta_obra").select("obra, valor, modo, percentual"),
  ]);

  const funcById = new Map((funcionarios ?? []).map((f) => [f.id, f]));
  const cestaByFc = new Map(
    (apontamentos ?? []).map((a) => [a.func_comp_id, a.cesta_basica])
  );
  // Cesta cadastrada por obra (chave normalizada: trim + maiúsculas).
  const cestaPorObra = new Map<string, CestaRow>();
  ((cestas ?? []) as CestaRow[]).forEach((c) => {
    const k = (c.obra ?? "").trim().toUpperCase();
    if (k) cestaPorObra.set(k, c);
  });

  // Reembolso VT (901) e VR (904) avulsos por func_comp — vêm do sistema.
  const fcIds = new Set((funcComp ?? []).map((fc) => fc.id));
  const reembVtByFc = new Map<string, number>();
  const reembVrByFc = new Map<string, number>();
  (lancamentos ?? []).forEach((l) => {
    if (!fcIds.has(l.func_comp_id)) return;
    if (l.motivo === "Reembolso VT")
      reembVtByFc.set(l.func_comp_id, (reembVtByFc.get(l.func_comp_id) ?? 0) + l.valor);
    else if (l.motivo === "Reembolso VR")
      reembVrByFc.set(l.func_comp_id, (reembVrByFc.get(l.func_comp_id) ?? 0) + l.valor);
  });

  // Cod do cliente por obra = código mais frequente entre os funcionários da
  // obra (dentro de uma obra o cliente é o mesmo; normaliza divergências).
  const codPorObra = new Map<string, string>();
  {
    const cont = new Map<string, Map<string, number>>();
    (funcComp ?? []).forEach((fc) => {
      const obraK = (fc.obra_snapshot ?? "").trim();
      const f = funcById.get(fc.funcionario_id);
      const cod = f?.cliente_codigo ? String(Number(f.cliente_codigo)) : null;
      if (!obraK || !cod) return;
      const m = cont.get(obraK) ?? new Map<string, number>();
      m.set(cod, (m.get(cod) ?? 0) + 1);
      cont.set(obraK, m);
    });
    cont.forEach((m, obraK) => {
      let best = "";
      let bestC = -1;
      m.forEach((c, cod) => {
        if (c > bestC) {
          bestC = c;
          best = cod;
        }
      });
      if (best) codPorObra.set(obraK, best);
    });
  }

  const linhas: LinhaPlanilhaVt[] = (funcComp ?? [])
    .filter((fc) => !obra || (fc.obra_snapshot ?? "").trim() === obra)
    .map((fc) => {
      const f = funcById.get(fc.funcionario_id);
      const obraK = (fc.obra_snapshot ?? "").trim();
      return {
        cod:
          codPorObra.get(obraK) ??
          (f?.cliente_codigo ? String(Number(f.cliente_codigo)) : null),
        obra: fc.obra_snapshot,
        matricula: f?.codigo ? String(Number(f.codigo)) : null,
        nome: f?.nome ?? "",
        valorDiario: fc.valor_diario,
        dias: fc.dias_uteis,
        vr: fc.vr_valor,
        // Cesta: cadastro por obra (valor fixo ou 6% do salário), já com
        // proporcional p/ admitidos no mês. Sem cadastro/salário, cai no
        // valor do apontamento reimportado; senão em branco.
        cesta:
          calcCestaFunc(
            cestaPorObra.get(obraK.toUpperCase()),
            f?.salario ?? null,
            f?.admissao ?? null,
            comp.ano,
            comp.mes
          ) ??
          cestaByFc.get(fc.id) ??
          null,
        reembolsoVt: reembVtByFc.get(fc.id) ?? null,
        reembolsoVr: reembVrByFc.get(fc.id) ?? null,
      };
    })
    .sort(
      (a, b) =>
        (a.obra ?? "").localeCompare(b.obra ?? "", "pt-BR") ||
        a.nome.localeCompare(b.nome, "pt-BR")
    );

  const buf = await construirPlanilhaVtBuffer(comp.ano, comp.mes, linhas);

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "no-store",
    },
  });
}
