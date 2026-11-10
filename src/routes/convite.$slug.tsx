import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/dashboard/Logo";
import { StoryAcoes, StoryPreview } from "@/components/org/story-preview";
import { copiarTexto } from "@/lib/copiar";
import { conviteAbrir, conviteClique } from "@/lib/org-painel.functions";
import { ATO, cargoLabel } from "@/lib/org-painel-shared";
import type { StoryDados } from "@/lib/story-ato";

export const Route = createFileRoute("/convite/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `${ATO} — HOST` },
      { name: "description", content: `Faço parte do ${ATO} da HOST.` },
      { property: "og:title", content: `${ATO} — HOST` },
      { property: "og:description", content: `Faço parte do ${ATO} da HOST.` },
    ],
  }),
  component: ConvitePage,
});

/** Cada navegador conta só uma visita por link, para o número não inflar com recarregamentos. */
function jaVisitou(slug: string): boolean {
  try {
    return localStorage.getItem(`host-convite-${slug}`) === "1";
  } catch {
    return false;
  }
}

function marcarVisita(slug: string) {
  try {
    localStorage.setItem(`host-convite-${slug}`, "1");
  } catch {
    // sem armazenamento: a visita pode ser contada de novo, sem problema
  }
}

function ConvitePage() {
  const { slug } = Route.useParams();
  const abrir = useServerFn(conviteAbrir);
  const clique = useServerFn(conviteClique);
  const [copiado, setCopiado] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: ["convite", slug],
    queryFn: async () => {
      const r = await abrir({ data: { slug, contar: !jaVisitou(slug) } });
      marcarVisita(slug);
      return r;
    },
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <Logo className="mx-auto h-10 [&_path]:fill-white" />
          <h1 className="mt-6 font-display text-xl font-semibold">Convite não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Esse link não existe mais. Peça um novo ao líder da sua organização.</p>
        </div>
      </div>
    );
  }

  const story: StoryDados = { chamada: "Faço parte do", nome: data.nome, etiqueta: `${cargoLabel(data.cargo)} · ${data.org}` };
  const link = window.location.href.split("#")[0] ?? window.location.href;

  const copiarLink = async () => {
    if (await copiarTexto(link)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1400);
      toast.success("Link copiado. Cole no sticker de link dos stories.");
    } else {
      toast.error("Não foi possível copiar. Copie o endereço da página.");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col items-center px-5 py-8">
      <Logo className="pf-sobe h-8 [&_path]:fill-white" />

      <div className="pf-sobe mt-6 text-center" style={{ animationDelay: "60ms" }}>
        <p className="eyebrow">HOST · {ATO}</p>
        <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight">{data.nome}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cargoLabel(data.cargo)} da {data.org} · faz parte do {ATO} da HOST
        </p>
      </div>

      {data.link_destino && (
        <a
          href={data.link_destino}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void clique({ data: { slug } }).catch(() => undefined)}
          className="pf-sobe mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          style={{ animationDelay: "120ms" }}
        >
          Entrar na HOST <ArrowUpRight className="size-4" />
        </a>
      )}

      <StoryPreview dados={story} className="pf-modal mt-6 w-[250px]" />

      <div className="pf-sobe mt-5 w-full space-y-2" style={{ animationDelay: "200ms" }}>
        <StoryAcoes dados={story} />
        <button
          type="button"
          onClick={() => void copiarLink()}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] text-sm text-foreground transition-colors hover:bg-white/[0.08]"
        >
          {copiado ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />} Copiar meu link
        </button>
      </div>

      <ol className="pf-sobe mt-6 w-full space-y-2.5 text-[13px] leading-relaxed text-muted-foreground" style={{ animationDelay: "260ms" }}>
        {["Salve a imagem no seu celular.", "Poste nos stories do Instagram.", "Adicione o sticker de link e cole o seu link."].map((passo, i) => (
          <li key={passo} className="flex gap-2.5">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[10px] font-semibold text-foreground">{i + 1}</span>
            <span>{passo}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
