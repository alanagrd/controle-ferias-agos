"use client";

import { useState } from "react";
import type {
  ArquivoPreview,
  FuncionarioPreview,
  ParsePreviewResposta,
} from "@/lib/holerites/types";

function mascararCpf(cpf: string): string {
  // 141.191.857-61 -> 141.***.***-61
  const m = cpf.match(/^(\d{3})\.\d{3}\.\d{3}-(\d{2})$/);
  return m ? `${m[1]}.***.***-${m[2]}` : cpf;
}

function fmtCompetencia(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes] = iso.split("-");
  return `${mes}/${ano}`;
}

function fmtMoeda(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function HoleritesImportacaoClient() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<ArquivoPreview[] | null>(null);

  async function analisar() {
    setErro(null);
    setPreview(null);
    if (arquivos.length === 0) {
      setErro("Selecione ao menos um PDF de holerite.");
      return;
    }
    setAnalisando(true);
    try {
      const form = new FormData();
      for (const f of arquivos) form.append("files", f);
      const res = await fetch("/api/holerites/parse", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(j?.error ?? `Erro ${res.status}`);
      }
      const data = (await res.json()) as ParsePreviewResposta;
      setPreview(data.arquivos);
    } catch (e) {
      console.error(e);
      setErro(e instanceof Error ? e.message : "Falha ao analisar os arquivos.");
    } finally {
      setAnalisando(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-bold text-agos-charcoal dark:text-white mb-1">
        Holerites — importação por obra
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Envie os PDFs de holerite por obra (Bitti). O sistema lê e mostra o
        resultado <strong>antes de gravar qualquer coisa</strong>.
      </p>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            PDFs de holerite (um ou vários)
          </label>
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
            className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-agos-green file:px-4 file:py-2 file:text-white file:font-semibold hover:file:bg-agos-green-dark"
          />
          {arquivos.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              {arquivos.length} arquivo(s) selecionado(s).
            </p>
          )}
        </div>

        {erro && (
          <div className="text-sm text-red-600 dark:text-red-400">{erro}</div>
        )}

        <button
          onClick={analisar}
          disabled={analisando}
          className="bg-agos-green hover:bg-agos-green-dark disabled:opacity-60 text-white font-semibold rounded-md px-5 py-2 text-sm transition"
        >
          {analisando ? "Analisando..." : "Analisar PDFs"}
        </button>
      </div>

      {preview && (
        <div className="mt-6 space-y-6">
          {preview.map((arq, i) => (
            <ArquivoCard key={i} arq={arq} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArquivoCard({ arq }: { arq: ArquivoPreview }) {
  if (arq.erro) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-lg p-5">
        <div className="font-semibold text-agos-charcoal dark:text-white">
          {arq.arquivo}
        </div>
        <div className="text-sm text-red-600 dark:text-red-400 mt-1">
          {arq.erro}
        </div>
      </div>
    );
  }

  const okMatched = arq.funcionarios.filter((f) => f.matched).length;
  const naoEncontrados = arq.funcionarios.filter((f) => !f.matched).length;
  const jaImportados = arq.funcionarios.filter((f) => f.jaImportado).length;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-x-6 gap-y-1">
        <div className="font-semibold text-agos-charcoal dark:text-white">
          {arq.arquivo}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Obra: <strong>{arq.obra ?? "—"}</strong>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Competência: <strong>{fmtCompetencia(arq.competencia)}</strong>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {arq.totalPaginas} páginas
        </div>
      </div>

      <div className="px-5 py-2 flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-0.5 rounded-full bg-agos-green/15 text-agos-green-dark dark:text-agos-green">
          {okMatched} encontrado(s)
        </span>
        {naoEncontrados > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {naoEncontrados} não encontrado(s)
          </span>
        )}
        {jaImportados > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {jaImportados} já importado(s) nesta competência
          </span>
        )}
        {arq.pendentes.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
            {arq.pendentes.length} pendência(s)
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
              <th className="px-4 py-2">Matrícula</th>
              <th className="px-4 py-2">Funcionário (holerite)</th>
              <th className="px-4 py-2">Situação</th>
              <th className="px-4 py-2">CPF</th>
              <th className="px-4 py-2 text-right">Líquido</th>
              <th className="px-4 py-2 text-right">Adiant.</th>
              <th className="px-4 py-2">Págs.</th>
            </tr>
          </thead>
          <tbody>
            {arq.funcionarios.map((f, i) => (
              <FuncionarioRow key={i} f={f} />
            ))}
          </tbody>
        </table>
      </div>

      {arq.pendentes.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 text-sm">
          <div className="font-semibold text-red-700 dark:text-red-300 mb-1">
            Pendências (revisar manualmente)
          </div>
          <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300 space-y-0.5">
            {arq.pendentes.map((p, i) => (
              <li key={i}>
                Página {p.pagina}: {p.motivo}
                {p.cpf ? ` (CPF ${mascararCpf(p.cpf)})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FuncionarioRow({ f }: { f: FuncionarioPreview }) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      <td className="px-4 py-2 font-mono">{f.matricula}</td>
      <td className="px-4 py-2">{f.nome}</td>
      <td className="px-4 py-2">
        {f.matched ? (
          <span className="text-agos-green-dark dark:text-agos-green">
            ✓ {f.nomeSistema}
            {f.statusSistema && f.statusSistema !== "ATIVO"
              ? ` (${f.statusSistema})`
              : ""}
          </span>
        ) : (
          <span className="text-amber-600 dark:text-amber-400">
            não encontrado
          </span>
        )}
        {f.jaImportado && (
          <span className="ml-2 text-xs text-slate-400">· já importado</span>
        )}
        {f.matched && !f.jaTemAcesso && (
          <span className="ml-2 text-xs text-slate-400">· criará acesso</span>
        )}
      </td>
      <td className="px-4 py-2 font-mono text-slate-500">
        {mascararCpf(f.cpf)}
      </td>
      <td className="px-4 py-2 text-right">{fmtMoeda(f.liquido)}</td>
      <td className="px-4 py-2 text-right">{fmtMoeda(f.adiantamento)}</td>
      <td className="px-4 py-2 text-slate-500">
        {f.paginas.map((n) => n + 1).join(", ")}
      </td>
    </tr>
  );
}
