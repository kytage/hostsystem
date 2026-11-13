import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, FileText, Handshake, Loader2, Skull } from "lucide-react";
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
  if (isPending || rolePending) return <div className="pagina" role="status"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando acesso…</p></div>;
  if (isError || !hasCaptacoesAccess(role, areas)) {
    return <div className="pagina"><PageHeader title="Acesso restrito" subtitle="Captações está disponível para as áreas ILEGAL, CAPTAÇÃO e POLÍCIA e para os cargos Coordinator, Direção, CEO e Founder." /></div>;
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
    <div className="flex flex-col gap-4 pagina">
      <PageHeader
        title="Captações"
        subtitle="Encontre organizações para as vagas livres, marque reuniões e gere a proposta."
        actions={
          <div className="segmentos" role="group" aria-label="Ilegal ou legal">
            <button type="button" aria-pressed={modo === "ilegal"} onClick={() => setModo("ilegal")}>
              <Skull className="size-3.5" /> ILEGAL
              <span className="tabular-nums opacity-60">{livresIlegal} livres</span>
            </button>
            <button type="button" aria-pressed={modo === "legal"} onClick={() => setModo("legal")}>
              <Building2 className="size-3.5" /> LEGAL
              <span className="tabular-nums opacity-60">{livresLegal} livres</span>
            </button>
          </div>
        }
      />

      <section aria-label="Legenda de Captações" className="glass hc grid gap-2.5 p-5 md:grid-cols-2">
        <div className="hc-dentro flex items-start gap-3 p-3.5">
          <span aria-hidden="true" className="mt-[5px] size-2 shrink-0 rounded-full bg-warning" />
          <div className="min-w-0">
            <h2 className="hc-titulo">Amarelo · Primeiro contato</h2>
            <p className="hc-nota mt-1 leading-relaxed">Primeiro contato feito, DM criada e reunião sendo marcada ou aguardando resposta.</p>
          </div>
        </div>
        <div className="hc-dentro flex items-start gap-3 p-3.5">
          <span aria-hidden="true" className="mt-[5px] size-2 shrink-0 rounded-full bg-info" />
          <div className="min-w-0">
            <h2 className="hc-titulo">Azul · Proposta aceita</h2>
            <p className="hc-nota mt-1 leading-relaxed">Tudo certo! Falta apenas entregar a organização e os benefícios.</p>
          </div>
        </div>
      </section>

      {/* Abas */}
      <div className="segmentos self-start" role="tablist" aria-label="Seções de Captações">
        {abas
          .filter((a) => !a.soLegal || modo === "legal")
          .map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => setAba(a.id)}
            >
              <a.icon className="size-3.5" />
              {a.label}
            </button>
          ))}
      </div>

      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
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
