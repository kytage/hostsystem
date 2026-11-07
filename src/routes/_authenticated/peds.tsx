import { Suspense } from "react";
import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { PedsContent } from "@/components/peds/peds-content";
import { Button } from "@/components/ui/button";
import { useMyAreas, useMyRole } from "@/lib/permissions";
import { hasPedsAccess } from "@/lib/peds-access";

export const Route = createFileRoute("/_authenticated/peds")({
  head: () => ({ meta: [
    { title: "Peds e Kids — HOST" }, { name: "description", content: "Controle de Peds e Kids HOST: skins, responsáveis, passaportes, Discord e situação dos cadastros." },
    { property: "og:title", content: "Peds e Kids — HOST" }, { property: "og:description", content: "Gestão de skins e cadastros de Peds do servidor HOST." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PedsPage,
  errorComponent: PedsError,
});
function PedsError({ reset }: ErrorComponentProps) {
  return <div className="space-y-4 p-6"><h1 className="text-xl font-semibold font-display">Não foi possível carregar Peds</h1><Button onClick={reset}>Tentar novamente</Button></div>;
}
function PedsPage() {
  const role = useMyRole();
  const areas = useMyAreas();
  if (role.isPending || areas.isPending) return <Loading />;
  if (role.isError || areas.isError || !hasPedsAccess(role.data, areas.data)) return <div className="p-6"><h1 className="text-xl font-semibold font-display">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Disponível para Coordinator, Direção, CEO, Founder e áreas PED/KIDS.</p></div>;
  return <Suspense fallback={<Loading />}><PedsContent /></Suspense>;
}
function Loading() { return <div role="status" className="animate-pulse p-6 text-muted-foreground">Carregando Peds…</div>; }