"use client";

import { useMemo, useState } from "react";
import type { CertificadoEmitido } from "@/lib/certificados/types";
import { gerarCertificadoPdf, nomeArquivoCertificado } from "@/lib/certificados/pdf";

function fmtData(value: string) {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export default function HistoricoClient({
  registros,
  textoFrente,
}: {
  registros: CertificadoEmitido[];
  textoFrente: string | null;
}) {
  const [busca, setBusca] = useState("");
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return registros;
    return registros.filter(
      (r) =>
        r.nome_funcionario.toLowerCase().includes(termo) ||
        r.cpf.includes(termo) ||
        (r.certificados_modelos?.nome_funcao ?? "")
          .toLowerCase()
          .includes(termo)
    );
  }, [registros, busca]);

  async function handleBaixar(registro: CertificadoEmitido) {
    if (!registro.certificados_modelos) return;
    setBaixandoId(registro.id);
    try {
      const dados = {
        nome_funcionario: registro.nome_funcionario,
        cpf: registro.cpf,
        cidade: registro.cidade,
        data_treinamento: registro.data_treinamento,
        data_treinamento_fim: registro.data_treinamento_fim,
      };
      const doc = await gerarCertificadoPdf(
        registro.certificados_modelos,
        dados,
        textoFrente
      );
      doc.save(nomeArquivoCertificado(registro.certificados_modelos, dados));
    } finally {
      setBaixandoId(null);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-agos-charcoal dark:text-white mb-1">
        Histórico de certificados emitidos
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {registros.length} certificado(s) no total.
      </p>

      <input
        className="input w-full max-w-sm mb-4"
        placeholder="Buscar por nome, CPF ou função..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-2">Funcionário</th>
              <th className="px-4 py-2">CPF</th>
              <th className="px-4 py-2">Função</th>
              <th className="px-4 py-2">Data treinamento</th>
              <th className="px-4 py-2">Cidade</th>
              <th className="px-4 py-2">Emitido em</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <td className="px-4 py-2">{r.nome_funcionario}</td>
                <td className="px-4 py-2">{r.cpf}</td>
                <td className="px-4 py-2">
                  {r.certificados_modelos?.nome_funcao ?? "—"}
                </td>
                <td className="px-4 py-2">
                  {fmtData(r.data_treinamento)}
                  {r.data_treinamento_fim
                    ? ` a ${fmtData(r.data_treinamento_fim)}`
                    : ""}
                </td>
                <td className="px-4 py-2">{r.cidade}</td>
                <td className="px-4 py-2 text-slate-400">
                  {new Date(r.emitido_em).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => handleBaixar(r)}
                    disabled={baixandoId === r.id}
                    className="text-agos-green-dark dark:text-agos-green font-medium hover:underline disabled:opacity-50"
                  >
                    {baixandoId === r.id ? "Gerando..." : "Baixar novamente"}
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  Nenhum certificado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
