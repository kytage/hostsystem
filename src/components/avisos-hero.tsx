import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, CheckCheck, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { getAuthUserData } from "@/lib/auth-cache";
import { confirmarAviso, fetchAvisos } from "@/lib/avisos";
import { getCurrentUsername } from "@/lib/kanban";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";

/**
 * Quadro de avisos na abertura do dashboard. Mostra, um por vez, os avisos
 * que a pessoa ainda não confirmou — a confirmação de leitura é feita aqui.
 */
export function AvisosHero() {
  const qc = useQueryClient();
  useRealtimeTable("avisos", [["avisos"]]);
  useRealtimeTable("aviso_confirmacoes", [["avisos"]]);
  const { data: avisos = [], isLoading } = useQuery({ queryKey: ["avisos"], queryFn: fetchAvisos });
  const { data: eu } = useQuery({ queryKey: ["meu-id"], queryFn: async () => (await getAuthUserData()).user?.id ?? null, staleTime: Infinity });
  const { data: username = "" } = useQuery({ queryKey: ["current-username"], queryFn: getCurrentUsername, staleTime: 300_000 });

  const pendentes = eu ? avisos.filter((a) => !a.confirmacoes.some((c) => c.userId === eu)) : [];
  const atual = pendentes[0];

  const confirmar = useMutation({
    mutationFn: (id: string) => confirmarAviso(id, username),
    onSuccess: () => {
      playSfx("check");
      void qc.invalidateQueries({ queryKey: ["avisos"] });
    },
    onError: () => toast.error("Não foi possível confirmar o aviso. Tente de novo."),
  });

  return (
    <section className="mt-5 w-full rounded-[22px] border border-white/[0.09] bg-black/55 p-4 text-left backdrop-blur-2xl sm:w-[400px]" aria-live="polite">
      <header className="flex items-center gap-2">
        <Megaphone className="size-4 text-ink-3" strokeWidth={1.7} />
        <h2 className="font-display text-sm font-semibold">Quadro de avisos</h2>
        {pendentes.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-red-200">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" /> {pendentes.length} para confirmar
          </span>
        )}
        <Link to="/avisos" aria-label="Abrir todos os avisos" title="Todos os avisos" className="ml-auto grid size-7 place-items-center rounded-full text-ink-3 transition-colors hover:bg-white/[0.07] hover:text-foreground">
          <ArrowUpRight className="size-3.5" />
        </Link>
      </header>

      {isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Carregando avisos…
        </p>
      ) : atual ? (
        <div key={atual.id} className="pf-sobe mt-3">
          <p className="text-sm font-semibold">{atual.titulo}</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{atual.texto}</p>
          <div className="mt-3 flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-[11px] text-ink-3">
              {atual.criadoPor} · {new Date(atual.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </p>
            <button
              onClick={() => confirmar.mutate(atual.id)}
              disabled={confirmar.isPending || !username}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-white"
            >
              {confirmar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Confirmar leitura
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
          <CheckCheck className="size-4 text-emerald-400" />
          {avisos.length === 0 ? "Nenhum aviso publicado." : "Você confirmou todos os avisos."}
        </p>
      )}
    </section>
  );
}
