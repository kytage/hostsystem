import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { useMyRole } from "@/lib/permissions";
import { useRealtimeTable } from "@/lib/realtime";
import { EntradaDialog } from "@/components/financeiro/entrada-dialog";
import { SaidaDialog } from "@/components/financeiro/saida-dialog";
import { EntradasView, SaidasView } from "@/components/financeiro/lancamentos-views";

import {
  FinanceiroComparativo,
  FinanceiroDistribuicao,
} from "@/components/financeiro/financeiro-graficos";
import {
  GhostButton,
  ModalBase,
  PrimaryButton,
  inputClasses,
  labelClasses,
} from "@/components/financeiro/modal-base";
import {
  STATUS_CLASSES,
  STATUS_LABELS,
  SUBTIPO_LABELS,
  TIPO_CLASSES,
  TIPO_LABELS,
  addMeses,
  atualizarStatusSaida,
  excluirEntrada,
  excluirSaida,
  fetchEntradas,
  fetchMeses,
  fetchSaidas,
  listaMeses,
  mesKey,
  mesLabel,
  moeda,
  parseValor,
  porSubtipo,
  porTipo,
  resumoDoMes,
  salvarMesConfig,
  serieMeses,
  type Entrada,
  type Saida,
  type SaidaStatus,
} from "@/lib/financeiro";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — HOST" },
      {
        name: "description",
        content: "Painel financeiro do servidor: saldo, entradas, despesas e gráficos mês a mês.",
      },
      { property: "og:title", content: "Financeiro — HOST" },
      {
        property: "og:description",
        content: "Saldo, entradas, despesas fixas e variáveis com gráficos comparativos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinanceiroPage,
});

function KpiCard({
  titulo,
  valor,
  icone: Icone,
  tom,
  detalhe,
  acao,
}: {
  titulo: string;
  valor: string;
  icone: typeof Wallet;
  tom: string;
  detalhe?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl glass p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {titulo}
        </p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", tom)}>
          <Icone className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground font-display">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
      {acao ? <div className="mt-3">{acao}</div> : null}
    </div>
  );
}

type AbaKey = "dashboard" | "entradas" | "saidas";

const ABAS: { key: AbaKey; label: string; icone: typeof Wallet }[] = [
  { key: "dashboard", label: "Dashboard", icone: Wallet },
  { key: "entradas", label: "Entradas", icone: TrendingUp },
  { key: "saidas", label: "Saídas", icone: TrendingDown },
];

function FinanceiroPage() {

  const { data: role, isLoading: loadingRole } = useMyRole();
  const queryClient = useQueryClient();

  const [aba, setAba] = useState<AbaKey>("dashboard");
  const [mes, setMes] = useState(mesKey());

  const [novaEntrada, setNovaEntrada] = useState(false);
  const [editEntrada, setEditEntrada] = useState<Entrada | null>(null);
  const [novaSaida, setNovaSaida] = useState(false);
  const [editSaida, setEditSaida] = useState<Saida | null>(null);
  const [configAberta, setConfigAberta] = useState(false);
  const [comprovante, setComprovante] = useState<string | null>(null);

  const ehFounder = role === "founder";

  const entradasQ = useQuery({
    queryKey: ["financeiro-entradas"],
    queryFn: fetchEntradas,
    enabled: ehFounder,
  });
  const saidasQ = useQuery({
    queryKey: ["financeiro-saidas"],
    queryFn: fetchSaidas,
    enabled: ehFounder,
  });
  const mesesQ = useQuery({
    queryKey: ["financeiro-meses"],
    queryFn: fetchMeses,
    enabled: ehFounder,
  });

  useRealtimeTable("financeiro_entradas", [["financeiro-entradas"]]);
  useRealtimeTable("financeiro_saidas", [["financeiro-saidas"]]);
  useRealtimeTable("financeiro_meses", [["financeiro-meses"]]);

  const entradas = entradasQ.data ?? [];
  const saidas = saidasQ.data ?? [];
  const config = mesesQ.data;

  const meses = useMemo(() => {
    const comDados = [...new Set([...entradas.map((e) => e.mes), ...saidas.map((s) => s.mes)])];
    return listaMeses(comDados);
  }, [entradas, saidas]);

  const resumo = useMemo(
    () => resumoDoMes(mes, entradas, saidas, config),
    [mes, entradas, saidas, config]
  );
  const serie = useMemo(() => serieMeses(meses, entradas, saidas, config), [meses, entradas, saidas, config]);
  const entradasMes = entradas.filter((e) => e.mes === mes);
  const saidasMes = saidas.filter((s) => s.mes === mes);

  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ["financeiro-entradas"] });
    void queryClient.invalidateQueries({ queryKey: ["financeiro-saidas"] });
    void queryClient.invalidateQueries({ queryKey: ["financeiro-meses"] });
  };

  if (loadingRole) {
    return <div className="px-8 py-10 text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!ehFounder) {
    return (
      <div className="mx-auto max-w-lg px-8 py-24 text-center">
        <Lock className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold text-foreground font-display">Área restrita</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O painel financeiro é exclusivo do Founder.
        </p>
      </div>
    );
  }

  return (
    <div className="pagina">
      <PageHeader
        title="Financeiro"
        subtitle="Saldo, entradas e despesas do servidor — visível apenas para o Founder."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMes((m) => addMeses(m, -1))}
              aria-label="Mês anterior"
              className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="rounded-lg border border-border bg-black/25 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary/60"
            >
              {meses.map((m) => (
                <option key={m} value={m}>
                  {mesLabel(m)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setMes((m) => addMeses(m, 1))}
              aria-label="Próximo mês"
              className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
      />

      {/* Abas */}
      <div className="mt-6 flex flex-wrap items-center gap-1 rounded-xl glass p-1">
        {ABAS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAba(a.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
              aba === a.key
                ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                : "text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
            )}
          >
            <a.icone className="size-3.5" />
            {a.label}
          </button>
        ))}
      </div>

      {aba === "dashboard" ? (
        <>
      {/* KPIs */}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          titulo="Saldo atual"
          valor={moeda(resumo.saldo)}
          icone={Wallet}
          tom="bg-blue-500/15 text-blue-400"
          detalhe={`Saldo inicial ${moeda(resumo.saldoInicial)}`}
        />
        <KpiCard
          titulo="Entradas"
          valor={moeda(resumo.entradasTotal)}
          icone={TrendingUp}
          tom="bg-emerald-500/15 text-emerald-400"
          detalhe={`Previsto ${moeda(resumo.entradaPrevista)} · Registrado ${moeda(resumo.entradasRegistradas)}`}
          acao={
            <button
              type="button"
              onClick={() => setConfigAberta(true)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Definir valor do mês
            </button>
          }
        />
        <KpiCard
          titulo="Despesas"
          valor={moeda(resumo.despesasTotal)}
          icone={TrendingDown}
          tom="bg-primary/15 text-primary"
          detalhe={`Pagas ${moeda(resumo.despesasPagas)} · Em aberto ${moeda(resumo.despesasAbertas)}`}
        />
        <KpiCard
          titulo="Lançamentos"
          valor={String(saidasMes.length + entradasMes.length)}
          icone={Receipt}
          tom="bg-violet-500/15 text-violet-400"
          detalhe={`${entradasMes.length} entradas · ${saidasMes.length} saídas`}
        />
      </div>

      {/* Gráficos */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FinanceiroComparativo data={serie} />
        </div>
        <FinanceiroDistribuicao titulo="Despesas por tipo" data={porTipo(mes, saidas)} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <FinanceiroDistribuicao titulo="Despesas por categoria" data={porSubtipo(mes, saidas)} />

        {/* Entradas */}
        <div className="rounded-xl glass p-4 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground font-display">Entradas de {mesLabel(mes)}</h2>
            <button
              type="button"
              onClick={() => setNovaEntrada(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="size-3.5" /> Entrada
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {entradasMes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma entrada registrada neste mês.
              </p>
            ) : (
              entradasMes.map((e) => (
                <div
                  key={e.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{e.titulo}</p>
                    {e.observacao ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{e.observacao}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-emerald-400">{moeda(e.valor)}</span>
                    <button
                      type="button"
                      onClick={() => setEditEntrada(e)}
                      aria-label="Editar entrada"
                      className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void excluirEntrada(e.id)
                          .then(() => {
                            toast.success("Entrada excluída");
                            recarregar();
                          })
                          .catch(() => toast.error("Falha ao excluir"));
                      }}
                      aria-label="Excluir entrada"
                      className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Saídas */}
      <div className="mt-4 rounded-xl glass p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground font-display">Saídas de {mesLabel(mes)}</h2>
          <button
            type="button"
            onClick={() => setNovaSaida(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-3.5" /> Saída
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {saidasMes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma saída registrada neste mês.
            </p>
          ) : (
            saidasMes.map((s) => (
              <div key={s.id} className="rounded-lg border border-border px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{s.titulo}</p>
                      <span
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                          TIPO_CLASSES[s.tipo]
                        )}
                      >
                        {TIPO_LABELS[s.tipo]}
                      </span>
                      <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        {SUBTIPO_LABELS[s.subtipo]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.dataPagamento
                        ? `Pagamento em ${new Date(`${s.dataPagamento}T12:00:00`).toLocaleDateString("pt-BR")}`
                        : "Sem data de pagamento"}
                      {s.criadoPor ? ` · por ${s.criadoPor}` : ""}
                    </p>
                    {s.observacao ? (
                      <p className="mt-1 text-xs text-muted-foreground">{s.observacao}</p>
                    ) : null}
                    {s.comprovante ? (
                      s.comprovante.startsWith("data:image") ? (
                        <button
                          type="button"
                          onClick={() => setComprovante(s.comprovante)}
                          className="mt-2 text-xs font-semibold text-primary hover:underline"
                        >
                          Ver comprovante
                        </button>
                      ) : (
                        <a
                          href={s.comprovante}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                        >
                          Abrir comprovante
                        </a>
                      )
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{moeda(s.valor)}</span>
                    <select
                      value={s.status}
                      onChange={(e) => {
                        void atualizarStatusSaida(s.id, e.target.value as SaidaStatus)
                          .then(() => recarregar())
                          .catch(() => toast.error("Falha ao mudar status"));
                      }}
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
                    <button
                      type="button"
                      onClick={() => setEditSaida(s)}
                      aria-label="Editar saída"
                      className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void excluirSaida(s.id)
                          .then(() => {
                            toast.success("Saída excluída");
                            recarregar();
                          })
                          .catch(() => toast.error("Falha ao excluir"));
                      }}
                      aria-label="Excluir saída"
                      className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
        </>
      ) : aba === "entradas" ? (
        <div className="mt-4">
          <EntradasView
            mes={mes}
            entradas={entradas}
            onNova={() => setNovaEntrada(true)}
            onEditar={(e) => setEditEntrada(e)}
            onExcluir={(e) => {
              void excluirEntrada(e.id)
                .then(() => {
                  toast.success("Entrada excluída");
                  recarregar();
                })
                .catch(() => toast.error("Falha ao excluir"));
            }}
          />
        </div>
      ) : (
        <div className="mt-4">
          <SaidasView
            mes={mes}
            saidas={saidas}
            onNova={() => setNovaSaida(true)}
            onEditar={(s) => setEditSaida(s)}
            onExcluir={(s) => {
              void excluirSaida(s.id)
                .then(() => {
                  toast.success("Saída excluída");
                  recarregar();
                })
                .catch(() => toast.error("Falha ao excluir"));
            }}
            onStatus={(s, status) => {
              void atualizarStatusSaida(s.id, status)
                .then(() => recarregar())
                .catch(() => toast.error("Falha ao mudar status"));
            }}
            onComprovante={(url) => setComprovante(url)}
          />
        </div>
      )}



      {/* Modais */}
      {novaEntrada ? (
        <EntradaDialog mes={mes} onClose={() => setNovaEntrada(false)} onSaved={recarregar} />
      ) : null}
      {editEntrada ? (
        <EntradaDialog
          mes={mes}
          entrada={editEntrada}
          onClose={() => setEditEntrada(null)}
          onSaved={recarregar}
        />
      ) : null}
      {novaSaida ? (
        <SaidaDialog mes={mes} onClose={() => setNovaSaida(false)} onSaved={recarregar} />
      ) : null}
      {editSaida ? (
        <SaidaDialog
          mes={mes}
          saida={editSaida}
          onClose={() => setEditSaida(null)}
          onSaved={recarregar}
        />
      ) : null}
      {configAberta ? (
        <ConfigMesDialog
          mes={mes}
          entradaPrevista={resumo.entradaPrevista}
          saldoInicial={resumo.saldoInicial}
          onClose={() => setConfigAberta(false)}
          onSaved={recarregar}
        />
      ) : null}
      {comprovante ? (
        <ModalBase title="Comprovante" onClose={() => setComprovante(null)}>
          <img
            src={comprovante}
            alt="Comprovante"
            className="max-h-[70vh] w-full rounded-lg border border-border object-contain"
          />
        </ModalBase>
      ) : null}
    </div>
  );
}

function ConfigMesDialog({
  mes,
  entradaPrevista,
  saldoInicial,
  onClose,
  onSaved,
}: {
  mes: string;
  entradaPrevista: number;
  saldoInicial: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [previsto, setPrevisto] = useState(String(entradaPrevista).replace(".", ","));
  const [inicial, setInicial] = useState(String(saldoInicial).replace(".", ","));
  const [salvando, setSalvando] = useState(false);

  const salvar = () => {
    setSalvando(true);
    void salvarMesConfig({
      mes,
      entradaPrevista: parseValor(previsto),
      saldoInicial: parseValor(inicial),
    })
      .then(() => {
        toast.success("Valores do mês atualizados");
        onSaved();
        onClose();
      })
      .catch(() => toast.error("Falha ao salvar valores"))
      .finally(() => setSalvando(false));
  };

  return (
    <ModalBase
      title="Valores do mês"
      subtitle={mesLabel(mes)}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses} htmlFor="cfg-previsto">
            Entrada do mês (R$)
          </label>
          <input
            id="cfg-previsto"
            value={previsto}
            onChange={(e) => setPrevisto(e.target.value)}
            inputMode="decimal"
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses} htmlFor="cfg-inicial">
            Saldo inicial (R$)
          </label>
          <input
            id="cfg-inicial"
            value={inicial}
            onChange={(e) => setInicial(e.target.value)}
            inputMode="decimal"
            className={inputClasses}
          />
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        O saldo atual considera o saldo inicial + entradas do mês − despesas já pagas.
      </p>
    </ModalBase>
  );
}
