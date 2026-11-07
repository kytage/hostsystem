import { useState } from "react";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  startOfMonth, startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const weekdays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

type Props = {
  today: Date | null;
  selected: Date | null;
  onSelect: (d: Date) => void;
  className?: string;
  style?: React.CSSProperties;
};

export function Calendar({ today, selected, onSelect, className, style }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const monthName = format(month, "MMMM", { locale: ptBR });

  return (
    <section style={style} className={cn("glass surface-hover animate-rise rounded-[20px] p-5", className)}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow">Calendário</p>
          <h2 className="mt-1 font-display text-lg font-semibold capitalize">
            {monthName} <span className="text-ink-3">{format(month, "yyyy")}</span>
          </h2>
        </div>
        <div className="glass-inset flex items-center gap-0.5 rounded-full p-1">
          <button
            aria-label="Mês anterior"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="grid h-7 w-7 place-items-center rounded-full text-ink-2 transition-colors duration-200 hover:bg-white/[0.06] hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              const now = new Date();
              setMonth(startOfMonth(now));
              onSelect(now);
            }}
            className="rounded-full px-3 py-1 text-xs font-medium text-ink-2 transition-colors duration-200 hover:bg-white/[0.06] hover:text-foreground"
          >
            Hoje
          </button>
          <button
            aria-label="Próximo mês"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="grid h-7 w-7 place-items-center rounded-full text-ink-2 transition-colors duration-200 hover:bg-white/[0.06] hover:text-foreground"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((d) => (
          <span key={d} className="pb-1 text-[10px] font-medium tracking-[0.14em] text-ink-3">{d}</span>
        ))}
        {days.map((d) => {
          const inMonth = isSameMonth(d, month);
          const isToday = today != null && isSameDay(d, today);
          const isSel = selected != null && isSameDay(d, selected) && !isToday;
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(d)}
              className={cn(
                "grid h-9 place-items-center rounded-[10px] text-[13px] tabular-nums transition-colors duration-200",
                inMonth ? "text-foreground/85 hover:bg-white/[0.05]" : "text-ink-3/50 hover:bg-white/[0.03]",
                isToday && "bg-primary font-semibold text-white hover:bg-primary",
                isSel && "bg-white/[0.08] font-medium text-foreground ring-1 ring-white/10",
              )}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>
    </section>
  );
}
