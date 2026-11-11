import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Heart, Loader2, Thermometer } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { todosPets, VISUAL_PADRAO, type Visual } from "@/lib/hoki";
import { ROLE_ORDER } from "@/lib/permissions";
import { ROLE_TAG } from "@/lib/roles";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";
import {
  faltaParaZerar,
  fetchMeusVotosHoje,
  fetchTermometroHoje,
  QUERIDOMETRO,
  votarTermometro,
} from "@/lib/termometro";
import { cn } from "@/lib/utils";
import { Hoki2D } from "./hoki-2d";

interface Perfil {
  id: string;
  username: string;
  /** Sigla do cargo (SUP, MOD…), mostrada em vermelho antes do nome. */
  tag: string;
  /** Aparência do HOKI da pessoa (a foto dela aqui é o próprio HOKI). */
  visual: Visual;
}
export interface LinhaDoQuadro {
  perfil: Perfil;
  /** Quantos de cada emoji a pessoa recebeu hoje (na ordem do queridômetro). */
  contagem: number[];
  total: number;
}

/**
 * Dados do queridômetro de hoje: os perfis, quantos emojis cada um recebeu,
 * o que eu já entreguei e para quantas pessoas ainda posso entregar.
 * Um emoji por pessoa, por dia; zera à meia-noite.
 */
export function useQueridometro(euId: string) {
  const qc = useQueryClient();
  useRealtimeTable("termometro_votos", [["termometro"], ["meus-votos-termometro"]]);
  const { data: contas = [] } = useQuery({
    queryKey: ["termometro-perfis"],
    queryFn: async () => {
      // todo mundo da equipe e as visitas (a função do banco devolve só nome e cargos)
      const lista = await supabase.rpc("hoki_pessoas" as never);
      if (!lista.error && Array.isArray(lista.data)) {
        const pessoas = lista.data as {
          id: string;
          username: string | null;
          cargos: string[] | null;
          visita: boolean;
        }[];
        return pessoas.map((p) => {
          const cargo = ROLE_ORDER.find((r) => p.cargos?.includes(r));
          return {
            id: p.id,
            username: p.username ?? "",
            tag: cargo ? ROLE_TAG[cargo] : p.visita ? "VIS" : "",
            visita: p.visita === true && !cargo,
          };
        });
      }
      // sem a função (versão antiga do banco): lê as tabelas, que mostram só o que cada um pode ver
      const [perfis, cargos] = await Promise.all([
        supabase.from("profiles").select("id, username").order("username", { ascending: true }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (perfis.error) throw perfis.error;
      const doUsuario = new Map<string, string[]>();
      for (const c of cargos.data ?? [])
        doUsuario.set(c.user_id, [...(doUsuario.get(c.user_id) ?? []), c.role]);
      return (perfis.data ?? []).map((p) => {
        const cargo = ROLE_ORDER.find((r) => doUsuario.get(p.id)?.includes(r));
        return {
          id: p.id,
          username: p.username ?? "",
          tag: cargo ? ROLE_TAG[cargo] : "",
          visita: false,
        };
      });
    },
    staleTime: 300_000,
  });
  const { data: pets = [] } = useQuery({
    queryKey: ["hoki-todos"],
    queryFn: todosPets,
    staleTime: 60_000,
  });
  const perfis = useMemo<Perfil[]>(() => {
    const visuais = new Map(pets.map((p) => [p.user_id, p.visual]));
    // o queridômetro é só da equipe: visitas não entram no quadro nem recebem emojis
    return contas
      .filter((c) => !c.visita)
      .map((c) => ({ ...c, visual: visuais.get(c.id) ?? VISUAL_PADRAO }));
  }, [contas, pets]);
  /** Sigla de cada pessoa (equipe e visitas), para o cartão de perfil. */
  const tags = useMemo(() => new Map(contas.map((c) => [c.id, c.tag])), [contas]);
  const { data: votos = [] } = useQuery({ queryKey: ["termometro"], queryFn: fetchTermometroHoje });
  const { data: meus = [] } = useQuery({
    queryKey: ["meus-votos-termometro"],
    queryFn: fetchMeusVotosHoje,
  });

  const quadro = useMemo<LinhaDoQuadro[]>(() => {
    const porPessoa = new Map<string, number[]>();
    for (const v of votos) {
      const i = QUERIDOMETRO.findIndex((e) => e.emoji === v.emoji);
      if (i < 0) continue; // emoji antigo, de antes do queridômetro
      const c = porPessoa.get(v.paraUserId) ?? QUERIDOMETRO.map(() => 0);
      c[i] = (c[i] ?? 0) + 1;
      porPessoa.set(v.paraUserId, c);
    }
    return perfis
      .map((perfil) => {
        const contagem = porPessoa.get(perfil.id) ?? QUERIDOMETRO.map(() => 0);
        return { perfil, contagem, total: contagem.reduce((s, n) => s + n, 0) };
      })
      .sort((a, b) => b.total - a.total || a.perfil.username.localeCompare(b.perfil.username));
  }, [perfis, votos]);

  const entregues = useMemo(() => new Map(meus.map((m) => [m.para, m.emoji])), [meus]);
  const pendentes = perfis.filter((p) => p.id !== euId && !entregues.has(p.id)).length;

  const entregar = useMutation({
    mutationFn: ({ para, emoji }: { para: Perfil; emoji: string }) =>
      votarTermometro(para.id, para.username, emoji),
    onSuccess: (_, { para, emoji }) => {
      playSfx("success");
      toast.success(`${emoji} entregue para ${para.username}. Ninguém vê de quem veio.`);
      void qc.invalidateQueries({ queryKey: ["termometro"] });
      void qc.invalidateQueries({ queryKey: ["meus-votos-termometro"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { perfis, quadro, entregues, pendentes, entregar, tags };
}

/** A "foto" da pessoa: o busto do HOKI dela. */
function Foto({ visual, className }: { visual: Visual; className?: string }) {
  return (
    <span
      className={cn(
        "block shrink-0 overflow-hidden rounded-full border border-white/15 bg-black/50",
        className,
      )}
    >
      <Hoki2D visual={visual} busto />
    </span>
  );
}
/** Nome com a sigla do cargo na frente, em vermelho (como na praça). */
function Nome({ p, className }: { p: Perfil; className?: string }) {
  return (
    <p className={cn("flex min-w-0 items-center gap-1.5 font-medium leading-tight", className)}>
      {p.tag && (
        <span className="shrink-0 rounded-full bg-[#ce0e0e] px-1.5 py-px text-[8.5px] font-bold tracking-wide text-white">
          {p.tag}
        </span>
      )}
      <span className="truncate">{p.username}</span>
    </p>
  );
}

/** Um cartão do quadro: a pessoa e, embaixo de cada emoji, quantos ela recebeu hoje. */
export function CartaoDoQuadro({ linha, compacto }: { linha: LinhaDoQuadro; compacto?: boolean }) {
  return (
    <div
      className={cn(
        "glass-inset flex items-center gap-3 rounded-2xl border",
        compacto ? "p-2" : "p-2.5",
      )}
    >
      <Foto visual={linha.perfil.visual} className={compacto ? "size-9" : "size-11"} />
      <div className="min-w-0 flex-1">
        <Nome p={linha.perfil} className="text-[12.5px]" />
        <div className="mt-1 flex items-start gap-1">
          {QUERIDOMETRO.map((e, i) => {
            const n = linha.contagem[i] ?? 0;
            return (
              <span
                key={e.nome}
                title={`${e.nome}: ${n}`}
                className="flex w-6 flex-col items-center leading-none"
              >
                <span className={cn("text-[15px]", n === 0 && "opacity-35 grayscale")}>
                  {e.emoji}
                </span>
                <span
                  className={cn(
                    "mt-1 text-[10px] font-semibold tabular-nums",
                    n ? "text-foreground" : "text-ink-3",
                  )}
                >
                  {n}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Queridômetro: abre quando o HOKI chega ao termômetro da praça. Numa aba a
 * pessoa entrega um emoji para cada perfil (um por pessoa, por dia); na outra
 * vê quantos de cada emoji todo mundo recebeu hoje.
 */
export function Queridometro({ euId, onClose }: { euId: string; onClose: () => void }) {
  const { perfis, quadro, entregues, pendentes, entregar } = useQueridometro(euId);
  // abre no quadro de hoje; entregar fica na outra aba
  const [aba, setAba] = useState<"entregar" | "quadro">("quadro");
  const falta = faltaParaZerar();
  // quem ainda não recebeu o meu emoji vem primeiro
  const pessoas = perfis
    .filter((p) => p.id !== euId)
    .sort((a, b) => Number(entregues.has(a.id)) - Number(entregues.has(b.id)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-[1760px] flex-col gap-0 overflow-hidden p-0"
      >
        <div className="brilho relative flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.07] px-5 py-3.5 pr-14">
          <span className="icone-quadro size-10 text-[#ff6a57]">
            <Thermometer className="size-[18px]" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-lg font-semibold tracking-tight">
              Queridômetro
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Um emoji por pessoa, por dia. É anônimo e zera à meia-noite (faltam {falta.horas}h{" "}
              {String(falta.minutos).padStart(2, "0")}min).
            </p>
          </div>
          <div className="flex items-center gap-2" role="tablist" aria-label="O que mostrar">
            <button
              type="button"
              role="tab"
              aria-selected={aba === "quadro"}
              onClick={() => setAba("quadro")}
              className={cn("pilula rounded-full", aba === "quadro" && "pilula-ativa")}
            >
              Quadro de hoje
            </button>
            {/* entregar em destaque: vermelho, com brilho e a contagem de quem ainda falta */}
            <button
              type="button"
              role="tab"
              aria-selected={aba === "entregar"}
              onClick={() => setAba("entregar")}
              className={cn(
                "relative flex h-9 items-center gap-2 rounded-full px-4 text-[12.5px] font-semibold text-white transition-transform duration-200 hover:-translate-y-px active:scale-[0.97]",
                "bg-gradient-to-b from-[#ff4a3d] to-[#ce0e0e] shadow-[0_8px_26px_-6px_rgba(229,35,27,0.85),inset_0_1px_0_rgba(255,255,255,0.3)]",
                aba === "entregar" && "ring-2 ring-white/70",
              )}
            >
              <Heart className="size-3.5" fill="currentColor" />
              Entregar emojis
              {pendentes > 0 && (
                <span className="relative grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white px-1 text-[10.5px] font-bold tabular-nums text-[#ce0e0e]">
                  {aba !== "entregar" && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-white/70" />
                  )}
                  <span className="relative">{pendentes}</span>
                </span>
              )}
            </button>
          </div>
        </div>

        {/* legenda: os seis emojis e o que cada um quer dizer */}
        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-white/[0.07] px-5 py-2.5">
          {QUERIDOMETRO.map((e) => (
            <span
              key={e.nome}
              className="glass-inset flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] text-foreground/85"
            >
              <span className="text-[14px] leading-none">{e.emoji}</span> {e.nome}
            </span>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
          {aba === "entregar" ? (
            pessoas.length === 0 ? (
              <p className="grid h-full place-items-center text-sm text-muted-foreground">
                Ainda não há outros perfis para receber emojis.
              </p>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(204px,1fr))] gap-2">
                {pessoas.map((p) => {
                  const dado = entregues.get(p.id);
                  const enviando = entregar.isPending && entregar.variables?.para.id === p.id;
                  return (
                    <li
                      key={p.id}
                      className={cn("glass-inset rounded-2xl border p-2.5", dado && "opacity-60")}
                    >
                      <div className="flex items-center gap-2.5">
                        <Foto visual={p.visual} className="size-10" />
                        <div className="min-w-0 flex-1">
                          <Nome p={p} className="text-[13px]" />
                          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            {dado ? (
                              <>
                                <Check className="size-3 text-emerald-400" /> você entregou {dado}
                              </>
                            ) : (
                              "escolha um emoji"
                            )}
                          </p>
                        </div>
                        {enviando && (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-6 gap-1">
                        {QUERIDOMETRO.map((e) => (
                          <button
                            key={e.nome}
                            type="button"
                            disabled={!!dado || entregar.isPending}
                            onClick={() => entregar.mutate({ para: p, emoji: e.emoji })}
                            aria-label={`Entregar ${e.nome} para ${p.username}`}
                            title={e.nome}
                            className={cn(
                              "grid h-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-[18px] leading-none hover:border-white/30 hover:bg-white/[0.1] disabled:cursor-default disabled:hover:border-white/[0.07] disabled:hover:bg-white/[0.04]",
                              dado === e.emoji && "!border-white/50 !bg-white/[0.12]",
                              dado && dado !== e.emoji && "grayscale",
                            )}
                          >
                            {e.emoji}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(204px,1fr))] gap-2">
              {quadro.map((l) => (
                <li key={l.perfil.id}>
                  <CartaoDoQuadro linha={l} compacto />
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
