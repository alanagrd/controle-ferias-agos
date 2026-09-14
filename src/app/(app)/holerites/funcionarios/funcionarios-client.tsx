"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type FuncStatus = {
  id: string;
  codigo: string;
  nome: string;
  temHolerite: boolean;
  storagePath: string | null;
  liquido: number | null;
};

function fmtComp(ym: string): string {
  const [ano, mes] = ym.split("-");
  return `${mes}/${ano}`;
}

export default function HoleritesFuncionariosClient({
  obras,
  competencias,
  obra,
  competencia,
  funcionarios,
}: {
  obras: string[];
  competencias: string[];
  obra: string;
  competencia: string;
  funcionarios: FuncStatus[];
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [subindo, setSubindo] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  function irPara(next: { obra?: string; competencia?: string }) {
    const o = next.obra ?? obra;
    const c = next.competencia ?? competencia;
    const qs = new URLSearchParams();
    if (o) qs.set("obra", o);
    if (c) qs.set("competencia", c);
    router.push(`/holerites/funcionarios?${qs.toString()}`);
  }

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return funcionarios;
    return funcionarios.filter(
      (f) => f.nome.toLowerCase().includes(t) || f.codigo.includes(t)
    );
  }, [funcionarios, busca]);

  const comHolerite = funcionarios.filter((f) => f.temHolerite).length;
  const faltando = funcionarios.length - comHolerite;

  async function ver(f: FuncStatus) {
    if (!f.storagePath) return;
    setErro(null);
    setAbrindo(f.id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("holerites")
        .createSignedUrl(f.storagePath, 120);
      if (error || !data?.signedUrl) {
        setErro("Não foi possível abrir o PDF.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener");
    } finally {
      setAbrindo(null);
    }
  }

  async function subir(f: FuncStatus, file: File) {
    setErro(null);
    setMsg(null);
    setSubindo(f.id);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("funcionarioId", f.id);
      form.append("competencia", competencia);
      const res = await fetch("/api/holerites/upload-manual", {
        method: "POST",
        body: form,
      });
      const j = (await res.json().catch(() => null)) as {
        error?: string;
        acessoCriado?: boolean;
      } | null;
      if (!res.ok) throw new Error(j?.error ?? `Erro ${res.status}`);
      setMsg(
        `Holerite de ${f.nome} enviado.${
          j?.acessoCriado ? " Acesso criado (senha = CPF)." : ""
        }`
      );
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setSubindo(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-bold text-agos-charcoal dark:text-white mb-1">
        Holerites por funcionário
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Veja quem já tem o holerite do mês e envie manualmente os que faltarem.
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium mb-1 text-slate-500">
            Obra
          </label>
          <select
            className="input"
            value={obra}
            onChange={(e) => irPara({ obra: e.target.value })}
          >
            <option value="">Selecione a obra...</option>
            {obras.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-slate-500">
            Competência
          </label>
          <select
            className="input"
            value={competencia}
            onChange={(e) => irPara({ competencia: e.target.value })}
          >
            {competencias.map((c) => (
              <option key={c} value={c}>
                {fmtComp(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {msg && (
        <div className="text-sm text-agos-green-dark dark:text-agos-green mb-3">
          {msg}
        </div>
      )}
      {erro && (
        <div className="text-sm text-red-600 dark:text-red-400 mb-3">{erro}</div>
      )}

      {!obra ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center text-slate-500">
          Selecione uma obra para ver os funcionários.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatCard valor={funcionarios.length} rotulo="Funcionários" />
            <StatCard
              valor={comHolerite}
              rotulo="Com holerite"
              tom="green"
            />
            <StatCard valor={faltando} rotulo="Faltando" tom="amber" />
          </div>

          <input
            className="input w-full max-w-sm mb-3"
            placeholder="Buscar por nome ou matrícula..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-2">Matrícula</th>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Holerite {fmtComp(competencia)}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <td className="px-4 py-2 font-mono">{f.codigo}</td>
                    <td className="px-4 py-2">{f.nome}</td>
                    <td className="px-4 py-2">
                      {f.temHolerite ? (
                        <span className="text-agos-green-dark dark:text-agos-green">
                          ✓ Disponível
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          ✗ Falta
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {f.temHolerite ? (
                        <button
                          onClick={() => ver(f)}
                          disabled={abrindo === f.id}
                          className="text-agos-green-dark dark:text-agos-green font-medium hover:underline disabled:opacity-50"
                        >
                          {abrindo === f.id ? "Abrindo..." : "Ver"}
                        </button>
                      ) : (
                        <>
                          <input
                            ref={(el) => {
                              inputsRef.current[f.id] = el;
                            }}
                            type="file"
                            accept="application/pdf"
                            hidden
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) subir(f, file);
                              e.target.value = "";
                            }}
                          />
                          <button
                            onClick={() => inputsRef.current[f.id]?.click()}
                            disabled={subindo === f.id}
                            className="text-agos-green-dark dark:text-agos-green font-medium hover:underline disabled:opacity-50"
                          >
                            {subindo === f.id ? "Enviando..." : "Subir PDF"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      Nenhum funcionário.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  valor,
  rotulo,
  tom = "neutral",
}: {
  valor: number;
  rotulo: string;
  tom?: "neutral" | "green" | "amber";
}) {
  const cor =
    tom === "green"
      ? "text-agos-green-dark dark:text-agos-green"
      : tom === "amber"
      ? "text-amber-600 dark:text-amber-400"
      : "text-agos-charcoal dark:text-white";
  const ponto =
    tom === "green"
      ? "bg-agos-green"
      : tom === "amber"
      ? "bg-amber-500"
      : "bg-slate-300 dark:bg-slate-600";
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${ponto}`} />
        <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {rotulo}
        </span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${cor}`}>{valor}</div>
    </div>
  );
}
