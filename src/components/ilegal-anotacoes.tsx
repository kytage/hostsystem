import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  atualizarAnotacaoIlegal,
  comprimirImagem,
  criarAnotacaoIlegal,
  deletarAnotacaoIlegal,
  fetchAnotacoesIlegal,
  type IlegalAnotacao,
  type IlegalAnotacaoInput,
} from "@/lib/ilegal-anotacoes";
import { useRealtimeTable } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { getAuthUserData } from "@/lib/auth-cache";

const VAZIO: IlegalAnotacaoInput = { titulo: "", descricao: "", imagens: [] };

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface EditorProps {
  inicial: IlegalAnotacaoInput;
  titulo: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: IlegalAnotacaoInput) => void;
}

function AnotacaoEditor({ inicial, titulo, saving, onClose, onSave }: EditorProps) {
  const [form, setForm] = useState<IlegalAnotacaoInput>(inicial);
  const [erro, setErro] = useState("");
  const [carregandoImg, setCarregandoImg] = useState(false);

  const addImagens = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCarregandoImg(true);
    setErro("");
    try {
      const novas: string[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        if (!file.type.startsWith("image/")) continue;
        novas.push(await comprimirImagem(file));
      }
      setForm((f) => ({ ...f, imagens: [...f.imagens, ...novas].slice(0, 12) }));
    } catch {
      setErro("Não foi possível processar a imagem.");
    } finally {
      setCarregandoImg(false);
    }
  };

  const submit = () => {
    if (!form.titulo.trim()) {
      setErro("Informe um título.");
      return;
    }
    onSave({
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      imagens: form.imagens,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-6 backdrop-blur-sm">
      <div className="my-auto w-full max-w-2xl rounded-[22px] glass-modal p-6">
        <div className="flex items-start justify-between">
          <h3 className="hc-titulo">{titulo}</h3>
          <button
            onClick={onClose}
            className="hc-seta"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="hc-sobre">Título</label>
            <input
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex.: Ideia de rota nova para lavagem"
              className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-white/30"
            />
          </div>

          <div>
            <label className="hc-sobre">Descrição</label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              rows={7}
              placeholder="Escreva a ideia, detalhes, coordenadas, o que precisa ser ajustado..."
              className="mt-1.5 w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-white/30"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="hc-sobre">
                Fotos ({form.imagens.length})
              </label>
              <label className="hc-pilula cursor-pointer hover:!border-transparent hover:!bg-[var(--gf-tx-1)] hover:!text-[var(--gf-painel)]">
                {carregandoImg ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
                Adicionar
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void addImagens(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {form.imagens.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {form.imagens.map((img, i) => (
                  <div
                    key={i}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.08]"
                  >
                    <img src={img} alt={`Anexo ${i + 1}`} className="size-full object-cover" />
                    <button
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          imagens: f.imagens.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                      aria-label="Remover foto"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {erro && <p className="text-xs font-medium text-primary">{erro}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="pilula rounded-full"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Imagem ampliada"
    >
      <button
        onClick={onClose}
        className="hc-seta !size-9 absolute right-4 top-4 shadow-lg"
        aria-label="Fechar imagem"
      >
        <X className="size-4" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[92vw] rounded-xl border border-white/[0.08] object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function AnotacaoViewer({
  anotacao,
  onClose,
}: {
  anotacao: IlegalAnotacao;
  onClose: () => void;
}) {
  const [ampliada, setAmpliada] = useState<string | null>(null);
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-6 backdrop-blur-sm">
        <div className="my-auto w-full max-w-3xl rounded-[22px] glass-modal p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="hc-titulo">{anotacao.titulo}</h3>
              <p className="hc-nota mt-1">
                {anotacao.criadoPor || "—"} · {formatarData(anotacao.updatedAt)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="hc-seta"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>

          {anotacao.descricao && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {anotacao.descricao}
            </p>
          )}

          {anotacao.imagens.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {anotacao.imagens.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setAmpliada(img)}
                  className="hc-dentro group overflow-hidden text-left transition-colors"
                  aria-label={`Ampliar foto ${i + 1}`}
                >
                  <img
                    src={img}
                    alt={`${anotacao.titulo} — foto ${i + 1}`}
                    loading="lazy"
                    className="w-full object-contain transition-transform group-hover:scale-[1.02]"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {ampliada && (
        <ImageLightbox
          src={ampliada}
          alt={`${anotacao.titulo} — imagem ampliada`}
          onClose={() => setAmpliada(null)}
        />
      )}
    </>
  );
}

export function IlegalAnotacoes() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<IlegalAnotacao | null>(null);
  const [vendo, setVendo] = useState<IlegalAnotacao | null>(null);

  useRealtimeTable("ilegal_anotacoes", [["ilegal-anotacoes"]]);

  const { data: me } = useQuery({
    queryKey: ["my-username"],
    queryFn: async () => {
      const auth = await getAuthUserData();
      if (!auth.user) return { id: "", username: "" };
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", auth.user.id)
        .maybeSingle();
      return { id: auth.user.id, username: data?.username ?? "" };
    },
  });

  const { data: anotacoes = [], isLoading } = useQuery({
    queryKey: ["ilegal-anotacoes"],
    queryFn: fetchAnotacoesIlegal,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["ilegal-anotacoes"] });

  const criar = useMutation({
    mutationFn: (input: IlegalAnotacaoInput) =>
      criarAnotacaoIlegal(input, { username: me?.username ?? "", id: me?.id ?? "" }),
    onSuccess: () => {
      invalidate();
      setCriando(false);
    },
  });

  const atualizar = useMutation({
    mutationFn: ({ id, input }: { id: string; input: IlegalAnotacaoInput }) =>
      atualizarAnotacaoIlegal(id, input),
    onSuccess: () => {
      invalidate();
      setEditando(null);
    },
  });

  const remover = useMutation({
    mutationFn: deletarAnotacaoIlegal,
    onSuccess: invalidate,
  });

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return anotacoes;
    return anotacoes.filter((a) =>
      `${a.titulo} ${a.descricao} ${a.criadoPor}`.toLowerCase().includes(q)
    );
  }, [anotacoes, busca]);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="campo-busca w-64">
          <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar anotação..."
            aria-label="Buscar anotação"
          />
        </label>
        <button
          onClick={() => setCriando(true)}
          className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> Nova anotação
        </button>
      </div>

      {isLoading ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando anotações...
        </div>
      ) : visiveis.length === 0 ? (
        <div className="mt-6 rounded-[22px] border border-dashed border-white/[0.1] p-12 text-center">
          <StickyNote className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {busca ? "Nenhuma anotação encontrada." : "Nenhuma anotação por aqui."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crie um bloco com título, descrição e fotos para salvar ideias da equipe.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((a) => (
            <article
              key={a.id}
              onClick={() => setVendo(a)}
              className={cn(
                "glass hc group cursor-pointer p-5 transition-colors hover:!border-white/[0.14]"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="hc-titulo line-clamp-2">
                  {a.titulo}
                </h3>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditando(a);
                    }}
                    className="hc-seta !size-7"
                    aria-label="Editar anotação"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Apagar a anotação "${a.titulo}"?`)) remover.mutate(a.id);
                    }}
                    className="hc-seta !size-7 hover:!border-destructive/30 hover:!bg-destructive/15 hover:!text-destructive"
                    aria-label="Apagar anotação"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {a.descricao && (
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {a.descricao}
                </p>
              )}

              {a.imagens.length > 0 && (
                <div className="mt-3 flex gap-1.5">
                  {a.imagens.slice(0, 3).map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`${a.titulo} — miniatura ${i + 1}`}
                      loading="lazy"
                      className="size-14 rounded-lg border border-white/[0.08] object-cover"
                    />
                  ))}
                  {a.imagens.length > 3 && (
                    <span className="hc-dentro flex size-14 items-center justify-center !rounded-lg text-xs font-semibold text-muted-foreground">
                      +{a.imagens.length - 3}
                    </span>
                  )}
                </div>
              )}

              <p className="mt-3 text-[11px] text-ink-3">
                {a.criadoPor || "—"} · {formatarData(a.updatedAt)}
              </p>
            </article>
          ))}
        </div>
      )}

      {criando && (
        <AnotacaoEditor
          inicial={VAZIO}
          titulo="Nova anotação"
          saving={criar.isPending}
          onClose={() => setCriando(false)}
          onSave={(input) => criar.mutate(input)}
        />
      )}

      {editando && (
        <AnotacaoEditor
          inicial={{
            titulo: editando.titulo,
            descricao: editando.descricao,
            imagens: editando.imagens,
          }}
          titulo="Editar anotação"
          saving={atualizar.isPending}
          onClose={() => setEditando(null)}
          onSave={(input) => atualizar.mutate({ id: editando.id, input })}
        />
      )}

      {vendo && <AnotacaoViewer anotacao={vendo} onClose={() => setVendo(null)} />}
    </section>
  );
}
