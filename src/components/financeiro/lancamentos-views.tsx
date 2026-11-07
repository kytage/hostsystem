import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_CLASSES,
  STATUS_LABELS,
  SUBTIPO_LABELS,
  TIPO_CLASSES,
  TIPO_LABELS,
  addMeses,
  mesLabel,
  moeda,
  type Entrada,
  type Saida,
  type SaidaStatus,
  type SaidaSubtipo,
  type SaidaTipo,
} from "@/lib/financeiro";

/* ------------------------------------------------------------------ *
 * Filtro de período (por mês de competência)
 * ------------------------------------------------------------------ */

export type PeriodoKey = "mes" | "3m" | "6m" | "12m" | "ano" | "todos";

const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: "mes", label: "Mês atual" },
  { key: "3m", label: "Últimos 3 meses" },
  { key: "6m", label: "Últimos 6 meses" },
  { key: "12m", label: "Últimos 12 meses" },
  { key: "ano", label: "Ano corrente" },
  { key: "todos", label: "Todos" },
];

/** Intervalo de meses (inclusivo) para o período escolhido. */
function intervaloMeses(mes: string, periodo: PeriodoKey): { de: string; ate: string } | null {
  if (periodo === "todos") return null;
  if (periodo === "mes") return { de: mes, ate: mes };
  if (periodo === "ano") return { de: `${mes.slice(0, 4)}-01-01`, ate: `${mes.slice(0, 4)}-12-01` };
  const meses = periodo === "3m" ? 2 : periodo === "6m" ? 5 : 11;
  return { de: addMeses(mes, -meses), ate: mes };
}

function dentroDoPeriodo(mesRegistro: string, mes: string, periodo: PeriodoKey): boolean {
  const range = intervaloMeses(mes, periodo);
  if (!range) return true;
  return mesRegistro >= range.de && mesRegistro <= range.ate;
}

const selectClasses =
  "rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60";

function FiltroBarra({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl glass p-4">
      {children}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Total({ label, valor, tom }: { label: string; valor: string; tom: string }) {
  return (
    <div className="rounded-xl glass px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-semibold tracking-tight font-display", tom)}>{valor}</p>
    </div>
  );
}

const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

/* ------------------------------------------------------------------ *
 * Aba: apenas Entradas
 * ------------------------------------------------------------------ */

export interface EntradasViewProps {
  mes: string;
  entradas: Entrada[];
  onNova: () => void;
  onEditar: (entrada: Entrada) => void;
  onExcluir: (entrada: Entrada) => void;
}

export function EntradasView({ mes, entradas, onNova, onEditar, onExcluir }: EntradasViewProps) {
  const [periodo, setPeriodo] = useState<PeriodoKey>("mes");
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return entradas
      .filter((e) => dentroDoPeriodo(e.mes, mes, periodo))
      .filter(
        (e) =>
          !termo ||
          e.titulo.toLowerCase().includes(termo) ||
          e.observacao.toLowerCase().includes(termo)
      )
      .sort((a, b) => (a.mes === b.mes ? b.createdAt.localeCompare(a.createdAt) : b.mes.localeCompare(a.mes)));
  }, [entradas, mes, periodo, busca]);

  const total = lista.reduce((s, e) => s + e.valor, 0);

  return (
    <div className="space-y-4">
      <FiltroBarra>
        <Campo label="Período">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as PeriodoKey)}
            className={selectClasses}
          >
            {PERIODOS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Buscar">
          <span className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou observação"
              className={cn(selectClasses, "w-64 pl-8")}
            />
          </span>
        </Campo>
        <button
          type="button"
          onClick={onNova}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-3.5" /> Nova entrada
        </button>
      </FiltroBarra>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Total label="Total do período" valor={moeda(total)} tom="text-emerald-400" />
        <Total label="Lançamentos" valor={String(lista.length)} tom="text-foreground" />
      </div>

      <div className="overflow-hidden rounded-xl glass">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Mês</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Observação</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma entrada no período selecionado.
                </td>
              </tr>
            ) : (
              lista.map((e) => (
                <tr key={e.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {mesLabel(e.mes)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{e.titulo}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{e.observacao || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-400">
                    {moeda(e.valor)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEditar(e)}
                        aria-label="Editar entrada"
                        className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onExcluir(e)}
                        aria-label="Excluir entrada"
                        className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Aba: apenas Saídas
 * ------------------------------------------------------------------ */

export interface SaidasViewProps {
  mes: string;
  saidas: Saida[];
  onNova: () => void;
  onEditar: (saida: Saida) => void;
  onExcluir: (saida: Saida) => void;
  onStatus: (saida: Saida, status: SaidaStatus) => void;
  onComprovante: (url: string) => void;
}

export function SaidasView({
  mes,
  saidas,
  onNova,
  onEditar,
  onExcluir,
  onStatus,
  onComprovante,
}: SaidasViewProps) {
  const [periodo, setPeriodo] = useState<PeriodoKey>("mes");
  const [tipo, setTipo] = useState<SaidaTipo | "todos">("todos");
  const [subtipo, setSubtipo] = useState<SaidaSubtipo | "todos">("todos");
  const [status, setStatus] = useState<SaidaStatus | "todos">("todos");
  const [pagDe, setPagDe] = useState("");
  const [pagAte, setPagAte] = useState("");
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return saidas
      .filter((s) => dentroDoPeriodo(s.mes, mes, periodo))
      .filter((s) => tipo === "todos" || s.tipo === tipo)
      .filter((s) => subtipo === "todos" || s.subtipo === subtipo)
      .filter((s) => status === "todos" || s.status === status)
      .filter((s) => !pagDe || (s.dataPagamento ?? "") >= pagDe)
      .filter((s) => !pagAte || (s.dataPagamento ?? "") <= pagAte)
      .filter(
        (s) =>
          !termo ||
          s.titulo.toLowerCase().includes(termo) ||
          s.observacao.toLowerCase().includes(termo)
      )
      .sort((a, b) => (a.dataPagamento ?? a.mes).localeCompare(b.dataPagamento ?? b.mes));
  }, [saidas, mes, periodo, tipo, subtipo, status, pagDe, pagAte, busca]);

  const total = lista.reduce((s, x) => s + (x.status === "cancelado" ? 0 : x.valor), 0);
  const pagas = lista
    .filter((s) => s.status === "pago")
    .reduce((s, x) => s + x.valor, 0);
  const abertas = lista
    .filter((s) => s.status === "pendente" || s.status === "atrasado")
    .reduce((s, x) => s + x.valor, 0);

  const limpar = () => {
    setTipo("todos");
    setSubtipo("todos");
    setStatus("todos");
    setPagDe("");
    setPagAte("");
    setBusca("");
  };

  return (
    <div className="space-y-4">
      <FiltroBarra>
        <Campo label="Período (competência)">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as PeriodoKey)}
            className={selectClasses}
          >
            {PERIODOS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Pagamento de">
          <input
            type="date"
            value={pagDe}
            onChange={(e) => setPagDe(e.target.value)}
            className={selectClasses}
          />
        </Campo>
        <Campo label="Pagamento até">
          <input
            type="date"
            value={pagAte}
            onChange={(e) => setPagAte(e.target.value)}
            className={selectClasses}
          />
        </Campo>
        <Campo label="Tipo de saída">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as SaidaTipo | "todos")}
            className={selectClasses}
          >
            <option value="todos">Todos</option>
            {(Object.keys(TIPO_LABELS) as SaidaTipo[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_LABELS[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Sub seleção">
          <select
            value={subtipo}
            onChange={(e) => setSubtipo(e.target.value as SaidaSubtipo | "todos")}
            className={selectClasses}
          >
            <option value="todos">Todas</option>
            {(Object.keys(SUBTIPO_LABELS) as SaidaSubtipo[]).map((t) => (
              <option key={t} value={t}>
                {SUBTIPO_LABELS[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SaidaStatus | "todos")}
            className={selectClasses}
          >
            <option value="todos">Todos</option>
            {(Object.keys(STATUS_LABELS) as SaidaStatus[]).map((t) => (
              <option key={t} value={t}>
                {STATUS_LABELS[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Buscar">
          <span className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Título ou observação"
              className={cn(selectClasses, "w-56 pl-8")}
            />
          </span>
        </Campo>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={limpar}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            Limpar filtros
          </button>
          <button
            type="button"
            onClick={onNova}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-3.5" /> Nova saída
          </button>
        </div>
      </FiltroBarra>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Total label="Total do período" valor={moeda(total)} tom="text-foreground" />
        <Total label="Pagas" valor={moeda(pagas)} tom="text-emerald-400" />
        <Total label="Em aberto" valor={moeda(abertas)} tom="text-amber-400" />
        <Total label="Lançamentos" valor={String(lista.length)} tom="text-foreground" />
      </div>

      <div className="overflow-hidden rounded-xl glass">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Sub seleção</th>
              <th className="px-4 py-3">Comprovante</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma saída com os filtros selecionados.
                </td>
              </tr>
            ) : (
              lista.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {s.dataPagamento ? dataBr(s.dataPagamento) : "—"}
                    <span className="block text-[10px]">{mesLabel(s.mes)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{s.titulo}</p>
                    {s.observacao ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.observacao}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        TIPO_CLASSES[s.tipo]
                      )}
                    >
                      {TIPO_LABELS[s.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {SUBTIPO_LABELS[s.subtipo]}
                  </td>
                  <td className="px-4 py-3">
                    {!s.comprovante ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : s.comprovante.startsWith("data:image") ? (
                      <button
                        type="button"
                        onClick={() => onComprovante(s.comprovante)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Ver
                      </button>
                    ) : (
                      <a
                        href={s.comprovante}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Abrir
                      </a>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">
                    {moeda(s.valor)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={s.status}
                      onChange={(e) => onStatus(s, e.target.value as SaidaStatus)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[11px] font-semibold uppercase outline-none",
                        STATUS_CLASSES[s.status]
                      )}
                    >
                      {(Object.keys(STATUS_LABELS) as SaidaStatus[]).map((st) => (
                        <option key={st} value={st} className="glass text-foreground">
                          {STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEditar(s)}
                        aria-label="Editar saída"
                        className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onExcluir(s)}
                        aria-label="Excluir saída"
                        className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
