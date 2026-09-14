import { NextRequest, NextResponse } from "next/server";
import * as mupdf from "mupdf";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseHoleritesPdf } from "@/lib/holerites/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." },
      { status: 500 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const funcionarioId = form.get("funcionarioId") as string | null;
    const competencia = form.get("competencia") as string | null; // AAAA-MM
    if (!(file instanceof File) || !funcionarioId || !competencia) {
      return NextResponse.json(
        { error: "Arquivo, funcionário e competência são obrigatórios." },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      return NextResponse.json(
        { error: "Competência inválida." },
        { status: 400 }
      );
    }

    const { data: func } = await admin
      .from("rh_funcionarios")
      .select("id, codigo, nome, obra")
      .eq("id", funcionarioId)
      .maybeSingle();
    if (!func) {
      return NextResponse.json(
        { error: "Funcionário não encontrado." },
        { status: 404 }
      );
    }
    const f = func as {
      id: string;
      codigo: string | null;
      nome: string;
      obra: string | null;
    };

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Lê os dados do PDF (best-effort). Garante que é 1 pessoa só e a certa.
    const parsed = await parseHoleritesPdf(bytes.slice());
    if (parsed.funcionarios.length > 1) {
      return NextResponse.json(
        {
          error:
            "Este PDF tem vários funcionários. Use a Importação por obra em vez do envio manual.",
        },
        { status: 400 }
      );
    }
    const p = parsed.funcionarios[0];
    const codigoFunc = (f.codigo ?? "").padStart(6, "0");
    if (p && p.matricula.padStart(6, "0") !== codigoFunc) {
      return NextResponse.json(
        {
          error: `O PDF parece ser de outra pessoa (matrícula ${p.matricula}). Selecione o funcionário correto.`,
        },
        { status: 400 }
      );
    }
    const cpfDigitos = p?.cpf.replace(/\D/g, "") ?? null;

    // Descriptografa + normaliza (mupdf) mantendo todas as páginas.
    const src = mupdf.PDFDocument.openDocument(
      bytes,
      "application/pdf"
    ) as mupdf.PDFDocument;
    const dst = new mupdf.PDFDocument();
    const n = src.countPages();
    for (let i = 0; i < n; i++) dst.graftPage(-1, src, i);
    const outBytes = new Uint8Array(
      dst.saveToBuffer("compress").asUint8Array()
    );
    dst.destroy();
    src.destroy();

    const objKey = `${f.id}/${competencia}.pdf`;
    const up = await admin.storage
      .from("holerites")
      .upload(objKey, outBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (up.error) {
      return NextResponse.json(
        { error: `Falha no upload: ${up.error.message}` },
        { status: 500 }
      );
    }

    const { error: hErr } = await admin.from("holerites").upsert(
      {
        funcionario_id: f.id,
        competencia: `${competencia}-01`,
        liquido: p?.liquido ?? null,
        adiantamento: p?.adiantamento ?? null,
        devolucao: p?.devolucao ?? null,
        obra: f.obra,
        storage_path: objKey,
        importado_por: user.id,
        importado_em: new Date().toISOString(),
      },
      { onConflict: "funcionario_id,competencia" }
    );
    if (hErr) {
      return NextResponse.json(
        { error: `Falha ao gravar holerite: ${hErr.message}` },
        { status: 500 }
      );
    }

    // Provisiona acesso (senha = CPF), se ainda não tiver e houver CPF legível.
    let acessoCriado = false;
    const { data: pa } = await admin
      .from("portal_acessos")
      .select("funcionario_id, cpf")
      .eq("funcionario_id", f.id)
      .maybeSingle();
    if (pa && !(pa as { cpf: string | null }).cpf && cpfDigitos) {
      await admin
        .from("portal_acessos")
        .update({ cpf: cpfDigitos })
        .eq("funcionario_id", f.id);
    }
    if (!pa && cpfDigitos) {
      const email = `${codigoFunc}@agos.internal`;
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: cpfDigitos,
        email_confirm: true,
        user_metadata: {
          funcionario_id: f.id,
          matricula: codigoFunc,
          nome: f.nome,
        },
      });
      if (!cErr && created?.user) {
        const { error: paErr } = await admin.from("portal_acessos").insert({
          funcionario_id: f.id,
          auth_user_id: created.user.id,
          senha_temporaria: true,
          cpf: cpfDigitos,
        });
        if (paErr) {
          await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
        } else {
          acessoCriado = true;
        }
      }
    }

    return NextResponse.json({ ok: true, acessoCriado });
  } catch (e) {
    console.error("Falha no upload manual de holerite", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
