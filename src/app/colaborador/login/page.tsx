"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ColaboradorLoginPage() {
  const router = useRouter();
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const matr = matricula.replace(/\D/g, "");
    if (!matr || !senha) {
      setErro("Informe a matrícula e a senha.");
      return;
    }
    setEntrando(true);
    try {
      const email = `${matr.padStart(6, "0")}@agos.internal`;
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) {
        setErro("Matrícula ou senha inválida.");
        return;
      }
      router.replace("/colaborador/holerites");
      router.refresh();
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-agos-gray-light dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-agos-charcoal dark:text-white">
            Portal do Colaborador
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            AGOS Serviços — acesse seus holerites
          </p>
        </div>
        <form
          onSubmit={entrar}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Matrícula</label>
            <input
              className="input w-full"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              placeholder="ex.: 8897"
              inputMode="numeric"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <input
              type="password"
              className="input w-full"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          {erro && (
            <div className="text-sm text-red-600 dark:text-red-400">{erro}</div>
          )}
          <button
            type="submit"
            disabled={entrando}
            className="w-full bg-agos-green hover:bg-agos-green-dark disabled:opacity-60 text-white font-semibold rounded-md py-2.5 transition"
          >
            {entrando ? "Entrando..." : "Entrar"}
          </button>
          <p className="text-xs text-slate-400 text-center">
            Primeiro acesso? Use a senha temporária que o RH informou.
          </p>
        </form>
      </div>
    </div>
  );
}
