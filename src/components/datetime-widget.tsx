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
    <div className="flex w-full items-center gap-4 rounded-2xl glass p-5 lg:w-auto lg:shrink-0">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <CalendarDays className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight text-foreground font-display">
          {formatDate(now)}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground/80">
            {WEEKDAYS[now.getDay()]}
          </span>
          <span className="text-border">//</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3.5 text-primary" />
            {hora}
          </span>
        </div>
      </div>
    </div>
  );
}
