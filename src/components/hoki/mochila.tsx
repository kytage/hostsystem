import { useState } from "react";
import { Backpack, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { type HokiPet } from "@/lib/hoki";
import { item, ITENS, LIMITE_DA_MOCHILA, pesoDaMochila, type Item } from "@/lib/hoki-itens";
import { cn } from "@/lib/utils";

type Filtro = "tudo" | "comida" | "bebida" | "presente";
const FILTROS: { id: Filtro; nome: string }[] = [
  { id: "tudo", nome: "Tudo" },
  { id: "comida", nome: "Comidas" },
  { id: "bebida", nome: "Bebidas" },
  { id: "presente", nome: "Presentes" },
];
const kg = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
/** O que o item faz ao ser consumido, em poucas palavras. */
const efeitos = (i: Item) =>
  [
    i.fome ? `+${i.fome} fome` : "",
    i.sede ? `+${i.sede} sede` : "",
    i.energia ? `+${i.energia} energia` : "",
    i.carinho ? `+${i.carinho} carinho` : "",
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * Mochila do HOKI: o que ele carrega (comidas e bebidas da HOST FAZENDAS e do Comércio),
 * com o peso de tudo. Aguenta 50 kg. Daqui o HOKI come, bebe ou joga fora.
 */
export function Mochila({
  pet,
  filtro: inicial = "tudo",
  ocupado,
  onUsar,
  onJogarFora,
  onClose,
}: {
  pet: HokiPet;
  filtro?: Filtro;
  ocupado: boolean;
  onUsar: (i: Item) => void;
  onJogarFora: (i: Item) => void;
  onClose: () => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>(inicial);
  const peso = pesoDaMochila(pet.inventario);
  const cheia = Math.min(100, (peso / LIMITE_DA_MOCHILA) * 100);
  // na ordem do catálogo, só o que há na mochila
  const meus = ITENS.filter(
    (i) => (pet.inventario[i.id] ?? 0) > 0 && (filtro === "tudo" || i.tipo === filtro),
  );
  const desconhecidos = Object.keys(pet.inventario).filter((id) => !item(id)).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[min(90dvh,680px)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0"
      >
        <div className="shrink-0 border-b border-white/[0.07] px-5 py-3.5 pr-14">
          <div className="flex flex-wrap items-center gap-3">
            <span className="icone-quadro size-10">
              <Backpack className="size-[18px]" strokeWidth={1.7} />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-display text-lg font-semibold tracking-tight">
                Mochila de {pet.nome}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {kg(peso)} de {LIMITE_DA_MOCHILA} kg. Cada colheita da HOST FAZENDAS manda uma
                unidade para cá; água é de graça na fonte da praça; o resto se compra no Comércio.
              </p>
            </div>
            <div className="segmentos" role="tablist" aria-label="O que mostrar">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filtro === f.id}
                  onClick={() => setFiltro(f.id)}
                  data-sem-elastico
                >
                  {f.nome}
                </button>
              ))}
            </div>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
            role="progressbar"
            aria-label="Peso da mochila"
            aria-valuenow={Math.round(cheia)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                cheia > 90 ? "bg-[#e5231b]" : "bg-white",
              )}
              style={{ width: `${cheia}%` }}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {meus.length === 0 ? (
            <div className="grid min-h-[200px] place-items-center text-center">
              <div>
                <p className="font-display text-base font-semibold">
                  {filtro === "tudo" ? "Mochila vazia" : "Nada disso na mochila"}
                </p>
                <p className="mx-auto mt-1 max-w-[340px] text-xs text-muted-foreground">
                  {filtro === "bebida" ? (
                    <>
                      Água é de graça: vá até a fonte no meio da praça e aperte E (uma garrafa a
                      cada 30 segundos). Leite, café e água de coco vêm da HOST FAZENDAS ou do
                      Comércio.
                    </>
                  ) : (
                    <>
                      Colha na HOST FAZENDAS (suba a escadaria do noroeste da praça): cada colheita
                      e cada coleta de árvore ou bicho mandam uma unidade para a mochila. Água é de
                      graça na fonte da praça. Também dá para comprar dos outros no Comércio.
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {meus.map((i) => {
                const n = pet.inventario[i.id] ?? 0;
                return (
                  <li key={i.id} className="glass-inset flex flex-col rounded-2xl border p-3">
                    <div className="flex items-center gap-3">
                      <span className="icone-quadro size-12 text-[26px] leading-none">
                        {i.emoji}
                      </span>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-[13.5px] font-medium">
                          {i.nome} <span className="font-normal text-muted-foreground">× {n}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {kg(i.peso * n)} kg no total
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-foreground/75">
                          {efeitos(i)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex gap-1.5">
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => onUsar(i)}
                        className="h-9 flex-1 rounded-full bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {i.usar ?? (i.tipo === "comida" ? "Comer" : "Beber")}
                      </button>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => onJogarFora(i)}
                        aria-label={`Jogar fora 1 ${i.nome}`}
                        title="Jogar fora 1"
                        className="grid size-9 shrink-0 place-items-center rounded-full border border-white/[0.12] text-muted-foreground hover:border-white/30 hover:text-foreground disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {desconhecidos > 0 && (
            <p className="mt-3 text-[11px] text-ink-3">
              Há {desconhecidos} item(ns) que esta versão do site não conhece.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
