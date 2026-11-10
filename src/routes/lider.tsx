import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ClipboardList,
  Copy,
  Crown,
  Eye,
  ImageDown,
  Link2,
  ListPlus,
  Loader2,
  LogOut,
  MousePointerClick,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/dashboard/Logo";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StoryAcoes, StoryPreview } from "@/components/org/story-preview";
import { useContador } from "@/hooks/use-contador";
import { copiarTexto } from "@/lib/copiar";
import { orgAbrir, orgAdicionar, orgAtualizar, orgRemover } from "@/lib/org-painel.functions";
import {
  ATO,
  CARGOS,
  cargoLabel,
  gerentesRecomendados,
  LIMITE_MEMBROS,
  linkConvite,
  listaParaDiscord,
  normalizarCodigo,
  patente,
  PATENTES,
  type Cargo,
  type OrgMembro,
  type OrgPainelLider,
  type PainelDados,
} from "@/lib/org-painel-shared";
import { playSfx } from "@/lib/sfx";
import type { StoryDados } from "@/lib/story-ato";

export const Route = createFileRoute("/lider")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `Painel do líder — HOST ${ATO}` },
      { name: "description", content: "Painel da organização na HOST: cadastre sua equipe e acompanhe a meta." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LiderPage,
});

/** O código fica salvo só neste aparelho, para o líder não digitar toda vez. */
const CHAVE = "host-lider-codigo";

function mensagem(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  return m && m.length < 160 && !m.startsWith("{") && !m.startsWith("[") ? m : "Algo deu errado. Tente de novo.";
}

function guardar(codigo: string | null) {
  try {
    if (codigo) localStorage.setItem(CHAVE, codigo);
    else localStorage.removeItem(CHAVE);
  } catch {
    // sem armazenamento: o líder só precisa digitar o código de novo na próxima vez
  }
}

/** Código vindo do link (depois do #) ou, se não houver, o salvo neste aparelho. Só lê, não altera nada. */
function codigoInicial(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const doLink = normalizarCodigo(decodeURIComponent(window.location.hash.slice(1)));
    if (doLink) return doLink;
  } catch {
    // endereço malformado: ignora e tenta o código salvo
  }
  try {
    const salvo = localStorage.getItem(CHAVE);
    return salvo ? normalizarCodigo(salvo) : null;
  } catch {
    return null;
  }
}

const campo =
  "h-11 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 text-base outline-none transition-colors [color-scheme:dark] placeholder:text-ink-3 focus:border-white/25 sm:text-sm";

/* ------------------------------------------------------------------ */

function LiderPage() {
  const qc = useQueryClient();
  const abrir = useServerFn(orgAbrir);
  const [codigo, setCodigo] = useState<string | null>(codigoInicial);
  const [erro, setErro] = useState("");

  // Tira o código da barra de endereço depois que ele já foi lido.
  useEffect(() => {
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
  }, []);

  const consulta = useQuery({
    queryKey: ["org-painel", codigo],
    queryFn: () => abrir({ data: { codigo: codigo ?? "" } }),
    enabled: !!codigo,
    retry: false,
    staleTime: 20_000,
  });

  useEffect(() => {
    if (!codigo) return;
    if (consulta.isSuccess) guardar(codigo);
    if (consulta.isError) {
      const msg = mensagem(consulta.error);
      setErro(msg);
      if (/inválido|desativado/i.test(msg)) guardar(null);
      setCodigo(null);
    }
  }, [codigo, consulta.isSuccess, consulta.isError, consulta.error]);

  if (codigo && consulta.isPending) {
    return (
      <div className="grid min-h-screen place-items-center">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Abrindo o painel…
        </span>
      </div>
    );
  }

  if (!codigo || !consulta.data) {
    return (
      <Entrada
        erro={erro}
        onEntrar={(c) => {
          setErro("");
          setCodigo(c);
        }}
      />
    );
  }

  return (
    <Painel
      codigo={codigo}
      dados={consulta.data}
      atualizando={consulta.isFetching}
      onAtualizar={() => void consulta.refetch()}
      onSair={() => {
        guardar(null);
        qc.removeQueries({ queryKey: ["org-painel"] });
        setCodigo(null);
      }}
    />
  );
}

function Entrada({ erro, onEntrar }: { erro: string; onEntrar: (codigo: string) => void }) {
  const [valor, setValor] = useState("");
  const [aviso, setAviso] = useState("");

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const codigo = normalizarCodigo(valor);
    if (!codigo) {
      setAviso("Esse código não parece certo. Confira e tente de novo.");
      return;
    }
    setAviso("");
    onEntrar(codigo);
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <form onSubmit={enviar} className="pf-modal w-full max-w-sm text-center">
        <Logo className="mx-auto h-11 [&_path]:fill-white" />
        <p className="eyebrow mt-7">HOST · {ATO}</p>
        <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight">Painel do líder</h1>
        <p className="mt-2 text-sm text-muted-foreground">Digite o código que a equipe da HOST enviou para você.</p>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="HOST-XXXXX-XXXXX"
          aria-label="Código do painel"
          aria-invalid={!!(aviso || erro)}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          className="mt-7 h-12 w-full rounded-2xl border border-white/[0.09] bg-black/40 px-4 text-center font-mono text-base uppercase tracking-[0.14em] outline-none transition-colors placeholder:tracking-[0.14em] placeholder:text-ink-3 focus:border-white/25"
        />
        {(aviso || erro) && (
          <p role="alert" className="mt-3 text-xs text-red-300">
            {aviso || erro}
          </p>
        )}
        <button type="submit" className="mt-4 h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90">
          Entrar
        </button>
        <p className="mt-6 text-[11px] leading-relaxed text-ink-3">
          Guarde o código: quem tiver ele consegue mexer na sua organização. Se perder, peça um novo à equipe.
        </p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type Dialogo =
  | { tipo: "editar"; membro: OrgMembro }
  | { tipo: "story"; membro: OrgMembro }
  | { tipo: "story-org" }
  | { tipo: "varios" }
  | null;

function Painel({
  codigo,
  dados,
  atualizando,
  onAtualizar,
  onSair,
}: {
  codigo: string;
  dados: PainelDados;
  atualizando: boolean;
  onAtualizar: () => void;
  onSair: () => void;
}) {
  const qc = useQueryClient();
  const adicionar = useServerFn(orgAdicionar);
  const atualizar = useServerFn(orgAtualizar);
  const remover = useServerFn(orgRemover);
  const { painel, membros } = dados;
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [ocupado, setOcupado] = useState(false);

  const aplicar = (lista: OrgMembro[]) =>
    qc.setQueryData<PainelDados>(["org-painel", codigo], (antes) => (antes ? { ...antes, membros: lista } : antes));

  /** Roda uma ação no servidor, mostra o erro em português e devolve o resultado (ou null). */
  async function executar<T>(acao: () => Promise<T>): Promise<T | null> {
    setOcupado(true);
    try {
      return await acao();
    } catch (e) {
      toast.error(mensagem(e));
      return null;
    } finally {
      setOcupado(false);
    }
  }

  const cadastrar = async (lista: { nome: string; discord: string; passaporte: string; cargo: Cargo }[]) => {
    const r = await executar(() => adicionar({ data: { codigo, membros: lista } }));
    if (!r) return false;
    aplicar(r.membros);
    if (r.adicionados === 0) {
      toast.error(
        r.repetidos > 0 ? "Essa pessoa já está cadastrada (mesmo Discord ou passaporte)." : "Não há mais vagas na organização.",
      );
      return false;
    }
    playSfx("add");
    const partes = [`${r.adicionados} ${r.adicionados === 1 ? "pessoa cadastrada" : "pessoas cadastradas"}`];
    if (r.repetidos > 0) partes.push(`${r.repetidos} ${r.repetidos === 1 ? "repetida pulada" : "repetidas puladas"}`);
    if (r.semVaga > 0) partes.push(`${r.semVaga} sem vaga`);
    if (lista.length > 1 || r.repetidos > 0 || r.semVaga > 0) toast.success(`${partes.join(", ")}.`);
    return true;
  };

  const editar = async (id: string, patch: Partial<Pick<OrgMembro, "nome" | "discord" | "passaporte" | "cargo">>) => {
    const r = await executar(() => atualizar({ data: { codigo, id, ...patch } }));
    if (!r) return false;
    aplicar(r.membros);
    return true;
  };

  const excluir = async (m: OrgMembro) => {
    if (!window.confirm(`Remover ${m.nome} da organização? O link de afiliação dele para de funcionar.`)) return;
    const r = await executar(() => remover({ data: { codigo, id: m.id } }));
    if (!r) return;
    playSfx("remove");
    aplicar(r.membros);
  };

  const copiar = async (texto: string, ok: string) => {
    if (await copiarTexto(texto)) toast.success(ok);
    else toast.error("Não foi possível copiar. Tente pelo computador.");
  };

  const total = membros.length;
  const porCargo = useMemo(
    () => ({
      lider: membros.filter((m) => m.cargo === "lider").length,
      gerente: membros.filter((m) => m.cargo === "gerente").length,
      membro: membros.filter((m) => m.cargo === "membro").length,
    }),
    [membros],
  );
  const visitas = membros.reduce((s, m) => s + m.visitas, 0);
  const cliques = membros.reduce((s, m) => s + m.cliques, 0);
  const recomendados = gerentesRecomendados(porCargo.membro);
  const origem = window.location.origin;

  const storyDoMembro = (m: OrgMembro): StoryDados => ({
    chamada: "Faço parte do",
    nome: m.nome,
    etiqueta: `${cargoLabel(m.cargo)} · ${painel.nome}`,
  });

  const indicadores = [
    { k: "Líderes", v: porCargo.lider, icon: Crown },
    { k: "Gerentes", v: porCargo.gerente, icon: Shield },
    { k: "Membros", v: porCargo.membro, icon: User },
    { k: "Visitas nos links", v: visitas, icon: Eye },
    { k: "Cliques em entrar", v: cliques, icon: MousePointerClick },
  ];

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-6 sm:py-8">
      <header className="pf-sobe flex items-center gap-3">
        <Logo className="h-6 shrink-0 [&_path]:fill-white" />
        <p className="min-w-0 truncate text-sm font-semibold">Painel do líder</p>
        <span className="ml-auto shrink-0 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-red-200">{ATO}</span>
        <button
          onClick={onAtualizar}
          aria-label="Atualizar números"
          title="Atualizar números"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.05] text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className={cn("size-4", atualizando && "animate-spin")} />
        </button>
        <button onClick={onSair} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] px-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <LogOut className="size-3.5" /> Sair
        </button>
      </header>

      <Meta total={total} painel={painel} />

      <section className="pf-sobe mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5" style={{ animationDelay: "120ms" }}>
        {indicadores.map((c, i) => (
          <div key={c.k} className={cn("glass rounded-[20px] px-4 py-3.5", i === 4 && "col-span-2 sm:col-span-1")}>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <c.icon className="size-3.5 text-ink-3" /> {c.k}
            </p>
            <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{c.v.toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="pf-sobe min-w-0 space-y-4" style={{ animationDelay: "180ms" }}>
          <Cadastro cheio={total >= LIMITE_MEMBROS} ocupado={ocupado} onCadastrar={(m) => cadastrar([m])} onVarios={() => setDialogo({ tipo: "varios" })} />
          <Lista
            membros={membros}
            ocupado={ocupado}
            onCargo={(m, cargo) => void editar(m.id, { cargo })}
            onLink={(m) => void copiar(linkConvite(origem, m.slug), `Link de ${m.nome} copiado.`)}
            onStory={(m) => setDialogo({ tipo: "story", membro: m })}
            onEditar={(m) => setDialogo({ tipo: "editar", membro: m })}
            onRemover={(m) => void excluir(m)}
          />
        </div>

        <aside className="pf-sobe space-y-4" style={{ animationDelay: "240ms" }}>
          <section className="glass rounded-[24px] p-4">
            <h2 className="font-display text-[15px] font-semibold">Estrutura</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {porCargo.lider === 0
                ? "Cadastre quem é o líder para a hierarquia ficar completa."
                : porCargo.gerente < recomendados
                  ? `Você tem ${porCargo.gerente} de ${recomendados} ${recomendados === 1 ? "gerente recomendado" : "gerentes recomendados"} (1 a cada 10 membros). Promova alguém de confiança para organizar a equipe.`
                  : "Liderança e gerência em dia para o tamanho da equipe."}
            </p>
            <div className="mt-3 grid gap-2">
              <AcaoLateral icon={ImageDown} onClick={() => setDialogo({ tipo: "story-org" })}>
                Arte dos stories da organização
              </AcaoLateral>
              <AcaoLateral icon={ClipboardList} onClick={() => void copiar(listaParaDiscord(painel.nome, membros), "Lista copiada. É só colar no Discord.")}>
                Copiar lista para o Discord
              </AcaoLateral>
            </div>
          </section>

          <Divulgacao membros={membros} />

          <section className="glass rounded-[24px] p-4">
            <h2 className="font-display text-[15px] font-semibold">Como funciona</h2>
            <ol className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-muted-foreground">
              {[
                "Cadastre cada pessoa da sua organização com nome, Discord e cargo.",
                "Copie o link de cada um e envie para a pessoa.",
                `No link, ela salva a arte do ${ATO} e posta nos stories. Você acompanha aqui quem mais divulgou.`,
              ].map((passo, i) => (
                <li key={passo} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[10px] font-semibold text-foreground">{i + 1}</span>
                  <span>{passo}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      {dialogo?.tipo === "editar" && (
        <EditarDialog
          membro={dialogo.membro}
          ocupado={ocupado}
          onClose={() => setDialogo(null)}
          onSalvar={async (patch) => {
            if (await editar(dialogo.membro.id, patch)) setDialogo(null);
          }}
        />
      )}
      {dialogo?.tipo === "story" && (
        <StoryDialog
          titulo={`Arte de ${dialogo.membro.nome}`}
          dados={storyDoMembro(dialogo.membro)}
          link={linkConvite(origem, dialogo.membro.slug)}
          onCopiar={copiar}
          onClose={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === "story-org" && (
        <StoryDialog
          titulo="Arte da organização"
          dados={{ chamada: "Estamos no", nome: painel.nome, etiqueta: `${total} ${total === 1 ? "membro" : "membros"}` }}
          link={undefined}
          onCopiar={copiar}
          onClose={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === "varios" && (
        <VariosDialog
          vagas={LIMITE_MEMBROS - total}
          ocupado={ocupado}
          onClose={() => setDialogo(null)}
          onCadastrar={async (lista) => {
            if (await cadastrar(lista)) setDialogo(null);
          }}
        />
      )}
    </div>
  );
}

function AcaoLateral({ icon: Icon, onClick, children }: { icon: typeof Crown; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 text-left text-[13px] text-foreground/90 transition-colors hover:bg-white/[0.07]"
    >
      <Icon className="size-4 shrink-0 text-ink-3" /> {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Meta de 0 a 100
 * ------------------------------------------------------------------ */

function Meta({ total, painel }: { total: number; painel: OrgPainelLider }) {
  const { atual, proxima, faltam } = patente(total);
  const numero = useContador(total);
  const [animado, setAnimado] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimado(true), 250);
    return () => clearTimeout(t);
  }, []);
  const pct = animado ? Math.min(100, (total / LIMITE_MEMBROS) * 100) : 0;
  const arco = "M 32.45 135 A 78 78 0 1 1 167.55 135";
  const etapas = PATENTES.filter((p) => p.min > 0);

  return (
    <section className="glass pf-sobe mt-5 rounded-[28px] p-5 sm:p-7" style={{ animationDelay: "60ms" }}>
      <div className="grid items-center gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
        <div className="relative mx-auto w-[220px]" role="img" aria-label={`${total} de ${LIMITE_MEMBROS} pessoas cadastradas`}>
          <svg viewBox="0 0 200 150" className="w-full">
            <path d={arco} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
            <path
              d={arco}
              fill="none"
              stroke="#ce0e0e"
              strokeWidth="10"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${pct} 100`}
              style={{ transition: "stroke-dasharray 1100ms cubic-bezier(.2,.7,.2,1)", filter: "drop-shadow(0 0 10px rgba(206,14,14,0.55))" }}
            />
          </svg>
          <div className="absolute inset-x-0 top-[56px] text-center">
            <p className="font-display text-[52px] font-semibold leading-none tabular-nums">{Math.round(numero)}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">de {LIMITE_MEMBROS} pessoas</p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="eyebrow">{painel.setagem ? `${painel.setagem} · ` : ""}Organização</p>
          <h1 className="mt-1 truncate font-display text-3xl font-semibold tracking-tight">{painel.nome}</h1>
          {painel.lider_nome && <p className="mt-1 text-sm text-muted-foreground">Líder: {painel.lider_nome}</p>}

          <p className="mt-5 text-sm">
            <span className="font-semibold">{atual.nome}</span>
            <span className="text-muted-foreground">
              {proxima ? ` · faltam ${faltam} ${faltam === 1 ? "pessoa" : "pessoas"} para ${proxima.nome}` : " · meta batida, a organização está completa"}
            </span>
          </p>
          <div className="mt-3 px-1.5">
            <div className="relative h-2 rounded-full bg-white/[0.07]">
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-1000 ease-out" style={{ width: `${pct}%` }} />
              {etapas.map((p) => (
                <span
                  key={p.min}
                  className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0d0d0d] transition-colors duration-700", total >= p.min ? "bg-primary" : "bg-white/25")}
                  style={{ left: `${p.min}%` }}
                />
              ))}
            </div>
            <div className="relative mt-2.5 h-8">
              {etapas.map((p) => (
                <span
                  key={p.min}
                  className={cn("absolute text-center text-[10px] leading-tight", p.min === 100 ? "-translate-x-[85%]" : "-translate-x-1/2", total >= p.min ? "text-foreground" : "text-ink-3")}
                  style={{ left: `${p.min}%` }}
                >
                  <span className="block font-medium">{p.nome}</span>
                  <span className="tabular-nums">{p.min}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Cadastro e lista
 * ------------------------------------------------------------------ */

function SeletorCargo({ value, onChange, className, rotulo }: { value: Cargo; onChange: (c: Cargo) => void; className?: string; rotulo: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Cargo)} aria-label={rotulo} className={className}>
      {CARGOS.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

function Cadastro({
  cheio,
  ocupado,
  onCadastrar,
  onVarios,
}: {
  cheio: boolean;
  ocupado: boolean;
  onCadastrar: (m: { nome: string; discord: string; passaporte: string; cargo: Cargo }) => Promise<boolean>;
  onVarios: () => void;
}) {
  const [nome, setNome] = useState("");
  const [discord, setDiscord] = useState("");
  const [passaporte, setPassaporte] = useState("");
  const [cargo, setCargo] = useState<Cargo>("membro");
  const nomeRef = useRef<HTMLInputElement>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 2 || ocupado || cheio) return;
    if (await onCadastrar({ nome: nome.trim(), discord: discord.trim(), passaporte: passaporte.trim(), cargo })) {
      setNome("");
      setDiscord("");
      setPassaporte("");
      // Depois do líder, o normal é cadastrar a equipe.
      if (cargo === "lider") setCargo("membro");
      nomeRef.current?.focus();
    }
  };

  return (
    <form onSubmit={(e) => void enviar(e)} className="glass rounded-[24px] p-4">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-[15px] font-semibold">Cadastrar pessoa</h2>
        <button type="button" onClick={onVarios} disabled={cheio} className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40">
          <ListPlus className="size-3.5" /> Adicionar vários
        </button>
      </div>
      {cheio ? (
        <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-3 text-sm text-muted-foreground">
          Meta batida: a organização chegou em {LIMITE_MEMBROS} pessoas. Para cadastrar alguém novo, remova quem saiu.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_104px_124px_auto]">
          <input ref={nomeRef} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome no jogo" aria-label="Nome" maxLength={60} className={cn(campo, "col-span-2 md:col-span-1")} />
          <input value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="Discord" aria-label="Discord" maxLength={40} autoCapitalize="none" className={campo} />
          <input value={passaporte} onChange={(e) => setPassaporte(e.target.value)} placeholder="Passaporte" aria-label="Passaporte" maxLength={12} inputMode="numeric" className={campo} />
          <SeletorCargo value={cargo} onChange={setCargo} rotulo="Cargo" className={campo} />
          <button
            type="submit"
            disabled={nome.trim().length < 2 || ocupado}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Adicionar
          </button>
        </div>
      )}
    </form>
  );
}

const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

function BotaoIcone({ rotulo, onClick, children, perigo }: { rotulo: string; onClick: () => void; children: ReactNode; perigo?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      className={cn("grid size-9 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-white/[0.07]", perigo ? "hover:text-red-300" : "hover:text-foreground")}
    >
      {children}
    </button>
  );
}

function Lista({
  membros,
  ocupado,
  onCargo,
  onLink,
  onStory,
  onEditar,
  onRemover,
}: {
  membros: OrgMembro[];
  ocupado: boolean;
  onCargo: (m: OrgMembro, cargo: Cargo) => void;
  onLink: (m: OrgMembro) => void;
  onStory: (m: OrgMembro) => void;
  onEditar: (m: OrgMembro) => void;
  onRemover: (m: OrgMembro) => void;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Cargo | "todos">("todos");
  const q = busca.trim().toLowerCase();
  const visiveis = membros.filter(
    (m) =>
      (filtro === "todos" || m.cargo === filtro) &&
      (!q || m.nome.toLowerCase().includes(q) || m.discord.toLowerCase().includes(q) || m.passaporte.toLowerCase().includes(q)),
  );
  const chips: { id: Cargo | "todos"; label: string; n: number }[] = [
    { id: "todos", label: "Todos", n: membros.length },
    ...CARGOS.map((c) => ({ id: c.id, label: c.plural, n: membros.filter((m) => m.cargo === c.id).length })),
  ];

  return (
    <section className="glass rounded-[24px] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-[15px] font-semibold">Equipe</h2>
        <label className="ml-auto flex h-9 w-full items-center gap-2 rounded-full bg-white/[0.04] px-3 sm:w-56">
          <Search className="size-3.5 shrink-0 text-ink-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, Discord ou passaporte" aria-label="Buscar na equipe" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3 sm:text-xs" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.id}
            onClick={() => setFiltro(c.id)}
            aria-pressed={filtro === c.id}
            className={cn("rounded-full px-3 py-1.5 text-xs transition-colors", filtro === c.id ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {c.label} <span className="text-ink-3">{c.n}</span>
          </button>
        ))}
      </div>

      {membros.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white/[0.03] px-4 py-10 text-center text-sm text-muted-foreground">
          Ninguém cadastrado ainda. Comece por você: cadastre o líder e depois a equipe.
        </p>
      ) : visiveis.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white/[0.03] px-4 py-10 text-center text-sm text-muted-foreground">Ninguém encontrado com esse filtro.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {CARGOS.map((cargo) => {
            const grupo = visiveis.filter((m) => m.cargo === cargo.id);
            if (grupo.length === 0) return null;
            return (
              <div key={cargo.id}>
                <p className="px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {cargo.plural} · {grupo.length}
                </p>
                <ul className="mt-1">
                  {grupo.map((m) => (
                    <li key={m.id} className="pf-linha flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl px-2 py-2 transition-colors hover:bg-white/[0.03]">
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold", m.cargo === "lider" ? "bg-primary/20 text-red-200" : "bg-white/[0.06] text-foreground/85")}>
                        {iniciais(m.nome) || "?"}
                      </span>
                      <span className="min-w-0 flex-1 basis-36">
                        <span className="block truncate text-sm font-medium">
                          {m.nome}
                          {m.passaporte && <span className="ml-1.5 font-normal text-ink-3">#{m.passaporte}</span>}
                        </span>
                        <span className="block truncate text-[11px] text-ink-3">
                          {m.discord ? `@${m.discord.replace(/^@/, "")}` : "Sem Discord"} · {m.visitas} {m.visitas === 1 ? "visita" : "visitas"}
                        </span>
                      </span>
                      <span className="flex items-center gap-0.5">
                        <SeletorCargo
                          value={m.cargo}
                          onChange={(c) => !ocupado && c !== m.cargo && onCargo(m, c)}
                          rotulo={`Cargo de ${m.nome}`}
                          className="mr-1 h-9 rounded-lg border border-white/[0.08] bg-black/30 px-2 text-xs outline-none [color-scheme:dark] focus:border-white/25"
                        />
                        <BotaoIcone rotulo={`Copiar link de ${m.nome}`} onClick={() => onLink(m)}>
                          <Link2 className="size-4" />
                        </BotaoIcone>
                        <BotaoIcone rotulo={`Arte dos stories de ${m.nome}`} onClick={() => onStory(m)}>
                          <ImageDown className="size-4" />
                        </BotaoIcone>
                        <BotaoIcone rotulo={`Editar ${m.nome}`} onClick={() => onEditar(m)}>
                          <Pencil className="size-4" />
                        </BotaoIcone>
                        <BotaoIcone rotulo={`Remover ${m.nome}`} onClick={() => onRemover(m)} perigo>
                          <Trash2 className="size-4" />
                        </BotaoIcone>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Divulgacao({ membros }: { membros: OrgMembro[] }) {
  const ranking = membros
    .filter((m) => m.visitas > 0 || m.cliques > 0)
    .sort((a, b) => b.cliques - a.cliques || b.visitas - a.visitas)
    .slice(0, 5);
  return (
    <section className="glass rounded-[24px] p-4">
      <h2 className="font-display text-[15px] font-semibold">Quem mais divulgou</h2>
      {ranking.length === 0 ? (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Ninguém abriu os links ainda. Envie o link de cada pessoa para ela postar nos stories.</p>
      ) : (
        <ol className="mt-3 space-y-1">
          {ranking.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums", i === 0 ? "bg-primary text-white" : "bg-white/[0.07] text-muted-foreground")}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{m.nome}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" title="Visitas no link · cliques em entrar">
                {m.visitas} · {m.cliques}
              </span>
            </li>
          ))}
        </ol>
      )}
      {ranking.length > 0 && <p className="mt-2 text-[11px] text-ink-3">Visitas no link · cliques em entrar</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Janelas
 * ------------------------------------------------------------------ */

function EditarDialog({
  membro,
  ocupado,
  onClose,
  onSalvar,
}: {
  membro: OrgMembro;
  ocupado: boolean;
  onClose: () => void;
  onSalvar: (patch: { nome: string; discord: string; passaporte: string; cargo: Cargo }) => Promise<void>;
}) {
  const [nome, setNome] = useState(membro.nome);
  const [discord, setDiscord] = useState(membro.discord);
  const [passaporte, setPassaporte] = useState(membro.passaporte);
  const [cargo, setCargo] = useState<Cargo>(membro.cargo);
  const rotulo = "mb-1.5 block text-xs text-muted-foreground";

  return (
    <Dialog open onOpenChange={(o) => !o && !ocupado && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100vw-1.5rem)] max-w-md">
        <DialogTitle>Editar pessoa</DialogTitle>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim().length >= 2) void onSalvar({ nome: nome.trim(), discord: discord.trim(), passaporte: passaporte.trim(), cargo });
          }}
        >
          <label className="block">
            <span className={rotulo}>Nome no jogo</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className={campo} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={rotulo}>Discord</span>
              <input value={discord} onChange={(e) => setDiscord(e.target.value)} maxLength={40} autoCapitalize="none" className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>Passaporte</span>
              <input value={passaporte} onChange={(e) => setPassaporte(e.target.value)} maxLength={12} inputMode="numeric" className={campo} />
            </label>
          </div>
          <label className="block">
            <span className={rotulo}>Cargo</span>
            <SeletorCargo value={cargo} onChange={setCargo} rotulo="Cargo" className={campo} />
          </label>
          <button type="submit" disabled={nome.trim().length < 2 || ocupado} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-40">
            {ocupado && <Loader2 className="size-4 animate-spin" />} Salvar
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StoryDialog({
  titulo,
  dados,
  link,
  onCopiar,
  onClose,
}: {
  titulo: string;
  dados: StoryDados;
  link: string | undefined;
  onCopiar: (texto: string, ok: string) => Promise<void>;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto">
        <DialogTitle>{titulo}</DialogTitle>
        <div className="grid gap-5 sm:grid-cols-[190px_minmax(0,1fr)]">
          <StoryPreview dados={dados} className="mx-auto w-[190px]" />
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {link
                ? "Envie o link abaixo para essa pessoa. Por ele, ela mesma salva a arte e posta nos stories. Se preferir, salve a imagem aqui e mande para ela."
                : "Salve a imagem e poste nos stories da organização."}
            </p>
            {link && (
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/30 py-1 pl-3 pr-1">
                <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground/85">{link.replace(/^https?:\/\//, "")}</span>
                <button
                  type="button"
                  onClick={() => {
                    void onCopiar(link, "Link copiado.");
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 1400);
                  }}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.07] px-3 text-xs text-foreground transition-colors hover:bg-white/[0.12]"
                >
                  {copiado ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />} Copiar link
                </button>
              </div>
            )}
            <StoryAcoes dados={dados} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Lê uma lista colada: uma pessoa por linha, campos separados por vírgula, ponto e vírgula, barra ou tab. */
function lerLista(texto: string) {
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.split(/[,;|\t]/).map((parte) => parte.trim()))
    .filter((partes) => (partes[0] ?? "").length >= 2)
    .map((partes) => ({
      nome: (partes[0] ?? "").slice(0, 60),
      discord: (partes[1] ?? "").replace(/^@/, "").slice(0, 40),
      passaporte: (partes[2] ?? "").replace(/^#/, "").slice(0, 12),
    }));
}

function VariosDialog({
  vagas,
  ocupado,
  onClose,
  onCadastrar,
}: {
  vagas: number;
  ocupado: boolean;
  onClose: () => void;
  onCadastrar: (lista: { nome: string; discord: string; passaporte: string; cargo: Cargo }[]) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [cargo, setCargo] = useState<Cargo>("membro");
  const lista = useMemo(() => lerLista(texto), [texto]);
  const passou = Math.max(0, lista.length - vagas);

  return (
    <Dialog open onOpenChange={(o) => !o && !ocupado && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100vw-1.5rem)] max-w-lg">
        <DialogTitle>Adicionar vários de uma vez</DialogTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Uma pessoa por linha, no formato <span className="font-mono text-foreground/85">Nome, Discord, Passaporte</span>. Só o nome é obrigatório.
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          autoFocus
          placeholder={"João Silva, joaosilva, 152\nMaria Souza, maria.rp, 318\nPedro Lima"}
          aria-label="Lista de pessoas"
          className="w-full resize-y rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-3 font-mono text-base outline-none placeholder:text-ink-3 focus:border-white/25 sm:text-[13px]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Cargo de todos
            <SeletorCargo value={cargo} onChange={setCargo} rotulo="Cargo de todos" className="h-9 rounded-lg border border-white/[0.08] bg-black/30 px-2 text-xs outline-none [color-scheme:dark]" />
          </label>
          <p className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {lista.length} {lista.length === 1 ? "pessoa reconhecida" : "pessoas reconhecidas"} · {vagas} {vagas === 1 ? "vaga" : "vagas"}
          </p>
        </div>
        {passou > 0 && <p className="text-xs text-amber-200">A lista tem {passou} a mais do que as vagas. Só as primeiras {vagas} entram.</p>}
        <button
          type="button"
          disabled={lista.length === 0 || ocupado}
          onClick={() => void onCadastrar(lista.map((m) => ({ ...m, cargo })))}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {ocupado && <Loader2 className="size-4 animate-spin" />} Cadastrar {lista.length > 0 ? lista.length : ""} {lista.length === 1 ? "pessoa" : "pessoas"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
