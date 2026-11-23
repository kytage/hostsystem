// HOST AVANÇADO: o HOST CENTRAL (captação, conteúdo, tarefas e radar) dentro do site.
// Só Founder e CEO. As telas são as mesmas do painel local; os dados ficam no banco do site.
import { Suspense, lazy, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Bot, BookOpen, CalendarDays, Home, ListChecks, Radar, Settings, Users, type LucideIcon } from "lucide-react";
import { NavLink, useLocation } from "@/avancado/roteador";
import { usePainel } from "@/avancado/lib/consultas";
import { api } from "@/avancado/lib/api";
import { useGavetaAberta, fecharGaveta } from "@/avancado/lib/gavetas";
import { Carregando } from "@/avancado/ui/kit";
import { ConfirmarHost } from "@/avancado/ui/sobrepostos";
import { GavetaLead } from "@/avancado/features/gaveta-lead";
import { GavetaConteudo } from "@/avancado/features/gaveta-conteudo";
import { GavetaTarefa } from "@/avancado/features/gaveta-tarefa";
import "@/avancado/avancado.css";

const Inicio = lazy(() => import("@/avancado/pages/inicio"));
const Tarefas = lazy(() => import("@/avancado/pages/tarefas"));
const Captacao = lazy(() => import("@/avancado/pages/captacao"));
const Conteudo = lazy(() => import("@/avancado/pages/conteudo"));
const RadarPagina = lazy(() => import("@/avancado/pages/radar"));
const Materiais = lazy(() => import("@/avancado/pages/materiais"));
const Automacoes = lazy(() => import("@/avancado/pages/automacoes"));
const Configuracoes = lazy(() => import("@/avancado/pages/config"));

const SECOES: Array<{ nome: string; para: string; icone: LucideIcon; exato?: boolean; triagem?: boolean }> = [
  { nome: "Início", para: "/", icone: Home, exato: true },
  { nome: "Tarefas", para: "/tarefas", icone: ListChecks },
  { nome: "Captação", para: "/captacao", icone: Users, triagem: true },
  { nome: "Conteúdo", para: "/conteudo", icone: CalendarDays },
  { nome: "Radar", para: "/radar", icone: Radar },
  { nome: "Materiais", para: "/materiais", icone: BookOpen },
  { nome: "Automações", para: "/automacoes", icone: Bot },
  { nome: "Configurações", para: "/config", icone: Settings },
];

function PaginaAtual() {
  const { pathname } = useLocation();
  const primeiro = pathname.split("/").filter(Boolean)[0] ?? "";
  switch (primeiro) {
    case "tarefas":
      return <Tarefas />;
    case "captacao":
      return <Captacao />;
    case "conteudo":
      return <Conteudo />;
    case "radar":
      return <RadarPagina />;
    case "materiais":
      return <Materiais />;
    case "automacoes":
      return <Automacoes />;
    case "config":
      return <Configuracoes />;
    default:
      return <Inicio />;
  }
}

function Secoes() {
  const { data: painel } = usePainel();
  const triagem = painel?.captacao.para_triagem ?? 0;
  return (
    <div className="pagina nao-imprimir !pb-0">
      {/* título numa linha e seções na de baixo: o menu flutuante do site (canto de cima, à direita) não cobre nada */}
      <div className="flex flex-col items-start gap-3 px-1">
        <div className="flex h-9 items-center gap-2">
          <span className="font-display text-[17px] font-semibold tracking-[-0.015em]">HOST</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#ce0e0e]">Avançado</span>
        </div>
        <nav className="segmentos max-w-full" aria-label="Seções do HOST AVANÇADO">
          {SECOES.map((s) => (
            <NavLink key={s.para} to={s.para} end={s.exato === true}>
              <s.icone size={13} strokeWidth={1.9} />
              {s.nome}
              {s.triagem && triagem > 0 && <span className="contador contador-alerta">{triagem}</span>}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

/**
 * Monitor de jogadores online: no computador, o painel coletava de hora em hora sozinho.
 * No site, a coleta roda enquanto o HOST AVANÇADO estiver aberto (confere a cada 10 minutos
 * se a última leitura tem mais de 1 hora e se "Coletar de hora em hora" está ligado).
 */
function ColetaAutomatica() {
  useEffect(() => {
    let parado = false;
    const conferir = async () => {
      try {
        const config = await api.get<Record<string, unknown>>("/config");
        if (parado || config["mercado_cfx_ativo"] !== true) return;
        const { itens } = await api.get<{ itens: { ultima_coleta: string | null }[] }>("/mercado/servidores");
        const ultima = itens.map((s) => s.ultima_coleta ?? "").sort().pop() ?? "";
        if (ultima && Date.now() - new Date(ultima).getTime() < 60 * 60 * 1000) return;
        if (!parado) await api.post("/mercado/coletar");
      } catch {
        // sem tabela, sem internet ou sem permissão: tenta de novo na próxima volta
      }
    };
    void conferir();
    const volta = window.setInterval(() => void conferir(), 10 * 60 * 1000);
    return () => {
      parado = true;
      window.clearInterval(volta);
    };
  }, []);
  return null;
}

function Gavetas() {
  const g = useGavetaAberta();
  if (!g) return null;
  if (g.tipo === "lead") return <GavetaLead key={g.id} id={g.id} inicial={g.inicial} aoFechar={fecharGaveta} />;
  if (g.tipo === "conteudo") return <GavetaConteudo key={g.id} id={g.id} inicial={g.inicial} aoFechar={fecharGaveta} />;
  return <GavetaTarefa key={g.id} id={g.id} inicial={g.inicial} aoFechar={fecharGaveta} />;
}

export function HostAvancado() {
  // cache próprio: as chaves (["tarefas"], ["leads"]...) não se misturam com as do resto do site
  const [consultas] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } } }));
  return (
    <QueryClientProvider client={consultas}>
      <div className="hc-avancado">
        <Secoes />
        <Suspense fallback={<div className="pagina"><Carregando linhas={5} /></div>}>
          <PaginaAtual />
        </Suspense>
        <Gavetas />
        <ConfirmarHost />
        <ColetaAutomatica />
      </div>
    </QueryClientProvider>
  );
}
