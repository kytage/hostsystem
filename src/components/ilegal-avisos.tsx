import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCheck,
  Loader2,
  Megaphone,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fmtDataHora } from "@/lib/kanban";
import {
  confirmarIlegalAviso,
  criarIlegalAviso,
  excluirIlegalAviso,
  fetchIlegalAvisos,
  removerConfirmacaoIlegal,
} from "@/lib/ilegal-avisos";
import { useRealtimeTable } from "@/lib/realtime";
import { ROLE_ORDER, useCanEditIlegal, useMyRole } from "@/lib/permissions";
import { getAuthUserData } from "@/lib/auth-cache";

function useMe() {
  return useQuery({
    // Esta identidade inclui `id`; não pode compartilhar cache com a sidebar,
    // cuja query `my-username` retorna apenas dados de apresentação.
    queryKey: ["my-aviso-confirmation-identity"],
    queryFn: async () => {
      const auth = await getAuthUserData();
      // Nunca cachear identidade vazia: sem isso, um load antes da sessão
      // hidratar deixava `me.id` vazio e os avisos voltavam a "não confirmado".
      if (!auth.user) throw new Error("Sessão não disponível.");
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", auth.user.id)
        .maybeSingle();
      return { id: auth.user.id, username: data?.username ?? "" };
    },
    staleTime: 60_000,
    retry: 3,
    retryDelay: 500,
  });
}


/**
 * Avisos do Ilegal — fixados no topo do painel para que toda a área
 * confirme a leitura. Apenas Coordinator+ publica.
 */
export function IlegalAvisos() {
  const queryClient = useQueryClient();
  const { data: avisos = [], isLoading } = useQuery({
    queryKey: ["ilegal-avisos"],
    queryFn: fetchIlegalAvisos,
  });
  const { data: me } = useMe();
  const { data: role } = useMyRole();
  const podeEditarIlegal = useCanEditIlegal();

  useRealtimeTable("ilegal_avisos", [["ilegal-avisos"]]);
  useRealtimeTable("ilegal_aviso_confirmacoes", [["ilegal-avisos"]]);

  const podeCriar =
    podeEditarIlegal ||
    ROLE_ORDER.indexOf(role ?? "staff") <= ROLE_ORDER.indexOf("coordinator");

  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["ilegal-avisos"] });

  const criar = useMutation({
    mutationFn: () =>
      criarIlegalAviso({
        titulo: titulo.trim(),
        texto: texto.trim(),
        criadoPor: me?.username ?? "",
      }),
    onSuccess: () => {
      toast.success("Aviso publicado para a área Ilegal.");
      setTitulo("");
      setTexto("");
      setAberto(false);
      invalidate();
    },
    onError: () => toast.error("Erro ao publicar aviso."),
  });

  const excluir = useMutation({
    mutationFn: excluirIlegalAviso,
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao remover aviso."),
  });

  const confirmar = useMutation({
    mutationFn: (id: string) => confirmarIlegalAviso(id, me?.username ?? ""),
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao confirmar aviso."),
  });

  const desconfirmar = useMutation({
    mutationFn: removerConfirmacaoIlegal,
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao remover confirmação."),
  });

  const naoConfirmados = avisos.filter(
    (a) => !a.confirmacoes.some((c) => c.userId === me?.id)
  ).length;

  return (
    <section className="glass hc p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="hc-icone">
            <Megaphone className="size-4" strokeWidth={1.75} />
          </span>
          <h2 className="hc-titulo">Avisos Ilegal</h2>
          {naoConfirmados > 0 && (
            <span className="hc-estado tabular-nums">
              <i aria-hidden />
              {naoConfirmados} a confirmar
            </span>
          )}
        </div>
        {podeCriar && (
          <button
            onClick={() => setAberto((v) => !v)}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
          >
            {aberto ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {aberto ? "Cancelar" : "Novo aviso"}
          </button>
        )}
      </header>

      {podeCriar && aberto && (
        <div className="hc-dentro mt-4 p-4">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título do aviso"
            maxLength={120}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-white/30"
          />
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Descrição do aviso..."
            rows={3}
            className="mt-2.5 w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-white/30"
          />
          <div className="mt-2.5 flex justify-end">
            <button
              onClick={() => criar.mutate()}
              disabled={!titulo.trim() || criar.isPending}
              className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {criar.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Publicar
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {isLoading && (
          <p className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Carregando avisos...
          </p>
        )}
        {!isLoading && avisos.length === 0 && (
          <p className="rounded-[14px] border border-dashed border-white/[0.1] px-4 py-4 text-center text-xs text-muted-foreground">
            Nenhum aviso publicado para a área Ilegal.
          </p>
        )}
        {avisos.map((a) => {
          const confirmado = a.confirmacoes.some((c) => c.userId === me?.id);
          return (
            <article
              key={a.id}
              className={cn(
                "hc-dentro p-4 transition-colors",
                !confirmado && "!border-primary/40 !bg-primary/5"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{a.titulo}</h3>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {a.criadoPor || "—"} · {fmtDataHora(a.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() =>
                      confirmado
                        ? desconfirmar.mutate(a.id)
                        : confirmar.mutate(a.id)
                    }
                     disabled={!me?.id || confirmar.isPending || desconfirmar.isPending}
                    className={cn(
                       "disabled:cursor-not-allowed disabled:opacity-50",
                      confirmado
                        ? "hc-pilula"
                        : "flex h-[30px] items-center gap-1.5 rounded-full bg-primary px-3 text-[11.5px] font-semibold text-primary-foreground"
                    )}
                  >
                    {confirmado ? (
                      <>
                        <CheckCheck className="size-3.5 text-success" /> Confirmado
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" /> Confirmar leitura
                      </>
                    )}
                  </button>
                  {podeCriar && (
                    <button
                      onClick={() => excluir.mutate(a.id)}
                      title="Remover aviso"
                      className="hc-seta hover:!border-destructive/30 hover:!bg-destructive/15 hover:!text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {a.texto && (
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {a.texto}
                </p>
              )}
              {a.confirmacoes.length > 0 && (
                <p className="mt-2.5 text-[11px] text-ink-3">
                  Confirmaram ({a.confirmacoes.length}):{" "}
                  {a.confirmacoes.map((c) => c.username || "—").join(", ")}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
