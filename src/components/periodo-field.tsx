import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { Matcher } from "react-day-picker";
import {
  ONLINE_PERIODOS_COMPLETOS,
  type IntervaloDatas,
  type OnlinePeriodo,
} from "@/lib/ilegal-online";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { cn } from "@/lib/utils";

/** "YYYY-MM-DD" -> Date ao meio-dia local: evita que o fuso do navegador vire o dia. */
function paraDate(data: string | undefined): Date | undefined {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return undefined;
  const d = new Date(`${data}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Date -> "YYYY-MM-DD" no dia local. */
function paraTexto(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

interface DataPickerProps {
  rotulo: string;
  value: string;
  onChange: (valor: string) => void;
  /** Data mínima selectable (inclusive). */
  min?: string | undefined;
  /** Data máxima selectable (inclusive). */
  max?: string | undefined;
  ariaLabel?: string | undefined;
}

/** Campo de data com calendário — clicável para abrir e trocar o dia. */
export function DataPicker({ rotulo, value, onChange, min, max, ariaLabel }: DataPickerProps) {
  const [aberto, setAberto] = React.useState(false);
  const selecionada = paraDate(value);
  const dMin = paraDate(min);
  const dMax = paraDate(max);

  const disabled: Matcher[] = [];
  if (dMin) disabled.push({ before: dMin });
  if (dMax) disabled.push({ after: dMax });

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel ?? rotulo}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selecionada && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          {selecionada ? (
            <span className="truncate">{format(selecionada, "dd/MM/yyyy")}</span>
          ) : (
            <span className="truncate">{rotulo}</span>
          )}
        </Button>
      </PopoverTrigger>
      {/* z acima dos modais (z-60) para o calendário não ficar escondido atrás deles. */}
      <PopoverContent
        align="start"
        className={cn("z-[90] w-auto p-0 pointer-events-auto", "p-3")}
      >
        <Calendar
          mode="single"
          selected={selecionada}
          defaultMonth={selecionada ?? new Date()}
          captionLayout="dropdown"
          disabled={disabled}
          initialFocus
          className="pointer-events-auto"
          onSelect={(d) => {
            if (!d) return;
            onChange(paraTexto(d));
            setAberto(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

interface PeriodoFieldProps {
  periodo: OnlinePeriodo;
  intervalo: IntervaloDatas;
  onPeriodo: (p: OnlinePeriodo) => void;
  onIntervalo: (v: IntervaloDatas) => void;
  label?: string;
  className?: string;
}

/**
 * Seletor de período: opções prontas (Hoje, 24h, 3 dias...) ou "Personalizado",
 * que abre dois calendários para escolher qualquer data inicial e final.
 */
export function PeriodoField({
  periodo,
  intervalo,
  onPeriodo,
  onIntervalo,
  label = "Período",
  className,
}: PeriodoFieldProps) {
  return (
    <div className={cn("block", className)}>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <MinimalSelect
        value={periodo}
        onChange={(v) => onPeriodo(v as OnlinePeriodo)}
        options={ONLINE_PERIODOS_COMPLETOS.map((p) => ({ value: p.id, label: p.label }))}
      />
      {periodo === "custom" && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">De</span>
            <DataPicker
              rotulo="Início"
              ariaLabel="Data inicial do período"
              value={intervalo.desde}
              max={intervalo.ate || undefined}
              onChange={(v) => onIntervalo({ ...intervalo, desde: v })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">Até</span>
            <DataPicker
              rotulo="Fim"
              ariaLabel="Data final do período"
              value={intervalo.ate}
              min={intervalo.desde || undefined}
              onChange={(v) => onIntervalo({ ...intervalo, ate: v })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

/** Mensagem de erro quando o período personalizado está incompleto ou invertido. */
export function erroDoPeriodoCustom(
  periodo: OnlinePeriodo,
  intervalo: IntervaloDatas
): string {
  if (periodo !== "custom") return "";
  if (!intervalo.desde || !intervalo.ate)
    return "Escolha as duas datas do período personalizado.";
  if (intervalo.desde > intervalo.ate)
    return "A data inicial não pode vir depois da data final.";
  return "";
}
