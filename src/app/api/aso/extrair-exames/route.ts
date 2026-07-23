import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Você lê relatórios/faturas de clínicas de medicina do trabalho brasileiras (ASO - Atestado de Saúde Ocupacional) e extrai os exames realizados.

Cada relatório pode vir em formatos diferentes (fatura em PDF com blocos por funcionário, ou planilha convertida em texto/CSV com uma linha por exame). Identifique, para cada exame realizado, três campos:

- "nome": nome completo do funcionário, exatamente como aparece no documento (não invente nem corrija grafia).
- "data": data em que o exame foi realizado, no formato ISO "AAAA-MM-DD".
- "tipo": o tipo de ASO, mapeado para um destes valores exatos:
  - "ADMISSIONAL" (admissional, "ADM")
  - "PERIODICO" (periódico, "PERI")
  - "RETORNO_AO_TRABALHO" (retorno ao trabalho, "RT")
  - "MUDANCA_DE_RISCO" (mudança de risco/função, "MR")
  - "DEMISSIONAL" (demissional, "DEM")

Ignore linhas de taxa extra, totais, cabeçalhos ou qualquer coisa que não seja um exame de um funcionário específico.

Responda APENAS com um array JSON, sem nenhum texto antes ou depois, sem markdown, no formato:
[{"nome": "...", "data": "AAAA-MM-DD", "tipo": "ADMISSIONAL"}, ...]

Se não conseguir determinar a data ou o tipo de uma linha com confiança, não inclua essa linha no resultado.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada no servidor." },
      { status: 500 }
    );
  }

  const form = await req.formData();
  const kind = form.get("kind");
  const file = form.get("file");
  const text = form.get("text");

  let content: Array<Record<string, unknown>>;

  if (kind === "pdf" && file instanceof File) {
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    content = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64,
        },
      },
      {
        type: "text",
        text: "Extraia os exames deste relatório em JSON, seguindo as instruções do sistema.",
      },
    ];
  } else if (kind === "text" && typeof text === "string") {
    content = [
      {
        type: "text",
        text: `Conteúdo da planilha (convertida em texto/CSV):\n\n${text}\n\nExtraia os exames em JSON, seguindo as instruções do sistema.`,
      },
    ];
  } else {
    return NextResponse.json(
      { error: "Requisição inválida: envie 'kind'=pdf com 'file', ou 'kind'=text com 'text'." },
      { status: 400 }
    );
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      { error: `Erro na API do Claude: ${errText}` },
      { status: 502 }
    );
  }

  const data = await response.json();
  const textBlock = (data.content ?? []).find(
    (b: { type: string }) => b.type === "text"
  );
  const raw = (textBlock?.text ?? "").replace(/```json|```/g, "").trim();

  let exames: unknown;
  try {
    exames = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Não consegui interpretar a resposta do modelo como JSON." },
      { status: 502 }
    );
  }

  if (!Array.isArray(exames)) {
    return NextResponse.json(
      { error: "Resposta do modelo não é uma lista de exames." },
      { status: 502 }
    );
  }

  return NextResponse.json({ exames });
}
