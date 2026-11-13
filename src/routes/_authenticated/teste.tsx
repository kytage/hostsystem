import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useMyRole } from "@/lib/permissions";
import { Teste3D } from "@/components/hoki/teste-3d";

export const Route = createFileRoute("/_authenticated/teste")({
  head: () => ({
    meta: [
      { title: "TESTE — HOST" },
      { name: "description", content: "Campo de teste dos novos bonecos, animações e natureza do HOKI." },
    ],
  }),
  component: Teste,
});

/** Aba TESTE (só o Founder): campo aberto para experimentar os pacotes 3D novos antes de irem para o jogo. */
function Teste() {
  const { data: role, isLoading } = useMyRole();
  if (isLoading) return null;
  if (role !== "founder")
    return (
      <div className="grid min-h-[50vh] place-items-center text-center text-sm text-muted-foreground">
        <div>
          <Lock className="mx-auto mb-3 size-6" />
          Esta aba é só do Founder.
        </div>
      </div>
    );
  return (
    <>
      <PageHeader
        kicker="HOKI"
        title="TESTE"
        subtitle="Campo de teste: boneco com 43 animações, movimentação nova e a natureza em 3D. Clique numa animação para ver."
      />
      <Teste3D className="h-[calc(100dvh-11.5rem)] min-h-[420px] w-full" />
    </>
  );
}
