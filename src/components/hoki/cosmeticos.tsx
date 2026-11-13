import { useState, type ReactNode } from "react";
import { Coins, Crown, Heart, Loader2, X } from "lucide-react";
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
import {
  ASAS_ANJO,
  ASAS_FADA,
  AUREOLA_ANJO,
  BONE_HOST,
  CAPACETE_VIKING,
  CHAPEU_COWBOY,
  CHAPEU_PIRATA,
  CORACOES_FLUTUANDO,
  GORRO_INVERNO,
  GORRO_NATAL,
  LACO_FOFO,
  ORELHAS_GATO,
  ORELHAS_URSO,
  URSINHO_COSTAS,
} from "./boneco-enfeites";
import { LOOKS, lookServe } from "./boneco-roupa";

/** As seções da lojinha (o preço que vale na compra é o do banco, em hoshi_loja). */
const SECOES: { id: string; nome: string; itens: string[] }[] = [
  { id: "looks", nome: "Looks", itens: [...Object.keys(LOOKS), VIP_BLACK] },
  {
    id: "cabeca",
    nome: "Cabeça",
    itens: [
      LACO_FOFO,
      ORELHAS_GATO,
      ORELHAS_URSO,
      BONE_HOST,
      GORRO_INVERNO,
      GORRO_NATAL,
      CHAPEU_COWBOY,
      CHAPEU_PIRATA,
      AUREOLA_ANJO,
      CAPACETE_VIKING,
      COROA_GLITTER,
    ],
  },
  { id: "costas", nome: "Costas", itens: [URSINHO_COSTAS, ASAS_FADA, ASAS_ANJO, CAPA_GLITTER] },
  { id: "efeitos", nome: "Efeitos", itens: [CORACOES_FLUTUANDO] },
];

/** Desenhinho simples de cada item (viewBox 40 x 40). */
const DESENHOS: Record<string, ReactNode> = {
  [BONE_HOST]: (
    <>
      <path d="M8 26c0-10 6-16 13-16s12 6 12 16z" fill="#ce0e0e" />
      <path d="M20 26h18c0 3-4 4-9 4H20z" fill="#161618" />
      <rect x="16" y="17" width="9" height="4" rx="1" fill="#f4f4f2" />
    </>
  ),
  [CHAPEU_COWBOY]: (
    <>
      <path d="M3 26c6 4 28 4 34 0-2 5-30 5-34 0z" fill="#7a4c22" />
      <path d="M12 26l2-13c2-2 4 1 6 1s4-3 6-1l2 13c-5 2-11 2-16 0z" fill="#9a6331" />
      <rect x="13" y="22" width="14" height="3" fill="#3a2416" />
    </>
  ),
  [CHAPEU_PIRATA]: (
    <>
      <path d="M3 28c3-14 31-14 34 0-10-3-24-3-34 0z" fill="#141416" stroke="#e0b53a" />
      <circle cx="20" cy="20" r="3" fill="#f4f2ea" />
      <path d="M15 25l10-4M15 21l10 4" stroke="#f4f2ea" strokeWidth="1.6" />
    </>
  ),
  [GORRO_INVERNO]: (
    <>
      <path d="M9 28c0-12 5-17 11-17s11 5 11 17z" fill="#1f3a7a" />
      <rect x="8" y="25" width="24" height="6" rx="2" fill="#e9e6dc" />
      <circle cx="20" cy="9" r="4" fill="#f4f2ea" />
    </>
  ),
  [CAPACETE_VIKING]: (
    <>
      <path d="M8 18c-5-2-6-8-4-12 1 5 4 7 8 8zM32 18c5-2 6-8 4-12-1 5-4 7-8 8z" fill="#efe6cf" />
      <path d="M9 28c0-10 5-15 11-15s11 5 11 15z" fill="#9aa1a8" />
      <rect x="8" y="25" width="24" height="4" fill="#b07a32" />
      <rect x="19" y="13" width="2" height="12" fill="#b07a32" />
    </>
  ),
  [GORRO_NATAL]: (
    <>
      <path d="M9 28C11 16 18 8 28 10c3 1 4 4 3 6-3-4-7-2-8 2l3 10z" fill="#c8141c" />
      <rect x="7" y="26" width="22" height="6" rx="3" fill="#f6f4ee" />
      <circle cx="31" cy="17" r="3.5" fill="#f6f4ee" />
    </>
  ),
  [ORELHAS_GATO]: (
    <>
      <path d="M6 30C8 14 32 14 34 30" fill="none" stroke="#2a2a2e" strokeWidth="2" />
      <path d="M7 22l3-14 8 9zM33 22l-3-14-8 9z" fill="#1a1a1d" />
      <path d="M10 19l1-7 4 4zM30 19l-1-7-4 4z" fill="#f7a8c8" />
    </>
  ),
  [ORELHAS_URSO]: (
    <>
      <path d="M6 30C8 14 32 14 34 30" fill="none" stroke="#6b4226" strokeWidth="2" />
      <circle cx="10" cy="15" r="6" fill="#8a5a36" />
      <circle cx="30" cy="15" r="6" fill="#8a5a36" />
      <circle cx="10" cy="15" r="3" fill="#e8c9a0" />
      <circle cx="30" cy="15" r="3" fill="#e8c9a0" />
    </>
  ),
  [LACO_FOFO]: (
    <>
      <path d="M20 20L6 11v18zM20 20l14-9v18z" fill="#ff6fae" />
      <circle cx="20" cy="20" r="4" fill="#e84f93" />
    </>
  ),
  [AUREOLA_ANJO]: (
    <ellipse
      cx="20"
      cy="20"
      rx="14"
      ry="5"
      fill="none"
      stroke="#ffd75e"
      strokeWidth="3.5"
      style={{ filter: "drop-shadow(0 0 4px #ffb800)" }}
    />
  ),
  [URSINHO_COSTAS]: (
    <>
      <circle cx="11" cy="11" r="5" fill="#a0673a" />
      <circle cx="29" cy="11" r="5" fill="#a0673a" />
      <circle cx="20" cy="21" r="12" fill="#a0673a" />
      <ellipse cx="20" cy="26" rx="6" ry="4.5" fill="#e8c9a0" />
      <circle cx="15" cy="19" r="1.6" fill="#111" />
      <circle cx="25" cy="19" r="1.6" fill="#111" />
      <circle cx="20" cy="24.5" r="1.7" fill="#111" />
    </>
  ),
  [ASAS_ANJO]: (
    <>
      <path d="M19 18C14 8 5 8 2 12c3 2 3 6 6 7-2 2 0 5 3 5 2 2 6 1 8-6z" fill="#fbfaf6" />
      <path d="M21 18c5-10 14-10 17-6-3 2-3 6-6 7 2 2 0 5-3 5-2 2-6 1-8-6z" fill="#fbfaf6" />
    </>
  ),
  [ASAS_FADA]: (
    <g fill="#e7b8ff" fillOpacity="0.75" stroke="#c48aff" strokeWidth="0.8">
      <path d="M19 20C14 6 3 6 5 14c1 4 8 6 14 6zM21 20C26 6 37 6 35 14c-1 4-8 6-14 6z" />
      <path d="M19 21c-6 1-11 6-8 10 3 2 7-4 8-10zM21 21c6 1 11 6 8 10-3 2-7-4-8-10z" />
    </g>
  ),
  [CAPA_GLITTER]: (
    <path
      d="M12 3h16l2 4c4 10 6 22 8 30-6 2-12 2-18 1-6 1-12 1-18-1 2-8 4-20 8-30z"
      fill="#111114"
      stroke="#55555f"
      strokeWidth="1.2"
    />
  ),
  [VIP_BLACK]: (
    <>
      <path
        d="M20 2c8 0 12 6 12 12 0 4-2 8-5 10v3c6 1 10 4 11 11H2c1-7 5-10 11-11v-3c-3-2-5-6-5-10C8 8 12 2 20 2z"
        fill="#1f1f23"
      />
      <rect
        x="7"
        y="11"
        width="26"
        height="5"
        rx="2.2"
        fill="#ff6a00"
        style={{ filter: "drop-shadow(0 0 3px #ff6a00)" }}
      />
    </>
  ),
};

/** Camiseta e bermuda (ou saia, ou calça) com as cores do look. */
function DesenhoLook({ id }: { id: string }) {
  const a = LOOKS[id]?.a;
  if (!a) return null;
  const calca = (a.bainha ?? 0.6) < 0.3;
  const listras = a.estampaCamiseta === "listras";
  return (
    <>
      <path d="M13 3h14l9 5-3 6-4-2v12H11V12l-4 2-3-6z" fill={a.camiseta} stroke="#ffffff22" />
      {listras &&
        [7, 12, 17, 22].map((y) => (
          <rect key={y} x="11" y={y} width="18" height="2" fill={a.detalhe ?? a.camiseta} />
        ))}
      {a.mangas && <path d="M27 3l9 5-3 6-4-2zM13 3L4 8l3 6 4-2z" fill={a.mangas} />}
      <rect x="15" y="9" width="10" height="3" rx="1" fill={a.logo} />
      <path
        d={calca ? "M11 25h18l-1 14h-6l-2-9-2 9h-6z" : "M11 25h18l1 8h-8l-2-4-2 4h-8z"}
        fill={a.bermuda}
        stroke="#ffffff22"
      />
    </>
  );
}

/** Desenhinho do item na vitrine (com brilho piscando nos lendários). */
function Vitrine({ id, brilho }: { id: string; brilho: boolean }) {
  return (
    <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.16),rgba(255,255,255,0.02)_70%)]">
      {id === COROA_GLITTER ? (
        <Crown
          className="size-8 text-[#f2c230] drop-shadow-[0_0_8px_rgba(242,194,48,0.7)]"
          fill="#f2c230"
          strokeWidth={1.4}
        />
      ) : id === CORACOES_FLUTUANDO ? (
        <Heart
          className="size-8 text-[#ff4d7d] drop-shadow-[0_0_8px_rgba(255,77,125,0.7)]"
          fill="#ff4d7d"
          strokeWidth={1.4}
        />
      ) : (
        <svg viewBox="0 0 40 40" className="size-10" aria-hidden>
          {LOOKS[id] ? <DesenhoLook id={id} /> : DESENHOS[id]}
        </svg>
      )}
      {brilho &&
        [0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden
            className="absolute size-1 animate-ping rounded-full bg-white"
            style={{
              left: `${22 + ((i * 37) % 60)}%`,
              top: `${18 + ((i * 53) % 62)}%`,
              animationDuration: `${1.4 + i * 0.45}s`,
              animationDelay: `${i * 0.3}s`,
              opacity: id === CAPA_GLITTER ? 0.55 : 0.9,
              ...(id === VIP_BLACK ? { background: "#ff8a2a" } : {}),
            }}
          />
        ))}
    </div>
  );
}

/**
 * Lojinha de cosméticos do boneco: looks, coisas para a cabeça, para as costas e efeitos.
 * Comprar gasta Staff Coins (o banco confere o preço e o saldo); usar e tirar
 * só mudam o visual salvo. Os looks aparecem só para o corpo certo.
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
  const [secao, setSecao] = useState(SECOES[0]!.id);
  const corpo = pet.visual.corpo === "feminino" ? "feminino" : "padrao";
  const comprar = async (id: string) => {
    const p = peca(id);
    if (!p) return;
    if (pet.coins < p.preco) {
      toast.error(`Faltam ${p.preco - pet.coins} Staff Coins para: ${p.nome}.`);
      return;
    }
    setComprando(id);
    try {
      await comprarItem(p);
      playSfx("success");
      toast.success(`${p.nome}: é seu! Já está vestido.`);
      onComprado();
      onUsar({ ...pet.visual, [p.grupo]: p.id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu para comprar agora.");
    } finally {
      setComprando(null);
    }
  };
  const atual = SECOES.find((s) => s.id === secao) ?? SECOES[0]!;
  const itens = atual.itens.filter((id) => !LOOKS[id] || lookServe(id, corpo));
  return (
    <div
      role="dialog"
      aria-label="Cosméticos"
      className="pf-pop absolute left-3 top-14 z-30 flex max-h-[calc(100%-4.5rem)] w-[310px] max-w-[calc(100%-1.5rem)] flex-col rounded-2xl border border-white/15 bg-black/85 p-3 text-white backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
          Cosméticos
        </p>
        <span className="ml-auto mr-1 flex items-center gap-1 text-[11.5px] font-semibold text-amber-300">
          <Coins className="size-3.5" strokeWidth={2.2} />
          {pet.coins.toLocaleString("pt-BR")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar os cosméticos"
          className="grid size-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mb-2 grid grid-cols-4 gap-1">
        {SECOES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              playSfx("click");
              setSecao(s.id);
            }}
            className={cn(
              "h-7 rounded-lg text-[11.5px] font-semibold transition-colors",
              secao === s.id
                ? "bg-white/15 text-white"
                : "bg-white/[0.04] text-white/55 hover:bg-white/10 hover:text-white",
            )}
          >
            {s.nome}
          </button>
        ))}
      </div>
      <ul className="-mr-1 min-h-0 max-h-[min(60vh,420px)] flex-1 space-y-2 overflow-y-auto pr-1">
        {itens.map((id) => {
          const p = peca(id);
          if (!p) return null;
          const meu = tem(pet, p);
          const usando = pet.visual[p.grupo] === p.id;
          const rar = p.raridade ? RARIDADES[p.raridade] : null;
          return (
            <li
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2"
            >
              <Vitrine id={p.id} brilho={p.raridade === "lendario"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{p.nome}</p>
                <p className="text-[10.5px] font-semibold">
                  {rar && <span style={{ color: rar.cor }}>{rar.nome}</span>}
                  {p.preco === 0 && <span className="text-emerald-300"> · Grátis</span>}
                </p>
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
                    Comprar · {p.preco.toLocaleString("pt-BR")}
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
