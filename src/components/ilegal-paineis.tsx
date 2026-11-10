import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { copiarTexto } from "@/lib/copiar";
import type { IlegalOrg } from "@/lib/ilegal-data";
import { getCurrentUsername } from "@/lib/kanban";
import {
  atualizarPainel,
  criarPainel,
  excluirPainel,
  fetchPaineis,
  trocarCodigo,
  type OrgPainelAdmin,
  type PainelInput,
} from "@/lib/org-painel-admin";
import { ATO, cargoLabel, CARGOS, LIMITE_MEMBROS, linkPainel, patente, urlSegura } from "@/lib/org-painel-shared";
import { useRealtimeTable } from "@/lib/realtime";
import { playSfx } from "@/lib/sfx";

const KEY = ["org-paineis"];

const campo =
  "h-10 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 text-sm outline-none transition-colors placeholder:text-ink-3 focus:border-white/25";

/** Mensagem pronta para mandar ao líder, com o link direto e o código. */
function textoConvite(nome: string, codigo: string): string {
  return [
    `Painel da ${nome} na HOST — ${ATO}`,
    "",
    `Acesse: ${linkPainel(window.location.origin, codigo)}`,
    `Código: ${codigo}`,
    "",
    "Por ele você cadastra sua equipe e gera o link de cada membro. Não passe o código para ninguém.",
  ].join("\n");
}

async function copiar(texto: string, ok: string) {
  if (await copiarTexto(texto)) toast.success(ok);
  else toast.error("Não foi possível copiar.");
}

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

export function IlegalPaineis({ orgs }: { orgs: IlegalOrg[] }) {
  const qc = useQueryClient();
  useRealtimeTable("org_paineis", [KEY]);
  useRealtimeTable("org_membros", [KEY]);
  const { data: paineis = [], isLoading, isError } = useQuery({ queryKey: KEY, queryFn: fetchPaineis });
  const [form, setForm] = useState<{ painel: OrgPainelAdmin | null } | null>(null);
  const [gerado, setGerado] = useState<{ nome: string; codigo: string; novo: boolean } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [revelados, setRevelados] = useState<string[]>([]);

  const recarregar = () => void qc.invalidateQueries({ queryKey: KEY });
  const falhou = () => toast.error("Não foi possível salvar. Tente de novo.");

  const novoCodigo = useMutation({
    mutationFn: (p: OrgPainelAdmin) => trocarCodigo(p.id).then((codigo) => ({ nome: p.nome, codigo })),
    onSuccess: (r) => {
      recarregar();
      setGerado({ ...r, novo: false });
    },
    onError: falhou,
  });
  const alternar = useMutation({
    mutationFn: (p: OrgPainelAdmin) => atualizarPainel(p.id, { ativo: !p.ativo }),
    onSuccess: recarregar,
    onError: falhou,
  });
  const remover = useMutation({
    mutationFn: (p: OrgPainelAdmin) => excluirPainel(p.id),
    onSuccess: () => {
      playSfx("remove");
      recarregar();
    },
    onError: falhou,
  });

  const ativos = paineis.filter((p) => p.ativo);
  const pessoas = paineis.reduce((s, p) => s + p.membros.length, 0);
  const visitas = paineis.reduce((s, p) => s + p.membros.reduce((t, m) => t + m.visitas, 0), 0);
  const kpis = [
    { k: "Painéis ativos", v: ativos.length },
    { k: "Pessoas cadastradas", v: pessoas },
    { k: "Média por organização", v: paineis.length ? Math.round(pessoas / paineis.length) : 0 },
    { k: "Visitas nos links", v: visitas },
  ];

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {kpis.map((c) => (
            <div key={c.k} className="border-l border-white/[0.08] pl-4">
              <p className="font-display text-2xl font-semibold tabular-nums">{isLoading ? "—" : c.v.toLocaleString("pt-BR")}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{c.k}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => setForm({ painel: null })}
          className="flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" /> Novo painel de líder
        </button>
      </div>

      <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Cada painel gera um código. Envie o código ao líder: só com ele dá para entrar e cadastrar a equipe da organização (nome, Discord e cargo), até {LIMITE_MEMBROS} pessoas.
      </p>

      {isError ? (
        <p className="glass-inset mt-5 rounded-2xl px-4 py-12 text-center text-sm text-muted-foreground">Não foi possível carregar os painéis. Você precisa ser Coordinator+ ou da área Ilegal.</p>
      ) : isLoading ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando painéis…
        </div>
      ) : paineis.length === 0 ? (
        <p className="glass-inset mt-5 rounded-2xl px-4 py-14 text-center text-sm text-muted-foreground">
          Nenhum painel criado ainda. Crie o primeiro e envie o código ao líder da organização.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {paineis.map((p) => {
            const total = p.membros.length;
            const { atual } = patente(total);
            const mostrando = revelados.includes(p.id);
            const acesso = quando(p.ultimo_acesso);
            return (
              <article key={p.id} className={cn("glass animate-rise rounded-[22px] p-4", !p.ativo && "opacity-60")}>
                <header className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 truncate font-display text-base font-semibold">{p.nome}</h3>
                  {p.setagem && <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10.5px] text-muted-foreground">{p.setagem}</span>}
                  <span className={cn("ml-auto flex items-center gap-1.5 text-[11px]", p.ativo ? "text-emerald-300" : "text-ink-3")}>
                    <span className={cn("size-1.5 rounded-full", p.ativo ? "bg-emerald-400" : "bg-white/30")} /> {p.ativo ? "Ativo" : "Desativado"}
                  </span>
                </header>
                <p className="mt-1 text-xs text-muted-foreground">
                  Líder: {p.lider_nome || "—"} · {acesso ? `último acesso em ${acesso}` : "ainda não entrou"}
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.min(100, total)}%` }} />
                  </div>
                  <span className="shrink-0 text-xs tabular-nums">
                    {total}/{LIMITE_MEMBROS} <span className="text-ink-3">· {atual.nome}</span>
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-ink-3">
                  {CARGOS.map((c) => `${p.membros.filter((m) => m.cargo === c.id).length} ${c.plural.toLowerCase()}`).join(" · ")} ·{" "}
                  {p.membros.reduce((s, m) => s + m.visitas, 0)} visitas
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-black/30 py-1.5 pl-3 pr-1.5">
                  <KeyRound className="size-3.5 shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] tracking-[0.08em]">{mostrando ? p.codigo : "HOST-•••••-•••••"}</span>
                  <Icone
                    rotulo={mostrando ? "Esconder código" : "Mostrar código"}
                    onClick={() => setRevelados((r) => (mostrando ? r.filter((id) => id !== p.id) : [...r, p.id]))}
                  >
                    {mostrando ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Icone>
                  <Icone rotulo="Copiar só o código" onClick={() => void copiar(p.codigo, "Código copiado.")}>
                    <Copy className="size-4" />
                  </Icone>
                  <button
                    onClick={() => void copiar(textoConvite(p.nome, p.codigo), "Convite copiado. É só colar para o líder.")}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.07] px-3 text-xs text-foreground transition-colors hover:bg-white/[0.12]"
                  >
                    <Send className="size-3.5" /> Copiar convite
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <Acao onClick={() => setAberto((a) => (a === p.id ? null : p.id))} ativo={aberto === p.id}>
                    <ChevronDown className={cn("size-3.5 transition-transform", aberto === p.id && "rotate-180")} /> Ver equipe
                  </Acao>
                  <Acao onClick={() => setForm({ painel: p })}>
                    <Pencil className="size-3.5" /> Editar
                  </Acao>
                  <Acao
                    onClick={() => {
                      if (window.confirm(`Gerar um código novo para ${p.nome}? O código atual para de funcionar na hora.`)) novoCodigo.mutate(p);
                    }}
                  >
                    <RefreshCw className="size-3.5" /> Novo código
                  </Acao>
                  <Acao onClick={() => alternar.mutate(p)}>
                    <Power className="size-3.5" /> {p.ativo ? "Desativar" : "Ativar"}
                  </Acao>
                  <Acao
                    perigo
                    onClick={() => {
                      if (window.confirm(`Excluir o painel de ${p.nome}? Os ${total} cadastros e os links de afiliação serão apagados. Isso não pode ser desfeito.`)) remover.mutate(p);
                    }}
                  >
                    <Trash2 className="size-3.5" /> Excluir
                  </Acao>
                </div>

                <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", aberto === p.id ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <div className="mt-3 max-h-72 overflow-y-auto border-t border-white/[0.06] pt-2">
                      {total === 0 ? (
                        <p className="py-6 text-center text-xs text-ink-3">O líder ainda não cadastrou ninguém.</p>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead className="text-[10.5px] text-ink-3">
                            <tr>
                              <th className="py-1.5 font-normal">Nome</th>
                              <th className="py-1.5 font-normal">Discord</th>
                              <th className="py-1.5 font-normal">Cargo</th>
                              <th className="py-1.5 text-right font-normal">Visitas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.membros.map((m) => (
                              <tr key={m.id} className="border-t border-white/[0.04]">
                                <td className="max-w-40 truncate py-1.5 pr-2">
                                  {m.nome}
                                  {m.passaporte && <span className="ml-1 text-ink-3">#{m.passaporte}</span>}
                                </td>
                                <td className="max-w-32 truncate py-1.5 pr-2 text-muted-foreground">{m.discord || "—"}</td>
                                <td className="py-1.5 pr-2 text-muted-foreground">{cargoLabel(m.cargo)}</td>
                                <td className="py-1.5 text-right tabular-nums text-muted-foreground">{m.visitas}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {form && (
        <PainelDialog
          painel={form.painel}
          orgs={orgs}
          existentes={paineis}
          onClose={() => setForm(null)}
          onCriado={(r) => {
            setForm(null);
            recarregar();
            setGerado({ ...r, novo: true });
          }}
          onSalvo={() => {
            setForm(null);
            recarregar();
          }}
        />
      )}
      {gerado && <CodigoDialog nome={gerado.nome} codigo={gerado.codigo} novo={gerado.novo} onClose={() => setGerado(null)} />}
    </section>
  );
}

function Icone({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={rotulo} title={rotulo} className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-white/[0.07] hover:text-foreground">
      {children}
    </button>
  );
}

function Acao({ onClick, children, perigo, ativo }: { onClick: () => void; children: ReactNode; perigo?: boolean; ativo?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors hover:bg-white/[0.06]",
        ativo ? "bg-white/[0.06] text-foreground" : "text-muted-foreground",
        perigo ? "hover:text-red-300" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function PainelDialog({
  painel,
  orgs,
  existentes,
  onClose,
  onCriado,
  onSalvo,
}: {
  painel: OrgPainelAdmin | null;
  orgs: IlegalOrg[];
  existentes: OrgPainelAdmin[];
  onClose: () => void;
  onCriado: (r: { nome: string; codigo: string }) => void;
  onSalvo: () => void;
}) {
  const { data: eu = "" } = useQuery({ queryKey: ["current-username"], queryFn: getCurrentUsername, staleTime: 300_000 });
  // Sugestões: organizações que já assumiram alguma setagem no painel Ilegal.
  const sugestoes = useMemo(() => {
    const vistas = new Map<string, string>();
    for (const o of orgs) {
      const nome = o.organizacao.trim();
      if (nome && o.status === "Assumida" && !vistas.has(nome.toLowerCase())) vistas.set(nome.toLowerCase(), o.setagem);
    }
    return vistas;
  }, [orgs]);
  const nomesSugeridos = useMemo(() => [...new Set(orgs.filter((o) => o.status === "Assumida" && o.organizacao.trim()).map((o) => o.organizacao.trim()))], [orgs]);

  const [f, setF] = useState<PainelInput>({
    nome: painel?.nome ?? "",
    setagem: painel?.setagem ?? "",
    lider_nome: painel?.lider_nome ?? "",
    // Um painel novo já começa com o mesmo link de entrada usado no último criado.
    link_destino: painel?.link_destino ?? existentes[0]?.link_destino ?? "",
  });
  const set = <K extends keyof PainelInput>(k: K, v: PainelInput[K]) => setF((o) => ({ ...o, [k]: v }));

  const repetido = !painel && existentes.some((p) => p.nome.trim().toLowerCase() === f.nome.trim().toLowerCase() && f.nome.trim() !== "");
  const linkRuim = f.link_destino.trim() !== "" && !urlSegura(f.link_destino);

  const salvar = useMutation({
    mutationFn: async () => {
      const input: PainelInput = { nome: f.nome.trim(), setagem: f.setagem.trim(), lider_nome: f.lider_nome.trim(), link_destino: f.link_destino.trim() };
      if (painel) {
        await atualizarPainel(painel.id, input);
        return null;
      }
      const { codigo } = await criarPainel(input, eu);
      return { nome: input.nome, codigo };
    },
    onSuccess: (r) => {
      playSfx("add");
      if (r) onCriado(r);
      else onSalvo();
    },
    onError: () => toast.error("Não foi possível salvar o painel."),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (f.nome.trim().length < 2 || linkRuim || salvar.isPending) return;
    salvar.mutate();
  };
  const rotulo = "mb-1.5 block text-xs text-muted-foreground";

  return (
    <Dialog open onOpenChange={(o) => !o && !salvar.isPending && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100vw-1.5rem)] max-w-md">
        <DialogTitle>{painel ? "Editar painel" : "Novo painel de líder"}</DialogTitle>
        <form onSubmit={enviar} className="space-y-3">
          <label className="block">
            <span className={rotulo}>Organização</span>
            <input
              value={f.nome}
              onChange={(e) => {
                const nome = e.target.value;
                const setagem = sugestoes.get(nome.trim().toLowerCase());
                setF((o) => ({ ...o, nome, setagem: setagem ?? o.setagem }));
              }}
              list="orgs-assumidas"
              placeholder="Nome da organização"
              maxLength={60}
              autoFocus
              className={campo}
            />
            <datalist id="orgs-assumidas">
              {nomesSugeridos.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {repetido && <span className="mt-1.5 block text-[11px] text-amber-200">Já existe um painel com esse nome. Você pode criar outro mesmo assim.</span>}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={rotulo}>Setagem (opcional)</span>
              <input value={f.setagem} onChange={(e) => set("setagem", e.target.value)} placeholder="Ex.: Armas01" maxLength={40} className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>Nome do líder</span>
              <input value={f.lider_nome} onChange={(e) => set("lider_nome", e.target.value)} placeholder="Quem vai receber o código" maxLength={60} className={campo} />
            </label>
          </div>
          <label className="block">
            <span className={rotulo}>Link do botão “Entrar na HOST” (opcional)</span>
            <input
              value={f.link_destino}
              onChange={(e) => set("link_destino", e.target.value)}
              placeholder="https://discord.gg/…"
              inputMode="url"
              maxLength={300}
              aria-invalid={linkRuim}
              className={campo}
            />
            <span className={cn("mt-1.5 block text-[11px]", linkRuim ? "text-red-300" : "text-ink-3")}>
              {linkRuim ? "O link precisa começar com https://" : "Aparece na página de cada membro. É para onde vai quem clicar no convite dele."}
            </span>
          </label>
          <button type="submit" disabled={f.nome.trim().length < 2 || linkRuim || salvar.isPending} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-40">
            {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : !painel && <KeyRound className="size-4" />}
            {painel ? "Salvar" : "Criar e gerar código"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CodigoDialog({ nome, codigo, novo, onClose }: { nome: string; codigo: string; novo: boolean; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100vw-1.5rem)] max-w-md text-center">
        <DialogTitle className="text-center">{novo ? "Painel criado" : "Código novo gerado"}</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Envie este código ao líder da <span className="text-foreground">{nome}</span>.{!novo && " O código antigo não funciona mais."}
        </p>
        <p className="rounded-2xl border border-white/[0.09] bg-black/40 px-4 py-4 font-mono text-xl font-semibold tracking-[0.14em]">{codigo}</p>
        <div className="grid gap-2">
          <button
            onClick={() => {
              void copiar(textoConvite(nome, codigo), "Convite copiado. É só colar para o líder.");
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            {copiado ? <Check className="size-4" /> : <Send className="size-4" />} Copiar convite com link e código
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => void copiar(codigo, "Código copiado.")} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] text-xs text-foreground transition-colors hover:bg-white/[0.08]">
              <Copy className="size-3.5" /> Só o código
            </button>
            <a href="/lider" target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] text-xs text-foreground transition-colors hover:bg-white/[0.08]">
              <ExternalLink className="size-3.5" /> Abrir a tela do líder
            </a>
          </div>
        </div>
        <p className="text-[11px] text-ink-3">O código continua disponível no cartão do painel, para copiar de novo quando precisar.</p>
      </DialogContent>
    </Dialog>
  );
}
