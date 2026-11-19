import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  Crown,
  Loader2,
  Radio,
  Search,
  Shield,
  ShieldHalf,
  Siren,
  UserRound,
  Users,
} from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Indice, Indices } from "@/components/indice";
import { FOTO_PADRAO, haQuanto } from "@/lib/player-perfil";
import {
  UNIDADES,
  estabDaUnidade,
  patenteNaUnidade,
  type PolicialResumo,
  type UnidadePolicial,
} from "@/lib/policia";
import { carregarPolicia, type EstabPolicia, type OnlinePolicia } from "@/lib/policia.functions";

type Aba = "geral" | "efetivo" | "online";

const chaveDiaBrt = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const hojeBrt = () => chaveDiaBrt(new Date().toISOString());

interface ResumoUnidade {
  u: UnidadePolicial;
  membros: { p: PolicialResumo; nivel: number | null; patente: string }[];
  online: number;
  estab: EstabPolicia | null;
  picoHoje: number | null;
  pico7: number | null;
}

/** Maior online por dia (das 5 contagens 20h–23:59) de cada grupo. */
function picosPorDia(online: OnlinePolicia[]) {
  const m = new Map<string, Map<string, number>>();
  for (const o of online) {
    // a contagem "00h" é feita às 23:5x: já cai no dia certo pela data de Brasília
    const dia = chaveDiaBrt(o.captured_at);
    const porDia = m.get(o.set_name) ?? new Map<string, number>();
    porDia.set(dia, Math.max(porDia.get(dia) ?? 0, o.amount));
    m.set(o.set_name, porDia);
  }
  return m;
}

export function PoliciaPainel() {
  const [aba, setAba] = useState<Aba>("geral");
  const [filtroUnidade, setFiltroUnidade] = useState<string>("todas");
  const [soOnline, setSoOnline] = useState(false);
  const [busca, setBusca] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["policia"],
    queryFn: () => carregarPolicia(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const picos = useMemo(() => picosPorDia(data?.online ?? []), [data?.online]);

  const resumos = useMemo<ResumoUnidade[]>(() => {
    const hoje = hojeBrt();
    const limite7 = chaveDiaBrt(new Date(Date.now() - 6 * 86_400_000).toISOString());
    return UNIDADES.map((u) => {
      const membros = (data?.policiais ?? [])
        .map((p) => {
          const pat = patenteNaUnidade(p.grupos, u);
          return pat ? { p, nivel: pat.nivel, patente: pat.nome } : null;
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => (a.nivel ?? 99) - (b.nivel ?? 99) || Number(b.p.online) - Number(a.p.online));
      const dias = picos.get(u.grupo) ?? new Map<string, number>();
      const ult7 = [...dias.entries()].filter(([d]) => d >= limite7).map(([, v]) => v);
      return {
        u,
        membros,
        online: membros.filter((m) => m.p.online).length,
        estab: estabDaUnidade(u, data?.estabelecimentos ?? []),
        picoHoje: dias.get(hoje) ?? null,
        pico7: ult7.length ? Math.max(...ult7) : null,
      };
    });
  }, [data, picos]);

  const efetivo = data?.policiais.length ?? 0;
  const onlineAgora = data?.policiais.filter((p) => p.online).length ?? 0;
  const guarnicoes = resumos.filter((r) => r.u.tipo === "guarnicao");
  const ocupadas = guarnicoes.filter((r) => r.estab?.status === "ocupado" || r.estab?.status === "reservado").length;

  const abrirEfetivo = (id: string) => {
    setFiltroUnidade(id);
    setAba("efetivo");
  };

  return (
    <div className="pagina">
      <PageHeader
        kicker="Operação"
        title="Polícia"
        subtitle="Corporações, guarnições e efetivo — tudo atualizado sozinho pelas fichas dos players."
      />

      <Indices>
        <Indice valor={efetivo} titulo="Efetivo" nota="policiais setados" icone={Users} />
        <Indice valor={onlineAgora} titulo="Online agora" nota={`de ${efetivo}`} icone={Radio} cor="#34d399" />
        <Indice
          valor={resumos.find((r) => r.u.id === "pm")?.membros.length ?? 0}
          titulo="Polícia Militar"
          nota="base (Police)"
          icone={Shield}
        />
        <Indice
          valor={resumos.find((r) => r.u.id === "civil")?.membros.length ?? 0}
          titulo="Polícia Civil"
          nota="investigativa"
          icone={ShieldHalf}
        />
        <Indice
          valor={`${ocupadas}/${guarnicoes.length}`}
          titulo="Guarnições ocupadas"
          nota={`${guarnicoes.length - ocupadas} livres`}
          icone={Siren}
        />
      </Indices>

      <div className="mt-4 segmentos" role="tablist" aria-label="Seções da Polícia">
        {(
          [
            { id: "geral", label: "Visão geral", Icon: Shield },
            { id: "efetivo", label: "Efetivo", Icon: Users },
            { id: "online", label: "Online", Icon: Activity },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando a polícia…
        </div>
      ) : isError ? (
        <p className="mt-6 rounded-[22px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Não deu para carregar."}
        </p>
      ) : aba === "geral" ? (
        <VisaoGeral resumos={resumos} vazio={efetivo === 0} onVer={abrirEfetivo} />
      ) : aba === "efetivo" ? (
        <Efetivo
          policiais={data?.policiais ?? []}
          filtroUnidade={filtroUnidade}
          setFiltroUnidade={setFiltroUnidade}
          soOnline={soOnline}
          setSoOnline={setSoOnline}
          busca={busca}
          setBusca={setBusca}
        />
      ) : (
        <AbaOnline picos={picos} online={data?.online ?? []} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ visão geral */

function StatusEstab({ estab }: { estab: EstabPolicia | null }) {
  if (!estab)
    return <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10.5px] text-ink-3">Sem cadastro</span>;
  const livre = estab.status === "livre";
  const desativ = estab.status === "desativado";
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold",
        livre
          ? "bg-emerald-500/15 text-emerald-400"
          : desativ
            ? "bg-white/[0.06] text-ink-3"
            : "bg-red-500/15 text-red-400",
      )}
    >
      <i className={cn("size-1.5 rounded-full", livre ? "bg-emerald-400" : desativ ? "bg-white/30" : "bg-red-400")} />
      {livre ? "Livre" : desativ ? "Desativado" : estab.status === "reservado" ? "Reservado" : "Ocupado"}
    </span>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-2.5 py-1.5">
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-3">{rotulo}</p>
      <p className="text-[17px] font-bold tabular-nums leading-tight" style={destaque ? { color: destaque } : undefined}>
        {valor}
      </p>
    </div>
  );
}

function VisaoGeral({
  resumos,
  vazio,
  onVer,
}: {
  resumos: ResumoUnidade[];
  vazio: boolean;
  onVer: (id: string) => void;
}) {
  const principais = resumos.filter((r) => r.u.tipo !== "guarnicao");
  const guarnicoes = resumos.filter((r) => r.u.tipo === "guarnicao");
  return (
    <div className="mt-4 space-y-5">
      {vazio && (
        <p className="rounded-2xl border border-dashed border-white/[0.1] px-4 py-3 text-[12.5px] text-muted-foreground">
          Ainda não há policiais nas fichas: o efetivo, o online e o pico aparecem sozinhos quando o servidor
          mandar as fichas dos players (resource host_painel). Status e responsáveis já vêm das Organizações.
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {principais.map((r) => (
          <CartaoCorporacao key={r.u.id} r={r} onVer={() => onVer(r.u.id)} />
        ))}
      </div>
      <div>
        <div className="mb-2 flex items-center gap-2 px-1">
          <Siren className="size-4 text-muted-foreground" />
          <h2 className="hc-titulo">Guarnições</h2>
          <span className="hc-nota">os policiais ficam setados na PM e entram também na guarnição</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {guarnicoes.map((r) => (
            <CartaoGuarnicao key={r.u.id} r={r} onVer={() => onVer(r.u.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CartaoCorporacao({ r, onVer }: { r: ResumoUnidade; onVer: () => void }) {
  const comando = r.membros.filter((m) => m.nivel !== null && m.nivel <= 4).slice(0, 6);
  // patentes com gente (na ordem do jogo)
  const contagem = r.u.hierarquia
    .map((_, i) => ({ nivel: i + 1, nome: patenteNaUnidade([`${r.u.grupo}:${i + 1}`], r.u)!.nome, qtd: r.membros.filter((m) => m.nivel === i + 1).length }))
    .filter((x) => x.qtd > 0);
  const maior = Math.max(1, ...contagem.map((c) => c.qtd));
  return (
    <section className="glass hc relative overflow-hidden p-4" style={{ "--cor": r.u.cor } as CSSProperties}>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: r.u.cor }} />
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="hc-sobre">{r.u.tipo === "principal" ? "Principal · base" : "Investigativa"}</p>
          <h3 className="flex items-center gap-2 text-lg font-bold">
            {r.u.nome} <span className="text-[12px] font-medium text-ink-3">{r.u.sigla} · grupo {r.u.grupo}</span>
          </h3>
          <p className="mt-0.5 max-w-md text-[12px] text-muted-foreground">{r.u.descricao}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusEstab estab={r.estab} />
          {r.estab?.observacao && (
            <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <Crown className="size-3 text-amber-300" /> {r.estab.observacao}
            </span>
          )}
        </div>
      </header>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <Numero rotulo="Efetivo" valor={r.membros.length} />
        <Numero rotulo="Online" valor={r.online} destaque="#34d399" />
        <Numero rotulo="Pico hoje" valor={r.picoHoje ?? "—"} />
        <Numero rotulo="Pico 7 dias" valor={r.pico7 ?? "—"} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="hc-sobre mb-1.5">Comando</p>
          {comando.length === 0 ? (
            <p className="text-[12px] text-ink-3">—</p>
          ) : (
            <ul className="space-y-1">
              {comando.map((m) => (
                <LinhaPolicial key={m.p.passaporte || m.p.nome} m={m} />
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="hc-sobre mb-1.5">Patentes</p>
          {contagem.length === 0 ? (
            <p className="text-[12px] text-ink-3">—</p>
          ) : (
            <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
              {contagem.map((c) => (
                <li key={c.nivel} className="text-[11.5px]">
                  <span className="flex justify-between">
                    <span className="truncate text-muted-foreground">{c.nome}</span>
                    <b className="tabular-nums">{c.qtd}</b>
                  </span>
                  <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full" style={{ width: `${(c.qtd / maior) * 100}%`, background: r.u.cor }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <button onClick={onVer} className="pilula mt-3 rounded-full">
        <Users className="size-3.5" /> Ver efetivo
      </button>
    </section>
  );
}

function CartaoGuarnicao({ r, onVer }: { r: ResumoUnidade; onVer: () => void }) {
  const comando = r.membros.filter((m) => m.nivel !== null && m.nivel <= 2);
  const livre = r.estab?.status === "livre";
  return (
    <section
      className={cn(
        "glass hc relative flex flex-col overflow-hidden p-3.5",
        livre && "!border-emerald-500/30",
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: r.u.cor === "#111827" ? "#e5e7eb" : r.u.cor }} />
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-extrabold tracking-wide">{r.u.sigla}</h3>
          <p className="text-[11px] text-ink-3">{r.u.descricao}</p>
        </div>
        <StatusEstab estab={r.estab} />
      </header>
      <p className="mt-2 flex items-center gap-1 text-[12px] text-muted-foreground">
        <Crown className="size-3 text-amber-300" />
        {r.estab?.observacao || (livre ? "Disponível para assumir" : "—")}
      </p>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <Numero rotulo="Membros" valor={r.membros.length} />
        <Numero rotulo="Online" valor={r.online} destaque="#34d399" />
        <Numero rotulo="Pico hoje" valor={r.picoHoje ?? "—"} />
      </div>
      <div className="mt-2.5 flex-1">
        <p className="hc-sobre mb-1">Comando</p>
        {comando.length === 0 ? (
          <p className="text-[11.5px] text-ink-3">—</p>
        ) : (
          <ul className="space-y-1">
            {comando.slice(0, 3).map((m) => (
              <LinhaPolicial key={m.p.passaporte || m.p.nome} m={m} compacto />
            ))}
          </ul>
        )}
      </div>
      <button onClick={onVer} className="pilula mt-3 justify-center rounded-full">
        <Users className="size-3.5" /> Ver membros
      </button>
    </section>
  );
}

function LinhaPolicial({
  m,
  compacto,
}: {
  m: { p: PolicialResumo; patente: string };
  compacto?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 text-[12px]">
      <span className={cn("size-1.5 shrink-0 rounded-full", m.p.online ? "bg-emerald-400" : "bg-white/20")} />
      <span className="min-w-0 flex-1 truncate">
        <b className="font-semibold">{m.p.nome || "Sem nome"}</b>
        <span className="text-ink-3"> #{m.p.passaporte}</span>
      </span>
      {!compacto && <span className="shrink-0 text-[11px] text-muted-foreground">{m.patente}</span>}
    </li>
  );
}

/* ------------------------------------------------------------------ efetivo */

function Efetivo({
  policiais,
  filtroUnidade,
  setFiltroUnidade,
  soOnline,
  setSoOnline,
  busca,
  setBusca,
}: {
  policiais: PolicialResumo[];
  filtroUnidade: string;
  setFiltroUnidade: (v: string) => void;
  soOnline: boolean;
  setSoOnline: (v: boolean) => void;
  busca: string;
  setBusca: (v: string) => void;
}) {
  const pm = UNIDADES.find((u) => u.id === "pm")!;
  const civil = UNIDADES.find((u) => u.id === "civil")!;
  const guarnicoes = UNIDADES.filter((u) => u.tipo === "guarnicao");
  const unidade = UNIDADES.find((u) => u.id === filtroUnidade);

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return policiais
      .map((p) => {
        const patPm = patenteNaUnidade(p.grupos, pm);
        const patCivil = patenteNaUnidade(p.grupos, civil);
        const guarn = guarnicoes
          .map((u) => ({ u, pat: patenteNaUnidade(p.grupos, u) }))
          .filter((x): x is { u: UnidadePolicial; pat: NonNullable<typeof x.pat> } => !!x.pat);
        const patFiltro = unidade ? patenteNaUnidade(p.grupos, unidade) : null;
        return { p, patPm, patCivil, guarn, patFiltro };
      })
      .filter((l) => (!unidade || l.patFiltro) && (!soOnline || l.p.online))
      .filter((l) => !q || [l.p.nome, l.p.passaporte, l.p.discord].some((v) => v?.toLowerCase().includes(q)))
      .sort(
        (a, b) =>
          (a.patFiltro?.nivel ?? a.patPm?.nivel ?? a.patCivil?.nivel ?? 99) -
            (b.patFiltro?.nivel ?? b.patPm?.nivel ?? b.patCivil?.nivel ?? 99) ||
          Number(b.p.online) - Number(a.p.online) ||
          a.p.nome.localeCompare(b.p.nome, "pt-BR"),
      );
  }, [policiais, busca, soOnline, unidade, pm, civil, guarnicoes]);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="segmentos flex-wrap" role="group" aria-label="Unidade">
          <button type="button" aria-pressed={filtroUnidade === "todas"} onClick={() => setFiltroUnidade("todas")}>
            Todas
          </button>
          {UNIDADES.map((u) => (
            <button key={u.id} type="button" aria-pressed={filtroUnidade === u.id} onClick={() => setFiltroUnidade(u.id)}>
              {u.tipo === "guarnicao" ? u.sigla : u.nome}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSoOnline(!soOnline)}
          className={cn("pilula rounded-full", soOnline && "pilula-ativa")}
          aria-pressed={soOnline}
        >
          <Radio className="size-3.5" /> Só online
        </button>
        <label className="campo-busca ml-auto w-full sm:w-72">
          <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar policial, ID ou Discord" />
        </label>
      </div>

      <div className="glass hc mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              <th className="px-4 py-3">Policial</th>
              <th className="px-4 py-3">{unidade && unidade.tipo === "guarnicao" ? `Cargo no ${unidade.sigla}` : "Corporação / patente"}</th>
              <th className="px-4 py-3">Guarnições</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Level</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {policiais.length === 0
                    ? "Nenhum policial nas fichas ainda (chegam pelo host_painel)."
                    : "Ninguém com esses filtros."}
                </td>
              </tr>
            ) : (
              linhas.map(({ p, patPm, patCivil, guarn, patFiltro }) => (
                <tr key={p.passaporte || p.nome} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2.5">
                      <span className="relative shrink-0">
                        <img src={FOTO_PADRAO} alt="" className="size-8 rounded-lg object-cover" />
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#111]",
                            p.online ? "bg-emerald-400" : "bg-white/25",
                          )}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {p.nome || "Sem nome"} <span className="font-normal text-ink-3">#{p.passaporte}</span>
                        </span>
                        {p.discord && <span className="block truncate text-[11px] text-ink-3">@{p.discord}</span>}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[12.5px]">
                    {unidade?.tipo === "guarnicao" && patFiltro ? (
                      <span className="font-semibold">{patFiltro.nome}</span>
                    ) : (
                      <span className="flex flex-col">
                        {patPm && (
                          <span>
                            <BadgeCheck className="mr-1 inline size-3.5 text-blue-400" />
                            PM · <b>{patPm.nome}</b>
                          </span>
                        )}
                        {patCivil && (
                          <span>
                            <BadgeCheck className="mr-1 inline size-3.5 text-purple-400" />
                            Civil · <b>{patCivil.nome}</b>
                          </span>
                        )}
                        {!patPm && !patCivil && <span className="text-ink-3">—</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap gap-1">
                      {guarn.length === 0 ? (
                        <span className="text-[12px] text-ink-3">—</span>
                      ) : (
                        guarn.map(({ u, pat }) => (
                          <span
                            key={u.id}
                            title={pat.nome}
                            className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                            style={{ background: `${u.cor === "#111827" ? "#e5e7eb" : u.cor}26`, color: u.cor === "#111827" ? "#e5e7eb" : u.cor }}
                          >
                            {u.sigla}
                            {pat.nivel !== null && pat.nivel <= 2 ? " ★" : ""}
                          </span>
                        ))
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[12px]">
                    {p.online ? (
                      <span className="font-semibold text-emerald-400">Online</span>
                    ) : (
                      <span className="text-ink-3">Visto {haQuanto(p.ultimoLogin)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{p.level}</td>
                  <td className="px-4 py-2 text-right">
                    {p.passaporte && (
                      <Link
                        to="/players"
                        search={{ jogador: p.passaporte }}
                        className="inline-grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-white/[0.06] hover:text-foreground"
                        title="Abrir o perfil do player"
                      >
                        <UserRound className="size-3.5" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 px-1 text-[11px] text-ink-3">★ = Comando ou Sub Comando da guarnição. Ordem: patente mais alta primeiro.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ online */

function AbaOnline({ picos, online }: { picos: Map<string, Map<string, number>>; online: OnlinePolicia[] }) {
  const dias = useMemo(() => {
    const lista: string[] = [];
    for (let i = 13; i >= 0; i--) lista.push(chaveDiaBrt(new Date(Date.now() - i * 86_400_000).toISOString()));
    return lista;
  }, []);
  const dados = dias.map((d) => {
    const linha: Record<string, string | number | null> = { dia: `${d.slice(8, 10)}/${d.slice(5, 7)}` };
    for (const u of UNIDADES) linha[u.sigla] = picos.get(u.grupo)?.get(d) ?? null;
    return linha;
  });
  const hoje = hojeBrt();
  const horarios = [20, 21, 22, 23, 0];
  const hojeRows = online.filter((o) => chaveDiaBrt(o.captured_at) === hoje);

  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="glass hc p-4">
        <p className="hc-sobre mb-1">Pico por dia — últimos 14 dias</p>
        <p className="hc-nota mb-3">Maior número de online entre as contagens das 20h, 21h, 22h, 23h e 23:59.</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dados} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="dia" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {UNIDADES.map((u) => (
                <Line
                  key={u.id}
                  type="monotone"
                  dataKey={u.sigla}
                  stroke={u.cor === "#111827" ? "#e5e7eb" : u.cor}
                  strokeWidth={u.tipo === "guarnicao" ? 1.6 : 2.6}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="glass hc p-4">
        <p className="hc-sobre mb-1">Hoje, por horário</p>
        <p className="hc-nota mb-3">As 5 contagens do dia (o site conta sozinho, sem pesar o servidor).</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                <th className="py-1.5 pr-2">Unidade</th>
                {horarios.map((h) => (
                  <th key={h} className="px-1.5 py-1.5 text-right">
                    {h === 0 ? "23:59" : `${h}h`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {UNIDADES.map((u) => (
                <tr key={u.id} className="border-t border-white/[0.05]">
                  <td className="py-1.5 pr-2 font-semibold">{u.tipo === "guarnicao" ? u.sigla : u.nome}</td>
                  {horarios.map((h) => {
                    const v = hojeRows.filter((o) => o.set_name === u.grupo && o.hour === h).at(-1)?.amount;
                    return (
                      <td key={h} className="px-1.5 py-1.5 text-right tabular-nums text-muted-foreground">
                        {v ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
