"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CertificadoModelo } from "@/lib/certificados/types";
import { gerarCertificadoPdf, nomeArquivoCertificado } from "@/lib/certificados/pdf";
import { formatCpf } from "@/lib/certificados/cpf";

type Linha = { nome: string; cpf: string };

export default function LoteClient({
  modelos,
  textoFrente,
}: {
  modelos: CertificadoModelo[];
  textoFrente: string | null;
}) {
  const [modeloId, setModeloId] = useState("");
  const [cidade, setCidade] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([
    { nome: "", cpf: "" },
    { nome: "", cpf: "" },
  ]);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const modelo = useMemo(
    () => modelos.find((m) => m.id === modeloId) ?? null,
    [modeloId, modelos]
  );

  const porNorma = useMemo(() => {
    const grupos: Record<string, CertificadoModelo[]> = {};
    for (const m of modelos) {
      grupos[m.norma] = grupos[m.norma] ?? [];
      grupos[m.norma].push(m);
    }
    return grupos;
  }, [modelos]);

  function atualizarLinha(i: number, campo: keyof Linha, valor: string) {
    setLinhas((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l))
    );
  }

  function addLinha() {
    setLinhas((prev) => [...prev, { nome: "", cpf: "" }]);
  }

  function removerLinha(i: number) {
    setLinhas((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleGerar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const validas = linhas.filter((l) => l.nome.trim() && l.cpf.trim());

    if (!modelo) {
      setErro("Selecione a função / modelo do certificado.");
      return;
    }
    if (!cidade.trim() || !dataInicio) {
      setErro("Preencha cidade e data do treinamento.");
      return;
    }
    if (validas.length === 0) {
      setErro("Adicione ao menos um funcionário com nome e CPF.");
      return;
    }

    setGerando(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const supabase = createClient();
      const registros = [];

      for (let i = 0; i < validas.length; i++) {
        const linha = validas[i];
        setProgresso(`Gerando ${i + 1} de ${validas.length}...`);
        const dados = {
          nome_funcionario: linha.nome.trim().toUpperCase(),
          cpf: linha.cpf.trim(),
          cidade: cidade.trim(),
          data_treinamento: dataInicio,
          data_treinamento_fim: dataFim || null,
        };
        const doc = await gerarCertificadoPdf(modelo, dados, textoFrente);
        const blob = doc.output("blob");
        zip.file(nomeArquivoCertificado(modelo, dados), blob);
        registros.push({
          modelo_id: modelo.id,
          nome_funcionario: dados.nome_funcionario,
          cpf: dados.cpf,
          cidade: dados.cidade,
          data_treinamento: dados.data_treinamento,
          data_treinamento_fim: dados.data_treinamento_fim,
        });
      }

      setProgresso("Compactando arquivos...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Certificados - ${modelo.nome_funcao} - ${dataInicio}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      const { error } = await supabase
        .from("certificados_emitidos")
        .insert(registros);
      if (error) throw error;

      setSucesso(
        `${validas.length} certificado(s) gerado(s) e registrado(s) no histórico.`
      );
      setLinhas([
        { nome: "", cpf: "" },
        { nome: "", cpf: "" },
      ]);
    } catch (err) {
      console.error(err);
      setErro("Não foi possível gerar os certificados. Tente novamente.");
    } finally {
      setGerando(false);
      setProgresso("");
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold text-agos-charcoal dark:text-white mb-1">
        Emitir certificados em lote
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Mesma turma, mesma data e cidade — adicione um funcionário por linha.
      </p>

      <form
        onSubmit={handleGerar}
        className="space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            Função / curso
          </label>
          <select
            className="input w-full"
            value={modeloId}
            onChange={(e) => setModeloId(e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {Object.entries(porNorma).map(([norma, lista]) => (
              <optgroup key={norma} label={norma}>
                {lista.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome_funcao}
                    {m.tipo === "periodico" ? " (Periódico)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {modelo && (
          <div className="text-xs text-slate-500 dark:text-slate-400 bg-agos-gray-light dark:bg-slate-800 rounded-md p-3">
            <span className="font-semibold">Carga horária:</span>{" "}
            {modelo.carga_horaria}h (fixa) ·{" "}
            <span className="font-semibold">Normas:</span>{" "}
            {modelo.normas_aplicaveis}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Cidade</label>
            <input
              className="input w-full"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="São Bernardo do Campo - SP"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Data do treinamento
            </label>
            <input
              type="date"
              className="input w-full"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Data final (opcional)
            </label>
            <input
              type="date"
              className="input w-full"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Funcionários da turma
          </label>
          <div className="space-y-2">
            {linhas.map((linha, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_11rem_auto] gap-2 items-center"
              >
                <input
                  className="input"
                  placeholder="Nome completo"
                  value={linha.nome}
                  onChange={(e) => atualizarLinha(i, "nome", e.target.value)}
                />
                <input
                  className="input"
                  placeholder="CPF"
                  inputMode="numeric"
                  maxLength={14}
                  value={linha.cpf}
                  onChange={(e) =>
                    atualizarLinha(i, "cpf", formatCpf(e.target.value))
                  }
                />
                <button
                  type="button"
                  onClick={() => removerLinha(i)}
                  className="px-2 text-slate-400 hover:text-red-600"
                  aria-label="Remover linha"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLinha}
            className="mt-2 text-sm text-agos-green-dark dark:text-agos-green font-medium hover:underline"
          >
            + adicionar funcionário
          </button>
        </div>

        {erro && (
          <div className="text-sm text-red-600 dark:text-red-400">{erro}</div>
        )}
        {sucesso && (
          <div className="text-sm text-agos-green-dark dark:text-agos-green">
            {sucesso}
          </div>
        )}

        <button
          type="submit"
          disabled={gerando}
          className="w-full bg-agos-green hover:bg-agos-green-dark disabled:opacity-60 text-white font-semibold rounded-md py-2.5 transition"
        >
          {gerando ? progresso || "Gerando..." : "Gerar certificados (ZIP)"}
        </button>
      </form>
    </div>
  );
}
