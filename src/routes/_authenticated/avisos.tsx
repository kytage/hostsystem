import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Trash2, Check, CheckCheck, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fmtDataHora } from "@/lib/kanban";
import {
  fetchAvisos,
  criarAviso,
  excluirAviso,
  confirmarAviso,
  removerConfirmacao,
} from "@/lib/avisos";
import { useRealtimeTable } from "@/lib/realtime";
import { useMyRole, ROLE_ORDER } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { getAuthUserData } from "@/lib/auth-cache";

export const Route = createFileRoute("/_authenticated/avisos")({
  component: AvisosPage,
});

function useMyUsername() {
  return useQuery({
    // Esta identidade inclui `id`; não pode compartilhar cache com a sidebar,
    // cuja query `my-username` retorna apenas dados de apresentação.
    queryKey: ["my-aviso-confirmation-identity"],
    queryFn: async () => {
      const auth = await getAuthUserData();
      // Nunca cachear identidade vazia (ver ilegal-avisos.tsx).
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


function AvisosPage() {
  const queryClient = useQueryClient();
  const { data: avisos = [], isLoading } = useQuery({ queryKey: ["avisos"], queryFn: fetchAvisos });
  const { data: me } = useMyUsername();
  const { data: role } = useMyRole();
  useRealtimeTable("avisos", [["avisos"]]);
  useRealtimeTable("aviso_confirmacoes", [["avisos"]]);

  const podeCriar =
    ROLE_ORDER.indexOf(role ?? "staff") <= ROLE_ORDER.indexOf("coordinator");

  const [novoAberto, setNovoAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["avisos"] });

  const criar = useMutation({
    mutationFn: () =>
      criarAviso({ titulo: titulo.trim(), texto: texto.trim(), criadoPor: me?.username ?? "" }),
    onSuccess: () => {
      toast.success("Aviso publicado.");
      setTitulo("");
      setTexto("");
      setNovoAberto(false);
      invalidate();
    },
    onError: () => toast.error("Erro ao publicar aviso."),
  });

  const excluir = useMutation({
    mutationFn: excluirAviso,
    onSuccess: () => {
      toast.success("Aviso removido.");
      invalidate();
    },
    onError: () => toast.error("Erro ao remover aviso."),
  });

  const confirmar = useMutation({
    mutationFn: (avisoId: string) => confirmarAviso(avisoId, me?.username ?? ""),
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao confirmar aviso."),
  });

  const desconfirmar = useMutation({
    mutationFn: removerConfirmacao,
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao remover confirmação."),
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-6 md:px-8">
      <PageHeader
        title="Avisos"
        subtitle="Comunicados oficiais da equipe — confirme a leitura."
        actions={
          podeCriar ? (
            <button
              onClick={() => setNovoAberto((v) => !v)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {novoAberto ? <X className="size-4" /> : <Plus className="size-4" />}
              {novoAberto ? "Cancelar" : "Novo aviso"}
            </button>
          ) : undefined
        }
      />

      {podeCriar && novoAberto && (
        <div className="mt-5 rounded-2xl glass p-5">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título do aviso"
            maxLength={120}
            className="w-full rounded-lg border border-border bg-black/25 px-3 py-2 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Descrição do aviso..."
            rows={4}
            className="mt-3 w-full resize-y rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => criar.mutate()}
              disabled={!titulo.trim() || criar.isPending}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {criar.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Publicar
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {isLoading && (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando avisos...
          </p>
        )}
        {!isLoading && avisos.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            Nenhum aviso publicado.
          </p>
        )}
        {avisos.map((a) => {
          const confirmado = a.confirmacoes.some((c) => c.userId === me?.id);
          return (
            <article
              key={a.id}
              className={cn(
                "rounded-2xl glass p-5 transition-colors",
                confirmado ? "border-border" : "border-primary/40"
              )}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-foreground">{a.titulo}</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    por {a.criadoPor || "equipe"} · {fmtDataHora(a.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => (confirmado ? desconfirmar.mutate(a.id) : confirmar.mutate(a.id))}
                     disabled={!me?.id || confirmar.isPending || desconfirmar.isPending}
                    className={cn(
                       "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      confirmado
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-primary text-primary-foreground hover:opacity-90"
                    )}
                  >
                    {confirmado ? <CheckCheck className="size-3.5" /> : <Check className="size-3.5" />}
                    {confirmado ? "Confirmado" : "Confirmar"}
                  </button>
                  {podeCriar && (
                    <button
                      onClick={() => excluir.mutate(a.id)}
                      aria-label="Excluir aviso"
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {a.texto && (
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
                  {a.texto}
                </p>
              )}
              <div className="mt-3 border-t border-border/60 pt-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {a.confirmacoes.length === 0
                    ? "Ninguém confirmou ainda."
                    : `Confirmado por: ${a.confirmacoes.map((c) => c.username).join(", ")}`}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
