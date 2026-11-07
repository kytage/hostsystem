import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { eventoTipoDef, type Evento } from "@/lib/eventos";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];


export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface CalendarMonthProps {
  eventos: Evento[];
  selectedDay: string | null;
  onSelectDay: (dayKey: string) => void;
}

/** Calendário mensal minimalista com marcadores de eventos */
export function CalendarMonth({ eventos, selectedDay, onSelectDay }: CalendarMonthProps) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const porDia = useMemo(() => {
    const map = new Map<string, Evento[]>();
    for (const ev of eventos) {
      const k = dayKey(new Date(ev.dataInicio));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    }
    return map;
  }, [eventos]);

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    // semana começando na segunda-feira
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const list: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < offset; i++) {
      const d = new Date(view.year, view.month, i - offset + 1);
      list.push({ date: d, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ date: new Date(view.year, view.month, d), inMonth: true });
    }
    while (list.length % 7 !== 0) {
      const last = list[list.length - 1]!.date;
      list.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    }
    return list;
  }, [view]);

  const nav = (delta: number) =>
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  const todayKey = dayKey(today);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize text-foreground">
          {MONTHS[view.month]} <span className="text-muted-foreground">{view.year}</span>
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => nav(-1)}
            className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })}
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            Hoje
          </button>
          <button
            onClick={() => nav(1)}
            className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map(({ date, inMonth }) => {
          const k = dayKey(date);
          const evs = porDia.get(k) ?? [];
          const isToday = k === todayKey;
          const isSelected = k === selectedDay;
          return (
            <button
              key={k}
              onClick={() => onSelectDay(k)}
              className={cn(
                "relative flex min-h-9 flex-col items-center rounded-lg py-1.5 text-sm transition-colors",
                inMonth ? "text-foreground hover:bg-white/[0.08]" : "text-muted-foreground/40",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                !isSelected && isToday && "border border-primary/50 font-semibold"
              )}
            >
              <span className={cn("leading-none", isToday && !isSelected && "text-primary")}>
                {date.getDate()}
              </span>
              {evs.length > 0 && (
                <span className="mt-1 flex gap-0.5">
                  {evs.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className={cn(
                        "size-1 rounded-full",
                        isSelected ? "bg-primary-foreground" : eventoTipoDef(ev.tipo).dot
                      )}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
