import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type {
  Competencia,
  Funcionario,
  FuncionarioCompetencia,
  LancamentoVt,
} from "@/lib/types";
import VtLancamentosClient from "./vt-lancamentos-client";

export const dynamic = "force-dynamic";

type FuncionarioLite = Pick<
  Funcionario,
  "id" | "codigo" | "nome" | "obra" | "status" | "cliente_razao_social"
>;

type FuncCompLite = Pick<
  FuncionarioCompetencia,
  "id" | "funcionario_id" | "competencia_id" | "obra_snapshot"
>;

type LancamentoLite = Pick<
  LancamentoVt,
  "id" | "func_comp_id" | "data" | "valor" | "motivo" | "cobrado_cliente"
>;

export default async function VtLancamentosPage({
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
      <VtLancamentosClient
        competencias={[]}
        competenciaAtual={null}
        lancamentos={[]}
        funcComp={[]}
        funcionarios={[]}
      />
    );
  }

  const { data: funcComp } = await fetchAllRows<FuncCompLite>((from, to) =>
    supabase
      .from("vt_funcionario_competencia")
      .select("id, funcionario_id, competencia_id, obra_snapshot")
      .eq("competencia_id", atual.id)
      .order("id")
      .range(from, to)
  );

  const funcCompIds = new Set((funcComp ?? []).map((fc) => fc.id));

  const [{ data: lancamentosTodos }, { data: funcionarios }] =
    await Promise.all([
      fetchAllRows<LancamentoLite>((from, to) =>
        supabase
          .from("vt_lancamentos")
          .select("id, func_comp_id, data, valor, motivo, cobrado_cliente")
          .order("data", { ascending: false })
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

  const lancamentos = (lancamentosTodos ?? []).filter((l) =>
    funcCompIds.has(l.func_comp_id)
  );

  return (
    <VtLancamentosClient
      competencias={lista}
      competenciaAtual={atual}
      lancamentos={lancamentos}
      funcComp={funcComp ?? []}
      funcionarios={funcionarios ?? []}
    />
  );
}
