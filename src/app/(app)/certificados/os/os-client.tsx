"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OsModelo } from "@/lib/os/types";
import { gerarOrdemServicoPdf, nomeArquivoOs, SETOR_PADRAO } from "@/lib/os/pdf";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function OsEmitirClient({ modelos }: { modelos: OsModelo[] }) {
  const supabase = createClient();
  const [funcaoId, setFuncaoId] = useState("");
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cpf, setCpf] = useState("");
  const [setor, setSetor] = useState(SETOR_PADRAO);
  const [admissao, setAdmissao] = useState("");
  const [dataEmissao, setDataEmissao] = useState(hojeISO());
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const modelo = modelos.find((m) => m.id === funcaoId) ?? null;

  async function gerar() {
    if (!modelo || !nome.trim()) {
      setMsg("Selecione a função e informe o nome.");
      return;
    }
    setGerando(true);
    setMsg(null);
    try {
      const dados = {
        nome: nome.trim(),
        codigo: codigo.trim(),
        funcao: modelo.funcao,
        cbo: modelo.cbo ?? "",
        setor: setor.trim(),
        cpf: cpf.trim(),
        admissao,
        dataEmissao,
      };
      const doc = await gerarOrdemServicoPdf(modelo, dados);
      doc.save(nomeArquivoOs(dados));
      await supabase.from("os_emitidas").insert({
        funcao: modelo.funcao,
        nome_funcionario: dados.nome,
        codigo: dados.codigo || null,
        cbo: dados.cbo || null,
        setor: dados.setor || null,
        cpf: dados.cpf || null,
        admissao: admissao || null,
        data_emissao: dataEmissao,
      });
      setMsg("Ordem de Serviço gerada e registrada no histórico.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao gerar a OS.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Ordem de Serviço
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Selecione a função e preencha os dados do funcionário. O conteúdo
          (atividades, riscos, EPIs, medidas) vem do modelo da função.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Função
          </span>
          <select
            value={funcaoId}
            onChange={(e) => setFuncaoId(e.target.value)}
            className="input w-full"
          >
            <option value="">Selecione…</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.funcao}
                {m.cbo ? ` (CBO ${m.cbo})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Nome do funcionário
          </span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="input w-full"
            placeholder="Nome completo"
          />
        </label>
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Código / Matrícula
          </span>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="input w-full"
            placeholder="opcional"
          />
        </label>
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            CPF
          </span>
          <input
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            className="input w-full"
            placeholder="opcional"
          />
        </label>
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Setor
          </span>
          <input
            value={setor}
            onChange={(e) => setSetor(e.target.value)}
            className="input w-full"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Admissão
            </span>
            <input
              type="date"
              value={admissao}
              onChange={(e) => setAdmissao(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Emissão
            </span>
            <input
              type="date"
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
              className="input w-full"
            />
          </label>
        </div>
      </div>

      {modelo && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            Prévia do conteúdo — {modelo.funcao}
          </p>
          <p>
            <span className="text-slate-400">Riscos:</span>{" "}
            {modelo.riscos.length > 0
              ? modelo.riscos.map((r) => r.grupo).join(", ")
              : "—"}
          </p>
          <p className="line-clamp-2">
            <span className="text-slate-400">Atividades:</span>{" "}
            {modelo.atividades || "—"}
          </p>
          {modelo.riscos.length === 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              Esta função está sem tabela de riscos — edite em “Modelos OS” se
              necessário.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={gerar}
          disabled={gerando || !modelo || !nome.trim()}
          className="bg-agos-green hover:bg-agos-green-dark text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {gerando ? "Gerando…" : "Gerar OS (PDF)"}
        </button>
        {msg && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{msg}</span>
        )}
      </div>
    </div>
  );
}
