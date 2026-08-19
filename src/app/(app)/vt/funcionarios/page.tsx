import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type {
  Competencia,
  Funcionario,
  FuncionarioCompetencia,
  LancamentoVt,
} from "@/lib/types";
import VtFuncionariosClient from "./vt-funcionarios-client";

export const dynamic = "force-dynamic";

type FuncionarioLite = Pick<
  Funcionario,
  "id" | "codigo" | "nome" | "obra" | "status" | "cliente_razao_social"
>;

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
  | "vr_valor"
>;

type LancamentoLite = Pick<
  LancamentoVt,
  "id" | "func_comp_id" | "data" | "valor" | "motivo" | "cobrado_cliente"
>;

export default async function VtFuncionariosPage() {
  const supabase = await createClient();

  const { data: competencias } = await supabase
    .from("vt_competencias")
    .select("id, ano, mes, status")
    .order("ano", { ascending: false })
    .order("mes", { ascending: false });

  const atual = (competencias?.[0] as Competencia | undefined) ?? null;

  const [{ data: funcionarios }, funcCompResult] = await Promise.all([
    fetchAllRows<FuncionarioLite>((from, to) =>
      supabase
        .from("rh_funcionarios")
        .select("id, codigo, nome, obra, status, cliente_razao_social")
        .order("id")
        .range(from, to)
    ),
    atual
      ? fetchAllRows<FuncCompLite>((from, to) =>
          supabase
            .from("vt_funcionario_competencia")
            .select(
              "id, funcionario_id, competencia_id, obra_snapshot, status_no_mes, tipo_vt, valor_diario, dias_uteis, valor_total, vr_valor"
            )
            .eq("competencia_id", atual.id)
            .order("id")
            .range(from, to)
        )
      : Promise.resolve({ data: [] as FuncCompLite[], error: null }),
  ]);

  const funcCompIds = new Set((funcCompResult.data ?? []).map((fc) => fc.id));

  // Busca todos os lançamentos e filtra em memória pelo func_comp_id da
  // competência atual — mesmo motivo do dashboard: evita .in() com centenas
  // de UUIDs, e o volume de vt_lancamentos ainda é pequeno.
  const { data: lancamentosTodos } = await fetchAllRows<LancamentoLite>(
    (from, to) =>
      supabase
        .from("vt_lancamentos")
        .select("id, func_comp_id, data, valor, motivo, cobrado_cliente")
        .order("id")
        .range(from, to)
  );

  const lancamentos = (lancamentosTodos ?? []).filter((l) =>
    funcCompIds.has(l.func_comp_id)
  );

  return (
    <VtFuncionariosClient
      competenciaAtual={atual}
      funcionarios={funcionarios ?? []}
      funcComp={funcCompResult.data ?? []}
      lancamentos={lancamentos}
    />
  );
}
