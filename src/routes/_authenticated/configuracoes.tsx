import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, RotateCcw, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AVATAR_URL, fileToAvatarDataUrl } from "@/lib/avatar";
import { useMyRole, ROLE_LABELS } from "@/lib/permissions";
import { STATUS_CONFIG, type PresenceStatus } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { getAuthUserData } from "@/lib/auth-cache";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — FiveM Host" },
      { name: "description", content: "Configurações da sua conta no painel da Host." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { data: myRole } = useMyRole();

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const auth = await getAuthUserData();
      if (!auth.user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, bio, status, discord_id, host_id")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const [bio, setBio] = useState<string | null>(null);
  const [discordId, setDiscordId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);

  const saveBioStatus = useMutation({
    mutationFn: async (input: { bio?: string; status?: string; discord_id?: string; host_id?: string }) => {
      if (!profile?.id) throw new Error("Perfil não carregado");
      const { error } = await supabase
        .from("profiles")
        .update(input)
        .eq("id", profile.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["chat-profiles"] });
      void queryClient.invalidateQueries({ queryKey: ["users-list"] });
      toast.success("Perfil atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const saveAvatar = useMutation({
    mutationFn: async (avatarUrl: string) => {
      if (!profile?.id) throw new Error("Perfil não carregado");
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", profile.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["my-username"] });
      toast.success("Foto de perfil atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await saveAvatar.mutateAsync(dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const avatarUrl = profile?.avatar_url || DEFAULT_AVATAR_URL;

  return (
    <div className="pagina">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie sua conta e preferências"
      />

      {/* Foto de perfil */}
      <div className="mt-4 gap-3 xl:columns-2 [&>section]:mb-3 [&>section]:break-inside-avoid">
      <section className="rounded-[24px] glass p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Foto de perfil
        </h2>
        <div className="mt-5 flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="group relative size-24 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted"
            aria-label="Alterar foto de perfil"
          >
            <img
              src={avatarUrl}
              alt="Foto de perfil"
              className="size-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? (
                <Loader2 className="size-6 animate-spin text-white" />
              ) : (
                <Camera className="size-6 text-white" />
              )}
            </span>
          </button>

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {profile?.username ?? "..."}
              </p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[myRole ?? "staff"]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "Enviando..." : "Alterar foto"}
              </button>
              {profile?.avatar_url ? (
                <button
                  type="button"
                  onClick={() => saveAvatar.mutate("")}
                  disabled={saveAvatar.isPending}
                  className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground disabled:opacity-50"
                >
                  <RotateCcw className="size-4" /> Voltar ao padrão
                </button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              A foto padrão é a logo da Host. Envie uma imagem quadrada para melhor resultado.
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </section>

      {/* Perfil estilo Discord: status + bio */}
      <section className="rounded-[24px] glass p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Presença e bio
        </h2>
        <div className="mt-5">
          <p className="text-xs font-semibold text-muted-foreground">Seu status no chat</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["online", "ocupado", "ausente", "invisivel"] as PresenceStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => saveBioStatus.mutate({ status: s })}
                disabled={saveBioStatus.isPending}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  profile?.status === s
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
                )}
              >
                <span className={cn("size-2.5 rounded-full", STATUS_CONFIG[s].dot)} />
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <p className="text-xs font-semibold text-muted-foreground">Sobre mim (bio)</p>
          <textarea
            value={bio ?? profile?.bio ?? ""}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Conte um pouco sobre você... aparece no seu perfil do chat."
            className="mt-2 w-full resize-y rounded-xl border border-border bg-black/25 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => saveBioStatus.mutate({ bio: (bio ?? profile?.bio ?? "").trim() })}
              disabled={saveBioStatus.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Salvar bio
            </button>
          </div>
        </div>
      </section>

      {/* Identificação: ID Discord e ID Host */}
      <section className="rounded-[24px] glass p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Identificação
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Seu ID do Discord e seu ID no servidor Host, usados nos registros do painel.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-xs font-semibold text-muted-foreground">
            ID Discord
            <input
              value={discordId ?? profile?.discord_id ?? ""}
              onChange={(e) => setDiscordId(e.target.value)}
              maxLength={40}
              placeholder="ex: 285948123456789012"
              className="w-full rounded-xl border border-border bg-black/25 px-3 py-2.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
            />
          </label>
          <label className="space-y-2 text-xs font-semibold text-muted-foreground">
            ID Host
            <input
              value={hostId ?? profile?.host_id ?? ""}
              onChange={(e) => setHostId(e.target.value)}
              maxLength={40}
              placeholder="ex: 1024"
              className="w-full rounded-xl border border-border bg-black/25 px-3 py-2.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() =>
              saveBioStatus.mutate({
                discord_id: (discordId ?? profile?.discord_id ?? "").trim(),
                host_id: (hostId ?? profile?.host_id ?? "").trim(),
              })
            }
            disabled={saveBioStatus.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Salvar IDs
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}
