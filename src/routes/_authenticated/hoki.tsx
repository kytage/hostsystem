import { createFileRoute } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { HokiCard } from "@/components/hoki/hoki-card";
import { supabase } from "@/integrations/supabase/client";
import { useSouVisita } from "@/lib/hoki-visita";

export const Route = createFileRoute("/_authenticated/hoki")({
  head: () => ({ meta: [{ title: "HOKI — HOST" }] }),
  component: HokiPage,
});

/** Tela só do HOKI. É a única que a visita enxerga; a equipe também pode abrir. */
function HokiPage() {
  const visita = useSouVisita();
  return (
    <div className="pagina">
      <div className="pagina-topo mb-4">
        <div className="min-w-0">
          <p className="hc-sobre">{visita ? "Visita" : "HOKI"}</p>
          <h1 className="pagina-titulo">Praça do HOKI</h1>
        </div>
        {visita && (
          <button
            onClick={() => void supabase.auth.signOut().then(() => window.location.assign("/auth"))}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-black/60 px-3 text-[12px] font-medium text-white transition-colors hover:bg-white/10"
          >
            <LogOut className="size-3.5" /> Sair
          </button>
        )}
      </div>
      <HokiCard alto />
    </div>
  );
}
