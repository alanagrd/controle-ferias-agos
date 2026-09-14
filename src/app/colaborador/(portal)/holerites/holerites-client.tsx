"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type HoleriteItem = {
  id: string;
  competencia: string; // AAAA-MM-01
  liquido: number | null;
  obra: string | null;
  storage_path: string;
};

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function rotuloCompetencia(iso: string): string {
  const [ano, mes] = iso.split("-").map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

export default function ColaboradorHoleritesClient({
  holerites,
}: {
  holerites: HoleriteItem[];
}) {
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir(h: HoleriteItem) {
    setErro(null);
    setAbrindo(h.id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("holerites")
        .createSignedUrl(h.storage_path, 120);
      if (error || !data?.signedUrl) {
        setErro("Não foi possível abrir o holerite. Tente novamente.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener");
    } finally {
      setAbrindo(null);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-agos-charcoal dark:text-white mb-1">
        Meus holerites
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        {holerites.length} holerite(s) disponível(is).
      </p>

      {erro && (
        <div className="text-sm text-red-600 dark:text-red-400 mb-3">{erro}</div>
      )}

      {holerites.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center text-slate-500">
          Nenhum holerite disponível ainda.
        </div>
      ) : (
        <ul className="space-y-2">
          {holerites.map((h) => (
            <li
              key={h.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-semibold text-agos-charcoal dark:text-white capitalize">
                  {rotuloCompetencia(h.competencia)}
                </div>
                {h.obra && (
                  <div className="text-xs text-slate-400">{h.obra}</div>
                )}
              </div>
              <button
                onClick={() => abrir(h)}
                disabled={abrindo === h.id}
                className="text-sm bg-agos-green hover:bg-agos-green-dark disabled:opacity-60 text-white font-semibold rounded-md px-4 py-2"
              >
                {abrindo === h.id ? "Abrindo..." : "Abrir PDF"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
