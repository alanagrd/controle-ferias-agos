import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type {
  ApontamentoVt,
  Competencia,
  Funcionario,
  FuncionarioCompetencia,
} from "@/lib/types";
import VtApontamentoClient from "./vt-apontamento-client";

export const dynamic = "force-dynamic";

type FuncionarioLite = Pick<
  Funcionario,
  "id" | "codigo" | "nome" | "obra" | "status" | "cliente_razao_social"
>;

type FuncCompLite = Pick<
  FuncionarioCompetencia,
  "id" | "funcionario_id" | "competencia_id" | "obra_snapshot" | "valor_diario"
>;

type ApontamentoLite = Pick<
  ApontamentoVt,
  | "id"
  | "func_comp_id"
  | "h50"
  | "h70"
  | "h100"
  | "faltas"
  | "dsr"
  | "ad_not"
  | "premio"
  | "dias_reembolso"
  | "dias_desconto"
  | "valor_reembolso"
  | "valor_desconto"
  | "arquivo_origem"
>;

export default async function VtApontamentoPage({
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
  const selecionada =
    lista.find((c) => c.id === competenciaIdParam) ?? lista[0] ?? null;

  if (!selecionada) {
    return (
      <VtApontamentoClient
        competencias={[]}
        competenciaSelecionada={null}
        funcComp={[]}
        funcionarios={[]}
        apontamentos={[]}
      />
    );
  }

  const [{ data: funcComp }, { data: funcionarios }] = await Promise.all([
    fetchAllRows<FuncCompLite>((from, to) =>
      supabase
        .from("vt_funcionario_competencia")
        .select("id, funcionario_id, competencia_id, obra_snapshot, valor_diario")
        .eq("competencia_id", selecionada.id)
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

  const funcCompIds = new Set((funcComp ?? []).map((fc) => fc.id));

  const { data: apontamentosTodos } = await fetchAllRows<ApontamentoLite>(
    (from, to) =>
      supabase
        .from("vt_apontamento")
        .select(
          "id, func_comp_id, h50, h70, h100, faltas, dsr, ad_not, premio, dias_reembolso, dias_desconto, valor_reembolso, valor_desconto, arquivo_origem"
        )
        .order("id")
        .range(from, to)
  );

  const apontamentos = (apontamentosTodos ?? []).filter((a) =>
    funcCompIds.has(a.func_comp_id)
  );

  return (
    <VtApontamentoClient
      competencias={lista}
      competenciaSelecionada={selecionada}
      funcComp={funcComp ?? []}
      funcionarios={funcionarios ?? []}
      apontamentos={apontamentos}
    />
  );
}
