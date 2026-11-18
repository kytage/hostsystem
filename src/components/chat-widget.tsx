import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hand, ImagePlus, Loader2, MessageCircle, Send, Smile, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { ROLE_LABELS, useAreas, type AppRole } from "@/lib/permissions";
import { roleRank } from "@/lib/roles";
import { pasteImageFromEvent } from "@/lib/clipboard-image";
import { playPlim, type CutucadaPayload } from "@/lib/cutucar";
import {
  CANAL_GERAL,
  STATUS_CONFIG,
  areaDoCanal,
  canalDaArea,
  fetchChatMessages,
  fetchChatProfiles,
  renderMentions,
  sendChatMessage,
  updateMyStatus,
  type CanalChat,
  type ChatProfile,
  type PresenceStatus,
} from "@/lib/chat";
import { BANNER_PADRAO } from "@/components/perfil/perfil-cartao";
import { cn } from "@/lib/utils";
import { getAuthUserData } from "@/lib/auth-cache";

const EMOJIS = [
  "😀",
  "😂",
  "🤣",
  "😊",
  "😍",
  "🥰",
  "😎",
  "🤔",
  "😴",
  "😭",
  "😡",
  "🥳",
  "🤝",
  "👍",
  "👎",
  "👏",
  "🙏",
  "💪",
  "🔥",
  "❤️",
  "💯",
  "⭐",
  "🎉",
  "🚀",
  "🍀",
  "☕",
  "🍔",
  "⚽",
  "🏆",
  "💀",
];

const CHAVE_CANAL = "host-chat-canal";

/** Status de quem está com o painel aberto agora (presença real), ou offline. */
function statusEfetivo(p: ChatProfile, online: Set<string>): string {
  if (!online.has(p.id) || p.status === "invisivel") return "offline";
  return p.status || "online";
}

function Bolinha({ status, className }: { status: string; className?: string }) {
  const cfg = STATUS_CONFIG[status as PresenceStatus] ?? STATUS_CONFIG.online;
  return (
    <span
      className={cn(
        "chat-bolinha",
        status === "offline" ? "bg-muted-foreground" : cfg.dot,
        className,
      )}
    />
  );
}

/** Cartão de perfil (banner, foto, cargo, áreas e bio) ao clicar em alguém. */
function CartaoPerfil({
  perfil,
  status,
  areas,
  onFechar,
  onCutucar,
}: {
  perfil: ChatProfile;
  status: string;
  areas: { key: string; label: string; emoji?: string | null }[];
  onFechar: () => void;
  onCutucar: (p: ChatProfile) => void;
}) {
  const cfg = STATUS_CONFIG[status as PresenceStatus] ?? STATUS_CONFIG.online;
  const suas = areas.filter((a) => perfil.areas.includes(a.key));
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div className="chat-cartao" onClick={(e) => e.stopPropagation()}>
        <div className="chat-cartao-banner">
          <img src={perfil.banner_url || BANNER_PADRAO} alt="" draggable={false} />
          <button type="button" className="chat-cartao-fechar" onClick={onFechar} title="Fechar">
            <X className="size-3.5" />
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="relative -mt-9 inline-block">
            <img
              src={perfil.avatar_url || DEFAULT_AVATAR_URL}
              alt={perfil.username}
              className="size-[72px] rounded-[20px] border-4 border-[#0c0c0d] object-cover"
            />
            <Bolinha status={status} className="!size-4 !border-[3px]" />
          </div>
          <p className="mt-1.5 text-[16px] font-semibold text-white">{perfil.username}</p>
          <p className="flex items-center gap-2 text-[12px] text-white/55">
            <span>{ROLE_LABELS[perfil.role as AppRole] ?? perfil.role}</span>
            <span className="text-white/25">·</span>
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  status === "offline" ? "bg-muted-foreground" : cfg.dot,
                )}
              />
              {status === "offline" ? "Offline" : cfg.label}
            </span>
          </p>
          {suas.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {suas.map((a) => (
                <span key={a.key} className="hc-selo !h-[22px] !text-[10.5px]">
                  {a.emoji} {a.label}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 rounded-[14px] bg-white/[0.05] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Sobre mim
            </p>
            <p className="mt-1 whitespace-pre-line text-[12.5px] text-white/85">
              {perfil.bio || "Este usuário ainda não escreveu uma bio."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCutucar(perfil)}
            className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-full bg-white text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            <Hand className="size-4" /> Cutucar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Chat da equipe: botão de mensagem no canto direito que abre uma janela com o CHAT GERAL e o
 * CHAT DA ÁREA (só aparece para quem é da área; com mais de uma, escolhe qual). Ao lado, quem
 * está online e offline naquele chat; clicar em alguém abre o perfil com o banner.
 */
export function ChatWidget() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [canal, setCanal] = useState<CanalChat>(() => {
    try {
      return localStorage.getItem(CHAVE_CANAL) || CANAL_GERAL;
    } catch {
      return CANAL_GERAL;
    }
  });
  const [membrosNoCelular, setMembrosNoCelular] = useState(false);
  const [texto, setTexto] = useState("");
  const [emojis, setEmojis] = useState(false);
  const [verPerfil, setVerPerfil] = useState<ChatProfile | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const lista = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLTextAreaElement>(null);
  const canalCutucar = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const abertoRef = useRef(aberto);
  abertoRef.current = aberto;

  const { data: areasTodas = [] } = useAreas();
  const { data: perfis = [] } = useQuery({
    queryKey: ["chat-profiles"],
    queryFn: fetchChatProfiles,
    staleTime: 60_000,
  });
  const { data: eu } = useQuery({
    queryKey: ["chat-me"],
    queryFn: async () => (await getAuthUserData()).user?.id ?? null,
  });
  const meuPerfil = perfis.find((p) => p.id === eu);
  const minhasAreas = useMemo(
    () => areasTodas.filter((a) => meuPerfil?.areas.includes(a.key)),
    [areasTodas, meuPerfil],
  );

  // canal de uma área que a pessoa não tem mais: volta para o geral
  const areaAtual = areaDoCanal(canal);
  const canalValido =
    !areaAtual || !meuPerfil || meuPerfil.areas.includes(areaAtual) ? canal : CANAL_GERAL;
  const trocarCanal = (c: CanalChat) => {
    setCanal(c);
    try {
      localStorage.setItem(CHAVE_CANAL, c);
    } catch {
      // sem armazenamento: só não lembra
    }
  };

  const { data: mensagens = [], isLoading: carregando } = useQuery({
    queryKey: ["chat-messages", canalValido],
    queryFn: () => fetchChatMessages(canalValido),
    enabled: aberto,
  });

  // presença real: quem está com o painel aberto agora
  useEffect(() => {
    if (!eu) return;
    const ch = supabase.channel("chat-presence", { config: { presence: { key: eu } } });
    ch.on("presence", { event: "sync" }, () =>
      setOnline(new Set(Object.keys(ch.presenceState()))),
    ).subscribe(async (s) => {
      if (s === "SUBSCRIBED") await ch.track({ user_id: eu, at: Date.now() });
    });
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [eu]);

  // mensagens novas e perfis atualizados
  useEffect(() => {
    if (!eu) return;
    const ch = supabase
      .channel(`chat-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (e) => {
          const m = e.new as { user_id: string; canal: string };
          void qc.invalidateQueries({ queryKey: ["chat-messages", m.canal] });
          if (m.user_id !== eu && !abertoRef.current) setNaoLidas((n) => n + 1);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => void qc.invalidateQueries({ queryKey: ["chat-profiles"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc, eu]);

  // cutucadas
  useEffect(() => {
    const ch = supabase
      .channel("cutucadas")
      .on("broadcast", { event: "cutucar" }, ({ payload }) => {
        const p = payload as CutucadaPayload;
        if (meuPerfil && p.para === meuPerfil.username) {
          playPlim();
          toast(`${p.de} cutucou você!`, { description: "Alguém está chamando você no chat." });
        }
      })
      .subscribe();
    canalCutucar.current = ch;
    return () => {
      canalCutucar.current = null;
      void supabase.removeChannel(ch);
    };
  }, [meuPerfil?.username]);

  useEffect(() => {
    if (aberto) setNaoLidas(0);
  }, [aberto]);

  // Esc fecha a janela
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !verPerfil) setAberto(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, verPerfil]);

  useEffect(() => {
    if (aberto && lista.current) lista.current.scrollTop = lista.current.scrollHeight;
  }, [mensagens.length, aberto, canalValido]);

  const enviar = useMutation({
    mutationFn: (t: string) => sendChatMessage(t, canalValido),
    onSuccess: () => {
      setTexto("");
      void qc.invalidateQueries({ queryKey: ["chat-messages", canalValido] });
    },
    onError: () => toast.error("Não deu para enviar a mensagem."),
  });
  const mudarStatus = useMutation({
    mutationFn: updateMyStatus,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["chat-profiles"] }),
  });

  const submeter = () => {
    const t = texto.trim();
    if (!t || enviar.isPending) return;
    enviar.mutate(t);
    setEmojis(false);
    if (entrada.current) entrada.current.style.height = "auto";
  };

  const cutucar = (p: ChatProfile) => {
    if (!meuPerfil) return;
    if (p.id === eu) {
      toast("Você não pode cutucar a si mesmo.");
      return;
    }
    void canalCutucar.current?.send({
      type: "broadcast",
      event: "cutucar",
      payload: { de: meuPerfil.username, para: p.username } satisfies CutucadaPayload,
    });
    toast.success(`Você cutucou ${p.username}!`);
  };

  // quem é deste chat: todos no geral, só os da área no chat da área
  const membros = perfis
    .filter((p) => !areaAtual || p.areas.includes(areaAtual))
    .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.username.localeCompare(b.username));
  const ligados = membros.filter((p) => statusEfetivo(p, online) !== "offline");
  const desligados = membros.filter((p) => statusEfetivo(p, online) === "offline");
  const areaInfo = areasTodas.find((a) => a.key === areaAtual);
  const titulo = areaAtual ? `Chat · ${areaInfo?.label ?? areaAtual}` : "Chat geral";

  const Pessoa = ({ p }: { p: ChatProfile }) => {
    const st = statusEfetivo(p, online);
    return (
      <button
        type="button"
        className="chat-pessoa"
        data-offline={st === "offline" ? "" : undefined}
        onClick={() => setVerPerfil(p)}
      >
        <span className="relative shrink-0">
          <img src={p.avatar_url || DEFAULT_AVATAR_URL} alt="" className="chat-pessoa-foto" />
          <Bolinha status={st} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[12.5px] font-medium">{p.username}</span>
          <span className="block truncate text-[10.5px] text-white/40">
            {ROLE_LABELS[p.role as AppRole] ?? p.role}
          </span>
        </span>
      </button>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="chat-flutuante"
        aria-label={aberto ? "Fechar chat" : "Abrir chat"}
        title={aberto ? "Fechar chat" : "Chat da equipe"}
        data-aberto={aberto ? "" : undefined}
      >
        {aberto ? (
          <X className="size-[18px]" strokeWidth={1.75} />
        ) : (
          <MessageCircle className="size-[18px]" strokeWidth={1.75} />
        )}
        {!aberto && naoLidas > 0 && (
          <span className="chat-flutuante-conta">{naoLidas > 9 ? "9+" : naoLidas}</span>
        )}
      </button>

      {aberto && (
        <div className="chat-janela" role="dialog" aria-label="Chat da equipe">
          <aside className="chat-lado" data-celular-aberto={membrosNoCelular ? "" : undefined}>
            <div className="chat-abas">
              <button
                type="button"
                data-ativo={!areaAtual ? "" : undefined}
                onClick={() => trocarCanal(CANAL_GERAL)}
              >
                Chat geral
              </button>
              <button
                type="button"
                data-ativo={areaAtual ? "" : undefined}
                disabled={minhasAreas.length === 0}
                title={minhasAreas.length === 0 ? "Você não tem área" : undefined}
                onClick={() => minhasAreas[0] && trocarCanal(canalDaArea(minhasAreas[0].key))}
              >
                Chat área
              </button>
            </div>
            {areaAtual && minhasAreas.length > 1 && (
              <div className="chat-areas">
                {minhasAreas.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    data-ativo={a.key === areaAtual ? "" : undefined}
                    onClick={() => trocarCanal(canalDaArea(a.key))}
                  >
                    {a.emoji} {a.label}
                  </button>
                ))}
              </div>
            )}
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <p className="chat-grupo">Online — {ligados.length}</p>
              {ligados.map((p) => (
                <Pessoa key={p.id} p={p} />
              ))}
              <p className="chat-grupo">Offline — {desligados.length}</p>
              {desligados.map((p) => (
                <Pessoa key={p.id} p={p} />
              ))}
            </div>
          </aside>

          <section className="chat-conversa">
            <header className="chat-topo">
              <button
                type="button"
                className="chat-botao chat-so-celular"
                onClick={() => setMembrosNoCelular((v) => !v)}
                title="Membros"
              >
                <Users className="size-4" strokeWidth={1.75} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-white">{titulo}</p>
                <p className="flex items-center gap-1.5 text-[11px] text-white/45">
                  <span className="size-1.5 rounded-full bg-success" />
                  {ligados.length} online · {desligados.length} offline
                </p>
              </div>
              <div className="flex items-center gap-1.5" title="Meu status">
                {(["online", "ocupado", "ausente", "invisivel"] as PresenceStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    title={STATUS_CONFIG[s].label}
                    onClick={() => mudarStatus.mutate(s)}
                    className={cn(
                      "size-3 rounded-full transition-transform hover:scale-125",
                      STATUS_CONFIG[s].dot,
                      meuPerfil?.status === s
                        ? "ring-2 ring-white/40 ring-offset-1 ring-offset-black"
                        : "opacity-35",
                    )}
                  />
                ))}
              </div>
              <button
                type="button"
                className="chat-botao"
                onClick={() => setAberto(false)}
                title="Fechar"
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </header>

            <div ref={lista} className="chat-mensagens scrollbar-thin">
              {carregando ? (
                <div className="grid h-full place-items-center">
                  <Loader2 className="size-5 animate-spin text-white/40" />
                </div>
              ) : mensagens.length === 0 ? (
                <p className="m-auto max-w-[260px] text-center text-[12px] text-white/40">
                  Nenhuma mensagem ainda neste chat. Puxe assunto!
                </p>
              ) : (
                mensagens.map((m, i) => {
                  const perfil = perfis.find((p) => p.id === m.userId);
                  const minha = m.userId === eu;
                  const imagem = m.texto.startsWith("data:image/");
                  // a mesma pessoa falando de novo em menos de 5 minutos: junta com a de cima
                  const anterior = mensagens[i - 1];
                  const seguida =
                    !!anterior &&
                    anterior.userId === m.userId &&
                    new Date(m.createdAt).getTime() - new Date(anterior.createdAt).getTime() <
                      5 * 60_000;
                  return (
                    <div
                      key={m.id}
                      className={cn("chat-msg", minha && "chat-msg-minha", seguida && "!mt-0.5")}
                    >
                      {!seguida ? (
                        <button
                          type="button"
                          className="relative shrink-0 self-end"
                          onClick={() => perfil && setVerPerfil(perfil)}
                          title={`Ver perfil de ${m.username}`}
                        >
                          <img
                            src={perfil?.avatar_url || m.avatarUrl}
                            alt=""
                            className="size-7 rounded-full object-cover"
                          />
                        </button>
                      ) : (
                        <span className="w-7 shrink-0" />
                      )}
                      <div className="min-w-0 max-w-[75%]">
                        {!seguida && !minha && (
                          <p className="mb-0.5 px-1 text-[10.5px] text-white/40">{m.username}</p>
                        )}
                        {imagem ? (
                          <img
                            src={m.texto}
                            alt="Imagem enviada no chat"
                            className="max-h-44 cursor-zoom-in rounded-[14px]"
                            onClick={() => window.open(m.texto, "_blank")}
                          />
                        ) : (
                          <p className="chat-balao">
                            {renderMentions(m.texto).map((part, k) =>
                              part.mention ? (
                                <span key={k} className="font-semibold text-[#ff8f85]">
                                  {part.text}
                                </span>
                              ) : (
                                <span key={k}>{part.text}</span>
                              ),
                            )}
                          </p>
                        )}
                        <p
                          className={cn(
                            "mt-0.5 px-1 text-[10px] text-white/30",
                            minha && "text-right",
                          )}
                        >
                          {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {emojis && (
              <div className="mx-3 mb-1 grid grid-cols-10 gap-0.5 rounded-[14px] bg-white/[0.05] p-2">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setTexto((t) => t + e);
                      entrada.current?.focus();
                    }}
                    className="rounded-md p-1 text-lg hover:bg-white/10"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            <div className="chat-entrada">
              <button
                type="button"
                className="chat-botao"
                onClick={() => setEmojis((v) => !v)}
                title="Emojis"
              >
                <Smile className="size-4" strokeWidth={1.75} />
              </button>
              <label className="chat-botao cursor-pointer" title="Enviar imagem (ou Ctrl+V)">
                <ImagePlus className="size-4" strokeWidth={1.75} />
                <input
                  type="file"
                  accept="image/*,.gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => {
                      if (typeof r.result === "string") enviar.mutate(r.result);
                    };
                    r.readAsDataURL(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <textarea
                ref={entrada}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  const el = entrada.current;
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
                  }
                }}
                onPaste={(e) => pasteImageFromEvent(e, (url) => enviar.mutate(url))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submeter();
                  }
                }}
                rows={1}
                placeholder="Sua mensagem…"
                className="chat-campo"
              />
              <button
                type="button"
                onClick={submeter}
                disabled={!texto.trim() || enviar.isPending}
                className="chat-enviar"
                title="Enviar"
              >
                {enviar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {verPerfil && (
        <CartaoPerfil
          perfil={verPerfil}
          status={statusEfetivo(verPerfil, online)}
          areas={areasTodas}
          onFechar={() => setVerPerfil(null)}
          onCutucar={(p) => {
            cutucar(p);
            setVerPerfil(null);
          }}
        />
      )}
    </>
  );
}
