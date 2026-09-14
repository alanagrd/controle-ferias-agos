"use client";

import { useState } from "react";
import type {
  ArquivoPreview,
  DecisoesArquivo,
  FuncionarioPreview,
  ImportarResposta,
  ParsePreviewResposta,
} from "@/lib/holerites/types";

function mascararCpf(cpf: string): string {
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
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Decisao = { skip: boolean; matricula: string };

export default function HoleritesImportacaoClient() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<ArquivoPreview[] | null>(null);
  // decisões por "fi:idx"
  const [decisoes, setDecisoes] = useState<Record<string, Decisao>>({});
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ImportarResposta | null>(null);

  function getDecisao(fi: number, idx: number): Decisao {
    return decisoes[`${fi}:${idx}`] ?? { skip: false, matricula: "" };
  }
  function setDecisao(fi: number, idx: number, patch: Partial<Decisao>) {
    setDecisoes((prev) => {
      const k = `${fi}:${idx}`;
      const atual = prev[k] ?? { skip: false, matricula: "" };
      return { ...prev, [k]: { ...atual, ...patch } };
    });
  }

  async function analisar() {
    setErro(null);
    setPreview(null);
    setResultado(null);
    setDecisoes({});
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
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `Erro ${res.status}`);
      }
      const data = (await res.json()) as ParsePreviewResposta;
      setPreview(data.arquivos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao analisar.");
    } finally {
      setAnalisando(false);
    }
  }

  async function importar() {
    if (!preview) return;
    setErro(null);
    setImportando(true);
    try {
      const decisoesArquivos: DecisoesArquivo[] = preview.map((arq, fi) => ({
        funcionarios: arq.funcionarios.map((_, idx) => {
          const d = getDecisao(fi, idx);
          return { skip: d.skip, matricula: d.matricula.trim() || undefined };
        }),
      }));
      const form = new FormData();
      for (const f of arquivos) form.append("files", f);
      form.append("decisoes", JSON.stringify(decisoesArquivos));
      const res = await fetch("/api/holerites/importar", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `Erro ${res.status}`);
      }
      const data = (await res.json()) as ImportarResposta;
      setResultado(data);
      setPreview(null); // some o preview; mostra o resultado
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      setImportando(false);
    }
  }

  const totalImportaveis =
    preview?.reduce(
      (acc, arq, fi) =>
        acc +
        arq.funcionarios.filter((f, idx) => {
          const d = getDecisao(fi, idx);
          return !d.skip && (f.matched || d.matricula.trim());
        }).length,
      0
    ) ?? 0;

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-bold text-agos-charcoal dark:text-white mb-1">
        Holerites — importação por obra
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Envie os PDFs de holerite por obra (Bitti). Confira o resultado e só
        então confirme — a gravação cria/atualiza os holerites e provisiona o
        acesso dos colaboradores.
      </p>

      {!resultado && (
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
      )}

      {resultado && <ResultadoImportacao r={resultado} onNovo={() => {
        setResultado(null);
        setArquivos([]);
      }} />}

      {preview && (
        <div className="mt-6 space-y-6">
          {preview.map((arq, fi) => (
            <ArquivoCard
              key={fi}
              fi={fi}
              arq={arq}
              getDecisao={getDecisao}
              setDecisao={setDecisao}
            />
          ))}

          {erro && (
            <div className="text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-md p-3">
              {erro}
            </div>
          )}
          <div className="sticky bottom-0 bg-agos-gray-light/90 dark:bg-slate-950/90 backdrop-blur border-t border-slate-200 dark:border-slate-800 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {totalImportaveis} funcionário(s) serão importados.
            </span>
            <button
              onClick={importar}
              disabled={importando || totalImportaveis === 0}
              className="bg-agos-green hover:bg-agos-green-dark disabled:opacity-60 text-white font-semibold rounded-md px-5 py-2.5 text-sm transition"
            >
              {importando ? "Importando..." : "Confirmar importação"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArquivoCard({
  fi,
  arq,
  getDecisao,
  setDecisao,
}: {
  fi: number;
  arq: ArquivoPreview;
  getDecisao: (fi: number, idx: number) => Decisao;
  setDecisao: (fi: number, idx: number, patch: Partial<Decisao>) => void;
}) {
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
            {jaImportados} já importado(s) — serão substituídos
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
              <th className="px-4 py-2 text-right">Líquido</th>
              <th className="px-4 py-2">Págs.</th>
              <th className="px-4 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {arq.funcionarios.map((f, idx) => (
              <FuncionarioRow
                key={idx}
                f={f}
                d={getDecisao(fi, idx)}
                onSkip={(skip) => setDecisao(fi, idx, { skip })}
                onMatricula={(matricula) => setDecisao(fi, idx, { matricula })}
              />
            ))}
          </tbody>
        </table>
      </div>

      {arq.pendentes.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 text-sm">
          <div className="font-semibold text-red-700 dark:text-red-300 mb-1">
            Pendências (não serão importadas — revisar/reprocessar depois)
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

function FuncionarioRow({
  f,
  d,
  onSkip,
  onMatricula,
}: {
  f: FuncionarioPreview;
  d: Decisao;
  onSkip: (skip: boolean) => void;
  onMatricula: (m: string) => void;
}) {
  const inclui = !d.skip && (f.matched || d.matricula.trim().length > 0);
  return (
    <tr
      className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${
        d.skip ? "opacity-50" : ""
      }`}
    >
      <td className="px-4 py-2 font-mono">{f.matricula}</td>
      <td className="px-4 py-2">
        {f.nome}
        <span className="block text-xs text-slate-400 font-mono">
          {mascararCpf(f.cpf)}
        </span>
      </td>
      <td className="px-4 py-2">
        {f.matched ? (
          <span className="text-agos-green-dark dark:text-agos-green">
            ✓ {f.nomeSistema}
            {f.statusSistema && f.statusSistema !== "ATIVO"
              ? ` (${f.statusSistema})`
              : ""}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-amber-600 dark:text-amber-400 text-xs">
              não encontrado — matrícula:
            </span>
            <input
              value={d.matricula}
              onChange={(e) => onMatricula(e.target.value)}
              placeholder="corrigir"
              inputMode="numeric"
              className="input w-24 py-1 text-xs"
            />
          </span>
        )}
        {f.jaImportado && (
          <span className="ml-2 text-xs text-slate-400">· substitui</span>
        )}
        {inclui && f.matched && !f.jaTemAcesso && (
          <span className="ml-2 text-xs text-slate-400">· criará acesso</span>
        )}
      </td>
      <td className="px-4 py-2 text-right">{fmtMoeda(f.liquido)}</td>
      <td className="px-4 py-2 text-slate-500">
        {f.paginas.map((n) => n + 1).join(", ")}
      </td>
      <td className="px-4 py-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={d.skip}
            onChange={(e) => onSkip(e.target.checked)}
          />
          pular
        </label>
      </td>
    </tr>
  );
}

function ResultadoImportacao({
  r,
  onNovo,
}: {
  r: ImportarResposta;
  onNovo: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const linhasCsv = () =>
    [
      "Nome;Matrícula;Usuário;Senha temporária",
      ...r.credenciais.map(
        (c) => `${c.nome};${c.matricula};${c.usuario};${c.senha}`
      ),
    ].join("\n");

  function copiar() {
    navigator.clipboard.writeText(linhasCsv()).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  function exportarCsv() {
    const blob = new Blob(["﻿" + linhasCsv()], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "credenciais-holerites.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-lg font-bold text-agos-green-dark dark:text-agos-green">
            {r.importados} importado(s)
          </span>
          {r.pulados > 0 && (
            <span className="text-sm text-slate-500">{r.pulados} pulado(s)</span>
          )}
          {r.erros.length > 0 && (
            <span className="text-sm text-red-600 dark:text-red-400">
              {r.erros.length} erro(s)
            </span>
          )}
          <button
            onClick={onNovo}
            className="ml-auto text-sm text-agos-green-dark dark:text-agos-green font-medium hover:underline"
          >
            Nova importação
          </button>
        </div>
      </div>

      {r.credenciais.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <div className="font-semibold text-amber-800 dark:text-amber-200">
              {r.credenciais.length} acesso(s) novo(s) — anote agora
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Estas senhas <strong>não podem ser recuperadas depois</strong>. Copie
              ou exporte e repasse ao colaborador; ele troca a senha no 1º acesso.
            </p>
          </div>
          <div className="px-5 py-3 flex gap-2">
            <button
              onClick={copiar}
              className="text-sm bg-agos-green hover:bg-agos-green-dark text-white font-semibold rounded-md px-4 py-1.5"
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
            <button
              onClick={exportarCsv}
              className="text-sm border border-slate-300 dark:border-slate-700 rounded-md px-4 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Matrícula</th>
                  <th className="px-4 py-2">Usuário</th>
                  <th className="px-4 py-2">Senha temporária</th>
                </tr>
              </thead>
              <tbody>
                {r.credenciais.map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <td className="px-4 py-2">{c.nome}</td>
                    <td className="px-4 py-2 font-mono">{c.matricula}</td>
                    <td className="px-4 py-2 font-mono">{c.usuario}</td>
                    <td className="px-4 py-2 font-mono font-semibold">
                      {c.senha}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {r.erros.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-lg p-5 text-sm">
          <div className="font-semibold text-red-700 dark:text-red-300 mb-1">
            Erros
          </div>
          <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300 space-y-0.5">
            {r.erros.map((e, i) => (
              <li key={i}>
                {e.arquivo}
                {e.funcionario ? ` · ${e.funcionario}` : ""}: {e.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
