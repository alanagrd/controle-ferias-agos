"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CertificadoModelo,
  NormaCertificado,
  TipoTreinamento,
} from "@/lib/certificados/types";

type FormState = {
  id: string | null;
  norma: NormaCertificado;
  nome_funcao: string;
  nome_curso: string;
  normas_aplicaveis: string;
  carga_horaria: string;
  tipo: TipoTreinamento;
  conteudo_programatico: string;
  ativo: boolean;
};

const FORM_VAZIO: FormState = {
  id: null,
  norma: "NR12",
  nome_funcao: "",
  nome_curso: "",
  normas_aplicaveis: "NR 12",
  carga_horaria: "8",
  tipo: "inicial",
  conteudo_programatico: "",
  ativo: true,
};

export default function ModelosClient({
  modelosIniciais,
}: {
  modelosIniciais: CertificadoModelo[];
}) {
  const [modelos, setModelos] = useState(modelosIniciais);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<FormState | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return modelos;
    return modelos.filter(
      (m) =>
        m.nome_funcao.toLowerCase().includes(termo) ||
        m.nome_curso.toLowerCase().includes(termo)
    );
  }, [modelos, busca]);

  function abrirNovo() {
    setErro(null);
    setEditando({ ...FORM_VAZIO });
  }

  function abrirEdicao(m: CertificadoModelo) {
    setErro(null);
    setEditando({
      id: m.id,
      norma: m.norma,
      nome_funcao: m.nome_funcao,
      nome_curso: m.nome_curso,
      normas_aplicaveis: m.normas_aplicaveis,
      carga_horaria: String(m.carga_horaria),
      tipo: m.tipo,
      conteudo_programatico: m.conteudo_programatico,
      ativo: m.ativo,
    });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setErro(null);

    const carga = parseInt(editando.carga_horaria, 10);
    if (
      !editando.nome_funcao.trim() ||
      !editando.nome_curso.trim() ||
      !editando.normas_aplicaveis.trim() ||
      !editando.conteudo_programatico.trim() ||
      !carga
    ) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }

    setSalvando(true);
    try {
      const supabase = createClient();
      const payload = {
        norma: editando.norma,
        nome_funcao: editando.nome_funcao.trim(),
        nome_curso: editando.nome_curso.trim(),
        normas_aplicaveis: editando.normas_aplicaveis.trim(),
        carga_horaria: carga,
        tipo: editando.tipo,
        conteudo_programatico: editando.conteudo_programatico.trim(),
        ativo: editando.ativo,
      };

      if (editando.id) {
        const { data, error } = await supabase
          .from("certificados_modelos")
          .update(payload)
          .eq("id", editando.id)
          .select()
          .single();
        if (error) throw error;
        setModelos((prev) =>
          prev.map((m) => (m.id === editando.id ? (data as CertificadoModelo) : m))
        );
      } else {
        const { data, error } = await supabase
          .from("certificados_modelos")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setModelos((prev) => [...prev, data as CertificadoModelo]);
      }

      setEditando(null);
    } catch (err) {
      console.error(err);
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-agos-charcoal dark:text-white mb-1">
            Funções / Modelos de certificado
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {modelos.length} modelo(s) cadastrado(s).
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="bg-agos-green hover:bg-agos-green-dark text-white font-semibold rounded-md px-4 py-2 text-sm transition"
        >
          + Novo modelo
        </button>
      </div>

      <input
        className="input w-full max-w-sm mb-4"
        placeholder="Buscar função ou curso..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-2">Norma</th>
              <th className="px-4 py-2">Função</th>
              <th className="px-4 py-2">Carga horária</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((m) => (
              <tr
                key={m.id}
                className="border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <td className="px-4 py-2">{m.norma}</td>
                <td className="px-4 py-2">{m.nome_funcao}</td>
                <td className="px-4 py-2">{m.carga_horaria}h</td>
                <td className="px-4 py-2">
                  {m.tipo === "periodico" ? "Periódico" : "Inicial"}
                </td>
                <td className="px-4 py-2">
                  {m.ativo ? (
                    <span className="text-agos-green-dark dark:text-agos-green">
                      Ativo
                    </span>
                  ) : (
                    <span className="text-slate-400">Inativo</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => abrirEdicao(m)}
                    className="text-agos-green-dark dark:text-agos-green font-medium hover:underline"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum modelo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center overflow-y-auto py-10 z-20">
          <form
            onSubmit={salvar}
            className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-agos-charcoal dark:text-white">
              {editando.id ? "Editar modelo" : "Novo modelo"}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Norma</label>
                <select
                  className="input w-full"
                  value={editando.norma}
                  onChange={(e) =>
                    setEditando({
                      ...editando,
                      norma: e.target.value as NormaCertificado,
                    })
                  }
                >
                  <option value="NR12">NR12</option>
                  <option value="NR35">NR35</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  className="input w-full"
                  value={editando.tipo}
                  onChange={(e) =>
                    setEditando({
                      ...editando,
                      tipo: e.target.value as TipoTreinamento,
                    })
                  }
                >
                  <option value="inicial">Inicial</option>
                  <option value="periodico">Periódico (reciclagem)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Nome da função (aparece no dropdown de emissão)
              </label>
              <input
                className="input w-full"
                value={editando.nome_funcao}
                onChange={(e) =>
                  setEditando({ ...editando, nome_funcao: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Nome do curso (frase usada no corpo do certificado)
              </label>
              <input
                className="input w-full"
                value={editando.nome_curso}
                onChange={(e) =>
                  setEditando({ ...editando, nome_curso: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Normas aplicáveis (texto da cláusula &ldquo;em conformidade com...&rdquo;)
                </label>
                <input
                  className="input w-full"
                  value={editando.normas_aplicaveis}
                  onChange={(e) =>
                    setEditando({
                      ...editando,
                      normas_aplicaveis: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Carga horária (fixa, em horas)
                </label>
                <input
                  type="number"
                  min={1}
                  className="input w-full"
                  value={editando.carga_horaria}
                  onChange={(e) =>
                    setEditando({
                      ...editando,
                      carga_horaria: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Conteúdo programático (texto do verso)
              </label>
              <textarea
                className="input w-full font-mono text-xs"
                rows={10}
                value={editando.conteudo_programatico}
                onChange={(e) =>
                  setEditando({
                    ...editando,
                    conteudo_programatico: e.target.value,
                  })
                }
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editando.ativo}
                onChange={(e) =>
                  setEditando({ ...editando, ativo: e.target.checked })
                }
              />
              Ativo (aparece na lista de emissão)
            </label>

            {erro && <div className="text-sm text-red-600">{erro}</div>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="bg-agos-green hover:bg-agos-green-dark disabled:opacity-60 text-white font-semibold rounded-md px-5 py-2 text-sm transition"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
