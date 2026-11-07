import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Inbox, ClipboardList, Code2, CalendarDays, Clock, Trophy, MessageCircle, Sparkles,
  Search, Bell, PenLine, ArrowUpRight, CalendarX2, Rocket, type LucideIcon,
} from "lucide-react";
import { Sidebar, MobileNav } from "@/components/dashboard/Sidebar";
import { Calendar } from "@/components/dashboard/Calendar";
import { Logo } from "@/components/dashboard/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — HOST" },
      { name: "description", content: "Visão geral do seu servidor FiveM no painel HOST." },
      { property: "og:title", content: "Dashboard — HOST" },
      { property: "og:description", content: "Visão geral do seu servidor FiveM no painel HOST." },
    ],
  }),
  component: Index,
});

const ranking = [
  { name: "nick", n: 179 },
  { name: "henrique", n: 104, me: true },
  { name: "lelet", n: 104 },
  { name: "larissa", n: 72 },
  { name: "jhonson", n: 62 },
];
const rankMax = Math.max(...ranking.map((r) => r.n));

const quickActions: { label: string; icon: LucideIcon; badge?: number; primary?: boolean }[] = [
  { label: "Aguardando aprovação", icon: Inbox, badge: 2, primary: true },
  { label: "Minhas pendências", icon: ClipboardList, badge: 10 },
  { label: "Quadro de dev", icon: Code2 },
  { label: "Eventos", icon: Sparkles },
];

const lanes = [
  { label: "Pendente", dot: "bg-ink-2" },
  { label: "Em andamento", dot: "bg-primary" },
  { label: "Concluído", dot: "bg-foreground" },
];

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function greeting(now: Date | null) {
  if (!now) return "Olá";
  const h = now.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function IconButton({ icon: Icon, label, dot }: { icon: LucideIcon; label: string; dot?: boolean }) {
  return (
    <button
      aria-label={label}
      className="relative grid h-9 w-9 place-items-center rounded-full text-ink-2 transition-colors duration-200 hover:bg-white/[0.06] hover:text-foreground"
    >
      <Icon className="h-[17px] w-[17px]" strokeWidth={1.6} />
      {dot && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-[#0d0d0d]" />}
    </button>
  );
}

function Index() {
  const now = useNow();
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<Date | null>(null);
  const day = selected ?? now;
  const isToday = day != null && now != null && isSameDay(day, now);

  return (
    <div className="relative z-10 flex min-h-screen">
      <Sidebar active={active} onSelect={setActive} />
      <MobileNav active={active} onSelect={setActive} />

      <main className="mx-auto w-full max-w-[1560px] px-4 pb-28 pt-5 md:px-8 md:pb-8 xl:px-10">
        {/* Top bar */}
        <header className="animate-rise flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="glass grid h-11 w-11 shrink-0 place-items-center rounded-full md:hidden">
              <Logo className="h-[18px]" />
            </span>
            <span className="glass hidden h-11 w-11 shrink-0 place-items-center rounded-full font-display text-sm font-semibold md:grid">H</span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">
                {greeting(now)}, <span className="font-semibold">henrique</span>
              </p>
              <p className="text-xs text-ink-3">Founder · Painel HOST</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="glass hidden items-center gap-2 rounded-full px-3.5 py-2 text-xs text-ink-2 lg:flex">
              <Rocket className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
              HOST Update <span className="font-medium text-foreground">2.1</span>
            </span>
            <div className="glass flex items-center gap-0.5 rounded-full p-1">
              <IconButton icon={Search} label="Buscar" />
              <IconButton icon={PenLine} label="Editar" />
              <IconButton icon={Bell} label="Notificações" dot />
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          {/* Hero */}
          <section
            style={delay(60)}
            className="glass-elevated animate-rise relative overflow-hidden rounded-[24px] p-6 md:p-7 lg:col-span-8"
          >
            <div className="pointer-events-none absolute -right-20 -top-32 h-72 w-[28rem] rounded-full bg-primary/[0.09] blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            <div className="relative flex items-center justify-between gap-3">
              <p className="eyebrow">HOST · Servidor FiveM</p>
              <span className="glass-inset flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-ink-2">
                <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.7} />
                {now ? cap(format(now, "EEEE, d 'de' MMMM", { locale: ptBR })) : "—"}
              </span>
            </div>

            <div className="relative mt-6 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-sm text-ink-2">Dashboard</h1>
                <p className="mt-1 font-display text-[56px] font-semibold leading-none tracking-[-0.045em] tabular-nums md:text-[68px]">
                  {now ? format(now, "HH:mm") : "--:--"}
                  <span className="text-ink-3">:{now ? format(now, "ss") : "--"}</span>
                </p>
                <p className="mt-3 text-sm text-ink-2">Visão geral do seu servidor FiveM</p>
              </div>

              <div className="glass-inset grid min-w-0 grid-cols-4 gap-1 rounded-[20px] p-3 sm:gap-4 sm:p-4">
                {quickActions.map((a) => (
                  <button key={a.label} className="group flex min-w-0 flex-col items-center gap-2 sm:w-20">
                    <span
                      className={cn(
                        "relative grid h-12 w-12 place-items-center rounded-full transition-all duration-200 group-hover:-translate-y-0.5 sm:h-14 sm:w-14",
                        a.primary
                          ? "bg-primary text-white"
                          : "border border-white/[0.08] bg-white/[0.045] text-foreground group-hover:bg-white/[0.08]",
                      )}
                    >
                      <a.icon className="h-5 w-5" strokeWidth={1.6} />
                      {a.badge != null && (
                        <span
                          className={cn(
                            "absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                            a.primary ? "bg-foreground text-black" : "bg-primary text-white",
                          )}
                        >
                          {a.badge}
                        </span>
                      )}
                    </span>
                    <span className="text-center text-[11px] leading-tight text-ink-2 transition-colors duration-200 group-hover:text-foreground">
                      {a.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Ranking */}
          <section
            style={delay(120)}
            className="glass surface-hover animate-rise flex flex-col rounded-[24px] p-5 lg:col-span-4 lg:row-span-2"
          >
            <header className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Ranking</p>
                <h2 className="mt-1 font-display text-lg font-semibold">Solicitações</h2>
              </div>
              <span className="glass-inset flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-ink-2">
                <Trophy className="h-3 w-3" strokeWidth={1.8} /> Top 5
              </span>
            </header>

            <div className="glass-inset mt-4 flex items-end justify-between rounded-2xl p-4">
              <div>
                <p className="text-[11px] text-ink-3">1º lugar</p>
                <p className="mt-0.5 text-base font-semibold">{ranking[0]!.name}</p>
              </div>
              <p className="font-display text-4xl font-semibold tracking-[-0.04em] tabular-nums">{ranking[0]!.n}</p>
            </div>

            <ol className="mt-3 flex flex-1 flex-col justify-between gap-1">
              {ranking.map((r, i) => (
                <li
                  key={r.name}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-white/[0.03]",
                    r.me && "bg-white/[0.04]",
                  )}
                >
                  {r.me && <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-primary" />}
                  <span className="w-5 text-center text-xs tabular-nums text-ink-3">{i + 1}</span>
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.07] bg-white/[0.04] text-xs font-semibold uppercase">
                    {r.name[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[13px] font-medium">
                      {r.name}
                      {r.me && <span className="rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-primary">você</span>}
                    </p>
                    <div className="mt-1.5 h-[3px] rounded-full bg-white/[0.06]">
                      <div
                        className={cn("h-full rounded-full", i === 0 ? "bg-foreground/80" : r.me ? "bg-primary" : "bg-white/25")}
                        style={{ width: `${(r.n / rankMax) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-9 text-right text-[13px] font-semibold tabular-nums">{r.n}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Stat tiles */}
          {[
            { t: "Tarefas em dev", v: 12, s: "no quadro de desenvolvimento", I: Code2 },
            { t: "Em revisão", v: 0, s: "aguardando validação", I: Clock },
          ].map((c, i) => (
            <section
              key={c.t}
              style={delay(180 + i * 60)}
              className="glass surface-hover animate-rise group flex items-end justify-between rounded-[24px] p-5 lg:col-span-4"
            >
              <div>
                <p className="flex items-center gap-2 text-xs text-ink-2">
                  <c.I className="h-3.5 w-3.5" strokeWidth={1.7} /> {c.t}
                </p>
                <p className="mt-4 font-display text-5xl font-semibold leading-none tracking-[-0.045em] tabular-nums">{c.v}</p>
                <p className="mt-2 text-xs text-ink-3">{c.s}</p>
              </div>
              <button
                aria-label={`Abrir ${c.t}`}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-ink-2 transition-all duration-200 group-hover:border-primary/40 group-hover:text-foreground"
              >
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.7} />
              </button>
            </section>
          ))}

          {/* Calendar */}
          <Calendar today={now} selected={selected} onSelect={setSelected} style={delay(300)} className="lg:col-span-5" />

          {/* Agenda */}
          <section style={delay(360)} className="glass surface-hover animate-rise flex flex-col rounded-[20px] p-5 lg:col-span-3">
            <header className="flex items-start justify-between gap-2">
              <div>
                <p className="eyebrow">{isToday ? "Eventos do dia" : "Eventos"}</p>
                <h2 className="mt-1 font-display text-lg font-semibold capitalize">
                  {day ? format(day, "EEE, d MMM", { locale: ptBR }) : "—"}
                </h2>
              </div>
              <a
                href="#"
                aria-label="Abrir eventos e cronograma"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08] text-ink-2 transition-colors duration-200 hover:text-foreground"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </header>

            <div className="glass-inset mt-4 flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl px-4 py-6 text-center">
              <CalendarX2 className="h-5 w-5 text-ink-3" strokeWidth={1.5} />
              <p className="text-[13px] text-ink-2">Nenhum evento neste dia.</p>
            </div>

            <p className="mt-5 text-xs font-medium text-ink-2">Próximos eventos</p>
            <div className="mt-2 rounded-2xl border border-dashed border-white/[0.07] px-4 py-4 text-center text-xs text-ink-3">
              Nenhum evento futuro agendado.
            </div>

            <a href="#" className="mt-4 text-xs font-medium text-ink-2 transition-colors duration-200 hover:text-foreground">
              Abrir eventos e cronograma <span className="text-primary">→</span>
            </a>
          </section>

          {/* Tarefas particulares */}
          <section style={delay(420)} className="glass surface-hover animate-rise flex flex-col rounded-[20px] p-5 lg:col-span-4">
            <header className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Pessoal</p>
                <h2 className="mt-1 font-display text-lg font-semibold">Tarefas particulares</h2>
              </div>
              <span className="glass-inset rounded-full px-2.5 py-1 text-[11px] tabular-nums text-ink-2">0 tarefas</span>
            </header>
            <div className="mt-4 flex flex-1 flex-col gap-2">
              {lanes.map((l) => (
                <div key={l.label} className="glass-inset flex flex-1 flex-col rounded-2xl p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full", l.dot)} />
                      {l.label}
                    </p>
                    <span className="text-xs tabular-nums text-ink-3">0</span>
                  </div>
                  <p className="mt-auto pt-3 text-xs text-ink-3">Sem tarefas</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <button
        aria-label="Chat"
        className="glass-elevated fixed bottom-24 right-5 z-40 grid h-12 w-12 place-items-center rounded-full text-foreground transition-transform duration-200 hover:-translate-y-0.5 md:bottom-6 md:right-6"
      >
        <MessageCircle className="h-5 w-5" strokeWidth={1.6} />
        <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-primary" />
      </button>
    </div>
  );
}
