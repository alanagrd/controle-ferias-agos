"use client";

import { useMemo, useState } from "react";

export type AcessoRow = {
  funcionarioId: string;
  nome: string;
  codigo: string;
  senhaTemporaria: boolean;
  ultimoAcesso: string | null;
  temCpf: boolean;
};

export default function AcessosClient({
  acessos,
}: {
  acessos: AcessoRow[];
}) {
  const [rows, setRows] = useState(acessos);
  const [busca, setBusca] = useState("");
  const [resetandoId, setResetandoId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) => r.nome.toLowerCase().includes(t) || r.codigo.includes(t)
    );
  }, [rows, busca]);

  async function resetar(r: AcessoRow) {
    if (
      !confirm(
        `Resetar a senha de ${r.nome} para o CPF (só números)? Ele terá que criar uma nova senha no próximo acesso.`
      )
    )
      return;
    setErro(null);
    setMsg(null);
    setResetandoId(r.funcionarioId);
    try {
      const res = await fetch("/api/holerites/reset-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcionarioId: r.funcionarioId }),
      });
      const j = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) throw new Error(j?.error ?? `Erro ${res.status}`);
      setRows((prev) =>
        prev.map((x) =>
          x.funcionarioId === r.funcionarioId
            ? { ...x, senhaTemporaria: true }
            : x
        )
      );
      setMsg(`Senha de ${r.nome} resetada para o CPF.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao resetar.");
    } finally {
      setResetandoId(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-bold text-agos-charcoal dark:text-white mb-1">
        Acessos do portal
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {rows.length} colaborador(es) com acesso. A senha inicial é o CPF; ao
        resetar, ela volta a ser o CPF e a troca é exigida no próximo acesso.
      </p>

      <input
        className="input w-full max-w-sm mb-4"
        placeholder="Buscar por nome ou matrícula..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {msg && (
        <div className="text-sm text-agos-green-dark dark:text-agos-green mb-3">
          {msg}
        </div>
      )}
      {erro && (
        <div className="text-sm text-red-600 dark:text-red-400 mb-3">{erro}</div>
      )}

      <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-2">Matrícula</th>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Situação da senha</th>
              <th className="px-4 py-2">Último acesso</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((r) => (
              <tr
                key={r.funcionarioId}
                className="border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <td className="px-4 py-2 font-mono">{r.codigo}</td>
                <td className="px-4 py-2">{r.nome}</td>
                <td className="px-4 py-2">
                  {r.senhaTemporaria ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      senha padrão (CPF)
                    </span>
                  ) : (
                    <span className="text-agos-green-dark dark:text-agos-green">
                      definida pelo colaborador
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-400">
                  {r.ultimoAcesso
                    ? new Date(r.ultimoAcesso).toLocaleString("pt-BR")
                    : "nunca"}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => resetar(r)}
                    disabled={resetandoId === r.funcionarioId || !r.temCpf}
                    title={
                      r.temCpf
                        ? "Resetar senha para o CPF"
                        : "CPF não disponível — reimporte um holerite desta pessoa"
                    }
                    className="text-agos-green-dark dark:text-agos-green font-medium hover:underline disabled:opacity-40 disabled:no-underline"
                  >
                    {resetandoId === r.funcionarioId
                      ? "Resetando..."
                      : "Resetar senha"}
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nenhum acesso encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
