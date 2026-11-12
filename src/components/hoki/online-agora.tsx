import { useEffect, useRef, useState } from "react";
import { ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Visual } from "@/lib/hoki";
import type { SeloDaPlaquinha } from "@/lib/fazenda/selos";
import { Hoki2D } from "./hoki-2d";

/** Uma pessoa online agora (eu incluído): onde está e o selo de nível da HOST FAZENDAS. */
export interface PessoaOnlineAgora {
  id: string;
  nome: string;
  tag: string;
  visual: Visual;
  dorme: boolean;
  naFazenda: boolean;
  souEu?: boolean;
}
type Aba = "online" | "dormindo" | "lobby" | "fazenda";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "online", nome: "Online" },
  { id: "dormindo", nome: "Dormindo" },
  { id: "lobby", nome: "Lobby" },
  { id: "fazenda", nome: "HOST Fazenda" },
];
const naAba = (p: PessoaOnlineAgora, aba: Aba) =>
  aba === "online"
    ? true
    : aba === "dormindo"
      ? p.dorme
      : aba === "fazenda"
        ? !p.dorme && p.naFazenda
        : !p.dorme && !p.naFazenda;
const ondeEsta = (p: PessoaOnlineAgora) =>
  p.dorme ? "dormindo no berço" : p.naFazenda ? "na HOST FAZENDAS" : "no lobby";

/**
 * Online agora: a pílula mostra o total de gente com o HOKI aberto; ao clicar, abre um
 * menu com quem está online, dormindo, no lobby ou na HOST FAZENDAS (nome e nível).
 */
export function OnlineAgora({
  pessoas,
  selos,
  onPessoa,
  abreParaCima = true,
  alinhar = "direita",
  className,
}: {
  pessoas: PessoaOnlineAgora[];
  selos: Record<string, SeloDaPlaquinha> | undefined;
  /** Clicou em alguém da lista (abre o perfil do HOKI). */
  onPessoa: (id: string) => void;
  abreParaCima?: boolean;
  alinhar?: "direita" | "esquerda";
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<Aba>("online");
  const caixa = useRef<HTMLDivElement>(null);
  // clicar fora ou apertar Esc fecha o menu
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAberto(false);
      }
    };
    window.addEventListener("pointerdown", fora);
    window.addEventListener("keydown", tecla, true);
    return () => {
      window.removeEventListener("pointerdown", fora);
      window.removeEventListener("keydown", tecla, true);
    };
  }, [aberto]);

  const total = pessoas.length;
  const lista = pessoas
    .filter((p) => naAba(p, aba))
    .sort(
      (a, b) =>
        Number(!!b.souEu) - Number(!!a.souEu) ||
        (selos?.[b.id]?.nivel ?? 0) - (selos?.[a.id]?.nivel ?? 0) ||
        a.nome.localeCompare(b.nome),
    );
  return (
    <div ref={caixa} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        title={`${total} online agora`}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11.5px] tabular-nums transition-colors",
          aberto
            ? "border-white/40 bg-white/[0.12] text-white"
            : "border-white/10 text-white/85 hover:border-white/25 hover:text-white",
        )}
      >
        <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
        <b className="font-semibold">{total}</b>
        <span className="text-white/55">online</span>
        <ChevronUp
          className={cn("size-3 text-white/50 transition-transform", !aberto && "rotate-180")}
          strokeWidth={2}
        />
      </button>
      {aberto && (
        <div
          role="dialog"
          aria-label="Quem está online agora"
          className={cn(
            "pf-pop absolute z-30 w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/15 bg-[#0d0d0d]/95 p-2.5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl",
            abreParaCima ? "bottom-12" : "top-12",
            alinhar === "direita" ? "right-0" : "left-0",
          )}
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-[13px] font-semibold">
              Online agora <span className="font-normal text-white/50">· {total}</span>
            </p>
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar"
              className="grid size-7 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="Onde estão">
            {ABAS.map((a) => {
              const n = pessoas.filter((p) => naAba(p, a.id)).length;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={aba === a.id}
                  onClick={() => setAba(a.id)}
                  className={cn(
                    "flex flex-col items-center rounded-xl px-1 py-1.5 text-[10px] font-semibold uppercase leading-tight tracking-wide transition-colors",
                    aba === a.id
                      ? "bg-white text-black"
                      : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white",
                  )}
                >
                  <span className="text-[14px] tabular-nums">{n}</span>
                  <span className="truncate">{a.nome}</span>
                </button>
              );
            })}
          </div>
          <ul className="mt-2 max-h-[240px] space-y-0.5 overflow-y-auto pr-0.5">
            {lista.map((p) => {
              const selo = selos?.[p.id];
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAberto(false);
                      onPessoa(p.id);
                    }}
                    title={`Ver o HOKI de ${p.nome}`}
                    className="flex w-full items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <span className="block size-8 shrink-0 overflow-hidden rounded-full border border-white/15 bg-black/50">
                      <Hoki2D visual={p.visual} busto />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="flex items-center gap-1.5">
                        {p.tag && (
                          <span className="shrink-0 rounded bg-[#ce0e0e] px-1 text-[8.5px] font-bold leading-[13px]">
                            {p.tag}
                          </span>
                        )}
                        <span className="truncate text-[12.5px] font-medium">{p.nome}</span>
                        {p.souEu && <span className="text-[10.5px] text-white/45">(você)</span>}
                      </span>
                      <span className="block truncate text-[10.5px] text-white/45">
                        {ondeEsta(p)}
                      </span>
                    </span>
                    <span
                      className="shrink-0 rounded-full px-1.5 text-[10.5px] font-extrabold leading-[17px] tabular-nums"
                      title={selo ? `Nível ${selo.nivel} (HOST FAZENDAS)` : "Ainda sem fazenda"}
                      style={
                        selo
                          ? { background: selo.fundo, color: selo.texto }
                          : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
                      }
                    >
                      {selo ? `Nv ${selo.nivel}` : "Nv –"}
                    </span>
                  </button>
                </li>
              );
            })}
            {lista.length === 0 && (
              <li className="py-6 text-center text-[11.5px] text-white/45">Ninguém aqui agora.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
