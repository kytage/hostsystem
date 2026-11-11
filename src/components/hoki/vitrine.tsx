import {
  Crown,
  PawPrint,
  Footprints,
  Glasses,
  Hand,
  Landmark,
  Shirt,
  Sparkles,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { catalogo, PECAS, TODAS_AS_CATEGORIAS, type Peca } from "@/lib/hoki";
import { miniatura } from "./miniaturas";

/** Ícone de cada categoria (a lista de categorias vem do catálogo). */
const ICONES: Record<string, LucideIcon> = {
  trajes: PawPrint,
  efeitos: Sparkles,
  roupas: Shirt,
  chapeus: Crown,
  rosto: Glasses,
  luvas: Hand,
  calcados: Footprints,
  costas: Wind,
  podios: Landmark,
};
export const CATEGORIAS_DA_VITRINE = TODAS_AS_CATEGORIAS.map((c) => ({
  ...c,
  Icone: ICONES[c.id] ?? Sparkles,
}));
export type CategoriaDaVitrine = (typeof CATEGORIAS_DA_VITRINE)[number];

/** Catálogo com os preços e níveis do banco (cai na lista local enquanto carrega). */
export function useCatalogo() {
  const { data = PECAS } = useQuery({
    queryKey: ["hoki-catalogo"],
    queryFn: catalogo,
    staleTime: 300_000,
  });
  return data;
}

/** Miniatura de uma peça: a foto 3D dela (vestida no HOKI, ou o próprio pódio). Enquanto a foto não chega, mostra a cor da peça. */
export function Miniatura({ p, className }: { p: Peca; className?: string }) {
  const [foto, setFoto] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setFoto(null);
    miniatura(p)
      .then((f) => vivo && setFoto(f))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [p]);
  if (foto)
    return (
      <img
        src={foto}
        alt={p.nome}
        draggable={false}
        className={cn("h-full w-full object-contain", className)}
      />
    );
  return (
    <span aria-label={p.nome} className={cn("grid h-full w-full place-items-center", className)}>
      <span
        className="size-10 animate-pulse rounded-full opacity-60"
        style={{ background: p.cor }}
      />
    </span>
  );
}

/** Coluna de categorias, usada na loja e no guarda-roupa. */
export function Categorias({
  atual,
  onMudar,
  contar,
  inicio,
  fim,
}: {
  atual: string;
  onMudar: (id: string) => void;
  contar: (c: CategoriaDaVitrine) => number;
  /** Uma entrada extra no começo da lista (as cores, no guarda-roupa). */
  inicio?: { id: string; nome: string; Icone: LucideIcon; n: number };
  /** Uma entrada extra no fim, em dourado (os itens exclusivos de quem tem). */
  fim?: { id: string; nome: string; Icone: LucideIcon; n: number };
}) {
  const semGrupos = [] as CategoriaDaVitrine["grupos"];
  const lista = [
    ...(inicio ? [{ ...inicio, grupos: semGrupos }] : []),
    ...CATEGORIAS_DA_VITRINE,
    ...(fim ? [{ ...fim, grupos: semGrupos }] : []),
  ];
  return (
    <nav
      aria-label="Categorias"
      className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.07] p-2 md:w-[224px] md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:p-3"
    >
      {lista.map((c) => {
        const n =
          inicio && c.id === inicio.id ? inicio.n : fim && c.id === fim.id ? fim.n : contar(c);
        const ativa = c.id === atual;
        const dourada = !!fim && c.id === fim.id;
        return (
          <button
            key={c.id}
            onClick={() => onMudar(c.id)}
            aria-current={ativa}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-left text-[13px] transition-colors",
              ativa
                ? "bg-white/[0.1] text-foreground"
                : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
              dourada &&
                "border border-amber-400/30 bg-amber-400/[0.07] font-semibold uppercase tracking-[0.08em] text-amber-200 hover:bg-amber-400/[0.12] hover:text-amber-100",
              dourada && ativa && "!bg-amber-400/[0.18]",
            )}
          >
            <c.Icone
              className={cn(
                "size-4 shrink-0",
                dourada ? "text-amber-300" : ativa && "text-primary",
              )}
              strokeWidth={1.8}
            />
            <span className="min-w-0 flex-1 truncate">{c.nome}</span>
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] tabular-nums",
                n ? "bg-white/[0.08] text-foreground/80" : "text-ink-3",
              )}
            >
              {n}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Aviso de categoria vazia. */
export function Vazio({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid h-full min-h-[220px] place-items-center p-6 text-center">
      <div>
        <p className="font-display text-base font-semibold">{titulo}</p>
        <p className="mx-auto mt-1 max-w-[280px] text-xs text-muted-foreground">{texto}</p>
        {children && <div className="mt-3 flex justify-center">{children}</div>}
      </div>
    </div>
  );
}
