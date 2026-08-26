import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { Competencia, Funcionario, FuncionarioCompetencia } from "@/lib/types";
import VtImportacaoClient from "./vt-importacao-client";

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
  | "valor_diario"
  | "valor_total"
  | "vr_valor"
  | "dias_uteis"
>;

export default async function VtImportacaoPage() {
  const supabase = await createClient();

  const { data: competencias } = await supabase
    .from("vt_competencias")
    .select("id, ano, mes, status")
    .order("ano", { ascending: false })
    .order("mes", { ascending: false });

  const atual = (competencias?.[0] as Competencia | undefined) ?? null;

  if (!atual) {
    return (
      <VtImportacaoClient competenciaAtual={null} funcComp={[]} funcionarios={[]} />
    );
  }

  const [{ data: funcComp }, { data: funcionarios }] = await Promise.all([
    fetchAllRows<FuncCompLite>((from, to) =>
      supabase
        .from("vt_funcionario_competencia")
        .select(
          "id, funcionario_id, competencia_id, obra_snapshot, status_no_mes, valor_diario, valor_total, vr_valor, dias_uteis"
        )
        .eq("competencia_id", atual.id)
        .order("id")
        .range(from, to)
    ),
    fetchAllRows<FuncionarioLite>((from, to) =>
      supabase
        .from("rh_funcionarios")
        .select("id, codigo, nome, obra, status, cliente_razao_social")
        .order("id")
        .range(from, to)
    ),
  ]);

  return (
    <VtImportacaoClient
      competenciaAtual={atual}
      funcComp={funcComp ?? []}
      funcionarios={funcionarios ?? []}
    />
  );
}
