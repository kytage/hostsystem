import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Crown, LayoutGrid, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AreaMembro {
  id: string;
  username: string;
  avatar_url: string;
  role: string;
  areas: string[];
  areaNiveis?: Record<string, "lider" | "auxiliar">;
}

export interface AreaDef {
  key: string;
  label: string;
  emoji: string;
}

export interface AreasDashboardProps {
  membros: AreaMembro[];
  areas: AreaDef[];
  roleLabels: Record<string, string>;
  onSelectArea: (areaKey: string) => void;
}

interface AreaResumo {
  key: string;
  label: string;
  emoji: string;
  lideres: AreaMembro[];
  auxiliares: AreaMembro[];
  total: number;
}

const DEFICIT_LIMITE = 2;

/** Dashboard visual das áreas: KPIs, gráfico de distribuição e cards com líder/auxiliares. */
export function AreasDashboard({ membros, areas, roleLabels, onSelectArea }: AreasDashboardProps) {
  const resumo: AreaResumo[] = useMemo(() => {
    const defs = new Map(areas.map((a) => [a.key, a]));
    const chaves = Array.from(
      new Set([...areas.map((a) => a.key), ...membros.flatMap((m) => m.areas)])
    );

    return chaves
      .map((key) => {
        const def = defs.get(key);
        const doArea = membros.filter((m) => m.areas.includes(key));
        const lideres = doArea.filter((m) => (m.areaNiveis ?? {})[key] === "lider");
        const auxiliares = doArea.filter((m) => (m.areaNiveis ?? {})[key] !== "lider");
        return {
          key,
          label: def?.label ?? key,
          emoji: def?.emoji ?? "•",
          lideres,
          auxiliares,
          total: doArea.length,
        };
      })
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt-BR"));
  }, [membros, areas]);

  const totalAlocacoes = resumo.reduce((acc, a) => acc + a.total, 0);
  const semLider = resumo.filter((a) => a.lideres.length === 0).length;
  const emDeficit = resumo.filter((a) => a.total <= DEFICIT_LIMITE).length;
  const semArea = membros.filter((m) => m.areas.length === 0).length;

  const chartData = resumo
    .filter((a) => a.total > 0)
    .slice(0, 12)
    .map((a) => ({ nome: `${a.emoji} ${a.label}`, key: a.key, total: a.total }));

  return (
    <div className="space-y-5 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={LayoutGrid} label="Áreas ativas" value={resumo.filter((a) => a.total > 0).length} />
        <Kpi icon={Users} label="Alocações" value={totalAlocacoes} />
        <Kpi icon={Crown} label="Sem líder" value={semLider} tone={semLider > 0 ? "warning" : "default"} />
        <Kpi icon={AlertTriangle} label="Em déficit" value={emDeficit} tone={emDeficit > 0 ? "danger" : "default"} />
      </div>

      {chartData.length > 0 ? (
        <section className="rounded-xl border-border/60 glass p-4">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Distribuição por área</h3>
            <span className="text-xs text-muted-foreground">
              {semArea} membro{semArea === 1 ? "" : "s"} sem área
            </span>
          </header>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 40 }}>
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--accent))", opacity: 0.4 }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "hsl(var(--popover-foreground))",
                  }}
                  formatter={(v: number) => [`${v} membro${v === 1 ? "" : "s"}`, "Total"]}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={44}>
                  {chartData.map((d) => (
                    <Cell
                      key={d.key}
                      className={d.total <= DEFICIT_LIMITE ? "fill-warning" : "fill-primary"}
                      cursor="pointer"
                      onClick={() => onSelectArea(d.key)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {resumo.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma área encontrada.</p>
        ) : (
          resumo.map((a) => {
            const deficit = a.total <= DEFICIT_LIMITE;
            return (
              <article
                key={a.key}
                className={cn(
                  "flex flex-col gap-3 rounded-xl glass p-4 transition-colors",
                  deficit ? "border-warning/40" : "border-border/60 hover:border-primary/40"
                )}
              >
                <header className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectArea(a.key)}
                    title={`Ver equipe de ${a.label}`}
                    className="flex items-center gap-2 text-left text-sm font-semibold text-foreground hover:text-primary"
                  >
                    <span className="text-base">{a.emoji}</span>
                    {a.label}
                  </button>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      deficit
                        ? "border-warning/40 bg-warning/15 text-warning"
                        : "border-border bg-accent text-accent-foreground"
                    )}
                  >
                    {a.total} membro{a.total === 1 ? "" : "s"}
                  </span>
                </header>

                <Grupo
                  titulo="Líder"
                  icone={Crown}
                  destaque
                  pessoas={a.lideres}
                  roleLabels={roleLabels}
                />
                <Grupo
                  titulo="Auxiliares"
                  icone={User}
                  pessoas={a.auxiliares}
                  roleLabels={roleLabels}
                />
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <div className="rounded-xl border-border/60 glass p-3.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon
          className={cn(
            "size-3.5",
            tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-primary"
          )}
        />
        {label}
      </div>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold font-display",
          tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Grupo({
  titulo,
  icone: Icone,
  pessoas,
  destaque = false,
  roleLabels,
}: {
  titulo: string;
  icone: typeof Users;
  pessoas: AreaMembro[];
  destaque?: boolean;
  roleLabels: Record<string, string>;
}) {
  return (
    <div className="border-l-2 border-border/70 pl-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icone className={cn("size-3", destaque ? "text-primary" : "text-muted-foreground")} />
        {titulo}
      </div>
      {pessoas.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {pessoas.map((p) => (
            <span
              key={p.id}
              title={roleLabels[p.role] ?? p.role}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                destaque
                  ? "border-white/15 bg-white/[0.07] text-foreground"
                  : "border-border bg-accent text-accent-foreground"
              )}
            >
              {destaque ? <Crown className="size-3" /> : null}@{p.username}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
