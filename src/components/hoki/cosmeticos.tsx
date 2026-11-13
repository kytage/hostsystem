import { useState } from "react";
import { Coins, Crown, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  comprarItem,
  peca,
  RARIDADES,
  tem,
  VISUAL_PADRAO,
  type HokiPet,
  type Visual,
} from "@/lib/hoki";
import { playSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { CAPA_GLITTER, COROA_GLITTER, VIP_BLACK } from "./boneco-acessorios";

/** Os cosméticos do boneco à venda (o preço que vale na compra é o do banco, em hoshi_loja). */
const ITENS = [
  { id: VIP_BLACK, desenho: "vip" as const },
  { id: COROA_GLITTER, desenho: "coroa" as const },
  { id: CAPA_GLITTER, desenho: "capa" as const },
];

/** Desenhinho do item na vitrine (com brilho piscando, como o glitter no jogo). */
function Vitrine({ desenho }: { desenho: "coroa" | "capa" | "vip" }) {
  return (
    <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.16),rgba(255,255,255,0.02)_70%)]">
      {desenho === "vip" ? (
        <svg viewBox="0 0 40 44" className="h-10 w-9" aria-hidden>
          <defs>
            <linearGradient id="vip-brilho" x1="0" x2="1">
              <stop offset="0" stopColor="#1a1a1d" />
              <stop offset="0.45" stopColor="#3a3a40" />
              <stop offset="1" stopColor="#050506" />
            </linearGradient>
          </defs>
          <path
            d="M20 3c8 0 12 6 12 13 0 5-2 9-5 11v3c6 1 11 5 12 13H1c1-8 6-12 12-13v-3c-3-2-5-6-5-11C8 9 12 3 20 3z"
            fill="url(#vip-brilho)"
          />
          <rect
            x="6.5"
            y="13"
            width="27"
            height="5.5"
            rx="2.2"
            fill="#ff6a00"
            style={{ filter: "drop-shadow(0 0 3px #ff6a00)" }}
          />
        </svg>
      ) : desenho === "coroa" ? (
        <Crown
          className="size-8 text-[#f2c230] drop-shadow-[0_0_8px_rgba(242,194,48,0.7)]"
          fill="#f2c230"
          strokeWidth={1.4}
        />
      ) : (
        <svg
          viewBox="0 0 40 44"
          className="h-9 w-8 drop-shadow-[0_0_6px_rgba(160,160,180,0.45)]"
          aria-hidden
        >
          <path
            d="M12 3h16l2 4c4 10 6 22 8 34-6 2-12 2-18 1-6 1-12 1-18-1 2-12 4-24 8-34z"
            fill="#111114"
            stroke="#55555f"
            strokeWidth="1.2"
          />
        </svg>
      )}
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          aria-hidden
          className="absolute size-1 animate-ping rounded-full bg-white"
          style={{
            left: `${22 + ((i * 37) % 60)}%`,
            top: `${18 + ((i * 53) % 62)}%`,
            animationDuration: `${1.4 + i * 0.45}s`,
            animationDelay: `${i * 0.3}s`,
            opacity: desenho === "capa" ? 0.55 : 0.9,
            ...(desenho === "vip" ? { background: "#ff8a2a" } : {}),
          }}
        />
      ))}
    </div>
  );
}

/**
 * Lojinha de cosméticos do boneco (por enquanto a coroa e a capa de glitter).
 * Comprar gasta Staff Coins (o banco confere o preço e o saldo); usar e tirar
 * só mudam o visual salvo.
 */
export function Cosmeticos({
  pet,
  salvando,
  onUsar,
  onComprado,
  onClose,
}: {
  pet: HokiPet;
  salvando: boolean;
  onUsar: (visual: Visual) => void;
  onComprado: () => void;
  onClose: () => void;
}) {
  const [comprando, setComprando] = useState<string | null>(null);
  const comprar = async (id: string) => {
    const p = peca(id);
    if (!p) return;
    if (pet.coins < p.preco) {
      toast.error(`Faltam ${p.preco - pet.coins} Staff Coins para a ${p.nome.toLowerCase()}.`);
      return;
    }
    setComprando(id);
    try {
      await comprarItem(p);
      playSfx("success");
      toast.success(`${p.nome} é sua! Já está vestida.`);
      onComprado();
      onUsar({ ...pet.visual, [p.grupo]: p.id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu para comprar agora.");
    } finally {
      setComprando(null);
    }
  };
  return (
    <div
      role="dialog"
      aria-label="Cosméticos"
      className="pf-pop absolute left-3 top-14 z-30 w-[290px] max-w-[calc(100%-1.5rem)] rounded-2xl border border-white/15 bg-black/85 p-3 text-white backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
          Cosméticos
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar os cosméticos"
          className="grid size-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <ul className="space-y-2">
        {ITENS.map((it) => {
          const p = peca(it.id);
          if (!p) return null;
          const meu = tem(pet, p);
          const usando = pet.visual[p.grupo] === p.id;
          const rar = p.raridade ? RARIDADES[p.raridade] : null;
          return (
            <li
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2"
            >
              <Vitrine desenho={it.desenho} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{p.nome}</p>
                {rar && (
                  <p className="text-[10.5px] font-semibold" style={{ color: rar.cor }}>
                    {rar.nome}
                  </p>
                )}
                {meu ? (
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => {
                      playSfx("click");
                      // tirar o traje volta para o corpo de sempre (os outros espaços ficam vazios)
                      const vazio = p.grupo === "traje" ? VISUAL_PADRAO.traje : "";
                      onUsar({ ...pet.visual, [p.grupo]: usando ? vazio : p.id });
                    }}
                    className={cn(
                      "mt-1 h-7 rounded-lg px-3 text-[12px] font-semibold transition-colors disabled:opacity-50",
                      usando
                        ? "bg-white/12 text-white hover:bg-white/20"
                        : "bg-[#CE0E0E] text-white hover:brightness-110",
                    )}
                  >
                    {usando ? "Tirar" : "Usar"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={comprando !== null}
                    onClick={() => void comprar(p.id)}
                    className="mt-1 flex h-7 items-center gap-1.5 rounded-lg bg-amber-300 px-3 text-[12px] font-bold text-black transition-[filter] hover:brightness-105 disabled:opacity-60"
                  >
                    {comprando === p.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Coins className="size-3.5" strokeWidth={2.2} />
                    )}
                    {p.preco.toLocaleString("pt-BR")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
