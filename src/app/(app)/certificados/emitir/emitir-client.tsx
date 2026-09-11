"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CertificadoModelo } from "@/lib/certificados/types";
import { gerarCertificadoPdf, nomeArquivoCertificado } from "@/lib/certificados/pdf";
import { formatCpf } from "@/lib/certificados/cpf";

/** Soma `dias` a uma data "YYYY-MM-DD" e devolve no mesmo formato,
 *  construindo em horário local para não escorregar de dia por fuso. */
function addDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dias);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function EmitirClient({
  modelos,
}: {
  modelos: CertificadoModelo[];
}) {
  const [modeloId, setModeloId] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [cidade, setCidade] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tambemNr35, setTambemNr35] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const modelo = useMemo(
    () => modelos.find((m) => m.id === modeloId) ?? null,
    [modeloId, modelos]
  );

  // Único modelo NR35 do sistema ("Trabalho em Altura") — usado no emitir-junto.
  const modeloNr35 = useMemo(
    () => modelos.find((m) => m.norma === "NR35") ?? null,
    [modelos]
  );

  const porNorma = useMemo(() => {
    const grupos: Record<string, CertificadoModelo[]> = {};
    for (const m of modelos) {
      grupos[m.norma] = grupos[m.norma] ?? [];
      grupos[m.norma].push(m);
    }
    return grupos;
  }, [modelos]);

  async function handleGerar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!modelo) {
      setErro("Selecione a função / modelo do certificado.");
      return;
    }
    if (!nome.trim() || !cpf.trim() || !cidade.trim() || !dataInicio) {
      setErro("Preencha nome, CPF, cidade e data do treinamento.");
      return;
    }

    // Emite o modelo escolhido e, opcionalmente, também o NR35 para a mesma
    // pessoa (mesmos dados) — atalho comum para operador de máquina que também
    // faz Trabalho em Altura.
    const aEmitir: CertificadoModelo[] = [modelo];
    if (tambemNr35 && modelo.norma === "NR12") {
      if (!modeloNr35) {
        setErro("Modelo NR35 (Trabalho em Altura) não encontrado.");
        return;
      }
      aEmitir.push(modeloNr35);
    }

    setGerando(true);
    try {
      const base = {
        nome_funcionario: nome.trim().toUpperCase(),
        cpf: cpf.trim(),
        cidade: cidade.trim(),
      };
      // Datas por modelo: o NR35 emitido junto acontece sempre 1 dia após o
      // término do NR12 (dia único), então sua data é derivada, não a mesma.
      const dadosDoModelo = (m: CertificadoModelo) => {
        if (m.norma === "NR35" && modelo.norma === "NR12") {
          return {
            ...base,
            data_treinamento: addDiasIso(dataFim || dataInicio, 1),
            data_treinamento_fim: null,
          };
        }
        return {
          ...base,
          data_treinamento: dataInicio,
          data_treinamento_fim: dataFim || null,
        };
      };

      const gerados: { doc: Awaited<ReturnType<typeof gerarCertificadoPdf>>; nome: string }[] = [];
      const registros = [];
      for (const m of aEmitir) {
        const dados = dadosDoModelo(m);
        const doc = await gerarCertificadoPdf(m, dados);
        gerados.push({ doc, nome: nomeArquivoCertificado(m, dados) });
        registros.push({
          modelo_id: m.id,
          nome_funcionario: dados.nome_funcionario,
          cpf: dados.cpf,
          cidade: dados.cidade,
          data_treinamento: dados.data_treinamento,
          data_treinamento_fim: dados.data_treinamento_fim,
        });
      }
      // Salva um a um; um pequeno intervalo evita que o navegador bloqueie o
      // segundo download quando são dois certificados.
      for (let i = 0; i < gerados.length; i++) {
        gerados[i].doc.save(gerados[i].nome);
        if (i < gerados.length - 1)
          await new Promise((r) => setTimeout(r, 700));
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("certificados_emitidos")
        .insert(registros);
      if (error) throw error;

      setSucesso(
        aEmitir.length > 1
          ? `${aEmitir.length} certificados gerados (NR12 + NR35) e registrados no histórico.`
          : "Certificado gerado e registrado no histórico."
      );
      setNome("");
      setCpf("");
      setDataInicio("");
      setDataFim("");
      setTambemNr35(false);
    } catch (err) {
      console.error(err);
      setErro("Não foi possível gerar o certificado. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-agos-charcoal dark:text-white mb-1">
        Emitir certificado
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Escolha a função do treinamento e preencha os dados do funcionário.
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
            <div>
              <span className="font-semibold">Curso:</span> {modelo.nome_curso}
            </div>
            <div>
              <span className="font-semibold">Carga horária:</span>{" "}
              {modelo.carga_horaria}h (fixa)
            </div>
            <div>
              <span className="font-semibold">Normas:</span>{" "}
              {modelo.normas_aplicaveis}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Nome do funcionário
          </label>
          <input
            className="input w-full"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome completo"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">CPF</label>
            <input
              className="input w-full"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={14}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Cidade (da obra/treinamento)
            </label>
            <input
              className="input w-full"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="São Bernardo do Campo - SP"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
              Data final (só se o treinamento durou mais de 1 dia)
            </label>
            <input
              type="date"
              className="input w-full"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
        </div>

        {modelo?.norma === "NR12" && modeloNr35 && (
          <label className="flex items-start gap-2 text-sm bg-agos-gray-light dark:bg-slate-800 rounded-md p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={tambemNr35}
              onChange={(e) => setTambemNr35(e.target.checked)}
            />
            <span>
              Emitir também o <strong>NR35 – Trabalho em Altura</strong> para
              esta pessoa. A data do NR35 é <strong>1 dia após</strong> o
              término do NR12. Serão gerados dois PDFs.
            </span>
          </label>
        )}

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
          {gerando
            ? "Gerando..."
            : tambemNr35 && modelo?.norma === "NR12"
            ? "Gerar certificados (NR12 + NR35)"
            : "Gerar certificado (PDF)"}
        </button>
      </form>
    </div>
  );
}
