"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Competencia, Funcionario, FuncionarioCompetencia } from "@/lib/types";
import { nomeCompetencia } from "@/lib/status-vt";
import { parseApontamentoXlsx, type LinhaApontamento } from "@/lib/importacao-vt";

type FuncionarioLite = Pick<
  Funcionario,
  "id" | "codigo" | "nome" | "obra" | "status" | "cliente_razao_social"
>;

type FuncCompLite = Pick<
  FuncionarioCompetencia,
  "id" | "funcionario_id" | "competencia_id" | "obra_snapshot"
>;

type LinhaConciliada = {
  linha: LinhaApontamento;
  funcComp: FuncCompLite | null;
  funcionario: FuncionarioLite | null;
};

export default function VtImportacaoClient({
  competenciaAtual,
  funcComp,
  funcionarios,
}: {
  competenciaAtual: Competencia | null;
  funcComp: FuncCompLite[];
  funcionarios: FuncionarioLite[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [conciliadas, setConciliadas] = useState<LinhaConciliada[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const funcionariosPorCodigo = useMemo(() => {
    const map = new Map<string, FuncionarioLite>();
    funcionarios.forEach((f) => {
      if (f.codigo) map.set(f.codigo, f);
    });
    return map;
  }, [funcionarios]);

  const funcCompPorFuncionarioId = useMemo(() => {
    const map = new Map<string, FuncCompLite>();
    funcComp.forEach((fc) => map.set(fc.funcionario_id, fc));
    return map;
  }, [funcComp]);

  async function handleFile(file: File) {
    setLoading(true);
    setResultado(null);
    setFileName(file.name);

    const { linhas, avisos: avisosParser } = await parseApontamentoXlsx(file);

    const conciliadasResult: LinhaConciliada[] = linhas.map((linha) => {
      const codigo = linha.matricula.padStart(6, "0");
      const funcionario = funcionariosPorCodigo.get(codigo) ?? null;
      const fc = funcionario
        ? funcCompPorFuncionarioId.get(funcionario.id) ?? null
        : null;
      return { linha, funcComp: fc, funcionario };
    });

    setConciliadas(conciliadasResult);
    setAvisos(avisosParser);
    setLoading(false);
  }

  const matched = conciliadas.filter((c) => c.funcComp);
  const semFuncionario = conciliadas.filter((c) => !c.funcionario);
  const semNaCompetencia = conciliadas.filter((c) => c.funcionario && !c.funcComp);

  async function aplicarImportacao() {
    if (matched.length === 0) return;
    setApplying(true);

    const rows = matched.map((c) => ({
      func_comp_id: c.funcComp!.id,
      h50: c.linha.h50,
      h70: c.linha.h70,
      h100: c.linha.h100,
      faltas: c.linha.faltas,
      dsr: c.linha.dsr,
      ad_not: c.linha.adNot,
      premio: c.linha.premio,
      arquivo_origem: fileName,
    }));

    const { error } = await supabase
      .from("vt_apontamento")
      .upsert(rows, { onConflict: "func_comp_id" });

    setApplying(false);
    if (error) {
      setResultado(`Erro ao aplicar: ${error.message}`);
      return;
    }
    setResultado(`${rows.length} apontamento(s) importado(s) com sucesso.`);
  }

  if (!competenciaAtual) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Abra a competência do mês em Funcionários & VT antes de importar o
          apontamento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Importar apontamento
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {nomeCompetencia(competenciaAtual.ano, competenciaAtual.mes)} — planilha de
          ponto de uma obra (50%, 70%, 100%, Faltas, DSR, Ad.Not, Prêmio)
        </p>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-agos-green transition bg-white dark:bg-slate-900"
      >
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Arraste a planilha de ponto ou clique para selecionar
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Cruza automaticamente por matrícula com o cadastro ativo da competência
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {loading && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lendo arquivo...</p>
      )}

      {avisos.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-3 text-xs text-amber-700 dark:text-amber-400">
          {avisos.map((a, i) => (
            <p key={i}>{a}</p>
          ))}
        </div>
      )}

      {conciliadas.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[12px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Prontos para importar
              </p>
              <p className="text-[22px] font-bold mt-1 text-agos-green-dark dark:text-agos-green-light">
                {matched.length}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[12px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Matrícula não encontrada
              </p>
              <p className="text-[22px] font-bold mt-1 text-red-600 dark:text-red-400">
                {semFuncionario.length}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[12px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Fora da competência atual
              </p>
              <p className="text-[22px] font-bold mt-1 text-amber-600 dark:text-amber-400">
                {semNaCompetencia.length}
              </p>
            </div>
          </div>

          {(semFuncionario.length > 0 || semNaCompetencia.length > 0) && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                Divergências ({semFuncionario.length + semNaCompetencia.length})
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {[...semFuncionario, ...semNaCompetencia].map((c, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                    >
                      <td className="py-2 px-3 font-mono text-xs text-slate-500">
                        {c.linha.matricula}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                        {c.funcionario?.nome ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-400">
                        {!c.funcionario
                          ? "Matrícula não existe no cadastro"
                          : "Não está na competência atual (funcionário dispensado ou não estava ATIVO na abertura)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between">
            {resultado && (
              <p className="text-sm text-agos-green-dark dark:text-agos-green-light">
                {resultado}
              </p>
            )}
            <button
              onClick={aplicarImportacao}
              disabled={applying || matched.length === 0}
              className="ml-auto bg-agos-green hover:bg-agos-green-dark text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60"
            >
              {applying
                ? "Importando..."
                : `Importar ${matched.length} apontamento(s)`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
