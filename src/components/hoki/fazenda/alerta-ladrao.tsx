import { X } from "lucide-react";
import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";

/**
 * Alerta de roubo da HOST FAZENDAS: sirene de 4 segundos e um aviso vermelho que pisca junto.
 * Aparece para quem rouba (o alarme da fazenda disparou) e para o dono, onde ele estiver no painel.
 */
export function alertaDeLadrao(descricao: string, duracao = 9000) {
  playSfx("alarme");
  toast.custom(
    (id) => (
      <div
        role="alert"
        className="relative w-[min(420px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[#e5231b]/70 bg-black/90 p-3.5 pr-9 text-white shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      >
        {/* flash vermelho: pisca 8 vezes em 4 segundos, junto com a sirene */}
        <div
          aria-hidden
          className="alerta-pisca pointer-events-none absolute inset-0 bg-[#e5231b]/25 opacity-0"
        />
        <div className="relative flex items-start gap-3">
          <span
            aria-hidden
            className="alerta-balanca grid size-9 shrink-0 place-items-center rounded-xl bg-[#e5231b] text-lg shadow-[0_0_18px_rgba(229,35,27,0.55)]"
          >
            🚨
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-[#ff4a3d]">
              ⚠ ALERTA — LADRÃOZINHO NO PEDAÇO!
            </p>
            <p className="mt-0.5 break-words text-[12px] leading-snug text-white/80">{descricao}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          aria-label="Fechar o alerta"
          className="absolute right-2 top-2 grid size-6 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
    ),
    { duration: duracao, className: "!border-0 !bg-transparent !p-0 !shadow-none" },
  );
}
