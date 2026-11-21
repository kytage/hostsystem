import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  BookOpenCheck,
  Bot,
  CalendarRange,
  Clock3,
  Gavel,
  Headset,
  Languages,
  Lock,
  MessagesSquare,
  Palette,
  ScanEye,
  ScrollText,
  ShieldCheck,
  Skull,
  Sparkles,
  Terminal,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cursos")({
  head: () => ({
    meta: [
      { title: "Cursos — HOST" },
      { name: "description", content: "Cursos da staff HOST: básicos, por área e extras. Em breve." },
    ],
  }),
  component: CursosPage,
});

type Tag = "obrigatorio" | "extra" | "area" | "livre";

interface Curso {
  titulo: string;
  icone: LucideIcon;
  tag: Tag;
  /** Para os cursos de área: qual área. */
  area?: string;
}

const BASICOS: Curso[] = [
  { titulo: "Atendimento ao Player", icone: Headset, tag: "obrigatorio" },
  { titulo: "Comandos e Ferramentas da Staff", icone: Terminal, tag: "obrigatorio" },
  { titulo: "Regras Gerais da HOST", icone: ScrollText, tag: "obrigatorio" },
  { titulo: "Conduta e Postura da Staff", icone: UserCheck, tag: "obrigatorio" },
  { titulo: "Aplicação de Advertências e Punições", icone: Gavel, tag: "extra" },
  { titulo: "Comunicação e Resolução de Conflitos", icone: MessagesSquare, tag: "extra" },
  { titulo: "Segurança e Proteção de Dados", icone: ShieldCheck, tag: "extra" },
];

const POR_AREA: Curso[] = [
  { titulo: "VAR e Telagem", icone: ScanEye, tag: "area", area: "VAR" },
  { titulo: "Análise de Denúncias", icone: BookOpenCheck, tag: "area", area: "Denúncias" },
  { titulo: "Organização de Eventos e Competitive", icone: CalendarRange, tag: "area", area: "Eventos" },
  { titulo: "Atendimento e Gestão do Ilegal", icone: Skull, tag: "area", area: "Ilegal" },
];

const EXTRAS: Curso[] = [
  { titulo: "Inglês", icone: Languages, tag: "livre" },
  { titulo: "Design Básico", icone: Palette, tag: "livre" },
  { titulo: "Automações", icone: Bot, tag: "livre" },
];

const TAGS: Record<Tag, { texto: (c: Curso) => string; classe: string }> = {
  obrigatorio: { texto: () => "Obrigatório", classe: "curso-tag-obrigatorio" },
  extra: { texto: () => "Extra", classe: "curso-tag-extra" },
  area: { texto: (c) => `Área ${c.area ?? ""}`, classe: "curso-tag-area" },
  livre: { texto: () => "Extra", classe: "curso-tag-extra" },
};

/** Cursos (por enquanto só a vitrine "em breve"; o sistema e os certificados vêm depois). */
function CursosPage() {
  const total = BASICOS.length + POR_AREA.length + EXTRAS.length;
  return (
    <div className="pagina">
      <PageHeader kicker="Staff HOST" title="Cursos" subtitle="Formação da equipe: o básico de todo staff, os cursos de cada área e alguns extras." />

      <section className="curso-hero mt-4">
        <div className="relative z-[1] max-w-2xl">
          <span className="curso-embreve">
            <Sparkles className="size-3.5" /> Em breve
          </span>
          <h2 className="curso-hero-titulo">Cursos da staff HOST</h2>
          <p className="curso-hero-texto">
            Uma trilha para todo staff aprender o jeito HOST de trabalhar: atendimento, comandos, regras e
            conduta. Depois vêm os cursos de cada área e alguns extras para quem quiser ir além.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Numero valor={total} texto="cursos planejados" />
            <Numero valor={BASICOS.filter((c) => c.tag === "obrigatorio").length} texto="obrigatórios" />
            <Numero valor={POR_AREA.length} texto="por área" />
            <span className="curso-numero">
              <Award className="size-4 text-[#ff6a5c]" />
              <span>certificado ao concluir</span>
            </span>
          </div>
        </div>
        <img src="/marca/host-simbolo-vermelho.svg" alt="" aria-hidden className="curso-hero-marca" />
      </section>

      <Trilha
        titulo="Cursos básicos"
        nota="Para todo staff da HOST. Os 4 primeiros são obrigatórios."
        cursos={BASICOS}
        numerado
      />
      <Trilha titulo="Cursos por área" nota="Para quem faz parte de cada área." cursos={POR_AREA} />
      <Trilha titulo="Cursos extras" nota="Para quem quiser aprender mais." cursos={EXTRAS} />
    </div>
  );
}

function Numero({ valor, texto }: { valor: number; texto: string }) {
  return (
    <span className="curso-numero">
      <b>{valor}</b>
      <span>{texto}</span>
    </span>
  );
}

function Trilha({ titulo, nota, cursos, numerado }: { titulo: string; nota: string; cursos: Curso[]; numerado?: boolean }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <h3 className="pagina-titulo !mt-0 !text-[20px]">{titulo}</h3>
          <p className="hc-nota mt-0.5">{nota}</p>
        </div>
        <span className="hc-nota tabular-nums">{cursos.length} cursos</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cursos.map((c, i) => (
          <CartaoCurso key={c.titulo} curso={c} numero={numerado ? i + 1 : undefined} />
        ))}
      </div>
    </section>
  );
}

function CartaoCurso({ curso, numero }: { curso: Curso; numero?: number | undefined }) {
  const tag = TAGS[curso.tag];
  const Icone = curso.icone;
  return (
    <article className={cn("curso-card glass", curso.tag === "obrigatorio" && "curso-card-obrigatorio")}>
      <div className="flex items-start justify-between gap-3">
        <span className="curso-icone">
          <Icone className="size-5" strokeWidth={1.7} />
        </span>
        <span className={cn("curso-tag", tag.classe)}>{tag.texto(curso)}</span>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {numero ? `Curso ${String(numero).padStart(2, "0")}` : "Curso"}
      </p>
      <h4 className="mt-1 text-[15px] font-semibold leading-snug text-foreground">{curso.titulo}</h4>
      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Clock3 className="size-3.5" /> Em breve
        </span>
        <span className="curso-bloqueado" title="Disponível em breve">
          <Lock className="size-3.5" />
        </span>
      </div>
    </article>
  );
}
