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

/**
 * Calendário mensal da tela inicial, com marcadores de eventos. Hoje ganha um fio
 * vermelho e o dia escolhido vira uma tecla branca (classes `hc-dia`, em src/styles.css).
 */
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
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate font-display text-[15px] font-semibold capitalize tracking-[-0.015em] text-foreground sm:text-[17px]">
          {MONTHS[view.month]}{" "}
          <span className="font-normal text-muted-foreground">{view.year}</span>
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => nav(-1)} className="hc-seta" aria-label="Mês anterior">
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })}
            className="hc-pilula"
          >
            Hoje
          </button>
          <button type="button" onClick={() => nav(1)} className="hc-seta" aria-label="Próximo mês">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="pb-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3"
          >
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
              type="button"
              onClick={() => onSelectDay(k)}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              data-sem-elastico
              className="hc-dia"
              data-fora={inMonth ? undefined : ""}
              data-hoje={isToday ? "" : undefined}
              data-escolhido={isSelected ? "" : undefined}
            >
              <span className="leading-none">{date.getDate()}</span>
              {evs.length > 0 && (
                <span className="flex gap-0.5">
                  {evs.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className={cn(
                        "size-1 rounded-full",
                        isSelected ? "bg-current" : eventoTipoDef(ev.tipo).dot,
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
