import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { Competencia, Funcionario, FuncionarioCompetencia } from "@/lib/types";
import VtImportacaoClient from "./vt-importacao-client";

export const dynamic = "force-dynamic";

type FuncionarioLite = Pick<
  Funcionario,
  | "id"
  | "codigo"
  | "nome"
  | "obra"
  | "status"
  | "cliente_razao_social"
  | "cliente_codigo"
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

export default async function VtImportacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ competencia?: string }>;
}) {
  const supabase = await createClient();
  const { competencia: competenciaIdParam } = await searchParams;

  const { data: competencias } = await supabase
    .from("vt_competencias")
    .select("id, ano, mes, status")
    .order("ano", { ascending: false })
    .order("mes", { ascending: false });

  const lista = (competencias as Competencia[]) ?? [];
  const atual = lista.find((c) => c.id === competenciaIdParam) ?? lista[0] ?? null;

  if (!atual) {
    return (
      <VtImportacaoClient
        competencias={[]}
        competenciaAtual={null}
        funcComp={[]}
        funcionarios={[]}
      />
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
        .select("id, codigo, nome, obra, status, cliente_razao_social, cliente_codigo")
        .order("id")
        .range(from, to)
    ),
  ]);

  return (
    <VtImportacaoClient
      competencias={lista}
      competenciaAtual={atual}
      funcComp={funcComp ?? []}
      funcionarios={funcionarios ?? []}
    />
  );
}
