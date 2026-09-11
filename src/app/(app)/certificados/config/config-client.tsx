"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_TEXTO_FRENTE,
  MARCADORES_FRENTE,
} from "@/lib/certificados/pdf";

const DESCRICAO_MARCADOR: Record<string, string> = {
  nome: "nome do funcionário (negrito)",
  cpf: "CPF digitado (negrito)",
  data: "data ou período do treinamento (negrito)",
  cidade: "cidade digitada (negrito)",
  curso: "nome do curso (do modelo)",
  carga: "carga horária (do modelo)",
  normas: "normas aplicáveis (do modelo)",
};

export default function ConfigClient({
  textoInicial,
}: {
  textoInicial: string;
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    setSucesso(null);
    if (!texto.trim()) {
      setErro("O texto não pode ficar vazio.");
      return;
    }
    setSalvando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("certificados_config")
        .update({ texto_frente: texto.trim(), updated_at: new Date().toISOString() })
        .eq("id", "default");
      if (error) throw error;
      setSucesso("Texto salvo. Os próximos certificados já usam a nova versão.");
    } catch (err) {
      console.error(err);
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold text-agos-charcoal dark:text-white mb-1">
        Configuração — texto do certificado
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Este é o texto da frente do certificado (a frase &ldquo;Certificamos
        que…&rdquo;). Vale para todos os modelos. Use os marcadores abaixo — eles
        são substituídos na hora de gerar o PDF.
      </p>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Texto da frente
          </label>
          <textarea
            className="input w-full font-mono text-xs"
            rows={9}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 bg-agos-gray-light dark:bg-slate-800 rounded-md p-3">
          <div className="font-semibold mb-1">Marcadores disponíveis:</div>
          <ul className="space-y-0.5">
            {MARCADORES_FRENTE.map((m) => (
              <li key={m}>
                <code>{`{${m}}`}</code> — {DESCRICAO_MARCADOR[m] ?? m}
              </li>
            ))}
          </ul>
        </div>

        {erro && (
          <div className="text-sm text-red-600 dark:text-red-400">{erro}</div>
        )}
        {sucesso && (
          <div className="text-sm text-agos-green-dark dark:text-agos-green">
            {sucesso}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={salvar}
            disabled={salvando}
            className="bg-agos-green hover:bg-agos-green-dark disabled:opacity-60 text-white font-semibold rounded-md px-5 py-2 text-sm transition"
          >
            {salvando ? "Salvando..." : "Salvar texto"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTexto(DEFAULT_TEXTO_FRENTE);
              setSucesso(null);
              setErro(null);
            }}
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Restaurar texto padrão
          </button>
        </div>
      </div>
    </div>
  );
}
