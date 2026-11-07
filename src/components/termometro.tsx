import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import {
  fetchMeusVotosHoje,
  fetchTermometroHoje,
  TERMOMETRO_EMOJIS,
  votarTermometro,
} from "@/lib/termometro";
import { useRealtimeTable } from "@/lib/realtime";
import { cn } from "@/lib/utils";

interface Perfil {
  id: string;
  username: string;
  avatar_url: string;
}

/** Termômetro da equipe — votos com emoji que resetam a cada 24h. */
export function Termometro() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [alvo, setAlvo] = useState<Perfil | null>(null);

  useRealtimeTable("termometro_votos", [["termometro"], ["meus-votos-termometro"]]);

  const { data: perfis = [] } = useQuery({
    queryKey: ["termometro-perfis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .order("username", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Perfil[];
    },
  });

  const { data: votos = [] } = useQuery({
    queryKey: ["termometro"],
    queryFn: fetchTermometroHoje,
  });
  const { data: meusVotos = [] } = useQuery({
    queryKey: ["meus-votos-termometro"],
    queryFn: fetchMeusVotosHoje,
  });

  const votarMutation = useMutation({
    mutationFn: ({
      para,
      emoji,
    }: {
      para: Perfil;
      emoji: string;
    }) => votarTermometro(para.id, para.username, emoji),
    onSuccess: () => {
      toast.success("Voto anônimo enviado! 🎉");
      setAlvo(null);
      void queryClient.invalidateQueries({ queryKey: ["termometro"] });
      void queryClient.invalidateQueries({ queryKey: ["meus-votos-termometro"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quadro = useMemo(() => {
    const map = new Map<string, { username: string; emojis: Map<string, number>; total: number }>();
    for (const v of votos) {
      const entry =
        map.get(v.paraUserId) ??
        { username: v.paraUsername, emojis: new Map<string, number>(), total: 0 };
      entry.emojis.set(v.emoji, (entry.emojis.get(v.emoji) ?? 0) + 1);
      entry.total += 1;
      map.set(v.paraUserId, entry);
    }
    return [...map.entries()]
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => b.total - a.total);
  }, [votos]);

  const candidatos = perfis.filter((p) => !meusVotos.includes(p.id));

  return (
    <section className="rounded-2xl glass p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Flame className="size-4 text-primary" /> Termômetro da equipe
        </h2>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Votar 🎉
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Envie um emoji anônimo para alegrar o dia de alguém. Reseta a cada 24h.
      </p>

      <div className="mt-4 space-y-2">
        {quadro.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum emoji enviado hoje. Seja o primeiro! 🔥
          </p>
        )}
        {quadro.map((q, idx) => {
          const perfil = perfis.find((p) => p.id === q.id);
          return (
            <div
              key={q.id}
              className="flex items-center gap-3 rounded-xl glass-inset p-3"
            >
              <span className="w-5 text-center text-xs font-semibold text-muted-foreground">
                {idx + 1}º
              </span>
              <img
                src={perfil?.avatar_url || DEFAULT_AVATAR_URL}
                alt={q.username}
                className="size-9 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{q.username}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {[...q.emojis.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([emoji, count]) => (
                      <span
                        key={emoji}
                        className="flex items-center gap-0.5 rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[11px]"
                      >
                        {emoji}
                        <span className="font-semibold text-muted-foreground">{count}</span>
                      </span>
                    ))}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                {q.total}
              </span>
            </div>
          );
        })}
      </div>

      {/* Modal de voto */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl glass-modal p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                {alvo ? `Enviar emoji para ${alvo.username}` : "Escolha alguém para alegrar"}
              </h3>
              <button
                onClick={() => {
                  setOpen(false);
                  setAlvo(null);
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.08]"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>

            {!alvo ? (
              <div className="mt-4 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto scrollbar-thin">
                {candidatos.length === 0 && (
                  <p className="col-span-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Você já votou em todo mundo hoje! Volte amanhã 😄
                  </p>
                )}
                {candidatos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setAlvo(p)}
                    className="flex items-center gap-2.5 rounded-xl glass-inset p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-white/[0.08]"
                  >
                    <img
                      src={p.avatar_url || DEFAULT_AVATAR_URL}
                      alt={p.username}
                      className="size-8 rounded-lg object-cover"
                    />
                    <span className="truncate text-sm font-semibold text-foreground">
                      {p.username}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-5 gap-2">
                  {TERMOMETRO_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => votarMutation.mutate({ para: alvo, emoji })}
                      disabled={votarMutation.isPending}
                      className={cn(
                        "flex items-center justify-center rounded-xl glass-inset p-3 text-2xl transition-all hover:scale-110 hover:border-primary/50 disabled:opacity-50"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {votarMutation.isPending && (
                  <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Enviando voto anônimo...
                  </p>
                )}
                <button
                  onClick={() => setAlvo(null)}
                  className="mt-3 w-full rounded-xl border border-border py-2 text-xs font-semibold text-muted-foreground hover:bg-white/[0.08]"
                >
                  Voltar
                </button>
              </>
            )}
            <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
              1 voto por pessoa a cada 24h · totalmente anônimo 🤫
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
