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
};
type AptRow = { func_comp_id: string; cesta_basica: number | null };

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

  const [{ data: funcComp }, { data: funcionarios }, { data: apontamentos }] =
    await Promise.all([
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
          .select("id, codigo, nome, cliente_codigo")
          .order("id")
          .range(from, to)
      ),
      // Todo o apontamento (poucos milhares no total) — filtrado em memória
      // pelos func_comp desta competência, evitando um `.in()` gigante.
      fetchAllRows<AptRow>((from, to) =>
        supabase
          .from("vt_apontamento")
          .select("func_comp_id, cesta_basica")
          .order("func_comp_id")
          .range(from, to)
      ),
    ]);

  const funcById = new Map((funcionarios ?? []).map((f) => [f.id, f]));
  const cestaByFc = new Map(
    (apontamentos ?? []).map((a) => [a.func_comp_id, a.cesta_basica])
  );

  const linhas: LinhaPlanilhaVt[] = (funcComp ?? [])
    .filter((fc) => !obra || (fc.obra_snapshot ?? "").trim() === obra)
    .map((fc) => {
      const f = funcById.get(fc.funcionario_id);
      return {
        cod: f?.cliente_codigo ? String(Number(f.cliente_codigo)) : null,
        obra: fc.obra_snapshot,
        matricula: f?.codigo ? String(Number(f.codigo)) : null,
        nome: f?.nome ?? "",
        valorDiario: fc.valor_diario,
        dias: fc.dias_uteis,
        vr: fc.vr_valor,
        cesta: cestaByFc.get(fc.id) ?? null,
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
