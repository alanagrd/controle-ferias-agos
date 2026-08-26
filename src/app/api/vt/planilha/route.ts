import { NextRequest, NextResponse } from "next/server";
import {
  construirPlanilhaVtBuffer,
  type LinhaPlanilhaVt,
} from "@/lib/export-planilha-vt";

// exceljs usa APIs do Node (streams), então a geração roda no servidor —
// muito mais rápida/confiável que no navegador.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { ano?: number; mes?: number; linhas?: LinhaPlanilhaVt[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { ano, mes, linhas } = body;
  if (typeof ano !== "number" || typeof mes !== "number" || !Array.isArray(linhas)) {
    return NextResponse.json(
      { error: "Parâmetros inválidos: ano, mes e linhas são obrigatórios." },
      { status: 400 }
    );
  }

  const buf = await construirPlanilhaVtBuffer(ano, mes, linhas);

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "no-store",
    },
  });
}
