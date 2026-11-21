import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Copy, ImagePlus, Loader2, Pencil, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";
import { DEFAULT_AVATAR_URL, fileToAvatarDataUrl } from "@/lib/avatar";
import { STATUS_CONFIG, type PresenceStatus } from "@/lib/chat";
import { ROLE_LABELS, useMyRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { EditorTexto } from "@/components/editor-texto";
import { TextoFormatado } from "@/components/texto-formatado";

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
      className="hc-seta !size-6"
    >
      {ok ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
    </button>
  );
}

/** O meu perfil (foto, banner e nome), com o mesmo cache do cartão: para mostrar em outras telas. */
export const useMeuPerfil = () =>
  useQuery({ queryKey: CHAVE_PERFIL, queryFn: buscarPerfil, staleTime: 30_000 });

/** Topo do Perfil & Agenda: banner, foto, nome, cargo, bio e IDs. */
export function PerfilCartao() {
  const qc = useQueryClient();
  const { data: role } = useMyRole();
  const { data: perfil } = useQuery({ queryKey: CHAVE_PERFIL, queryFn: buscarPerfil, staleTime: 30_000 });
  const [editando, setEditando] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const euId = perfil?.id ?? "";

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

  const banner = perfil?.banner_url || BANNER_PADRAO;
  const avatar = perfil?.avatar_url || DEFAULT_AVATAR_URL;

  return (
    <section className="perfil-cartao glass relative rounded-[22px]">
      {/* Banner */}
      <div className="group/banner relative h-16 overflow-hidden rounded-t-[22px]">
        <img src={banner} alt="" draggable={false} className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/80" />
        <button
          type="button"
          onClick={() => bannerRef.current?.click()}
          disabled={trocarBanner.isPending}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[10.5px] font-medium text-white/85 opacity-80 backdrop-blur-md transition-opacity hover:opacity-100 md:opacity-0 md:group-hover/banner:opacity-100"
        >
          {trocarBanner.isPending ? <Loader2 className="size-3 animate-spin" /> : <ImagePlus className="size-3" />}
          Trocar banner
        </button>
      </div>

      <div className="relative px-4 pb-4">
        <div className="-mt-7 flex items-end gap-3">
          {/* Foto */}
          <button
            type="button"
            onClick={() => fotoRef.current?.click()}
            disabled={trocarFoto.isPending}
            aria-label="Trocar foto"
            className="group/foto relative size-14 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black ring-[3px] ring-background"
          >
            <img src={avatar} alt="" draggable={false} className="size-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition-opacity group-hover/foto:opacity-100">
              {trocarFoto.isPending ? <Loader2 className="size-4 animate-spin text-white" /> : <Camera className="size-4 text-white" />}
            </span>
          </button>

          <div className="min-w-0 flex-1 pb-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <h2 className="truncate font-display text-[17px] font-semibold leading-tight tracking-tight">
                {perfil?.username || "…"}
              </h2>
            </div>
            <p className="truncate text-[11.5px] text-muted-foreground">{ROLE_LABELS[role ?? "staff"]}</p>
          </div>
        </div>

        {/* Editar */}
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-[11.5px] font-semibold text-primary-foreground"
          >
            <Pencil className="size-3" /> Editar perfil
          </button>
        </div>

        {perfil?.bio && (
          <p className="mt-2.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground" title={perfil.bio}>
            <TextoFormatado texto={perfil.bio} />
          </p>
        )}

        {/* IDs */}
        <div className="hc-dentro mt-3 grid grid-cols-2 overflow-hidden">
          <div className="col-span-2 space-y-1 px-2.5 py-2 text-[11.5px]">
            <p className="flex items-center justify-between gap-2">
              <span className="text-ink-3">ID Host</span>
              <span className="flex min-w-0 items-center gap-1.5 font-mono">
                <span className="truncate">{perfil?.host_id || <span className="text-ink-3">—</span>}</span>
                <Copiar valor={perfil?.host_id ?? ""} rotulo="ID Host" />
              </span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-ink-3">Discord</span>
              <span className="flex min-w-0 items-center gap-1.5 font-mono">
                <span className="truncate">{perfil?.discord_id || <span className="text-ink-3">—</span>}</span>
                <Copiar valor={perfil?.discord_id ?? ""} rotulo="ID Discord" />
              </span>
            </p>
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
    </section>
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
    "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-white/30";

  return createPortal(
    <div className="pf-fade fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="pf-modal glass-elevated max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[22px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="hc-sobre">Perfil & Agenda</p>
            <h3 className="hc-titulo mt-1.5">Editar perfil</h3>
          </div>
          <button type="button" onClick={onClose} className="hc-seta">
            <X className="size-4" />
          </button>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="hc-sobre block">ID Host</span>
            <input value={hostId} onChange={(e) => setHostId(e.target.value)} maxLength={40} placeholder="ex: 1024" className={cn(campo, "font-mono")} />
          </label>
          <label className="space-y-1.5">
            <span className="hc-sobre block">ID Discord</span>
            <input value={discord} onChange={(e) => setDiscord(e.target.value)} maxLength={40} placeholder="ex: 285948123456789012" className={cn(campo, "font-mono")} />
          </label>
        </div>

        <label className="mt-3 block space-y-1.5">
          <span className="hc-sobre block">Sobre mim (bio)</span>
          <EditorTexto
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Conte um pouco sobre você… aparece no seu perfil do chat."
            className={cn(campo, "resize-none")}
          />
        </label>

        <div className="mt-4">
          <p className="hc-sobre">Status no chat</p>
          <div className="segmentos mt-2" role="group" aria-label="Status no chat">
            {(["online", "ocupado", "ausente", "invisivel"] as PresenceStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={presenca === s}
                onClick={() => setPresenca(s)}
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
              aria-pressed={semFoto}
              onClick={() => setSemFoto((v) => !v)}
              className={cn("pilula rounded-full", semFoto && "pilula-ativa")}
            >
              <RotateCcw className="size-3.5" /> Foto padrão
            </button>
          )}
          {perfil.banner_url && (
            <button
              type="button"
              aria-pressed={semBanner}
              onClick={() => setSemBanner((v) => !v)}
              className={cn("pilula rounded-full", semBanner && "pilula-ativa")}
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
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {salvando && <Loader2 className="size-3.5 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
