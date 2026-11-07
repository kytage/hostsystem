import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { serieDiaria, type PunicaoRow } from "@/lib/punicoes";

interface PunicoesGraficoProps {
  rows: PunicaoRow[];
  dias?: number;
}

/** Gráfico principal: evolução diária de punições por tipo no período selecionado. */
export function PunicoesGrafico({ rows, dias = 14 }: PunicoesGraficoProps) {
  const data = useMemo(() => serieDiaria(rows, dias), [rows, dias]);

  return (
    <div className="rounded-xl glass p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Últimos {dias} {dias === 1 ? "dia" : "dias"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground font-display">Evolução de punições</h2>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" /> Denúncias
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-500" /> VAR
          </span>
        </div>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-denuncia" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-var" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 12,
                color: "var(--foreground)",
              }}
              labelStyle={{ color: "var(--foreground)", fontWeight: 700 }}
              itemStyle={{ color: "var(--foreground)" }}
            />
            <Area
              type="monotone"
              dataKey="denuncia"
              name="Denúncias"
              stroke="var(--primary)"
              fill="url(#grad-denuncia)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="var"
              name="VAR"
              stroke="#3b82f6"
              fill="url(#grad-var)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
