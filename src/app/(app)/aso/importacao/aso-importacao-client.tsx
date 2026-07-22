"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Funcionario } from "@/lib/types";
import { parseAtivosGeralAsoCsv, type LinhaAtivosGeralAso } from "@/lib/importacao";
import { fmtDate } from "@/lib/status";

type CandidatoInativacao = { f: Funcionario };
type CandidatoNovo = { row: LinhaAtivosGeralAso };
type CandidatoCcusto = { f: Funcionario; row: LinhaAtivosGeralAso };

export default function AsoImportacaoClient({
  dbFuncionarios,
}: {
  dbFuncionarios: Funcionario[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [dbState, setDbState] = useState(dbFuncionarios);
  const [linhas, setLinhas] = useState<LinhaAtivosGeralAso[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [excludedInativar, setExcludedInativar] = useState<Set<string>>(new Set());
  const [excludedNovos, setExcludedNovos] = useState<Set<string>>(new Set());
  const [excludedCcusto, setExcludedCcusto] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);
  const [aplicado, setAplicado] = useState<string | null>(null);

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    setAplicado(null);
    try {
      const buf = await file.arrayBuffer();
      const decoder = new TextDecoder("windows-1252");
      const text = decoder.decode(buf);
      const rows = parseAtivosGeralAsoCsv(text);
      if (rows.length === 0) {
        setParseError(
          "Não encontrei nenhuma linha válida no arquivo. Confira se é o export \"Funcionários Ativos Geral\" (;-delimitado)."
        );
        setLinhas(null);
      } else {
        setLinhas(rows.filter((r) => !r.demissao));
        setFileName(file.name);
        setExcludedInativar(new Set());
        setExcludedNovos(new Set());
        setExcludedCcusto(new Set());
      }
    } catch {
      setParseError("Não consegui ler o arquivo. Confira o formato (CSV).");
    } finally {
      setParsing(false);
    }
  }

  const codigoInt = useCallback((codigo: string | null): number | null => {
    if (!codigo || !/^\d+$/.test(codigo)) return null;
    return Number(codigo);
  }, []);

  const analise = useMemo(() => {
    if (!linhas) return null;

    const codigosCsv = new Map<number, LinhaAtivosGeralAso>();
    linhas.forEach((r) => {
      if (r.codigoNum !== null) codigosCsv.set(r.codigoNum, r);
    });

    const dbByCodigo = new Map<number, Funcionario>();
    dbState.forEach((f) => {
      const n = codigoInt(f.codigo);
      if (n !== null) dbByCodigo.set(n, f);
    });

    const candidatosInativacao: CandidatoInativacao[] = dbState
      .filter((f) => f.status === "ATIVO")
      .filter((f) => {
        const n = codigoInt(f.codigo);
        if (n === null) return false; // sem código numérico, não mexe
        return !codigosCsv.has(n);
      })
      .map((f) => ({ f }));

    const novosACadastrar: CandidatoNovo[] = linhas
      .filter((r) => r.codigoNum !== null && !dbByCodigo.has(r.codigoNum))
      .map((row) => ({ row }));

    const ccustoDivergente: CandidatoCcusto[] = linhas
      .filter((r) => r.codigoNum !== null)
      .map((row) => {
        const f = dbByCodigo.get(row.codigoNum as number);
        if (!f || f.status !== "ATIVO") return null;
        const obraAtual = (f.obra ?? "").trim();
        const obraNova = (row.ccusto ?? "").trim();
        if (!obraNova || obraNova === obraAtual) return null;
        return { f, row };
      })
      .filter((x): x is CandidatoCcusto => x !== null);

    return { candidatosInativacao, novosACadastrar, ccustoDivergente };
  }, [linhas, dbState, codigoInt]);

  async function handleAplicar() {
    if (!analise) return;
    setAplicando(true);
    setAplicado(null);

    const inativar = analise.candidatosInativacao.filter(
      (c) => !excludedInativar.has(c.f.id)
    );
    const novos = analise.novosACadastrar.filter(
      (c) => !excludedNovos.has(c.row.codigo)
    );
    const ccusto = analise.ccustoDivergente.filter(
      (c) => !excludedCcusto.has(c.f.id)
    );

    const erros: string[] = [];
    const dbUpdates: Funcionario[] = [];

    for (const c of inativar) {
      const { error } = await supabase
        .from("rh_funcionarios")
        .update({ status: "INATIVO" })
        .eq("id", c.f.id);
      if (error) erros.push(`${c.f.nome}: ${error.message}`);
      else dbUpdates.push({ ...c.f, status: "INATIVO" });
    }

    for (const c of ccusto) {
      const { error } = await supabase
        .from("rh_funcionarios")
        .update({ obra: c.row.ccusto })
        .eq("id", c.f.id);
      if (error) erros.push(`${c.f.nome}: ${error.message}`);
      else dbUpdates.push({ ...c.f, obra: c.row.ccusto });
    }

    for (const c of novos) {
      const { data, error } = await supabase
        .from("rh_funcionarios")
        .insert({
          codigo: c.row.codigo,
          nome: c.row.nome,
          cargo: c.row.cargo || null,
          obra: c.row.ccusto,
          admissao: c.row.admissao,
          status: "ATIVO",
        })
        .select()
        .single();
      if (error || !data) {
        erros.push(`${c.row.nome}: ${error?.message ?? "erro desconhecido"}`);
        continue;
      }
      dbUpdates.push(data as Funcionario);
      if (c.row.admissao) {
        const vencimento = new Date(c.row.admissao + "T00:00:00");
        vencimento.setDate(vencimento.getDate() + 365);
        await supabase.from("rh_registros_aso").insert({
          funcionario_id: (data as Funcionario).id,
          data_aso: c.row.admissao,
          tipo: "ADMISSIONAL",
          data_vencimento: vencimento.toISOString().slice(0, 10),
        });
      }
    }

    setDbState((prev) => {
      const byId = new Map(prev.map((f) => [f.id, f]));
      dbUpdates.forEach((f) => byId.set(f.id, f));
      return Array.from(byId.values());
    });

    setAplicando(false);
    setAplicado(
      erros.length > 0
        ? `Aplicado com ${erros.length} erro(s): ${erros.join("; ")}`
        : `Aplicado: ${inativar.length} inativado(s), ${novos.length} cadastrado(s), ${ccusto.length} C.Custo atualizado(s).`
    );
    setLinhas(null);
    setFileName(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Importação mensal — ASO
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sobe a planilha &quot;Funcionários Ativos Geral&quot; do mês. Ela
          concilia quem entrou/saiu e atualiza o C.Custo — a data de exame
          continua sendo lançada manualmente em Funcionários.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Arquivo (.csv)
          </span>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="text-sm text-slate-700 dark:text-slate-300"
          />
        </label>
        {parsing && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Lendo arquivo...
          </p>
        )}
        {parseError && (
          <p className="text-xs text-red-600 mt-2">{parseError}</p>
        )}
        {fileName && !parseError && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {fileName} — {linhas?.length ?? 0} linha(s) lida(s)
          </p>
        )}
        {aplicado && (
          <p className="text-xs text-agos-green-dark dark:text-agos-green-light mt-2">
            {aplicado}
          </p>
        )}
      </div>

      {analise && (
        <>
          <Painel
            titulo={`Candidatos a inativar (${analise.candidatosInativacao.length})`}
            descricao="Estão ATIVO no sistema mas sumiram da planilha deste mês."
            vazio="Ninguém sumiu da planilha em relação ao cadastro atual."
          >
            {analise.candidatosInativacao.map((c) => (
              <LinhaCandidato
                key={c.f.id}
                checked={!excludedInativar.has(c.f.id)}
                onToggle={() =>
                  setExcludedInativar((prev) => toggleSet(prev, c.f.id))
                }
                titulo={c.f.nome}
                sub={`Código ${c.f.codigo ?? "–"} · admitido em ${fmtDate(c.f.admissao)}`}
              />
            ))}
          </Painel>

          <Painel
            titulo={`Funcionários novos a cadastrar (${analise.novosACadastrar.length})`}
            descricao="Estão na planilha mas não existem no sistema — serão cadastrados ATIVO com ASO admissional (data = admissão)."
            vazio="Nenhum funcionário novo nesta planilha."
          >
            {analise.novosACadastrar.map((c) => (
              <LinhaCandidato
                key={c.row.codigo}
                checked={!excludedNovos.has(c.row.codigo)}
                onToggle={() =>
                  setExcludedNovos((prev) => toggleSet(prev, c.row.codigo))
                }
                titulo={c.row.nome}
                sub={`Código ${c.row.codigo} · ${c.row.cargo || "sem função"} · admissão ${fmtDate(c.row.admissao)} · ${c.row.ccusto || "sem C.Custo"}`}
              />
            ))}
          </Painel>

          <Painel
            titulo={`C.Custo divergente (${analise.ccustoDivergente.length})`}
            descricao="Mesmo funcionário, mas o C.Custo da planilha é diferente do cadastrado."
            vazio="Nenhuma divergência de C.Custo."
          >
            {analise.ccustoDivergente.map((c) => (
              <LinhaCandidato
                key={c.f.id}
                checked={!excludedCcusto.has(c.f.id)}
                onToggle={() =>
                  setExcludedCcusto((prev) => toggleSet(prev, c.f.id))
                }
                titulo={c.f.nome}
                sub={`${c.f.obra || "sem C.Custo"} → ${c.row.ccusto}`}
              />
            ))}
          </Painel>

          <div className="flex justify-end">
            <button
              onClick={handleAplicar}
              disabled={aplicando}
              className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-4 py-2.5 disabled:opacity-60"
            >
              {aplicando ? "Aplicando..." : "Aplicar selecionados"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function toggleSet(prev: Set<string>, key: string): Set<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function Painel({
  titulo,
  descricao,
  vazio,
  children,
}: {
  titulo: string;
  descricao: string;
  vazio: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
      <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-slate-100">
        {titulo}
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        {descricao}
      </p>
      {hasChildren ? (
        <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60">
          {children}
        </div>
      ) : (
        <p className="text-xs text-slate-400">{vazio}</p>
      )}
    </div>
  );
}

function LinhaCandidato({
  checked,
  onToggle,
  titulo,
  sub,
}: {
  checked: boolean;
  onToggle: () => void;
  titulo: string;
  sub: string;
}) {
  return (
    <label className="flex items-start gap-3 py-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1"
      />
      <div>
        <div className="text-slate-900 dark:text-slate-100">{titulo}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{sub}</div>
      </div>
    </label>
  );
}
