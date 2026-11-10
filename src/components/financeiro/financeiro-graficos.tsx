import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";
import { moeda } from "@/lib/financeiro";

const TOOLTIP = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--foreground)",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 700 },
  itemStyle: { color: "var(--foreground)" },
};

interface ComparativoProps {
  data: { label: string; entradas: number; despesas: number; saldo: number }[];
}

/** Comparação mês a mês: entradas, despesas e linha de saldo. */
export function FinanceiroComparativo({ data }: ComparativoProps) {
  return (
    <div className="rounded-xl glass p-4">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Comparativo
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground font-display">Entradas x Despesas</h2>
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={70}
              tickFormatter={(v: number) => moeda(v).replace("R$", "").trim()}
            />
            <Tooltip
              {...TOOLTIP}
              formatter={(v: number | string) => moeda(Number(v))}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesas" name="Despesas" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="saldo"
              name="Saldo"
              stroke="#a8a8a8"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const CORES = ["var(--primary)", "#a8a8a8", "#10b981", "#f59e0b", "#a855f7"];

interface DistribuicaoProps {
  titulo: string;
  data: { nome: string; valor: number }[];
}

/** Pizza de distribuição das despesas do mês. */
export function FinanceiroDistribuicao({ titulo, data }: DistribuicaoProps) {
  const total = data.reduce((s, d) => s + d.valor, 0);

  return (
    <div className="rounded-xl glass p-4">
      <div className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Distribuição
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground font-display">{titulo}</h2>
      </div>
      {total === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhuma despesa registrada neste mês.
        </p>
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="valor" nameKey="nome" innerRadius={50} outerRadius={85}>
                {data.map((d, i) => (
                  <Cell key={d.nome} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
              <Tooltip {...TOOLTIP} formatter={(v: number | string) => moeda(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
