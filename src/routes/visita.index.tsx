import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Ticket } from "lucide-react";
import { LogoExtenso } from "@/components/dashboard/Logo";

export const Route = createFileRoute("/visita/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Convite do HOKI — HOST" }] }),
  component: CodigoPage,
});

/** Para quem recebeu só o código do convite: digita aqui e segue para criar a conta. */
function CodigoPage() {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");

  const seguir = (e: FormEvent) => {
    e.preventDefault();
    const limpo = codigo.trim().replace(/^.*\/visita\//, "");
    if (!/^[A-Za-z0-9]{8,32}$/.test(limpo)) {
      setErro("Código inválido. Confira e tente de novo.");
      return;
    }
    navigate({ to: "/visita/$token", params: { token: limpo } });
  };

  return (
    <div className="dark relative flex min-h-screen flex-col items-center overflow-hidden px-4">
      <div className="pf-glow pointer-events-none mt-[9vh] w-[min(1080px,94vw)] select-none">
        <LogoExtenso />
      </div>
      <div className="pf-modal glass relative z-10 -mt-[min(9vw,92px)] w-full max-w-sm rounded-[28px] !bg-black/45 p-6 backdrop-blur-2xl sm:p-7">
        <p className="eyebrow text-center">HOKI · Convite de visita</p>
        <h1 className="mt-2 text-center font-display text-2xl font-semibold tracking-tight">
          Tenho um código
        </h1>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          Cole o código (ou o link) que você recebeu.
        </p>
        <form onSubmit={seguir} className="mt-6 space-y-4">
          <span className="relative block">
            <Ticket className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              required
              autoFocus
              autoCapitalize="none"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="código do convite"
              className="h-12 w-full rounded-2xl border border-white/[0.09] bg-black/40 pl-11 pr-4 text-base text-foreground outline-none transition-colors placeholder:text-ink-3 focus:border-white/30 sm:text-sm"
            />
          </span>
          {erro && (
            <p role="alert" className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-red-200">
              {erro}
            </p>
          )}
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-black transition-all duration-200 hover:bg-white/90 active:scale-[0.985]"
          >
            Continuar
          </button>
        </form>
      </div>
    </div>
  );
}
