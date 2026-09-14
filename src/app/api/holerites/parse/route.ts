import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { parseHoleritesPdf } from "@/lib/holerites/parse";
import type { ArquivoPreview, FuncionarioPreview } from "@/lib/holerites/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FuncLite = {
  id: string;
  codigo: string | null;
  nome: string;
  status: string | null;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  // Só admin: RLS de admin_users devolve a própria linha só para admin.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 }
    );
  }

  const form = await req.formData();
  const arquivos = form
    .getAll("files")
    .filter((f): f is File => f instanceof File);
  if (arquivos.length === 0) {
    return NextResponse.json(
      { error: "Nenhum arquivo enviado." },
      { status: 400 }
    );
  }

  // Índice de funcionários por matrícula zero-padded (6 díg).
  const { data: funcs } = await fetchAllRows<FuncLite>((from, to) =>
    supabase
      .from("rh_funcionarios")
      .select("id, codigo, nome, status")
      .order("id")
      .range(from, to)
  );
  const porMatricula = new Map<string, FuncLite>();
  for (const f of funcs ?? []) {
    if (f.codigo) porMatricula.set(f.codigo.padStart(6, "0"), f);
  }

  const resultados: ArquivoPreview[] = [];

  for (const file of arquivos) {
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const parsed = await parseHoleritesPdf(data);

      const comMatch = parsed.funcionarios.map((f) => ({
        f,
        sis: porMatricula.get(f.matricula.padStart(6, "0")) ?? null,
      }));
      const idsMatched = comMatch
        .map((x) => x.sis?.id)
        .filter((v): v is string => !!v);

      const acessos = new Set<string>();
      const importados = new Set<string>();
      if (idsMatched.length > 0) {
        const { data: pa } = await supabase
          .from("portal_acessos")
          .select("funcionario_id")
          .in("funcionario_id", idsMatched);
        for (const r of pa ?? [])
          acessos.add((r as { funcionario_id: string }).funcionario_id);

        if (parsed.competencia) {
          const { data: hs } = await supabase
            .from("holerites")
            .select("funcionario_id")
            .eq("competencia", parsed.competencia)
            .in("funcionario_id", idsMatched);
          for (const r of hs ?? [])
            importados.add((r as { funcionario_id: string }).funcionario_id);
        }
      }

      const funcionarios: FuncionarioPreview[] = comMatch.map(({ f, sis }) => ({
        matricula: f.matricula,
        nome: f.nome,
        cpf: f.cpf,
        paginas: f.paginas,
        liquido: f.liquido,
        adiantamento: f.adiantamento,
        devolucao: f.devolucao,
        funcionarioId: sis?.id ?? null,
        nomeSistema: sis?.nome ?? null,
        statusSistema: sis?.status ?? null,
        matched: !!sis,
        jaTemAcesso: sis ? acessos.has(sis.id) : false,
        jaImportado: sis ? importados.has(sis.id) : false,
      }));

      resultados.push({
        arquivo: file.name,
        obra: parsed.obra,
        competencia: parsed.competencia,
        totalPaginas: parsed.totalPaginas,
        funcionarios,
        pendentes: parsed.pendentes,
      });
    } catch (e) {
      console.error("Falha ao processar holerite", file.name, e);
      resultados.push({
        arquivo: file.name,
        erro: `Não foi possível ler este PDF: ${
          e instanceof Error ? e.message : String(e)
        }`,
        obra: null,
        competencia: null,
        totalPaginas: 0,
        funcionarios: [],
        pendentes: [],
      });
    }
  }

  return NextResponse.json({ arquivos: resultados });
}
