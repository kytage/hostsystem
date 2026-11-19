import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import { PoliciaPainel } from "@/components/policia/policia-painel";
import { useMyAreas, useMyRole } from "@/lib/permissions";
import { hasPoliciaAccess } from "@/lib/policia";

export const Route = createFileRoute("/_authenticated/policia")({
  head: () => ({
    meta: [
      { title: "Polícia — HOST" },
      { name: "description", content: "Corporações, guarnições e efetivo da polícia do servidor HOST." },
    ],
  }),
  component: PoliciaPage,
});

function PoliciaPage() {
  const role = useMyRole();
  const areas = useMyAreas();
  if (role.isLoading || areas.isLoading)
    return (
      <div className="grid min-h-[60svh] place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (role.isError || areas.isError || !hasPoliciaAccess(role.data, areas.data))
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <div className="glass hc p-8 text-center">
          <span className="hc-icone mx-auto !size-11">
            <Lock className="size-5" strokeWidth={1.75} />
          </span>
          <h1 className="hc-titulo mt-4">Área restrita</h1>
          <p className="hc-nota mt-1.5">A Polícia é para Coordinator e acima, ou para quem tem a área Polícia.</p>
        </div>
      </div>
    );
  return <PoliciaPainel />;
}
