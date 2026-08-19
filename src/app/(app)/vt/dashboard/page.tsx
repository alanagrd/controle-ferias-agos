import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type {
  ApontamentoVt,
  Competencia,
  FuncionarioCompetencia,
  LancamentoVt,
} from "@/lib/types";
import VtDashboardClient from "./vt-dashboard-charts";

export const dynamic = "force-dynamic";

type FuncCompLite = Pick<
  FuncionarioCompetencia,
  | "id"
  | "funcionario_id"
  | "competencia_id"
  | "obra_snapshot"
  | "status_no_mes"
  | "tipo_vt"
  | "valor_diario"
  | "dias_uteis"
  | "valor_total"
>;

export default async function VtDashboardPage() {
  const supabase = await createClient();

  const { data: competencias } = await supabase
    .from("vt_competencias")
    .select("id, ano, mes, status")
    .order("ano", { ascending: false })
    .order("mes", { ascending: false });

  const atual = (competencias?.[0] as Competencia | undefined) ?? null;

  if (!atual) {
    return (
      <VtDashboardClient
        competencias={(competencias as Competencia[]) ?? []}
        competenciaAtual={null}
        funcComp={[]}
        apontamentos={[]}
        lancamentos={[]}
      />
    );
  }

  const { data: funcComp } = await fetchAllRows<FuncCompLite>(
    (from, to) =>
      supabase
        .from("vt_funcionario_competencia")
        .select(
          "id, funcionario_id, competencia_id, obra_snapshot, status_no_mes, tipo_vt, valor_diario, dias_uteis, valor_total"
        )
        .eq("competencia_id", atual.id)
        .order("id")
        .range(from, to)
  );

  // .in() com centenas de UUIDs arriscaria estourar o limite de tamanho da
  // URL do PostgREST — busca as tabelas inteiras (mesmo padrão de fetchAllRows
  // usado no resto do app) e filtra pelo func_comp_id da competência atual em
  // memória. Não é um problema de volume: vt_apontamento/vt_lancamentos ainda
  // são pequenas (poucos meses de histórico).
  const funcCompIds = new Set((funcComp ?? []).map((fc) => fc.id));

  const [{ data: apontamentosTodos }, { data: lancamentosTodos }] =
    await Promise.all([
      fetchAllRows<ApontamentoVt>((from, to) =>
        supabase
          .from("vt_apontamento")
          .select(
            "id, func_comp_id, h50, h70, h100, faltas, dsr, ad_not, premio, arquivo_origem"
          )
          .order("id")
          .range(from, to)
      ),
      fetchAllRows<LancamentoVt>((from, to) =>
        supabase
          .from("vt_lancamentos")
          .select("id, func_comp_id, data, valor, motivo, cobrado_cliente")
          .order("id")
          .range(from, to)
      ),
    ]);

  const apontamentos = (apontamentosTodos ?? []).filter((a) =>
    funcCompIds.has(a.func_comp_id)
  );
  const lancamentos = (lancamentosTodos ?? []).filter((l) =>
    funcCompIds.has(l.func_comp_id)
  );

  return (
    <VtDashboardClient
      competencias={(competencias as Competencia[]) ?? []}
      competenciaAtual={atual}
      funcComp={funcComp ?? []}
      apontamentos={apontamentos ?? []}
      lancamentos={lancamentos ?? []}
    />
  );
}
