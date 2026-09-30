"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  resolverCatalogo,
  type EpiCatalogoItem,
  type EpiItem,
  type EpiModelo,
} from "@/lib/epi/types";
import { gerarFichaEpiPdf, nomeArquivoFichaEpi } from "@/lib/epi/pdf";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function EpiEmitirClient({
  modelos,
  catalogo,
}: {
  modelos: EpiModelo[];
  catalogo: EpiCatalogoItem[];
}) {
  const supabase = createClient();
  const [funcaoId, setFuncaoId] = useState("");
  const [nome, setNome] = useState("");
  const [data, setData] = useState(hojeISO());
  const [itens, setItens] = useState<EpiItem[]>([]);
  const [novoEpi, setNovoEpi] = useState("");
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const modelo = modelos.find((m) => m.id === funcaoId) ?? null;

  function selecionarFuncao(id: string) {
    setFuncaoId(id);
    const m = modelos.find((x) => x.id === id);
    setItens(m ? m.itens.map((it) => ({ ...it })) : []);
  }

  const ca = (desc: string) => resolverCatalogo(desc, catalogo)?.ca ?? "";

  const semCatalogo = useMemo(
    () => itens.filter((it) => !resolverCatalogo(it.descricao, catalogo)),
    [itens, catalogo]
  );

  async function gerar() {
    if (!modelo || !nome.trim() || itens.length === 0) {
      setMsg("Selecione a função, informe o nome e tenha ao menos 1 EPI.");
      return;
    }
    setGerando(true);
    setMsg(null);
    try {
      const dados = {
        nome: nome.trim(),
        funcao: modelo.funcao,
        dataEntrega: data,
        itens,
      };
      const doc = await gerarFichaEpiPdf(dados, catalogo);
      doc.save(nomeArquivoFichaEpi(dados));

      await supabase.from("epi_emitidas").insert({
        funcao: modelo.funcao,
        nome_funcionario: nome.trim(),
        data_entrega: data,
        itens: itens.map((it) => ({
          descricao: it.descricao,
          qtd: it.qtd,
          ca: ca(it.descricao) || null,
        })),
      });
      setMsg("Ficha gerada e registrada no histórico.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao gerar a ficha.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Ficha de EPI
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Selecione a função, informe o funcionário e a data de entrega. A lista
          vem do modelo da função e pode ser ajustada. O C.A é puxado do catálogo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block sm:col-span-1">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Função
          </span>
          <select
            value={funcaoId}
            onChange={(e) => selecionarFuncao(e.target.value)}
            className="input w-full"
          >
            <option value="">Selecione…</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.funcao}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-1">
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
        <label className="block sm:col-span-1">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Data de entrega
          </span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="input w-full"
          />
        </label>
      </div>

      {modelo && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 font-medium w-20 text-center">Qtde</th>
                <th className="px-3 py-2 font-medium">Descrição do EPI</th>
                <th className="px-3 py-2 font-medium w-24 text-center">C.A</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {itens.map((it, i) => {
                const semCa = !resolverCatalogo(it.descricao, catalogo);
                return (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        inputMode="numeric"
                        value={it.qtd}
                        onChange={(e) =>
                          setItens((prev) =>
                            prev.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    qtd:
                                      Number(e.target.value.replace(/\D/g, "")) ||
                                      0,
                                  }
                                : x
                            )
                          )
                        }
                        className="input w-16 text-center py-1 text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-slate-800 dark:text-slate-100">
                      {it.descricao}
                    </td>
                    <td className="px-3 py-1.5 text-center tabular-nums">
                      {semCa ? (
                        <span
                          className="text-rose-500"
                          title="Descrição não encontrada no catálogo — C.A sairá em branco"
                        >
                          —
                        </span>
                      ) : (
                        ca(it.descricao) || "—"
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <button
                        onClick={() =>
                          setItens((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="text-slate-400 hover:text-rose-500 text-sm"
                        title="Remover"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center gap-2 p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <select
              value={novoEpi}
              onChange={(e) => setNovoEpi(e.target.value)}
              className="input text-sm flex-1"
            >
              <option value="">+ Adicionar EPI do catálogo…</option>
              {catalogo.map((c) => (
                <option key={c.id} value={c.descricao}>
                  {c.descricao}
                  {c.ca ? ` (C.A ${c.ca})` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!novoEpi) return;
                setItens((prev) => [...prev, { descricao: novoEpi, qtd: 1 }]);
                setNovoEpi("");
              }}
              className="text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline whitespace-nowrap"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {semCatalogo.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {semCatalogo.length} item(ns) sem correspondência no catálogo (C.A sairá
          em branco): {semCatalogo.map((i) => i.descricao).join(", ")}.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={gerar}
          disabled={gerando || !modelo || !nome.trim()}
          className="bg-agos-green hover:bg-agos-green-dark text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {gerando ? "Gerando…" : "Gerar ficha (PDF)"}
        </button>
        {msg && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{msg}</span>
        )}
      </div>
    </div>
  );
}
