import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { contagemPor, type PunicaoRow } from "@/lib/punicoes";

interface PunicoesDistribuicaoProps {
  rows: PunicaoRow[];
}

/** Paleta fixa para as fatias dos gráficos (cores de gráfico não são tokens de tema). */
const CORES = [
  "#ce0e0e",
  "#a8a8a8",
  "#10b981",
  "#f59e0b",
  "#5f5f5f",
  "#ec4899",
  "#8a8a8a",
  "#f97316",
  "#84cc16",
  "#64748b",
  "#e11d48",
  "#14b8a6",
  "#a855f7",
  "#eab308",
  "#bdbdbd",
];

function Donut({
  titulo,
  dados,
}: {
  titulo: string;
  dados: { nome: string; total: number }[];
}) {
  const total = dados.reduce((acc, d) => acc + d.total, 0);

  return (
    <div className="flex flex-col rounded-2xl glass p-5 transition-colors hover:border-primary/30">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Distribuição
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground font-display">{titulo}</h2>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
          {total}
        </span>
      </div>

      {total === 0 ? (
        <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          Sem registros no período.
        </p>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
          {/* Donut centralizado — total desenhado dentro do SVG */}
          <div className="relative h-[190px] w-[190px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dados}
                  dataKey="total"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={86}
                  paddingAngle={dados.length > 1 ? 3 : 0}
                  cornerRadius={5}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                >
                  {dados.map((d, i) => (
                    <Cell key={d.nome} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    `${value} (${Math.round((value / total) * 100)}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold leading-none text-foreground font-display">{total}</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                total
              </span>
            </div>
          </div>

          {/* Legenda em lista com barras de proporção */}
          <ul className="w-full min-w-0 flex-1 space-y-2.5">
            {dados.map((d, i) => {
              const pct = Math.round((d.total / total) * 100);
              return (
                <li key={d.nome} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: CORES[i % CORES.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                      {d.nome}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-foreground">{d.total}</span>
                    <span className="w-9 shrink-0 text-right text-[10px] font-semibold text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                  <div className="ml-[18px] mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: CORES[i % CORES.length] }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Gráficos de pizza: motivos das denúncias e userset dos punidos. */
export function PunicoesDistribuicao({ rows }: PunicoesDistribuicaoProps) {
  const motivos = useMemo(() => contagemPor(rows, "motivo"), [rows]);
  const usersets = useMemo(() => contagemPor(rows, "userset"), [rows]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Donut titulo="Motivos" dados={motivos} />
      <Donut titulo="Userset" dados={usersets} />
    </div>
  );
}
