import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  Megaphone,
  Search,
  Send,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { listEquipeAreas } from "@/lib/areas.functions";
import { abrirAvisos, alternarAvisos, fecharPainel, usePainelTopo } from "@/lib/menu-perfil";
import { useAreas, useMyRole } from "@/lib/permissions";
import { useRealtimeTable } from "@/lib/realtime";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  CARGOS_EM_ORDEM,
  PRIORIDADES,
  apagarComunicado,
  arquivarComunicado,
  confirmarLeitura,
  destinatarios,
  enviarComunicado,
  fetchComunicados,
  fetchLeituras,
  marcarTarefa,
  pendenteParaMim,
  podeEnviarComunicado,
  textoDoPublico,
  tocarAlerta,
  type Comunicado,
  type Leitura,
  type MembroEquipe,
  type NovoComunicado,
  type Prioridade,
  type Publico,
  type TipoComunicado,
} from "@/lib/comunicados";
import { TextoFormatado } from "@/components/texto-formatado";
import { EditorTexto } from "@/components/editor-texto";

const KEY_C = ["comunicados"];
const KEY_L = ["comunicado-leituras"];

function useEu() {
  const nome = useQuery({
    queryKey: ["my-username"],
    queryFn: async () => {
      const auth = await getAuthUserData();
      if (!auth.user) return { username: "", avatar_url: "" };
      const { data } = await supabase.from("profiles").select("username, avatar_url").eq("id", auth.user.id).maybeSingle();
      return { username: data?.username ?? "", avatar_url: data?.avatar_url ?? "" };
    },
    staleTime: 60_000,
  });
  const id = useQuery({
    queryKey: ["eu-id"],
    queryFn: async () => (await getAuthUserData()).user?.id ?? null,
    staleTime: Infinity,
  });
  return id.data ? { id: id.data, nome: nome.data?.username || "staff" } : null;
}

function useComunicados() {
  useRealtimeTable("comunicados", [KEY_C]);
  useRealtimeTable("comunicado_leituras", [KEY_L]);
  const c = useQuery({ queryKey: KEY_C, queryFn: fetchComunicados, staleTime: 20_000, retry: 1 });
  const l = useQuery({ queryKey: KEY_L, queryFn: fetchLeituras, staleTime: 20_000, retry: 1 });
  return { comunicados: c.data ?? [], leituras: l.data ?? [], carregando: c.isLoading, carregado: c.isSuccess, erro: c.isError };
}

const haQuanto = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
const horaCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/* ================================================================== botão do sino */

/** Sino ao lado do "Menu @nome": conta o que falta confirmar e toca quando chega aviso novo. */
export function SinoBotao() {
  const eu = useEu();
  const painel = usePainelTopo();
  const { comunicados, leituras, carregado } = useComunicados();
  const minhas = useMemo(() => new Map(leituras.filter((l) => l.user_id === eu?.id).map((l) => [l.comunicado_id, l])), [leituras, eu?.id]);
  const paraMim = comunicados.filter((c) => c.criado_por_id !== eu?.id);
  const pendentes = paraMim.filter((c) => pendenteParaMim(c, minhas.get(c.id)));
  const urgente = pendentes.some((c) => c.prioridade === "urgente");
  // obrigatório: aviso que pede confirmação (ou tarefa) que a pessoa ainda nem abriu
  const obrigatorios = paraMim.filter(
    (c) => !c.arquivado && !minhas.has(c.id) && (c.exige_leitura || c.tipo === "tarefa"),
  );
  const temObrigatorio = !!eu && carregado && obrigatorios.length > 0;
  const urgenteObrigatorio = obrigatorios.some((c) => c.prioridade === "urgente");
  // apita a cada 5 s enquanto houver aviso para confirmar
  useEffect(() => {
    if (!temObrigatorio) return;
    tocarAlerta(urgenteObrigatorio);
    const t = window.setInterval(() => tocarAlerta(urgenteObrigatorio), 5000);
    return () => window.clearInterval(t);
  }, [temObrigatorio, urgenteObrigatorio]);

  // aviso novo chegando (tempo real): toca o som e mostra um aviso na tela
  const vistos = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!eu || !carregado) return;
    // primeira leitura: o que já existia não toca (só o que chegar depois)
    if (vistos.current === null) {
      vistos.current = new Set(comunicados.map((c) => c.id));
      return;
    }
    for (const c of comunicados) {
      if (vistos.current.has(c.id)) continue;
      vistos.current.add(c.id);
      if (c.criado_por_id === eu.id || c.arquivado) continue;
      if (c.som) tocarAlerta(c.prioridade === "urgente");
      toast(c.tipo === "tarefa" ? `Nova tarefa: ${c.titulo}` : `Novo aviso: ${c.titulo}`, {
        description: c.criado_por ? `Enviado por ${c.criado_por}` : undefined,
        duration: c.prioridade === "urgente" ? 20_000 : 8_000,
        action: { label: "Abrir", onClick: abrirAvisos },
      });
    }
  }, [comunicados, eu, carregado]);

  const aberto = painel === "avisos";
  return (
    <>
    {temObrigatorio && eu && <AvisosObrigatorios lista={obrigatorios} eu={eu} />}
    <button
      type="button"
      onClick={alternarAvisos}
      aria-expanded={aberto}
      aria-label={pendentes.length ? `Avisos: ${pendentes.length} para confirmar` : "Avisos"}
      title="Avisos e tarefas"
      className={cn("menu-sino", aberto && "menu-perfil-botao-on", pendentes.length > 0 && "menu-sino-tem", urgente && "menu-sino-urgente")}
    >
      {aberto ? <X className="size-[17px]" strokeWidth={2.1} /> : pendentes.length ? <BellRing className="size-[17px]" strokeWidth={2} /> : <Bell className="size-[17px]" strokeWidth={1.9} />}
      {pendentes.length > 0 && !aberto && <span className="menu-sino-num">{pendentes.length > 9 ? "9+" : pendentes.length}</span>}
    </button>
    </>
  );
}

/* ================================================================== aviso obrigatório */

/**
 * Tela que tapa o site inteiro até a pessoa confirmar a leitura dos avisos obrigatórios (e dar
 * ciência das tarefas). Apita a cada 5 s enquanto estiver aberta.
 */
function AvisosObrigatorios({ lista, eu }: { lista: Comunicado[]; eu: { id: string; nome: string } }) {
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState<string | null>(null);
  const confirmar = async (c: Comunicado) => {
    setSalvando(c.id);
    try {
      await confirmarLeitura(c.id, eu);
      await qc.invalidateQueries({ queryKey: KEY_L });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu para confirmar. Tente de novo.");
    } finally {
      setSalvando(null);
    }
  };
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="aviso-obrigatorio-fundo" role="alertdialog" aria-modal="true" aria-label="Avisos para confirmar">
      <div className="aviso-obrigatorio">
        <div className="flex items-center gap-3">
          <span className="aviso-obrigatorio-sino">
            <BellRing className="size-6" strokeWidth={2} />
          </span>
          <div>
            <p className="text-[19px] font-bold text-white">
              {lista.length === 1 ? "Você tem 1 aviso para confirmar" : `Você tem ${lista.length} avisos para confirmar`}
            </p>
            <p className="hc-nota">Leia e confirme para continuar usando o painel.</p>
          </div>
        </div>
        <ul className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {lista.map((c) => {
            const p = PRIORIDADES.find((x) => x.id === c.prioridade)!;
            return (
              <li key={c.id} className="aviso-card aviso-card-pendente" style={{ borderLeftColor: p.cor }}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Etiqueta tipo={c.tipo} />
                  {c.prioridade !== "normal" && (
                    <span className="aviso-chip" style={{ color: p.cor, borderColor: `${p.cor}55` }}>
                      {p.rotulo}
                    </span>
                  )}
                  <span className="hc-nota ml-auto">{c.criado_por ? `De ${c.criado_por} · ` : ""}{haQuanto(c.created_at)}</span>
                </div>
                <p className="mt-1.5 text-[14px] font-semibold text-foreground">{c.titulo}</p>
                {c.texto && <p className="aviso-texto"><TextoFormatado texto={c.texto} /></p>}
                {c.prazo && <p className="hc-nota mt-1">Prazo: {horaCurta(c.prazo)}</p>}
                <div className="mt-2.5 flex justify-end">
                  <button type="button" className="aviso-confirmar" disabled={salvando === c.id} onClick={() => void confirmar(c)}>
                    {salvando === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    {c.tipo === "tarefa" ? "Estou ciente" : "Confirmar leitura"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

/* ================================================================== a tela dos avisos */

/** Tela única: o que é para mim (confirmar / marcar feita) e, para Coordinator+, enviar e acompanhar. */
export function PainelAvisos() {
  const eu = useEu();
  const { data: role } = useMyRole();
  const gestor = podeEnviarComunicado(role);
  const { comunicados, leituras, carregando, erro } = useComunicados();
  const listar = useServerFn(listEquipeAreas);
  const equipe = useQuery({
    queryKey: ["areas-equipe"],
    queryFn: () => listar(),
    enabled: gestor,
    staleTime: 60_000,
  });
  const areas = useAreas();
  const membros: MembroEquipe[] = useMemo(
    () => (equipe.data ?? []).map((u) => ({ id: u.id, username: u.username, avatar_url: u.avatar_url, role: u.role, areas: u.areas })),
    [equipe.data],
  );
  const nomes = useMemo(
    () => ({
      cargo: (r: string) => ROLE_LABELS[r as AppRole] ?? r,
      area: (a: string) => areas.data?.find((x) => x.key === a)?.label ?? a,
      pessoa: (id: string) => membros.find((m) => m.id === id)?.username ?? "staff",
    }),
    [areas.data, membros],
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Avisos e tarefas" className="menu-perfil-janela">
      <div className="menu-perfil-topo">
        <div>
          <p className="menu-perfil-titulo">Avisos e tarefas</p>
          <p className="hc-nota">
            {gestor
              ? "Envie avisos e tarefas para quem você escolher e veja quem já leu."
              : "Avisos e tarefas da gestão para você. Confirme a leitura de cada um."}
          </p>
        </div>
        <button type="button" onClick={fecharPainel} className="menu-perfil-fechar" aria-label="Fechar">
          <X className="size-4" />
        </button>
      </div>
      {erro ? (
        <p className="m-6 rounded-2xl border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
          Os avisos ainda não estão no banco. (A atualização do banco do sino precisa ser aplicada.)
        </p>
      ) : (
        <div className={cn("aviso-grade", gestor ? "aviso-grade-gestor" : "aviso-grade-staff")}>
          <ParaVoce comunicados={comunicados} leituras={leituras} eu={eu} carregando={carregando} />
          {gestor && <NovoAviso membros={membros} carregandoEquipe={equipe.isLoading} areas={areas.data ?? []} eu={eu} />}
          {gestor && <Enviados comunicados={comunicados} leituras={leituras} membros={membros} nomes={nomes} carregando={carregando} />}
        </div>
      )}
    </div>
  );
}

function Coluna({ titulo, icone, extra, children }: { titulo: string; icone: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="aviso-coluna">
      <header className="aviso-coluna-topo">
        <span className="flex items-center gap-2">
          {icone}
          <span className="hc-titulo">{titulo}</span>
        </span>
        {extra}
      </header>
      <div className="aviso-coluna-corpo">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ para você */

function ParaVoce({
  comunicados,
  leituras,
  eu,
  carregando,
}: {
  comunicados: Comunicado[];
  leituras: Leitura[];
  eu: { id: string; nome: string } | null;
  carregando: boolean;
}) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"pendentes" | "todos">("pendentes");
  const minhas = useMemo(() => new Map(leituras.filter((l) => l.user_id === eu?.id).map((l) => [l.comunicado_id, l])), [leituras, eu?.id]);
  // o que é para mim (a gestão vê tudo no banco; aqui fica só o que me inclui e não fui eu que mandei)
  const meus = comunicados.filter((c) => c.criado_por_id !== eu?.id && !c.arquivado);
  const pendentes = meus.filter((c) => pendenteParaMim(c, minhas.get(c.id)));
  const lista = filtro === "pendentes" ? pendentes : meus;

  const acao = useMutation({
    mutationFn: async ({ c, feita }: { c: Comunicado; feita?: boolean }) => {
      if (!eu) throw new Error("Entre novamente.");
      if (c.tipo === "tarefa") await marcarTarefa(c.id, eu, feita ?? true);
      else await confirmarLeitura(c.id, eu);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY_L }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu para salvar."),
  });

  return (
    <Coluna
      titulo="Para você"
      icone={<Megaphone className="size-4 text-[#ff4b3e]" />}
      extra={
        <div className="segmentos !h-8 text-[11.5px]" role="group">
          <button type="button" aria-pressed={filtro === "pendentes"} onClick={() => setFiltro("pendentes")}>
            Pendentes <span className="tabular-nums opacity-60">{pendentes.length}</span>
          </button>
          <button type="button" aria-pressed={filtro === "todos"} onClick={() => setFiltro("todos")}>
            Todos
          </button>
        </div>
      }
    >
      {carregando ? (
        <Loader2 className="mx-auto my-10 size-5 animate-spin text-muted-foreground" />
      ) : lista.length === 0 ? (
        <div className="grid h-full place-items-center p-6 text-center">
          <div>
            <CheckCheck className="mx-auto size-7 text-emerald-400/80" strokeWidth={1.6} />
            <p className="mt-2 text-[13px] text-foreground">{filtro === "pendentes" ? "Tudo em dia" : "Nenhum aviso ainda"}</p>
            <p className="hc-nota">{filtro === "pendentes" ? "Nada para confirmar agora." : "Quando a gestão mandar algo, aparece aqui."}</p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((c) => {
            const m = minhas.get(c.id);
            const p = PRIORIDADES.find((x) => x.id === c.prioridade)!;
            const pendente = pendenteParaMim(c, m);
            return (
              <li key={c.id} className={cn("aviso-card", pendente && "aviso-card-pendente")} style={{ borderLeftColor: p.cor }}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Etiqueta tipo={c.tipo} />
                  {c.prioridade !== "normal" && (
                    <span className="aviso-chip" style={{ color: p.cor, borderColor: `${p.cor}55` }}>
                      {p.rotulo}
                    </span>
                  )}
                  <span className="hc-nota ml-auto">{haQuanto(c.created_at)}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] font-semibold text-foreground">{c.titulo}</p>
                {c.texto && <p className="aviso-texto"><TextoFormatado texto={c.texto} /></p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="hc-nota">
                    {c.criado_por ? `De ${c.criado_por}` : ""}
                    {c.prazo ? ` · prazo ${horaCurta(c.prazo)}` : ""}
                  </span>
                  <span className="ml-auto">
                    {c.tipo === "tarefa" ? (
                      m?.concluido_em ? (
                        <button type="button" className="aviso-feito" onClick={() => acao.mutate({ c, feita: false })} title="Desfazer">
                          <Check className="size-3.5" /> Feita
                        </button>
                      ) : (
                        <button type="button" className="aviso-confirmar" disabled={acao.isPending} onClick={() => acao.mutate({ c, feita: true })}>
                          <ClipboardCheck className="size-3.5" /> Marcar como feita
                        </button>
                      )
                    ) : m ? (
                      <span className="aviso-feito">
                        <Check className="size-3.5" /> Lido {horaCurta(m.lido_em)}
                      </span>
                    ) : c.exige_leitura ? (
                      <button type="button" className="aviso-confirmar" disabled={acao.isPending} onClick={() => acao.mutate({ c })}>
                        <Check className="size-3.5" /> Confirmar leitura
                      </button>
                    ) : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Coluna>
  );
}

function Etiqueta({ tipo }: { tipo: TipoComunicado }) {
  return tipo === "tarefa" ? (
    <span className="aviso-chip aviso-chip-tarefa">
      <ClipboardCheck className="size-3" /> Tarefa
    </span>
  ) : (
    <span className="aviso-chip">
      <Megaphone className="size-3" /> Aviso
    </span>
  );
}

/* ------------------------------------------------------------------ novo aviso */

const VAZIO: NovoComunicado = {
  tipo: "aviso",
  titulo: "",
  texto: "",
  prioridade: "normal",
  publico: "todos",
  cargos: [],
  areas: [],
  pessoas: [],
  som: true,
  exige_leitura: true,
  prazo: null,
};

function NovoAviso({
  membros,
  carregandoEquipe,
  areas,
  eu,
}: {
  membros: MembroEquipe[];
  carregandoEquipe: boolean;
  areas: { key: string; label: string; emoji?: string | null }[];
  eu: { id: string; nome: string } | null;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<NovoComunicado>(VAZIO);
  const [busca, setBusca] = useState("");
  const set = <K extends keyof NovoComunicado>(k: K, v: NovoComunicado[K]) => setF((x) => ({ ...x, [k]: v }));
  const alternar = (k: "cargos" | "areas" | "pessoas", v: string) =>
    setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const quem = destinatarios(f, membros);
  const achados = membros.filter((m) => m.username.toLowerCase().includes(busca.trim().toLowerCase()));

  const enviar = useMutation({
    mutationFn: async () => {
      if (!eu) throw new Error("Entre novamente.");
      await enviarComunicado({ ...f, prazo: f.tipo === "tarefa" && f.prazo ? new Date(f.prazo).toISOString() : null, exige_leitura: f.tipo === "tarefa" ? true : f.exige_leitura }, eu);
    },
    onSuccess: () => {
      toast.success(`${f.tipo === "tarefa" ? "Tarefa" : "Aviso"} enviado para ${quem.length} staff${quem.length === 1 ? "" : "s"}.`);
      setF((x) => ({ ...VAZIO, publico: x.publico, cargos: x.cargos, areas: x.areas, pessoas: x.pessoas }));
      void qc.invalidateQueries({ queryKey: KEY_C });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu para enviar."),
  });

  const pronto = f.titulo.trim().length > 0 && (f.publico === "todos" || quem.length > 0);

  return (
    <Coluna titulo="Novo aviso" icone={<Send className="size-4 text-[#ff4b3e]" />}>
      <form
        className="flex h-full flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (pronto) enviar.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-1.5">
          {(["aviso", "tarefa"] as const).map((t) => (
            <button key={t} type="button" onClick={() => set("tipo", t)} className={cn("aviso-opcao", f.tipo === t && "aviso-opcao-on")}>
              {t === "aviso" ? <Megaphone className="size-3.5" /> : <ClipboardCheck className="size-3.5" />}
              {t === "aviso" ? "Aviso" : "Tarefa para todos"}
            </button>
          ))}
        </div>
        <input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder={f.tipo === "tarefa" ? "O que precisa ser feito?" : "Título do aviso"} className="arte-input" maxLength={140} />
        <EditorTexto value={f.texto ?? ""} onChange={(e) => set("texto", e.target.value)} placeholder="Detalhes (opcional)" rows={3} className="arte-input resize-none" />

        <div>
          <p className="arte-rotulo">Prioridade</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {PRIORIDADES.map((p) => (
              <button key={p.id} type="button" onClick={() => set("prioridade", p.id as Prioridade)} className={cn("aviso-opcao", f.prioridade === p.id && "aviso-opcao-on")} style={f.prioridade === p.id ? { borderColor: p.cor, color: p.cor } : undefined}>
                {p.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <p className="arte-rotulo">Para quem</p>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {(
              [
                ["todos", "Todos"],
                ["cargos", "Cargos"],
                ["areas", "Áreas"],
                ["pessoas", "Staffs"],
              ] as [Publico, string][]
            ).map(([id, r]) => (
              <button key={id} type="button" onClick={() => set("publico", id)} className={cn("aviso-opcao", f.publico === id && "aviso-opcao-on")}>
                {r}
              </button>
            ))}
          </div>
          <div className="aviso-escolha">
            {f.publico === "todos" ? (
              <p className="hc-nota p-2">Vai para toda a equipe.</p>
            ) : f.publico === "cargos" ? (
              <div className="flex flex-wrap gap-1.5 p-1">
                {CARGOS_EM_ORDEM.map((r) => (
                  <button key={r} type="button" onClick={() => alternar("cargos", r)} className={cn("aviso-pilula", f.cargos.includes(r) && "aviso-pilula-on")}>
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            ) : f.publico === "areas" ? (
              <div className="flex flex-wrap gap-1.5 p-1">
                {areas.map((a) => (
                  <button key={a.key} type="button" onClick={() => alternar("areas", a.key)} className={cn("aviso-pilula", f.areas.includes(a.key) && "aviso-pilula-on")}>
                    {a.emoji ? `${a.emoji} ` : ""}
                    {a.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <label className="flex items-center gap-2 border-b border-white/[0.06] px-2 pb-1.5">
                  <Search className="size-3.5 text-muted-foreground" />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar staff…" className="w-full bg-transparent text-[12.5px] outline-none" />
                  {f.pessoas.length > 0 && <span className="hc-nota shrink-0">{f.pessoas.length} escolhidos</span>}
                </label>
                <div className="min-h-0 flex-1 overflow-y-auto pt-1">
                  {carregandoEquipe ? (
                    <Loader2 className="mx-auto my-4 size-4 animate-spin text-muted-foreground" />
                  ) : (
                    achados.map((m) => (
                      <button key={m.id} type="button" onClick={() => alternar("pessoas", m.id)} className={cn("aviso-pessoa", f.pessoas.includes(m.id) && "aviso-pessoa-on")}>
                        <img src={m.avatar_url || DEFAULT_AVATAR_URL} alt="" className="size-6 rounded-md object-cover" />
                        <span className="min-w-0 flex-1 truncate text-left">{m.username}</span>
                        <span className="hc-nota">{ROLE_LABELS[m.role as AppRole] ?? m.role}</span>
                        <span className="aviso-check">{f.pessoas.includes(m.id) && <Check className="size-3" />}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Chave ligado={f.som} onChange={(v) => set("som", v)} icone={<Volume2 className="size-3.5" />} texto="Tocar som de notificação" />
          {f.tipo === "aviso" ? (
            <Chave ligado={f.exige_leitura} onChange={(v) => set("exige_leitura", v)} icone={<CheckCheck className="size-3.5" />} texto="Precisam confirmar a leitura" />
          ) : (
            <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              Prazo (opcional)
              <input type="datetime-local" value={f.prazo ?? ""} onChange={(e) => set("prazo", e.target.value || null)} className="arte-input !w-auto !py-1.5" />
            </label>
          )}
        </div>

        <button type="submit" disabled={!pronto || enviar.isPending} className="aviso-enviar">
          {enviar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Enviar para {f.publico === "todos" && !membros.length ? "todos" : `${quem.length} staff${quem.length === 1 ? "" : "s"}`}
        </button>
      </form>
    </Coluna>
  );
}

function Chave({ ligado, onChange, icone, texto }: { ligado: boolean; onChange: (v: boolean) => void; icone: ReactNode; texto: string }) {
  return (
    <button type="button" onClick={() => onChange(!ligado)} className="flex w-full items-center gap-2 text-left text-[12.5px] text-foreground">
      <span className={cn("aviso-chave", ligado && "aviso-chave-on")}>
        <span />
      </span>
      <span className="text-muted-foreground">{icone}</span>
      {texto}
    </button>
  );
}

/* ------------------------------------------------------------------ enviados */

function Enviados({
  comunicados,
  leituras,
  membros,
  nomes,
  carregando,
}: {
  comunicados: Comunicado[];
  leituras: Leitura[];
  membros: MembroEquipe[];
  nomes: Parameters<typeof textoDoPublico>[1];
  carregando: boolean;
}) {
  const qc = useQueryClient();
  const [verArquivados, setVerArquivados] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const lista = comunicados.filter((c) => c.arquivado === verArquivados);
  const porComunicado = useMemo(() => {
    const m = new Map<string, Leitura[]>();
    for (const l of leituras) m.set(l.comunicado_id, [...(m.get(l.comunicado_id) ?? []), l]);
    return m;
  }, [leituras]);

  const arquivar = useMutation({
    mutationFn: ({ id, a }: { id: string; a: boolean }) => arquivarComunicado(id, a),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY_C }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu."),
  });
  const apagar = useMutation({
    mutationFn: apagarComunicado,
    onSuccess: () => {
      toast.success("Apagado.");
      void qc.invalidateQueries({ queryKey: KEY_C });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu."),
  });

  return (
    <Coluna
      titulo="Enviados"
      icone={<CheckCheck className="size-4 text-[#ff4b3e]" />}
      extra={
        <div className="segmentos !h-8 text-[11.5px]" role="group">
          <button type="button" aria-pressed={!verArquivados} onClick={() => setVerArquivados(false)}>
            Ativos
          </button>
          <button type="button" aria-pressed={verArquivados} onClick={() => setVerArquivados(true)}>
            Arquivados
          </button>
        </div>
      }
    >
      {carregando ? (
        <Loader2 className="mx-auto my-10 size-5 animate-spin text-muted-foreground" />
      ) : lista.length === 0 ? (
        <p className="hc-nota p-6 text-center">{verArquivados ? "Nada arquivado." : "Nenhum aviso enviado ainda."}</p>
      ) : (
        <ul className="space-y-2">
          {lista.map((c) => {
            const alvo = destinatarios(c, membros).filter((m) => m.id !== c.criado_por_id);
            const ls = porComunicado.get(c.id) ?? [];
            const ok = c.tipo === "tarefa" ? ls.filter((l) => l.concluido_em) : ls;
            const okIds = new Set(ok.map((l) => l.user_id));
            const total = alvo.length || 1;
            const pct = Math.min(100, Math.round((alvo.filter((m) => okIds.has(m.id)).length / total) * 100));
            const feitos = alvo.filter((m) => okIds.has(m.id)).length;
            const p = PRIORIDADES.find((x) => x.id === c.prioridade)!;
            const expandido = aberto === c.id;
            return (
              <li key={c.id} className="aviso-card" style={{ borderLeftColor: p.cor }}>
                <button type="button" className="w-full text-left" onClick={() => setAberto(expandido ? null : c.id)}>
                  <div className="flex items-center gap-1.5">
                    <Etiqueta tipo={c.tipo} />
                    <span className="hc-nota truncate">{textoDoPublico(c, nomes)}</span>
                    <ChevronDown className={cn("ml-auto size-3.5 shrink-0 text-muted-foreground transition", expandido && "rotate-180")} />
                  </div>
                  <p className="mt-1.5 truncate text-[13px] font-semibold text-foreground">{c.titulo}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="aviso-barra">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                      {feitos}/{alvo.length} {c.tipo === "tarefa" ? "fizeram" : c.exige_leitura ? "leram" : "viram"}
                    </span>
                  </div>
                  <p className="hc-nota mt-1">
                    {c.criado_por ? `${c.criado_por} · ` : ""}
                    {haQuanto(c.created_at)}
                    {c.som ? " · com som" : ""}
                  </p>
                </button>
                {expandido && (
                  <div className="mt-2 border-t border-white/[0.06] pt-2">
                    <div className="grid max-h-44 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto">
                      {alvo.map((m) => {
                        const l = ls.find((x) => x.user_id === m.id);
                        const feito = okIds.has(m.id);
                        return (
                          <span key={m.id} className={cn("flex items-center gap-1.5 text-[12px]", feito ? "text-foreground" : "text-muted-foreground")} title={l ? `Leu ${horaCurta(l.lido_em)}${l.concluido_em ? ` · fez ${horaCurta(l.concluido_em)}` : ""}` : "Ainda não"}>
                            {feito ? <Check className="size-3 text-emerald-400" /> : <span className="size-3 rounded-full border border-white/20" />}
                            <span className="truncate">{m.username}</span>
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <button type="button" className="arte-baixar" onClick={() => arquivar.mutate({ id: c.id, a: !c.arquivado })}>
                        {c.arquivado ? <ArchiveRestore className="size-3" /> : <Archive className="size-3" />}
                        {c.arquivado ? "Desarquivar" : "Arquivar"}
                      </button>
                      <button
                        type="button"
                        className="arte-baixar opacity-70 hover:opacity-100"
                        onClick={() => window.confirm(`Apagar "${c.titulo}"? As leituras também somem.`) && apagar.mutate(c.id)}
                      >
                        <Trash2 className="size-3" /> Apagar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Coluna>
  );
}
