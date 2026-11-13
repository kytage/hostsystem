import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
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
import { Indices } from "@/components/indice";
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
  tom?: string;
  detalhe?: string;
  acao?: React.ReactNode;
}) {
  // o mesmo quadro de número da tela inicial (valor em dinheiro, por isso compacto), com uma ação embaixo
  return (
    <div className="hc-indice" data-compacto="">
      <span className="hc-indice-valor">{valor}</span>
      <span className="hc-indice-icone" aria-hidden>
        <Icone strokeWidth={1.75} />
      </span>
      <span className="hc-indice-rotulo">
        {tom ? <i className="hc-indice-cor" style={{ background: tom }} aria-hidden /> : null}
        {titulo}
      </span>
      {detalhe ? <span className="hc-indice-nota">{detalhe}</span> : null}
      {acao ? <span className="col-span-full mt-2.5">{acao}</span> : null}
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
    return (
      <div className="pagina">
        <p className="flex items-center gap-2 px-1 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando...
        </p>
      </div>
    );
  }

  if (!ehFounder) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <div className="glass hc p-8 text-center">
          <span className="hc-icone mx-auto !size-11">
            <Lock className="size-5" strokeWidth={1.75} />
          </span>
          <h1 className="hc-titulo mt-4">Área restrita</h1>
          <p className="hc-nota mt-1.5">O painel financeiro é exclusivo do Founder.</p>
        </div>
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
              className="hc-seta !size-9"
            >
              <ChevronLeft className="size-4" />
            </button>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="h-9 rounded-full border border-input bg-white/[0.03] px-3.5 text-[13px] font-semibold text-foreground outline-none focus:border-foreground/30"
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
              className="hc-seta !size-9"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
      />

      {/* Abas */}
      <div className="segmentos mt-5" role="tablist" aria-label="Seções do financeiro">
        {ABAS.map((a) => (
          <button
            key={a.key}
            type="button"
            role="tab"
            aria-selected={aba === a.key}
            onClick={() => setAba(a.key)}
          >
            <a.icone className="size-3.5" />
            {a.label}
          </button>
        ))}
      </div>

      {aba === "dashboard" ? (
        <>
      {/* KPIs */}

      <Indices className="mt-5">
        <KpiCard
          titulo="Saldo atual"
          valor={moeda(resumo.saldo)}
          icone={Wallet}
          detalhe={`Saldo inicial ${moeda(resumo.saldoInicial)}`}
        />
        <KpiCard
          titulo="Entradas"
          valor={moeda(resumo.entradasTotal)}
          icone={TrendingUp}
          tom="#4ade80"
          detalhe={`Previsto ${moeda(resumo.entradaPrevista)} · Registrado ${moeda(resumo.entradasRegistradas)}`}
          acao={
            <button
              type="button"
              onClick={() => setConfigAberta(true)}
              className="hc-pilula !h-7 !text-[11px]"
            >
              Definir valor do mês
            </button>
          }
        />
        <KpiCard
          titulo="Despesas"
          valor={moeda(resumo.despesasTotal)}
          icone={TrendingDown}
          tom="#ce0e0e"
          detalhe={`Pagas ${moeda(resumo.despesasPagas)} · Em aberto ${moeda(resumo.despesasAbertas)}`}
        />
        <KpiCard
          titulo="Lançamentos"
          valor={String(saidasMes.length + entradasMes.length)}
          icone={Receipt}
          detalhe={`${entradasMes.length} entradas · ${saidasMes.length} saídas`}
        />
      </Indices>

      {/* Gráficos */}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FinanceiroComparativo data={serie} />
        </div>
        <FinanceiroDistribuicao titulo="Despesas por tipo" data={porTipo(mes, saidas)} />
      </div>
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <FinanceiroDistribuicao titulo="Despesas por categoria" data={porSubtipo(mes, saidas)} />

        {/* Entradas */}
        <div className="glass hc p-5 xl:col-span-2">
          <div className="flex items-center gap-3">
            <span className="hc-icone">
              <TrendingUp className="size-4" strokeWidth={1.75} />
            </span>
            <h2 className="hc-titulo min-w-0 flex-1 truncate">Entradas de {mesLabel(mes)}</h2>
            <button
              type="button"
              onClick={() => setNovaEntrada(true)}
              className="hc-pilula shrink-0"
            >
              <Plus className="size-3.5" /> Entrada
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {entradasMes.length === 0 ? (
              <p className="rounded-[14px] border border-dashed border-white/[0.1] px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma entrada registrada neste mês.
              </p>
            ) : (
              entradasMes.map((e) => (
                <div
                  key={e.id}
                  className="hc-dentro flex items-start justify-between gap-3 p-3"
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
                      className="hc-seta"
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
                      className="hc-seta hover:!border-destructive/30 hover:!bg-destructive/15 hover:!text-destructive"
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
      <div className="glass hc mt-3.5 p-5">
        <div className="flex items-center gap-3">
          <span className="hc-icone">
            <TrendingDown className="size-4" strokeWidth={1.75} />
          </span>
          <h2 className="hc-titulo min-w-0 flex-1 truncate">Saídas de {mesLabel(mes)}</h2>
          <button
            type="button"
            onClick={() => setNovaSaida(true)}
            className="hc-pilula shrink-0"
          >
            <Plus className="size-3.5" /> Saída
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {saidasMes.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-white/[0.1] px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma saída registrada neste mês.
            </p>
          ) : (
            saidasMes.map((s) => (
              <div key={s.id} className="hc-dentro p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{s.titulo}</p>
                      <span
                        className={cn(
                          "inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-medium",
                          TIPO_CLASSES[s.tipo]
                        )}
                      >
                        {TIPO_LABELS[s.tipo]}
                      </span>
                      <span className="hc-selo">{SUBTIPO_LABELS[s.subtipo]}</span>
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
                          className="hc-pilula mt-2"
                        >
                          Ver comprovante
                        </button>
                      ) : (
                        <a
                          href={s.comprovante}
                          target="_blank"
                          rel="noreferrer"
                          className="hc-pilula mt-2"
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
                        "h-7 rounded-full border px-2.5 text-[11px] font-semibold uppercase outline-none",
                        STATUS_CLASSES[s.status]
                      )}
                    >
                      {(Object.keys(STATUS_LABELS) as SaidaStatus[]).map((st) => (
                        <option key={st} value={st} className="bg-popover text-popover-foreground">
                          {STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setEditSaida(s)}
                      aria-label="Editar saída"
                      className="hc-seta"
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
                      className="hc-seta hover:!border-destructive/30 hover:!bg-destructive/15 hover:!text-destructive"
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
        <div className="mt-5">
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
        <div className="mt-5">
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
            className="max-h-[70vh] w-full rounded-xl border border-white/[0.08] object-contain"
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
