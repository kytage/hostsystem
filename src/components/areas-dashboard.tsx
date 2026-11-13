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
import { Indice, Indices } from "@/components/indice";
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
      <Indices>
        <Kpi icon={LayoutGrid} label="Áreas ativas" value={resumo.filter((a) => a.total > 0).length} />
        <Kpi icon={Users} label="Alocações" value={totalAlocacoes} />
        <Kpi icon={Crown} label="Sem líder" value={semLider} tone={semLider > 0 ? "warning" : "default"} />
        <Kpi icon={AlertTriangle} label="Em déficit" value={emDeficit} tone={emDeficit > 0 ? "danger" : "default"} />
      </Indices>

      {chartData.length > 0 ? (
        <section className="glass hc p-5">
          <header className="mb-4 flex items-baseline justify-between gap-3">
            <h3 className="hc-titulo">Distribuição por área</h3>
            <span className="hc-nota">
              {semArea} membro{semArea === 1 ? "" : "s"} sem área
            </span>
          </header>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 40 }}>
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
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
                  cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "var(--popover-foreground)",
                  }}
                  formatter={(v: number) => [`${v} membro${v === 1 ? "" : "s"}`, "Total"]}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={44}>
                  {chartData.map((d) => (
                    <Cell
                      key={d.key}
                      // vermelho só nas áreas com poucos membros (pedem atenção); as demais ficam cinza
                      className={
                        d.total <= DEFICIT_LIMITE ? "fill-primary" : "fill-muted-foreground"
                      }
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

      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {resumo.length === 0 ? (
          <p className="rounded-[22px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Nenhuma área encontrada.
          </p>
        ) : (
          resumo.map((a) => {
            const deficit = a.total <= DEFICIT_LIMITE;
            return (
              <article
                key={a.key}
                className={cn("glass hc flex flex-col gap-3 p-5", deficit && "!border-primary/40")}
              >
                <header className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectArea(a.key)}
                    title={`Ver equipe de ${a.label}`}
                    className="flex min-w-0 items-center gap-3 text-left transition-opacity hover:opacity-80"
                  >
                    <span className="hc-icone text-[17px] leading-none">{a.emoji}</span>
                    <span className="hc-titulo truncate">{a.label}</span>
                  </button>
                  <span className="hc-selo shrink-0 tabular-nums">
                    {/* poucos membros: um ponto vermelho, pede atenção */}
                    {deficit && <i className="size-1.5 rounded-full bg-primary" aria-hidden />}
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
  // quadro de número da tela inicial; "warning" e "danger" pedem ação (ponto vermelho ao lado do número)
  return <Indice valor={value} titulo={label} icone={Icon} alerta={tone !== "default"} />;
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
    <div className="hc-dentro p-3">
      <div className="hc-sobre mb-2 flex items-center gap-1.5">
        <Icone className={cn("size-3", destaque ? "text-amber-300" : "text-muted-foreground")} />
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
              className={cn("hc-selo", destaque && "!text-foreground")}
            >
              {destaque ? <Crown className="size-3 text-amber-300" /> : null}@{p.username}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
