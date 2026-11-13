import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Copy, Heart, ImagePlus, Loader2, Pencil, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";
import { DEFAULT_AVATAR_URL, fileToAvatarDataUrl } from "@/lib/avatar";
import { STATUS_CONFIG, type PresenceStatus } from "@/lib/chat";
import { meuPet } from "@/lib/hoki";
import { EMOJIS_STATUS, STATUS_PRONTOS, useStatusHoki } from "@/lib/hoki-status";
import { useMeuNivel } from "@/lib/fazenda/selos";
import { corDoSelo, progressoDoNivel } from "@/lib/fazenda/catalogo";
import { ROLE_LABELS, useMyRole } from "@/lib/permissions";
import { QUERIDOMETRO } from "@/lib/termometro";
import { Queridometro, useQueridometro } from "@/components/hoki/queridometro";
import { cn } from "@/lib/utils";

export const BANNER_PADRAO = "/perfil/banner-padrao.jpg";
const CHAVE_PERFIL = ["perfil-agenda"] as const;

interface MeuPerfil {
  id: string;
  username: string;
  avatar_url: string;
  banner_url: string | null;
  bio: string;
  status: string;
  discord_id: string;
  host_id: string;
}

async function buscarPerfil(): Promise<MeuPerfil> {
  const auth = await getAuthUserData();
  if (!auth.user) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, banner_url, bio, status, discord_id, host_id" as never)
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Partial<MeuPerfil>;
  return {
    id: auth.user.id,
    username: d.username ?? "",
    avatar_url: d.avatar_url ?? "",
    banner_url: d.banner_url ?? null,
    bio: d.bio ?? "",
    status: d.status ?? "online",
    discord_id: d.discord_id ?? "",
    host_id: d.host_id ?? "",
  };
}

/** Reduz a imagem do banner (no máximo 1600 × 600) e devolve um JPEG. */
function prepararBanner(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Selecione um arquivo de imagem"));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, 1600 / img.width, 600 / img.height);
      const w = Math.max(1, Math.round(img.width * escala));
      const h = Math.max(1, Math.round(img.height * escala));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d");
      if (!ctx) return reject(new Error("Não foi possível ler a imagem"));
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível ler a imagem"))), "image/jpeg", 0.86);
    };
    img.onerror = () => reject(new Error("Não foi possível ler a imagem"));
    img.src = url;
  });
}

function Copiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  if (!valor) return null;
  return (
    <button
      type="button"
      title={`Copiar ${rotulo}`}
      onClick={() => {
        void navigator.clipboard?.writeText(valor).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        });
      }}
      className="grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:bg-white/[0.06] hover:text-foreground"
    >
      {ok ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
    </button>
  );
}

/** Topo do Perfil & Agenda: banner, foto, nome, nível do HOKI, status, queridômetro e Staff Coins. */
export function PerfilCartao() {
  const qc = useQueryClient();
  const { data: role } = useMyRole();
  const { data: perfil } = useQuery({ queryKey: CHAVE_PERFIL, queryFn: buscarPerfil, staleTime: 30_000 });
  const { data: nivel } = useMeuNivel();
  const { data: pet } = useQuery({ queryKey: ["hoki-meu"], queryFn: meuPet, staleTime: Infinity });
  const [status, salvarStatus] = useStatusHoki();
  const [editando, setEditando] = useState(false);
  const [mudandoStatus, setMudandoStatus] = useState(false);
  const [quadroAberto, setQuadroAberto] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const euId = perfil?.id ?? "";
  const { quadro, pendentes } = useQueridometro(euId);
  const meuQuadro = quadro.find((l) => l.perfil.id === euId);

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: CHAVE_PERFIL });
    void qc.invalidateQueries({ queryKey: ["my-profile"] });
    void qc.invalidateQueries({ queryKey: ["my-username"] });
    void qc.invalidateQueries({ queryKey: ["chat-profiles"] });
    void qc.invalidateQueries({ queryKey: ["users-list"] });
  };

  const salvar = useMutation({
    mutationFn: async (campos: Partial<Omit<MeuPerfil, "id" | "username">>) => {
      if (!euId) throw new Error("Perfil não carregado");
      const { error } = await supabase.from("profiles").update(campos as never).eq("id", euId);
      if (error) throw new Error(error.message);
    },
    onSuccess: atualizar,
    onError: (e: Error) => toast.error(e.message),
  });

  const trocarFoto = useMutation({
    mutationFn: async (file: File) => {
      const dataUrl = await fileToAvatarDataUrl(file);
      await salvar.mutateAsync({ avatar_url: dataUrl });
    },
    onSuccess: () => toast.success("Foto atualizada"),
    onError: (e: Error) => toast.error(e.message),
  });

  const trocarBanner = useMutation({
    mutationFn: async (file: File) => {
      if (!euId) throw new Error("Perfil não carregado");
      const blob = await prepararBanner(file);
      const caminho = `${euId}/banner-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(caminho, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("avatars").getPublicUrl(caminho);
      await salvar.mutateAsync({ banner_url: data.publicUrl });
    },
    onSuccess: () => toast.success("Banner atualizado"),
    onError: (e: Error) => toast.error(e.message),
  });

  const prog = progressoDoNivel(nivel?.xp ?? 0);
  const selo = corDoSelo(nivel?.cor, nivel?.nivel ?? 1);
  const coins = pet?.coins ?? 0;
  const banner = perfil?.banner_url || BANNER_PADRAO;
  const avatar = perfil?.avatar_url || DEFAULT_AVATAR_URL;

  return (
    <section className="perfil-cartao relative rounded-[28px] border border-white/[0.08] bg-black/35 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-[3px]">
      {/* Banner */}
      <div className="group/banner relative h-36 overflow-hidden rounded-t-[28px] md:h-48">
        <img src={banner} alt="" draggable={false} className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/80" />
        <button
          type="button"
          onClick={() => bannerRef.current?.click()}
          disabled={trocarBanner.isPending}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[11.5px] font-medium text-white/85 opacity-80 backdrop-blur-md transition-opacity hover:opacity-100 md:opacity-0 md:group-hover/banner:opacity-100"
        >
          {trocarBanner.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
          Trocar banner
        </button>
      </div>

      <div className="relative px-5 pb-5 md:px-7 md:pb-6">
        <div className="-mt-12 flex flex-wrap items-end gap-4 md:-mt-14">
          {/* Foto */}
          <button
            type="button"
            onClick={() => fotoRef.current?.click()}
            disabled={trocarFoto.isPending}
            aria-label="Trocar foto"
            className="group/foto relative size-24 shrink-0 overflow-hidden rounded-[24px] border border-white/15 bg-black ring-4 ring-black md:size-28"
          >
            <img src={avatar} alt="" draggable={false} className="size-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition-opacity group-hover/foto:opacity-100">
              {trocarFoto.isPending ? <Loader2 className="size-5 animate-spin text-white" /> : <Camera className="size-5 text-white" />}
            </span>
          </button>

          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-2xl font-semibold tracking-tight md:text-[28px]">
                {perfil?.username || "…"}
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                style={{ background: selo.fundo, color: selo.texto }}
                title="Nível do HOKI (HOST FAZENDAS)"
              >
                HOKI Nv {nivel?.nivel ?? 1}
              </span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-foreground">
              <span>{ROLE_LABELS[role ?? "staff"]}</span>
              {perfil?.host_id && (
                <>
                  <span className="text-ink-3">·</span>
                  <span className="font-mono">ID Host {perfil.host_id}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMudandoStatus((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-2 text-[12.5px] transition-colors hover:bg-white/[0.09]"
                title="Status do HOKI (o mesmo da praça)"
              >
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                {status || "Definir status"}
              </button>
              {mudandoStatus && (
                <EditorStatus
                  atual={status}
                  onSalvar={(s) => {
                    salvarStatus(s);
                    setMudandoStatus(false);
                  }}
                  onClose={() => setMudandoStatus(false)}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90"
            >
              <Pencil className="size-3.5" /> Editar perfil
            </button>
          </div>
        </div>

        {perfil?.bio && <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{perfil.bio}</p>}

        {/* Números */}
        <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] lg:grid-cols-4">
          <div className="border-b border-r border-white/[0.06] p-4 lg:border-b-0">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="size-3.5 text-amber-300" /> HOKI Level
            </p>
            <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{nivel?.nivel ?? 1}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#7a120c] to-[#ff4a3d]" style={{ width: `${prog.pct}%` }} />
            </div>
            <p className="mt-1 text-[10.5px] text-ink-3">
              {prog.maximo ? "Nível máximo" : `${prog.noNivel}/${prog.paraSubir} XP para o próximo`}
            </p>
          </div>
          <div className="border-b border-white/[0.06] p-4 lg:border-b-0 lg:border-r">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="text-[13px] leading-none">💰</span> Staff Coins
            </p>
            <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{coins.toLocaleString("pt-BR")}</p>
            <p className="mt-2 text-[10.5px] leading-snug text-ink-3">
              Tarefa recebida concluída: +10 · Sua própria tarefa: +1
            </p>
          </div>
          <div className="border-r border-white/[0.06] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground" title="Emojis que você recebeu hoje">
                <Heart className="size-3.5 shrink-0 text-primary" /> Queridômetro
              </p>
              <button
                type="button"
                onClick={() => setQuadroAberto(true)}
                className="shrink-0 whitespace-nowrap rounded-full border border-white/10 px-2 py-0.5 text-[10.5px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Entregar{pendentes > 0 ? ` (${pendentes})` : ""}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-6 gap-1">
              {QUERIDOMETRO.map((e, i) => (
                <span key={e.emoji} title={e.nome} className="flex flex-col items-center rounded-lg bg-white/[0.03] py-1">
                  <span className="text-[15px] leading-none">{e.emoji}</span>
                  <span className="mt-1 text-[10.5px] font-semibold tabular-nums text-muted-foreground">
                    {meuQuadro?.contagem[i] ?? 0}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <div className="p-4">
            <p className="text-[11px] text-muted-foreground">Identificação</p>
            <div className="mt-1.5 space-y-1.5 text-[12.5px]">
              <p className="flex items-center justify-between gap-2">
                <span className="text-ink-3">ID Host</span>
                <span className="flex items-center gap-0.5 font-mono">
                  {perfil?.host_id || <span className="text-ink-3">—</span>}
                  <Copiar valor={perfil?.host_id ?? ""} rotulo="ID Host" />
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="text-ink-3">Discord</span>
                <span className="flex min-w-0 items-center gap-0.5 font-mono">
                  <span className="truncate">{perfil?.discord_id || <span className="text-ink-3">—</span>}</span>
                  <Copiar valor={perfil?.discord_id ?? ""} rotulo="ID Discord" />
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fotoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) trocarFoto.mutate(f);
          e.target.value = "";
        }}
      />
      <input
        ref={bannerRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) trocarBanner.mutate(f);
          e.target.value = "";
        }}
      />

      {editando && perfil && (
        <EditarPerfil
          perfil={perfil}
          salvando={salvar.isPending}
          onSalvar={async (campos) => {
            await salvar.mutateAsync(campos);
            toast.success("Perfil atualizado");
            setEditando(false);
          }}
          onClose={() => setEditando(false)}
        />
      )}
      {quadroAberto && euId && <Queridometro euId={euId} onClose={() => setQuadroAberto(false)} />}
    </section>
  );
}

function EditorStatus({
  atual,
  onSalvar,
  onClose,
}: {
  atual: string;
  onSalvar: (s: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [emoji, setEmoji] = useState(() => EMOJIS_STATUS.find((e) => atual.startsWith(e)) ?? "📘");
  const [texto, setTexto] = useState(() => {
    const e = EMOJIS_STATUS.find((x) => atual.startsWith(x));
    return e ? atual.slice(e.length).trim() : atual;
  });
  useEffect(() => {
    const fora = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onClose();
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="pf-pop absolute right-0 top-full z-30 mt-2 w-[290px] rounded-2xl border border-white/10 bg-[#0b0b0b]/95 p-3 shadow-2xl backdrop-blur-xl"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">Status do HOKI</p>
      <div className="flex flex-wrap gap-1.5">
        {STATUS_PRONTOS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSalvar(s)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
              s === atual ? "border-primary/50 bg-primary/15 text-foreground" : "border-white/10 text-muted-foreground hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <select
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className="h-8 rounded-lg border border-white/10 bg-black/40 px-1 text-sm outline-none"
          aria-label="Emoji do status"
        >
          {EMOJIS_STATUS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && texto.trim() && onSalvar(`${emoji} ${texto}`)}
          maxLength={28}
          placeholder="Escreva o seu…"
          className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 text-[12.5px] outline-none placeholder:text-ink-3 focus:border-white/25"
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <button type="button" onClick={() => onSalvar("")} className="text-[11.5px] text-ink-3 hover:text-foreground">
          Limpar status
        </button>
        <button
          type="button"
          disabled={!texto.trim()}
          onClick={() => onSalvar(`${emoji} ${texto}`)}
          className="rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-black disabled:opacity-40"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

function EditarPerfil({
  perfil,
  salvando,
  onSalvar,
  onClose,
}: {
  perfil: MeuPerfil;
  salvando: boolean;
  onSalvar: (campos: Partial<Omit<MeuPerfil, "id" | "username">>) => Promise<void>;
  onClose: () => void;
}) {
  const [bio, setBio] = useState(perfil.bio);
  const [discord, setDiscord] = useState(perfil.discord_id);
  const [hostId, setHostId] = useState(perfil.host_id);
  const [presenca, setPresenca] = useState(perfil.status || "online");
  const [semFoto, setSemFoto] = useState(false);
  const [semBanner, setSemBanner] = useState(false);
  const campo =
    "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none placeholder:text-ink-3 focus:border-white/25";

  return createPortal(
    <div className="pf-fade fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="pf-modal glass-elevated max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[24px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Perfil & Agenda</p>
            <h3 className="mt-1 font-display text-lg font-semibold">Editar perfil</h3>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
            <X className="size-4" />
          </button>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            ID Host
            <input value={hostId} onChange={(e) => setHostId(e.target.value)} maxLength={40} placeholder="ex: 1024" className={cn(campo, "font-mono")} />
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            ID Discord
            <input value={discord} onChange={(e) => setDiscord(e.target.value)} maxLength={40} placeholder="ex: 285948123456789012" className={cn(campo, "font-mono")} />
          </label>
        </div>

        <label className="mt-3 block space-y-1.5 text-xs font-medium text-muted-foreground">
          Sobre mim (bio)
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Conte um pouco sobre você… aparece no seu perfil do chat."
            className={cn(campo, "resize-none")}
          />
        </label>

        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Status no chat</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["online", "ocupado", "ausente", "invisivel"] as PresenceStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPresenca(s)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                  presenca === s ? "border-primary/60 bg-primary/10 text-foreground" : "border-white/10 text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("size-2 rounded-full", STATUS_CONFIG[s].dot)} />
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {perfil.avatar_url && (
            <button
              type="button"
              onClick={() => setSemFoto((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                semFoto ? "border-primary/60 bg-primary/10 text-foreground" : "border-white/10 text-muted-foreground hover:text-foreground",
              )}
            >
              <RotateCcw className="size-3.5" /> Foto padrão
            </button>
          )}
          {perfil.banner_url && (
            <button
              type="button"
              onClick={() => setSemBanner((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                semBanner ? "border-primary/60 bg-primary/10 text-foreground" : "border-white/10 text-muted-foreground hover:text-foreground",
              )}
            >
              <RotateCcw className="size-3.5" /> Banner padrão
            </button>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={salvando}
            onClick={() =>
              void onSalvar({
                bio: bio.trim(),
                discord_id: discord.trim(),
                host_id: hostId.trim(),
                status: presenca,
                ...(semFoto ? { avatar_url: "" } : {}),
                ...(semBanner ? { banner_url: null } : {}),
              })
            }
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {salvando && <Loader2 className="size-3.5 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
