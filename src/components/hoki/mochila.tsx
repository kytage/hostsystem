import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Backpack, X } from "lucide-react";
import { toast } from "sonner";
import { type HokiPet } from "@/lib/hoki";
import { item, ITENS, LIMITE_DA_MOCHILA, pesoDaMochila, type Item } from "@/lib/hoki-itens";
import { cn } from "@/lib/utils";

type Filtro = "tudo" | "comida" | "bebida" | "presente";
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

/** Quantos espaços a mochila mostra (5 na barra de atalhos + a grade). */
export const ATALHOS = 5;
const ESPACOS_MINIMOS = 20;
const CHAVE_ORDEM = "hoki-mochila-ordem";
const TIPO_ARRASTO = "application/x-hoki-item";

const lerOrdem = (): (string | null)[] => {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_ORDEM) ?? "[]") as unknown;
    return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : null)) : [];
  } catch {
    return [];
  }
};
const gravarOrdem = (o: (string | null)[]) => {
  try {
    // os vazios do fim não precisam ser guardados
    let fim = o.length;
    while (fim > 0 && !o[fim - 1]) fim--;
    localStorage.setItem(CHAVE_ORDEM, JSON.stringify(o.slice(0, fim)));
  } catch {
    // sem armazenamento: a arrumação vale só enquanto a mochila estiver aberta
  }
};

/**
 * Onde cada item fica na mochila (espaço 0 a 4 = atalhos 1 a 5). Respeita a
 * arrumação que a pessoa fez arrastando; o que é novo entra no primeiro espaço livre.
 */
export function arrumarMochila(inventario: Record<string, number>, ordem = lerOrdem()) {
  const tenho = (id: string | null) => !!id && (inventario[id] ?? 0) > 0 && !!item(id);
  const espacos: (Item | null)[] = ordem.map((id) => (id && tenho(id) ? (item(id) ?? null) : null));
  const postos = new Set(espacos.filter((i): i is Item => !!i).map((i) => i.id));
  for (const i of ITENS) {
    if (!tenho(i.id) || postos.has(i.id)) continue;
    const livre = espacos.indexOf(null);
    if (livre >= 0) espacos[livre] = i;
    else espacos.push(i);
    postos.add(i.id);
  }
  return espacos;
}

/**
 * Mochila do HOKI, em grade (estilo inventário de jogo): a primeira fileira são
 * os atalhos 1 a 5, embaixo o resto dos espaços. Clica num item para escolher;
 * a barra de baixo tem a quantidade e as ações Usar, Largar e Enviar.
 * O peso aparece no canto (aguenta 50 kg).
 */
export function Mochila({
  pet,
  filtro = "tudo",
  ocupado,
  onUsar,
  onJogarFora,
  onClose,
}: {
  pet: HokiPet;
  filtro?: Filtro;
  ocupado: boolean;
  onUsar: (i: Item, n: number) => void;
  onJogarFora: (i: Item, n: number) => void;
  onClose: () => void;
}) {
  const peso = pesoDaMochila(pet.inventario);
  const cheia = Math.min(100, (peso / LIMITE_DA_MOCHILA) * 100);
  // cada espaço com o seu item (a arrumação de arrastar fica salva neste aparelho)
  const [ordem, setOrdem] = useState(lerOrdem);
  const espacos = useMemo(() => arrumarMochila(pet.inventario, ordem), [pet.inventario, ordem]);
  const meus = useMemo(() => {
    const l = espacos.filter((i): i is Item => !!i);
    // abrindo pela comida (ou bebida), ela vem escolhida primeiro
    if (filtro !== "tudo") l.sort((a, b) => Number(b.tipo === filtro) - Number(a.tipo === filtro));
    return l;
  }, [espacos, filtro]);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  /** Leva o item para o espaço `j` (troca de lugar com o que estiver lá). */
  const mover = (id: string, j: number) => {
    const atual = espacos.map((i) => i?.id ?? null);
    const de = atual.indexOf(id);
    if (de < 0 || de === j) return;
    while (atual.length <= j) atual.push(null);
    atual[de] = atual[j] ?? null;
    atual[j] = id;
    setOrdem(atual);
    gravarOrdem(atual);
  };
  const itemArrastado = (e: React.DragEvent) => {
    const id = e.dataTransfer.getData(TIPO_ARRASTO) || arrastando;
    return id ? (meus.find((i) => i.id === id) ?? null) : null;
  };
  /** Solto em cima de um botão de ação: usa, larga ou envia (a quantidade vale até o que tem). */
  const soltarNaAcao = (e: React.DragEvent, acao: "usar" | "largar" | "enviar") => {
    e.preventDefault();
    setAlvo(null);
    const it = itemArrastado(e);
    setArrastando(null);
    if (!it || ocupado) return;
    setEscolhido(it.id);
    const q = Math.max(1, Math.min(pet.inventario[it.id] ?? 1, Math.floor(Number(qtd) || 1)));
    if (acao === "usar") onUsar(it, q);
    else if (acao === "largar") onJogarFora(it, q);
    else
      toast.info(
        "Para enviar, chegue perto de alguém na praça, clique na pessoa e escolha Dar presente.",
      );
  };
  const aceitaArrasto = (nome: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!arrastando) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (alvo !== nome) setAlvo(nome);
    },
    onDragLeave: () => setAlvo((a) => (a === nome ? null : a)),
  });
  const desconhecidos = Object.keys(pet.inventario).filter((id) => !item(id)).length;
  const [escolhido, setEscolhido] = useState<string | null>(meus[0]?.id ?? null);
  const [qtd, setQtd] = useState("1");
  const sel = meus.find((i) => i.id === escolhido) ?? null;
  const tenho = sel ? (pet.inventario[sel.id] ?? 0) : 0;
  const n = Math.max(1, Math.min(tenho || 1, Math.floor(Number(qtd) || 1)));

  // ESC fecha
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  // o item escolhido acabou: escolhe o primeiro
  useEffect(() => {
    if (escolhido && !meus.some((i) => i.id === escolhido)) setEscolhido(meus[0]?.id ?? null);
  }, [meus, escolhido]);

  const total = Math.max(ESPACOS_MINIMOS, Math.ceil(espacos.length / 5) * 5 + 5);
  const espaco = (i: number) => {
    const it = espacos[i] ?? null;
    const qt = it ? (pet.inventario[it.id] ?? 0) : 0;
    const ativo = !!it && it.id === escolhido;
    return (
      <button
        key={i}
        type="button"
        aria-disabled={!it}
        draggable={!!it}
        onDragStart={(e) => {
          if (!it) return;
          e.dataTransfer.setData(TIPO_ARRASTO, it.id);
          e.dataTransfer.effectAllowed = "move";
          setArrastando(it.id);
          setEscolhido(it.id);
        }}
        onDragEnd={() => {
          setArrastando(null);
          setAlvo(null);
        }}
        {...aceitaArrasto(`espaco-${i}`)}
        onDrop={(e) => {
          e.preventDefault();
          setAlvo(null);
          const id = e.dataTransfer.getData(TIPO_ARRASTO) || arrastando;
          setArrastando(null);
          if (id) mover(id, i);
        }}
        onClick={() => it && (setEscolhido(it.id), setQtd("1"))}
        onDoubleClick={() => it && !ocupado && onUsar(it, 1)}
        title={
          it
            ? `${it.nome} · ${kg(it.peso * qt)} kg${efeitos(it) ? ` · ${efeitos(it)}` : ""}`
            : undefined
        }
        className={cn(
          "relative block aspect-square w-full rounded-lg border text-white transition-[border-color,background-color,transform] duration-100",
          it
            ? "border-white/10 bg-gradient-to-b from-[#3a1416]/80 to-[#1d0f10]/90 hover:border-white/25 active:scale-[0.97]"
            : "cursor-default border-white/[0.06] bg-white/[0.025]",
          ativo && "border-[#CE0E0E] shadow-[0_0_0_1px_#CE0E0E,0_0_18px_rgba(206,14,14,0.35)]",
          it && "cursor-grab active:cursor-grabbing",
          !!it && it.id === arrastando && "opacity-40",
          alvo === `espaco-${i}` && "border-white/60 bg-white/[0.08]",
        )}
      >
        {it && (
          <>
            <span className="absolute right-1.5 top-1 text-[10.5px] font-semibold tabular-nums text-white/70">
              {qt}x
            </span>
            <span className="absolute inset-x-0 top-[22%] text-center text-[30px] leading-none sm:text-[34px]">
              {it.emoji}
            </span>
            <span className="absolute inset-x-1 bottom-2.5 truncate text-center text-[11px] font-semibold">
              {it.nome}
            </span>
            {/* barrinha: quanto do peso da mochila este item ocupa */}
            <span className="absolute inset-x-2 bottom-1 h-[3px] overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-[#e5231b]"
                style={{
                  width: `${Math.max(8, Math.min(100, ((it.peso * qt) / LIMITE_DA_MOCHILA) * 100 * 4))}%`,
                }}
              />
            </span>
          </>
        )}
      </button>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[85] grid place-items-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Mochila de ${pet.nome}`}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="pf-pop w-full max-w-[640px] rounded-2xl border border-white/10 bg-[#141416]/95 p-4 text-white shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        {/* topo: título e o peso no canto */}
        <div className="mb-3 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/[0.05]">
            <Backpack className="size-4" strokeWidth={1.8} />
          </span>
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">Mochila de {pet.nome}</p>
          <span
            className={cn(
              "text-[12px] font-semibold tabular-nums",
              cheia > 90 ? "text-[#ff4b44]" : "text-white/60",
            )}
            title="Peso da mochila"
          >
            {kg(peso)}kg / <span className="text-[#e5231b]">{LIMITE_DA_MOCHILA}kg</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar a mochila"
            className="grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              cheia > 90 ? "bg-[#e5231b]" : "bg-white/70",
            )}
            style={{ width: `${cheia}%` }}
          />
        </div>

        {/* atalhos 1 a 5 */}
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: ATALHOS }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className="rounded-md bg-[#5a1a1c]/70 px-3 py-0.5 text-[11px] font-bold tabular-nums text-white/80">
                {i + 1}
              </span>
              <div className="w-full">{espaco(i)}</div>
            </div>
          ))}
        </div>
        {/* o resto da mochila */}
        <div className="mt-2 grid max-h-[min(44dvh,330px)] grid-cols-5 gap-2 overflow-y-auto pr-1">
          {Array.from({ length: total - ATALHOS }, (_, k) => espaco(k + ATALHOS))}
        </div>

        {meus.length === 0 && (
          <p className="mt-3 text-center text-[12px] text-white/55">
            Mochila vazia. Colha na HOST FAZENDAS (cada colheita manda uma unidade para cá) ou pegue
            água de graça na fonte da praça.
          </p>
        )}
        {desconhecidos > 0 && (
          <p className="mt-2 text-[11px] text-white/40">
            Há {desconhecidos} item(ns) que esta versão do site não conhece.
          </p>
        )}

        {/* barra de ações */}
        <div className="mt-3 grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 rounded-xl border border-white/[0.07] bg-black/30 p-2">
          <input
            value={qtd}
            onChange={(e) => setQtd(e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric"
            placeholder="Quantidade"
            aria-label="Quantidade"
            className="h-10 min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
          <button
            type="button"
            disabled={(!sel && !arrastando) || ocupado}
            onClick={() => sel && onUsar(sel, n)}
            {...aceitaArrasto("usar")}
            onDrop={(e) => soltarNaAcao(e, "usar")}
            className={cn(
              "h-10 rounded-lg border border-transparent bg-white/[0.06] text-[13px] font-semibold transition-colors hover:bg-white/[0.12] disabled:opacity-40",
              arrastando && "border-dashed border-white/30",
              alvo === "usar" && "border-solid border-[#CE0E0E] bg-[#CE0E0E]/30",
            )}
          >
            {sel?.usar ?? "Usar"}
          </button>
          <button
            type="button"
            disabled={(!sel && !arrastando) || ocupado}
            onClick={() => sel && onJogarFora(sel, n)}
            {...aceitaArrasto("largar")}
            onDrop={(e) => soltarNaAcao(e, "largar")}
            className={cn(
              "h-10 rounded-lg border border-transparent bg-white/[0.06] text-[13px] font-semibold transition-colors hover:bg-white/[0.12] disabled:opacity-40",
              arrastando && "border-dashed border-white/30",
              alvo === "largar" && "border-solid border-[#CE0E0E] bg-[#CE0E0E]/30",
            )}
          >
            Largar
          </button>
          <button
            type="button"
            disabled={!sel && !arrastando}
            onClick={() =>
              toast.info(
                "Para enviar, chegue perto de alguém na praça, clique na pessoa e escolha Dar presente.",
              )
            }
            {...aceitaArrasto("enviar")}
            onDrop={(e) => soltarNaAcao(e, "enviar")}
            className={cn(
              "h-10 rounded-lg border border-transparent bg-white/[0.06] text-[13px] font-semibold transition-colors hover:bg-white/[0.12] disabled:opacity-40",
              arrastando && "border-dashed border-white/30",
              alvo === "enviar" && "border-solid border-[#CE0E0E] bg-[#CE0E0E]/30",
            )}
          >
            Enviar
          </button>
        </div>
        {sel && (
          <p className="mt-2 truncate px-1 text-[11.5px] text-white/55">
            {sel.emoji} {sel.nome} · {tenho} na mochila · {kg(sel.peso)} kg cada
            {efeitos(sel) ? ` · ${efeitos(sel)}` : ""} · arraste até Usar (ou clique duas vezes)
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
