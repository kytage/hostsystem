import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Corpo } from "./boneco";

const OPCOES: { id: Corpo; nome: string; arte: string }[] = [
  { id: "padrao", nome: "Masculino", arte: "/hoki/boneco/escolha-masculino.webp" },
  { id: "feminino", nome: "Feminino", arte: "/hoki/boneco/escolha-feminino.webp" },
];

/**
 * Primeiro acesso depois da atualização dos personagens: a pessoa escolhe o
 * gênero do personagem antes de entrar. Aparece enquanto o visual não tiver
 * `corpo` (quem já escolheu nunca mais vê); depois dá para trocar no botão
 * "Corpo" do cartão.
 */
export function EscolhaDeGenero({
  salvando,
  onEscolher,
}: {
  salvando: boolean;
  onEscolher: (corpo: Corpo) => void;
}) {
  const [marcado, setMarcado] = useState<Corpo | null>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  // por cima da página inteira (o cartão tem animação, que prenderia a janela dentro dele)
  if (!pronto) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="escolha-genero-titulo"
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md"
    >
      <div className="pf-pop w-full max-w-[560px] rounded-3xl border border-white/12 bg-[#0c0c0e] p-5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:p-7">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#CE0E0E]">
          Novidade no HOKI
        </p>
        <h2
          id="escolha-genero-titulo"
          className="mt-1 text-[22px] font-semibold leading-tight sm:text-[26px]"
        >
          Escolha o seu personagem
        </h2>
        <p className="mt-1.5 text-[13px] text-white/60">
          Os personagens ganharam corpo novo, roupa básica da HOST e movimentação nova. Dá para
          trocar depois no botão Corpo.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {OPCOES.map((o) => {
            const ativo = marcado === o.id;
            return (
              <button
                key={o.id}
                type="button"
                disabled={salvando}
                aria-pressed={ativo}
                onClick={() => setMarcado(o.id)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-2 text-left transition-all duration-200",
                  ativo
                    ? "border-[#CE0E0E] shadow-[0_0_0_3px_rgba(206,14,14,0.25)]"
                    : "border-white/10 hover:-translate-y-0.5 hover:border-white/25",
                )}
              >
                <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.14),transparent_65%)]">
                  <img
                    src={o.arte}
                    alt={`Personagem ${o.nome.toLowerCase()}`}
                    className="h-full w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                    draggable={false}
                  />
                </div>
                <p className="mt-2 text-center text-[14px] font-semibold">{o.nome}</p>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!marcado || salvando}
          onClick={() => marcado && onEscolher(marcado)}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#CE0E0E] text-[14px] font-semibold text-white transition-[opacity,transform] hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
        >
          {salvando && <Loader2 className="size-4 animate-spin" />}
          {marcado ? "Confirmar" : "Escolha um personagem"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
