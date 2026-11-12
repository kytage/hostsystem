import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Coins, Cookie, Lock, Timer } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { aoVivo, ESPACOS, humor, peca, type HokiPet } from "@/lib/hoki";
import { CORES_LEVEL, corDoSelo, progressoDoNivel } from "@/lib/fazenda/catalogo";
import { CHAVE_MEU_NIVEL, useMeuNivel, useSelos, type MeuNivel } from "@/lib/fazenda/selos";
import { fazendaAcao } from "@/lib/fazenda.functions";
import { QUERIDOMETRO } from "@/lib/termometro";
import { cn } from "@/lib/utils";
import { Hoki3D, type Reacao } from "./hoki-3d";
import { useQueridometro } from "./queridometro";
import { useSouVisita } from "@/lib/hoki-visita";

/**
 * Perfil do HOKI de alguém: o mascote em 3D no pódio, o nível, os recordes,
 * o queridômetro de hoje e o que ele está vestindo. `acoes` são os botões de
 * quem abriu o perfil pela praça (chamar, convidar, desafiar).
 */
export function PerfilHoki({
  pet: bruto,
  posicao = 0,
  onClose,
  acoes,
}: {
  pet: HokiPet;
  /** Posição no ranking (0 = fora da lista). */
  posicao?: number;
  onClose: () => void;
  acoes?: ReactNode;
}) {
  const pet = aoVivo(bruto);
  // nível = nível do HOST FAZENDAS (o meu com XP; o dos outros só o número e a cor)
  const { data: meu } = useMeuNivel();
  const souEu = !!meu && meu.userId === pet.user_id;
  const { data: selos } = useSelos(souEu ? [] : [pet.user_id]);
  const seloDeOutro = selos?.[pet.user_id];
  const prog = progressoDoNivel(souEu ? meu.xp : 0);
  const nivel = souEu ? prog.nivel : (seloDeOutro?.nivel ?? 1);
  const cor = souEu
    ? corDoSelo(meu.cor, nivel)
    : seloDeOutro
      ? { fundo: seloDeOutro.fundo, texto: seloDeOutro.texto }
      : corDoSelo(null, 1);
  const vestindo = ESPACOS.map((g) => peca(pet.visual[g])).filter((p) => !!p);
  const [aceno] = useState<{ tipo: Reacao; n: number }>({ tipo: "acenar", n: 1 });
  const { quadro, tags } = useQueridometro("");
  const linha = quadro.find((l) => l.perfil.id === pet.user_id);
  const tag = tags.get(pet.user_id) ?? "";
  // o queridômetro é só da equipe: visita não vê, e perfil de visita não tem
  const souVisita = useSouVisita();
  const comQueridometro = !souVisita && !!linha;
  const numeros = [
    { k: "Staff Coins", v: pet.coins, Icone: Coins },
    { k: "Petiscos", v: pet.recorde_petiscos || "—", Icone: Cookie },
    { k: "Reflexo", v: pet.recorde_reflexo ? `${pet.recorde_reflexo} ms` : "—", Icone: Timer },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[calc(100vw-1.5rem)] max-w-[780px] gap-0 overflow-hidden p-0"
      >
        <div className="grid sm:grid-cols-[290px_minmax(0,1fr)]">
          {/* palco: o HOKI no pódio dele, com a plaquinha do nome */}
          <div className="brilho relative min-h-[300px] overflow-hidden border-b border-white/[0.07] sm:min-h-[420px] sm:border-b-0 sm:border-r">
            <Hoki3D
              humor={humor(pet)}
              reacao={aceno}
              visual={pet.visual}
              placa={{ nome: pet.nome, nivel }}
              interativo
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
            />
            {posicao > 0 && (
              <span className="vidro absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md">
                {posicao}º no ranking
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-col p-5">
            <p className="eyebrow flex items-center gap-2">
              <span
                aria-hidden
                className="size-[5px] rounded-full bg-[#e5231b] shadow-[0_0_8px_rgba(229,35,27,0.95)]"
              />
              Nível {nivel} · HOST FAZENDAS
            </p>
            <DialogTitle className="mt-1.5 truncate font-display text-[28px] font-semibold leading-none tracking-[-0.035em]">
              {pet.nome}
            </DialogTitle>
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              {tag && (
                <span className="rounded-full bg-[#ce0e0e] px-1.5 py-px text-[8.5px] font-bold tracking-wide text-white">
                  {tag}
                </span>
              )}
              HOKI de {pet.username || "staff"}
            </p>

            {/* nível do HOST FAZENDAS (a experiência só aparece no meu perfil) */}
            <div className="glass-inset mt-4 flex items-center gap-3 rounded-2xl border p-3">
              <span
                className="grid h-10 min-w-10 place-items-center rounded-full px-2 font-display text-[19px] font-extrabold leading-none tabular-nums"
                style={{ background: cor.fundo, color: cor.texto }}
              >
                {nivel}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Nível · HOST FAZENDAS</span>
                  {souEu && (
                    <span className="tabular-nums">
                      {prog.maximo
                        ? "nível máximo"
                        : `${prog.noNivel.toLocaleString("pt-BR")}/${prog.paraSubir.toLocaleString("pt-BR")} XP`}
                    </span>
                  )}
                </div>
                {souEu ? (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${prog.pct}%` }}
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-ink-3">
                    {seloDeOutro
                      ? "Sobe plantando, colhendo e cuidando da ilha."
                      : "Ainda não entrou no HOST FAZENDAS."}
                  </p>
                )}
              </div>
            </div>
            {souEu && <CorDoLevel meu={meu} />}

            <dl className="mt-2 grid grid-cols-3 gap-2">
              {numeros.map((x) => (
                <div key={x.k} className="glass-inset rounded-2xl border px-2.5 py-2">
                  <dt className="flex items-center gap-1 text-[10.5px] text-ink-3">
                    <x.Icone className="size-3" strokeWidth={1.7} /> {x.k}
                  </dt>
                  <dd className="mt-0.5 font-display text-[15px] font-semibold tabular-nums">
                    {x.v}
                  </dd>
                </div>
              ))}
            </dl>

            {/* queridômetro de hoje */}
            <p
              className={cn(
                "mt-4 text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-3",
                !comQueridometro && "hidden",
              )}
            >
              Queridômetro de hoje
            </p>
            <div className={cn("mt-1.5 flex gap-1.5", !comQueridometro && "hidden")}>
              {QUERIDOMETRO.map((e, i) => {
                const n = linha?.contagem[i] ?? 0;
                return (
                  <span
                    key={e.nome}
                    title={`${e.nome}: ${n}`}
                    className="glass-inset flex flex-1 flex-col items-center rounded-xl border py-1.5 leading-none"
                  >
                    <span className={cn("text-[16px]", n === 0 && "opacity-35 grayscale")}>
                      {e.emoji}
                    </span>
                    <span
                      className={cn(
                        "mt-1 text-[11px] font-semibold tabular-nums",
                        n ? "text-foreground" : "text-ink-3",
                      )}
                    >
                      {n}
                    </span>
                  </span>
                );
              })}
            </div>

            <p className="mt-4 text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-3">
              Vestindo
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {vestindo.map((p) => (
                <span
                  key={p.id}
                  className="glass-inset flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]"
                >
                  <span
                    className="size-2.5 rounded-full border border-white/20"
                    style={{ background: p.cor }}
                  />{" "}
                  {p.nome}
                </span>
              ))}
            </div>

            {acoes && <div className="mt-auto flex flex-wrap gap-2 pt-5">{acoes}</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Personalização: a cor do número do nível na plaquinha (libera com o nível do HOST FAZENDAS). */
function CorDoLevel({ meu }: { meu: MeuNivel }) {
  const acao = useServerFn(fazendaAcao);
  const qc = useQueryClient();
  const [trocando, setTrocando] = useState<string | null>(null);
  const nivel = progressoDoNivel(meu.xp).nivel;
  const equipar = async (id: string) => {
    if (!meu.temIlha) {
      toast.info("Entre no HOST FAZENDAS (portal do celeiro) para criar a sua ilha primeiro.");
      return;
    }
    setTrocando(id);
    try {
      const r = await acao({ data: { op: crypto.randomUUID(), acao: { t: "cor", id } } });
      if (r.erro) return void toast.error(r.erro);
      qc.setQueryData<MeuNivel | null>(CHAVE_MEU_NIVEL, (v) => (v ? { ...v, cor: id } : v));
      void qc.invalidateQueries({ queryKey: ["fazenda-selos"] });
      toast.success("Cor do level equipada!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu para trocar a cor agora.");
    } finally {
      setTrocando(null);
    }
  };
  return (
    <div className="mt-2 rounded-2xl border border-white/[0.07] p-3">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-3">
        Personalização · Cor do Level
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CORES_LEVEL.map((c) => {
          const liberada = nivel >= c.nivel;
          const emUso = corDoSelo(meu.cor, nivel).id === c.id;
          return (
            <button
              key={c.id}
              disabled={!liberada || emUso || !!trocando}
              onClick={() => void equipar(c.id)}
              title={liberada ? c.nome : `${c.nome}: libera no nível ${c.nivel}`}
              aria-label={liberada ? `Equipar ${c.nome}` : `${c.nome}, libera no nível ${c.nivel}`}
              className={cn(
                "relative grid h-7 min-w-9 place-items-center rounded-full px-2 text-[11px] font-extrabold tabular-nums transition",
                emUso ? "ring-2 ring-white ring-offset-2 ring-offset-black" : "hover:scale-105",
                !liberada && "cursor-not-allowed opacity-35",
              )}
              style={{ background: c.fundo, color: c.texto }}
            >
              {emUso ? (
                <Check className="size-3.5" />
              ) : liberada ? (
                nivel
              ) : (
                <span className="flex items-center gap-0.5">
                  <Lock className="size-2.5" />
                  {c.nivel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
