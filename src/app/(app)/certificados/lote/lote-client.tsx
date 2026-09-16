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
  const [tipoSel, setTipoSel] = useState("");
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

  const tipos = useMemo(
    () =>
      Array.from(new Set(modelos.map((m) => m.norma))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [modelos]
  );
  const funcoesDoTipo = useMemo(
    () =>
      modelos
        .filter((m) => m.norma === tipoSel)
        .sort((a, b) => a.nome_funcao.localeCompare(b.nome_funcao, "pt-BR")),
    [modelos, tipoSel]
  );
  const docTipo = modelo?.doc_tipo === "RG" ? "RG" : "CPF";

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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Tipo de certificado
            </label>
            <select
              className="input w-full"
              value={tipoSel}
              onChange={(e) => {
                setTipoSel(e.target.value);
                setModeloId("");
              }}
              required
            >
              <option value="">Selecione...</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Função / curso
            </label>
            <select
              className="input w-full"
              value={modeloId}
              onChange={(e) => setModeloId(e.target.value)}
              required
              disabled={!tipoSel}
            >
              <option value="">
                {tipoSel ? "Selecione..." : "Escolha o tipo primeiro"}
              </option>
              {funcoesDoTipo.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome_funcao}
                  {m.tipo === "periodico" ? " (Periódico)" : ""}
                </option>
              ))}
            </select>
          </div>
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
                  placeholder={docTipo}
                  inputMode={docTipo === "CPF" ? "numeric" : "text"}
                  maxLength={docTipo === "CPF" ? 14 : 20}
                  value={linha.cpf}
                  onChange={(e) =>
                    atualizarLinha(
                      i,
                      "cpf",
                      docTipo === "CPF" ? formatCpf(e.target.value) : e.target.value
                    )
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
