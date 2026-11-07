import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  Crown,
  Hand,
  ImagePlus,
  Loader2,
  MessageCircle,
  Send,
  Smile,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { ROLE_LABELS, ROLE_ORDER, type AppRole } from "@/lib/permissions";
import { pasteImageFromEvent } from "@/lib/clipboard-image";
import { playPlim, type CutucadaPayload } from "@/lib/cutucar";
import {
  fetchChatMessages,
  fetchChatProfiles,
  renderMentions,
  sendChatMessage,
  updateMyStatus,
  STATUS_CONFIG,
  type ChatProfile,
  type PresenceStatus,
} from "@/lib/chat";
import { cn } from "@/lib/utils";
import { getAuthUserData } from "@/lib/auth-cache";

const EMOJIS = [
  "😀", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤔", "😴", "😭",
  "😡", "🥳", "🤝", "👍", "👎", "👏", "🙏", "💪", "🔥", "❤️",
  "💯", "⭐", "🎉", "🚀", "🍀", "☕", "🍔", "⚽", "🏆", "💀",
];

function StatusDot({ status, className }: { status: string; className?: string }) {
  const cfg = STATUS_CONFIG[(status as PresenceStatus) ?? "online"] ?? STATUS_CONFIG.online;
  const isOffline = status === "offline" || status === "invisivel";
  return (
    <span
      className={cn(
        "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-black",
        isOffline ? "bg-muted-foreground" : cfg.dot,
        className
      )}
    />
  );
}

function ProfilePop({
  profile,
  status,
  onClose,
  onCutucar,
}: {
  profile: ChatProfile;
  status: string;
  onClose: () => void;
  onCutucar: (profile: ChatProfile) => void;
}) {
  const isOffline = status === "offline" || status === "invisivel";
  const cfg = STATUS_CONFIG[(status as PresenceStatus) ?? "online"] ?? STATUS_CONFIG.online;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-72 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        <div className="h-16 bg-gradient-to-r from-primary/60 to-primary/20" />
        <div className="-mt-8 px-4 pb-4">
          <div className="relative inline-block">
            <img
              src={profile.avatar_url || DEFAULT_AVATAR_URL}
              alt={profile.username}
              className="size-16 rounded-2xl border-4 border-black object-cover"
            />
            <StatusDot status={status} className="size-4 -bottom-0 -right-0" />
          </div>
          <p className="mt-2 text-base font-semibold text-white">{profile.username}</p>
          <p className="flex items-center gap-1.5 text-xs text-white/50">
            <span className={cn("size-2 rounded-full", isOffline ? "bg-muted-foreground" : cfg.dot)} />
            {isOffline ? "Offline" : cfg.label}
          </p>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Sobre mim
            </p>
            <p className="mt-1 whitespace-pre-line text-xs text-white/90">
              {profile.bio || "Este usuário ainda não escreveu uma bio."}
            </p>
          </div>
          <button
            onClick={() => onCutucar(profile)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Hand className="size-4" />
            Cutucar 👉
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChatWidget() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [texto, setTexto] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [viewProfile, setViewProfile] = useState<ChatProfile | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cutucarChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["chat-messages"],
    queryFn: () => fetchChatMessages(),
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["chat-profiles"],
    queryFn: fetchChatProfiles,
  });

  const { data: me } = useQuery({
    queryKey: ["chat-me"],
    queryFn: async () => {
      const auth = await getAuthUserData();
      return auth.user?.id ?? null;
    },
  });
  const myProfile = profiles.find((p) => p.id === me);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  // Presença real (quem está com o app aberto agora)
  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel("chat-presence", {
      config: { presence: { key: me } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: me, at: Date.now() });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me]);

  // Realtime (mensagens + perfis)
  useEffect(() => {
    const channel = supabase
      .channel("chat-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => void queryClient.invalidateQueries({ queryKey: ["chat-messages"] })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => void queryClient.invalidateQueries({ queryKey: ["chat-profiles"] })
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Canal de cutucadas (broadcast)
  useEffect(() => {
    const channel = supabase
      .channel("cutucadas")
      .on("broadcast", { event: "cutucar" }, ({ payload }) => {
        const p = payload as CutucadaPayload;
        if (myProfile && p.para === myProfile.username) {
          playPlim();
          toast(`${p.de} cutucou você! 👉`, {
            description: "Alguém está chamando sua atenção no chat.",
            duration: 6000,
          });
        }
      })
      .subscribe();
    cutucarChannelRef.current = channel;
    return () => {
      cutucarChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [myProfile?.username]);

  // Scroll para o fim
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length, open]);

  const sendMutation = useMutation({
    mutationFn: sendChatMessage,
    onSuccess: () => {
      setTexto("");
      setMentionQuery(null);
      void queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: updateMyStatus,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["chat-profiles"] }),
  });

  function handleChange(value: string) {
    setTexto(value);
    const match = value.match(/@([\w.+-]*)$/);
    setMentionQuery(match ? (match[1] ?? "") : null);
    // Auto-resize do textarea
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
    }
  }

  function insertMention(username: string) {
    setTexto((t) => t.replace(/@[\w.+-]*$/, `@${username} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    pasteImageFromEvent(e, (dataUrl) => {
      void sendMutation.mutateAsync(dataUrl);
    });
  }

  function submit() {
    const t = texto.trim();
    if (!t || sendMutation.isPending) return;
    sendMutation.mutate(t);
    setShowEmoji(false);
    const el = inputRef.current;
    if (el) el.style.height = "auto";
  }

  function cutucar(profile: ChatProfile) {
    if (!myProfile) return;
    if (profile.id === me) {
      toast("Você não pode cutucar a si mesmo 😅");
      return;
    }
    void cutucarChannelRef.current?.send({
      type: "broadcast",
      event: "cutucar",
      payload: { de: myProfile.username, para: profile.username } satisfies CutucadaPayload,
    });
    toast.success(`Você cutucou ${profile.username}! 👉`);
  }

  const mentionOptions = mentionQuery !== null
    ? profiles.filter((p) =>
        p.username.toLowerCase().startsWith(mentionQuery.toLowerCase())
      )
    : [];

  /** Status efetivo: só fica online se estiver com o app aberto (presença real) */
  function effectiveStatus(p: ChatProfile): string {
    if (!onlineIds.has(p.id) || p.status === "invisivel") return "offline";
    return p.status || "online";
  }

  const online = profiles.filter((p) => effectiveStatus(p) !== "offline");
  const offline = profiles.filter((p) => effectiveStatus(p) === "offline");

  /** Agrupa membros por cargo, como no Discord */
  const roleGroups = ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_LABELS[role as AppRole] ?? role,
    members: profiles
      .filter((p) => p.role === role)
      .sort((a, b) => {
        const ao = effectiveStatus(a) === "offline" ? 1 : 0;
        const bo = effectiveStatus(b) === "offline" ? 1 : 0;
        return ao - bo || a.username.localeCompare(b.username);
      }),
  })).filter((g) => g.members.length > 0);

  function handleMemberClick(profile: ChatProfile) {
    setViewProfile(profile);
    setShowMembers(false);
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[80] flex size-13 items-center justify-center rounded-full bg-primary p-3.5 text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label={open ? "Fechar chat geral" : "Abrir chat geral"}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </button>

      {open && (
        <div className="fixed inset-y-0 right-0 z-[60] flex h-full w-full max-w-[520px] flex-col border-l border-white/10 bg-black shadow-2xl sm:w-[460px] md:max-w-[560px]">
          <div className="flex h-full min-h-0 flex-1">
            {/* Coluna principal */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Chat Geral</h3>
                  <p className="flex items-center gap-1.5 text-[11px] text-white/50">
                    <span className="size-1.5 rounded-full bg-success" />
                    {online.length} online · {offline.length} offline
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowMembers((s) => !s)}
                    title="Ver membros"
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white",
                      showMembers && "bg-white/10 text-white"
                    )}
                  >
                    <Users className="size-4" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    title="Fechar"
                    className="flex size-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="size-4" />
                  </button>
                  {/* Meu status */}
                  <div className="flex items-center gap-2">
                    {(["online", "ocupado", "ausente", "invisivel"] as PresenceStatus[]).map(
                      (s) => (
                        <button
                          key={s}
                          title={STATUS_CONFIG[s].label}
                          onClick={() => statusMutation.mutate(s)}
                          className={cn(
                            "size-3.5 rounded-full transition-transform hover:scale-125",
                            STATUS_CONFIG[s].dot,
                            myProfile?.status === s
                              ? "ring-2 ring-white/40 ring-offset-1 ring-offset-black"
                              : "opacity-40"
                          )}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>

          {/* Mensagens */}
          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 scrollbar-thin">
            {messages.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-white/40">
                Nenhuma mensagem ainda. Puxe assunto! 👋
              </p>
            )}
            {messages.map((m) => {
              const profile = profiles.find((p) => p.id === m.userId);
              const isImage = m.texto.startsWith("data:image/");
              const isMine = m.userId === me;
              return (
                <div key={m.id} className={cn("flex gap-2.5", isMine && "flex-row-reverse")}>
                  <button
                    onClick={() => profile && setViewProfile(profile)}
                    className="relative shrink-0 self-start"
                    title={`Ver perfil de ${m.username}`}
                  >
                    <img
                      src={m.avatarUrl}
                      alt={m.username}
                      className="size-8 rounded-lg object-cover"
                    />
                    {profile && <StatusDot status={effectiveStatus(profile)} />}
                  </button>
                  <div className={cn("min-w-0 max-w-[75%]", isMine && "text-right")}>
                    <p className="text-[11px] text-white/40">
                      <span className="font-semibold text-white">{m.username}</span>
                      {" · "}
                      {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {isImage ? (
                      <img
                        src={m.texto}
                        alt="Imagem enviada no chat"
                        className="mt-1 max-h-44 cursor-zoom-in rounded-xl border border-white/10"
                        onClick={() => window.open(m.texto, "_blank")}
                      />
                    ) : (
                      <p
                        className={cn(
                          "mt-0.5 inline-block whitespace-pre-wrap break-words rounded-xl px-3 py-1.5 text-left text-[13px]",
                          isMine
                            ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                            : "bg-white/10 text-white"
                        )}
                      >
                        {renderMentions(m.texto).map((part, i) =>
                          part.mention ? (
                            <span
                              key={i}
                              className={cn(
                                "rounded px-0.5 font-semibold",
                                part.text === "@everyone"
                                  ? "bg-warning/30 text-warning"
                                  : "bg-primary/25 text-primary",
                                isMine && "bg-white/25 text-primary-foreground"
                              )}
                            >
                              {part.text}
                            </span>
                          ) : (
                            <span key={i}>{part.text}</span>
                          )
                        )}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Autocomplete de menção */}
          {mentionQuery !== null && (mentionOptions.length > 0 || "everyone".startsWith(mentionQuery.toLowerCase())) && (
            <div className="mx-3 mb-1 max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-neutral-950 p-1 shadow-lg scrollbar-thin">
              {"everyone".startsWith(mentionQuery.toLowerCase()) && (
                <button
                  onClick={() => insertMention("everyone")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-white/10"
                >
                  <AtSign className="size-3.5 text-warning" />
                  <span className="font-semibold text-warning">everyone</span>
                  <span className="text-white/40">— notifica todos</span>
                </button>
              )}
              {mentionOptions.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  onClick={() => insertMention(p.username)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-white/10"
                >
                  <img
                    src={p.avatar_url || DEFAULT_AVATAR_URL}
                    alt=""
                    className="size-5 rounded object-cover"
                  />
                  <span className="font-semibold text-white">{p.username}</span>
                </button>
              ))}
            </div>
          )}

          {/* Emoji picker */}
          {showEmoji && (
            <div className="mx-3 mb-1 grid grid-cols-10 gap-0.5 rounded-xl border border-white/10 bg-neutral-950 p-2 shadow-lg">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setTexto((t) => t + e);
                    inputRef.current?.focus();
                  }}
                  className="rounded-md p-1 text-lg hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-end gap-1.5 border-t border-white/10 p-3">
            <button
              onClick={() => setShowEmoji((s) => !s)}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              title="Emojis"
            >
              <Smile className="size-4.5" />
            </button>
            <label
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              title="Enviar imagem/GIF (ou Ctrl+V)"
            >
              <ImagePlus className="size-4.5" />
              <input
                type="file"
                accept="image/*,.gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === "string")
                      void sendMutation.mutateAsync(reader.result);
                  };
                  reader.readAsDataURL(f);
                  e.target.value = "";
                }}
              />
            </label>
            <textarea
              ref={inputRef}
              value={texto}
              onChange={(e) => handleChange(e.target.value)}
              onPaste={(e) => void handlePaste(e)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Mensagem..."
              title="@ para mencionar · Ctrl+V cola imagem"
              className="h-9 max-h-24 min-h-9 flex-1 resize-none overflow-y-auto rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-primary/50"
            />
            <button
              onClick={submit}
              disabled={!texto.trim() || sendMutation.isPending}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              title="Enviar"
            >
              {sendMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
            </div>

            {/* Painel lateral de membros — estilo Discord (grupos por cargo) */}
            {showMembers && (
              <div className="flex w-60 shrink-0 flex-col border-l border-white/10 bg-neutral-950">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Membros — {profiles.length}
                  </p>
                  <button
                    onClick={() => setShowMembers(false)}
                    className="text-white/40 hover:text-white"
                    title="Fechar"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
                  {roleGroups.map((group) => (
                    <div key={group.role} className="pb-2">
                      <p className="flex items-center gap-1 px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        {group.role === "founder" && (
                          <Crown className="size-3 text-warning" />
                        )}
                        {group.label} — {group.members.length}
                      </p>
                      {group.members.map((p) => {
                        const st = effectiveStatus(p);
                        const isOffline = st === "offline";
                        const cfg =
                          STATUS_CONFIG[(st as PresenceStatus) ?? "online"] ??
                          STATUS_CONFIG.online;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleMemberClick(p)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/10"
                          >
                            <div className="relative shrink-0">
                              <img
                                src={p.avatar_url || DEFAULT_AVATAR_URL}
                                alt=""
                                className={cn(
                                  "size-7 rounded-full object-cover",
                                  isOffline && "opacity-40 grayscale"
                                )}
                              />
                              <span
                                className={cn(
                                  "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-neutral-950",
                                  isOffline ? "bg-muted-foreground" : cfg.dot
                                )}
                              />
                            </div>
                            <span
                              className={cn(
                                "truncate text-xs font-medium",
                                isOffline ? "text-white/35" : "text-white"
                              )}
                            >
                              {p.username}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewProfile && (
        <ProfilePop
          profile={viewProfile}
          status={effectiveStatus(viewProfile)}
          onClose={() => setViewProfile(null)}
          onCutucar={(p) => {
            cutucar(p);
            setViewProfile(null);
          }}
        />
      )}
    </>
  );
}
