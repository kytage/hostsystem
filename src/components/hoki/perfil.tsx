import { useState, type ReactNode } from "react";
import { Coins, Cookie, Timer } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { aoVivo, ESPACOS, humor, peca, progresso, titulo, type HokiPet } from "@/lib/hoki";
import { QUERIDOMETRO } from "@/lib/termometro";
import { cn } from "@/lib/utils";
import { Hoki3D, type Reacao } from "./hoki-3d";
import { useQueridometro } from "./queridometro";

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
  const prog = progresso(pet.xp);
  const vestindo = ESPACOS.map((g) => peca(pet.visual[g])).filter((p) => !!p);
  const [aceno] = useState<{ tipo: Reacao; n: number }>({ tipo: "acenar", n: 1 });
  const { quadro } = useQueridometro("");
  const linha = quadro.find((l) => l.perfil.id === pet.user_id);
  const tag = linha?.perfil.tag ?? "";
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
              placa={{ nome: pet.nome, nivel: prog.nivel }}
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
              {titulo(prog.nivel)}
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

            {/* nível e experiência */}
            <div className="glass-inset mt-4 flex items-center gap-3 rounded-2xl border p-3">
              <span className="font-display text-[34px] font-light leading-none tracking-[-0.04em] tabular-nums">
                {prog.nivel}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Nível</span>
                  <span className="tabular-nums">
                    {prog.noNivel}/{prog.paraSubir} XP
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-white" style={{ width: `${prog.pct}%` }} />
                </div>
              </div>
            </div>

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
            <p className="mt-4 text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-3">
              Queridômetro de hoje
            </p>
            <div className="mt-1.5 flex gap-1.5">
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
