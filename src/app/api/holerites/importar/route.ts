import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { parseHoleritesPdf } from "@/lib/holerites/parse";
import type {
  CredencialNova,
  DecisoesArquivo,
  ErroImportacao,
} from "@/lib/holerites/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FuncLite = {
  id: string;
  codigo: string | null;
  nome: string;
  status: string | null;
};

// Senha temporária forte (sem caracteres ambíguos); trocada no 1º acesso.
function gerarSenha(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
  const b = randomBytes(12);
  let s = "";
  for (let i = 0; i < 12; i++) s += abc[b[i] % abc.length];
  return s;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
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

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor. Adicione a variável no Vercel para poder gravar.",
      },
      { status: 500 }
    );
  }

  try {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const decisoes: DecisoesArquivo[] = JSON.parse(
    (form.get("decisoes") as string) || "[]"
  );

  // Índice de funcionários por matrícula zero-padded.
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

  const credenciais: CredencialNova[] = [];
  const erros: ErroImportacao[] = [];
  let importados = 0;
  let pulados = 0;

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    const dec = decisoes[fi]?.funcionarios ?? [];
    const bytes = new Uint8Array(await file.arrayBuffer());

    let parsed;
    try {
      parsed = await parseHoleritesPdf(bytes);
    } catch {
      erros.push({ arquivo: file.name, motivo: "Não foi possível ler o PDF." });
      continue;
    }
    if (!parsed.competencia) {
      erros.push({ arquivo: file.name, motivo: "Competência não detectada." });
      continue;
    }
    const competenciaYm = parsed.competencia.slice(0, 7); // AAAA-MM
    const src = await PDFDocument.load(bytes);
    let okArq = 0;

    for (let idx = 0; idx < parsed.funcionarios.length; idx++) {
      const f = parsed.funcionarios[idx];
      const d = dec[idx] ?? {};
      if (d.skip) {
        pulados++;
        continue;
      }

      const matr = (d.matricula?.trim() || f.matricula).padStart(6, "0");
      const sis = porMatricula.get(matr);
      if (!sis) {
        pulados++;
        erros.push({
          arquivo: file.name,
          funcionario: f.nome,
          motivo: `Matrícula ${matr} não encontrada em rh_funcionarios.`,
        });
        continue;
      }

      // 1) Recorta as páginas do funcionário num PDF próprio.
      let outBytes: Uint8Array;
      try {
        const out = await PDFDocument.create();
        const pages = await out.copyPages(src, f.paginas);
        pages.forEach((p) => out.addPage(p));
        outBytes = await out.save();
      } catch {
        erros.push({
          arquivo: file.name,
          funcionario: sis.nome,
          motivo: "Falha ao recortar as páginas.",
        });
        continue;
      }

      // 2) Sobe no Storage (privado). upsert = reimportar substitui.
      const objKey = `${sis.id}/${competenciaYm}.pdf`;
      const up = await admin.storage
        .from("holerites")
        .upload(objKey, outBytes, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (up.error) {
        erros.push({
          arquivo: file.name,
          funcionario: sis.nome,
          motivo: `Falha no upload: ${up.error.message}`,
        });
        continue;
      }

      // 3) Upsert do registro (unique funcionario_id+competencia).
      const { error: hErr } = await admin.from("holerites").upsert(
        {
          funcionario_id: sis.id,
          competencia: parsed.competencia,
          liquido: f.liquido,
          adiantamento: f.adiantamento,
          devolucao: f.devolucao,
          obra: parsed.obra,
          storage_path: objKey,
          importado_por: user.id,
          importado_em: new Date().toISOString(),
        },
        { onConflict: "funcionario_id,competencia" }
      );
      if (hErr) {
        erros.push({
          arquivo: file.name,
          funcionario: sis.nome,
          motivo: `Falha ao gravar holerite: ${hErr.message}`,
        });
        continue;
      }

      // 4) Provisiona acesso do colaborador, se ainda não tiver.
      const { data: pa } = await admin
        .from("portal_acessos")
        .select("funcionario_id")
        .eq("funcionario_id", sis.id)
        .maybeSingle();

      if (!pa) {
        const email = `${matr}@agos.internal`;
        const senha = gerarSenha();
        const { data: created, error: cErr } =
          await admin.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
            user_metadata: {
              funcionario_id: sis.id,
              matricula: matr,
              nome: sis.nome,
            },
          });
        if (cErr || !created?.user) {
          erros.push({
            arquivo: file.name,
            funcionario: sis.nome,
            motivo: `Holerite gravado, mas falhou ao criar o acesso: ${
              cErr?.message ?? "erro desconhecido"
            }`,
          });
        } else {
          const { error: paErr } = await admin.from("portal_acessos").insert({
            funcionario_id: sis.id,
            auth_user_id: created.user.id,
            senha_temporaria: true,
          });
          if (paErr) {
            // desfaz o usuário órfão para permitir nova tentativa limpa
            await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
            erros.push({
              arquivo: file.name,
              funcionario: sis.nome,
              motivo: `Holerite gravado, mas falhou ao vincular acesso: ${paErr.message}`,
            });
          } else {
            credenciais.push({
              nome: sis.nome,
              matricula: matr,
              usuario: email,
              senha,
            });
          }
        }
      }

      importados++;
      okArq++;
    }

    // Resumo do lote por arquivo.
    await admin.from("holerites_importacoes").insert({
      arquivo_original: file.name,
      obra: parsed.obra,
      competencia: parsed.competencia,
      total_paginas: parsed.totalPaginas,
      funcionarios_ok: okArq,
      funcionarios_pendentes: parsed.pendentes.length,
      detalhe_pendentes: parsed.pendentes,
      criado_por: user.id,
    });
  }

  return NextResponse.json({ importados, pulados, credenciais, erros });
  } catch (e) {
    console.error("Falha na importação de holerites", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
