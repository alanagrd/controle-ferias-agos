"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TrocarSenhaClient() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) {
      setErro("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        setErro("Não foi possível alterar a senha. Tente novamente.");
        return;
      }
      // Marca como definitiva (libera o portal).
      const res = await fetch("/api/colaborador/senha-trocada", {
        method: "POST",
      });
      if (!res.ok) {
        setErro(
          "Senha alterada, mas houve um problema ao liberar o acesso. Recarregue a página."
        );
        return;
      }
      router.replace("/colaborador/holerites");
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-agos-gray-light dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-agos-charcoal dark:text-white">
            Criar nova senha
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            No primeiro acesso, defina uma senha sua.
          </p>
        </div>
        <form
          onSubmit={salvar}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Nova senha</label>
            <input
              type="password"
              className="input w-full"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Confirmar nova senha
            </label>
            <input
              type="password"
              className="input w-full"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
            />
          </div>
          {erro && (
            <div className="text-sm text-red-600 dark:text-red-400">{erro}</div>
          )}
          <button
            type="submit"
            disabled={salvando}
            className="w-full bg-agos-green hover:bg-agos-green-dark disabled:opacity-60 text-white font-semibold rounded-md py-2.5 transition"
          >
            {salvando ? "Salvando..." : "Salvar e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
