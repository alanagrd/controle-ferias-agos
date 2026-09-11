import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { CertificadoEmitido } from "@/lib/certificados/types";
import HistoricoClient from "./historico-client";

export const dynamic = "force-dynamic";

export default async function HistoricoCertificadosPage() {
  const supabase = await createClient();

  const [{ data }, { data: cfg }] = await Promise.all([
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("certificados_emitidos")
        .select(
          "id, modelo_id, nome_funcionario, cpf, cidade, data_treinamento, data_treinamento_fim, emitido_em, certificados_modelos(id, norma, nome_funcao, nome_curso, normas_aplicaveis, carga_horaria, tipo, conteudo_programatico, ativo)"
        )
        .order("emitido_em", { ascending: false })
        .range(from, to)
    ),
    supabase
      .from("certificados_config")
      .select("texto_frente")
      .eq("id", "default")
      .maybeSingle(),
  ]);

  // Supabase's generated types can't express the to-one cardinality of this
  // FK join, so it infers `certificados_modelos` as an array — normalize it
  // to a single object (or null) to match CertificadoEmitido.
  const registros: CertificadoEmitido[] = (data ?? []).map((row) => {
    const modelo = row.certificados_modelos;
    return {
      ...row,
      certificados_modelos: Array.isArray(modelo) ? modelo[0] ?? null : modelo,
    } as CertificadoEmitido;
  });

  return (
    <HistoricoClient
      registros={registros}
      textoFrente={(cfg?.texto_frente as string | undefined) ?? null}
    />
  );
}
