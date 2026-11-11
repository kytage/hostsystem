import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, FileText, Handshake, Skull } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CaptacoesVagas } from "@/components/captacoes-vagas";
import { CaptacoesPipeline } from "@/components/captacoes-pipeline";
import { CaptacoesEstabelecimentos } from "@/components/captacoes-estabelecimentos";
import { CaptacoesProposta } from "@/components/captacoes-proposta";
import type { CaptacaoPrefill } from "@/components/captacao-dialog";
import { fetchCategorias, type IlegalOrg } from "@/lib/ilegal-data";
import {
  fetchEstabelecimentos,
  type Estabelecimento,
} from "@/lib/captacoes";
import { cn } from "@/lib/utils";
import { useMyAreas, useMyRole } from "@/lib/permissions";
import { hasCaptacoesAccess } from "@/lib/captacoes-access";

export const Route = createFileRoute("/_authenticated/captacoes")({
  head: () => ({
    meta: [
      { title: "Captações — HOST" },
      {
        name: "description",
        content:
          "Captação de organizações para as vagas livres do servidor: pipeline de negociação, reuniões e gerador de propostas de parceria.",
      },
      { property: "og:title", content: "Captações — HOST" },
      {
        property: "og:description",
        content:
          "Encontre organizações para as vagas livres, marque reuniões e gere a proposta de parceria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaptacoesPage,
});

type Modo = "ilegal" | "legal";
type Aba = "reunioes" | "estabelecimentos" | "proposta";

function CaptacoesPage() {
  const { data: areas, isPending, isError } = useMyAreas();
  const { data: role, isPending: rolePending } = useMyRole();
  if (isPending || rolePending) return <div className="p-6 text-muted-foreground" role="status">Carregando acesso…</div>;
  if (isError || !hasCaptacoesAccess(role, areas)) {
    return <div className="p-6"><PageHeader title="Acesso restrito" subtitle="Captações está disponível para as áreas ILEGAL, CAPTAÇÃO e POLÍCIA e para os cargos Coordinator, Direção, CEO e Founder." /></div>;
  }
  return <CaptacoesContent />;
}

function CaptacoesContent() {
  const [modo, setModo] = useState<Modo>("ilegal");
  const [aba, setAba] = useState<Aba>("reunioes");
  const [prefill, setPrefill] = useState<CaptacaoPrefill | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);

  const { data: categorias } = useQuery({
    queryKey: ["ilegal-orgs"],
    queryFn: fetchCategorias,
    staleTime: 30_000,
  });
  const { data: estabelecimentos } = useQuery({
    queryKey: ["captacoes-estabelecimentos"],
    queryFn: fetchEstabelecimentos,
    staleTime: 30_000,
  });

  const livresIlegal = (categorias ?? []).reduce(
    (acc, c) => acc + c.orgs.filter((o) => o.status === "Livre").length,
    0,
  );
  const livresLegal = (estabelecimentos ?? []).filter((e) => e.status === "livre").length;

  function captarIlegal(org: IlegalOrg) {
    setPrefill({ setagem: org.id, local: org.local });
    setAba("reunioes");
  }

  function captarLegal(est: Estabelecimento, categoria: string) {
    setPrefill({ organizacao: "", local: `${est.nome} (${categoria})` });
    setAba("reunioes");
  }

  const abas: { id: Aba; label: string; icon: typeof Handshake; soLegal?: boolean }[] = [
    { id: "reunioes", label: "Captações e reuniões", icon: Handshake },
    { id: "estabelecimentos", label: "Estabelecimentos", icon: Building2, soLegal: true },
    { id: "proposta", label: "Gerar proposta", icon: FileText },
  ];

  return (
    <div className="flex flex-col gap-6 pagina">
      <PageHeader
        title="Captações"
        subtitle="Encontre organizações para as vagas livres, marque reuniões e gere a proposta."
        actions={
          <div className="flex rounded-xl glass p-1">
            <button
              type="button"
              onClick={() => setModo("ilegal")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold tracking-wide transition-colors",
                modo === "ilegal"
                  ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Skull className="size-3.5" /> ILEGAL
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px]",
                  modo === "ilegal" ? "bg-white/20" : "bg-muted",
                )}
              >
                {livresIlegal} livres
              </span>
            </button>
            <button
              type="button"
              onClick={() => setModo("legal")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold tracking-wide transition-colors",
                modo === "legal"
                  ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Building2 className="size-3.5" /> LEGAL
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px]",
                  modo === "legal" ? "bg-white/20" : "bg-muted",
                )}
              >
                {livresLegal} livres
              </span>
            </button>
          </div>
        }
      />

      <section aria-label="Legenda de Captações" className="grid gap-4 border-y border-border py-4 md:grid-cols-2 md:gap-6">
        <div className="flex items-start gap-3 border-l-2 border-warning pl-3">
          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-warning">Amarelo · Primeiro contato</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Primeiro contato feito, DM criada e reunião sendo marcada ou aguardando resposta.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 border-l-2 border-info pl-3">
          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-info" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-info">Azul · Proposta aceita</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Tudo certo! Falta apenas entregar a organização e os benefícios.</p>
          </div>
        </div>
      </section>

      {/* Abas */}
      <div className="flex gap-1 border-b border-border">
        {abas
          .filter((a) => !a.soLegal || modo === "legal")
          .map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                aba === a.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <a.icon className={cn("size-4", aba === a.id && "text-primary")} />
              {a.label}
            </button>
          ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {aba === "reunioes" && (
          <CaptacoesPipeline
            prefill={prefill}
            onPrefillConsumed={() => setPrefill(null)}
            novaAberta={novaAberta}
            onNovaChange={setNovaAberta}
          />
        )}
        {aba === "estabelecimentos" && modo === "legal" && (
          <CaptacoesEstabelecimentos onCaptar={captarLegal} />
        )}
        {aba === "proposta" && <CaptacoesProposta />}

        {aba !== "proposta" && (
          <CaptacoesVagas
            modo={modo}
            onCaptarIlegal={captarIlegal}
            onCaptarLegal={captarLegal}
          />
        )}
      </div>
    </div>
  );
}
