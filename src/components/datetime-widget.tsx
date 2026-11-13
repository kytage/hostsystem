import { useEffect, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatDate(d: Date) {
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** Widget minimalista de data e hora — ocupa o espaço livre ao lado do ranking */
export function DatetimeWidget() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hora = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="glass hc flex w-full items-center gap-4 p-5 lg:w-auto lg:shrink-0">
      <span className="hc-icone !size-11">
        <CalendarDays className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="font-display text-[19px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          {formatDate(now)}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground/80">
            {WEEKDAYS[now.getDay()]}
          </span>
          <span className="text-ink-3">//</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3.5" />
            {hora}
          </span>
        </div>
      </div>
    </div>
  );
}
