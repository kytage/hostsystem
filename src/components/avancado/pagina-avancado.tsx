// Porta de entrada do HOST AVANÇADO: só Founder e CEO. O banco também barra os outros cargos.
import { lazy, Suspense } from "react";
import { Loader2, Lock } from "lucide-react";
import { useMyRole } from "@/lib/permissions";

const HostAvancado = lazy(() => import("@/avancado/host-avancado").then((m) => ({ default: m.HostAvancado })));

export const CARGOS_AVANCADO = ["founder", "c_level"] as const;
export const podeVerAvancado = (role: string | null | undefined) => !!role && (CARGOS_AVANCADO as readonly string[]).includes(role);

export function PaginaAvancado() {
  const { data: role, isLoading } = useMyRole();
  if (isLoading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (!podeVerAvancado(role)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <div className="glass hc p-8 text-center">
          <span className="hc-icone mx-auto !size-11">
            <Lock className="size-5" strokeWidth={1.75} />
          </span>
          <h1 className="hc-titulo mt-4">Área restrita</h1>
          <p className="hc-nota mt-1.5">O HOST AVANÇADO é exclusivo do Founder e do CEO.</p>
        </div>
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <HostAvancado />
    </Suspense>
  );
}
