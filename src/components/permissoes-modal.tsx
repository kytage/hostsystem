import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Eye,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  CheckCircle2,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ACTIONS,
  ALL_ACTIONS,
  CATEGORIES,
  ROLE_DOT,
  ROLE_LABELS,
  ROLE_ORDER,
  useAreaPermissions,
  useAreas,
  usePermissions,
  type ActionKey,
  type AppRole,
  type CategoryActions,
} from "@/lib/permissions";
import {
  deleteArea,
  setAreaPermission,
  setRolePermission,
  upsertArea,
} from "@/lib/users.functions";

const ACTION_ICONS: Record<ActionKey, typeof Eye> = {
  view: Eye,
  create: Plus,
  edit: Pencil,
  delete: Trash2,
  approve: CheckCircle2,
};

type Aba = "cargos" | "areas";

export interface PermissoesModalProps {
  onClose: () => void;
}

/**
 * Painel completo de permissões: escolhe cargo/área e define, por categoria,
 * quais ações (visualizar, criar, editar, excluir, aprovar) estão liberadas.
 * Também permite criar, editar e remover áreas personalizadas.
 */
export function PermissoesModal({ onClose }: PermissoesModalProps) {
  const queryClient = useQueryClient();
  const { data: perms } = usePermissions();
  const { data: areaPerms } = useAreaPermissions();
  const { data: areas } = useAreas();

  const [aba, setAba] = useState<Aba>("cargos");
  const [role, setRole] = useState<AppRole>("staff");
  const [area, setArea] = useState<string>("");
  const [novaAreaOpen, setNovaAreaOpen] = useState(false);
  const [novaKey, setNovaKey] = useState("");
  const [novaLabel, setNovaLabel] = useState("");
  const [novoEmoji, setNovoEmoji] = useState("🏷️");

  const areaAtual = area || areas?.[0]?.key || "";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    void queryClient.invalidateQueries({ queryKey: ["area-permissions"] });
    void queryClient.invalidateQueries({ queryKey: ["areas-list"] });
    void queryClient.invalidateQueries({ queryKey: ["users-list"] });
  };

  const mutRolePerm = useMutation({
    mutationFn: (vars: { category: string; allowed: boolean; actions?: ActionKey[] }) =>
      setRolePermission({ data: { role, ...vars } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const mutAreaPerm = useMutation({
    mutationFn: (vars: { category: string; allowed: boolean; actions?: ActionKey[] }) =>
      setAreaPermission({ data: { area: areaAtual, ...vars } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const mutCriarArea = useMutation({
    mutationFn: () =>
      upsertArea({
        data: {
          key: novaKey.trim().toLowerCase().replace(/[\s-]+/g, "_"),
          label: novaLabel.trim(),
          emoji: novoEmoji.trim() || "•",
        },
      }),
    onSuccess: () => {
      toast.success("Área salva");
      setArea(novaKey.trim().toLowerCase().replace(/[\s-]+/g, "_"));
      setNovaAreaOpen(false);
      setNovaKey("");
      setNovaLabel("");
      setNovoEmoji("🏷️");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutRemoverArea = useMutation({
    mutationFn: (key: string) => deleteArea({ data: { key } }),
    onSuccess: () => {
      toast.success("Área removida");
      setArea("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvando = mutRolePerm.isPending || mutAreaPerm.isPending;

  /** Mapa categoria -> ações do alvo selecionado. */
  const atual: CategoryActions = useMemo(() => {
    const source = aba === "cargos" ? perms?.get(role) : areaPerms?.get(areaAtual);
    return source ?? new Map();
  }, [aba, perms, areaPerms, role, areaAtual]);

  const aplicar = (category: string, allowed: boolean, actions?: ActionKey[]) => {
    const vars = { category, allowed, ...(actions ? { actions } : {}) };
    if (aba === "cargos") mutRolePerm.mutate(vars);
    else mutAreaPerm.mutate(vars);
  };


  const toggleAction = (category: string, action: ActionKey) => {
    const current = atual.get(category) ?? [];
    const next = current.includes(action)
      ? current.filter((a) => a !== action)
      : ALL_ACTIONS.filter((a) => current.includes(a) || a === action);
    if (next.length === 0) aplicar(category, false);
    else aplicar(category, true, next);
  };

  const totalLiberadas = atual.size;
  const alvoNome =
    aba === "cargos"
      ? ROLE_LABELS[role]
      : (areas?.find((a) => a.key === areaAtual)?.label ?? areaAtual);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl glass-modal">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <ShieldCheck className="size-5 text-primary" /> Central de permissões
            </h2>
            <p className="text-xs text-muted-foreground">
              Defina por categoria o que cada cargo ou área pode visualizar, criar, editar,
              excluir e aprovar.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl border border-border p-1">
              {(["cargos", "areas"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAba(t)}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors",
                    aba === t
                      ? "bg-white/[0.09] text-foreground ring-1 ring-white/10"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "cargos" ? "Cargos" : "Áreas"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[260px_1fr]">
          {/* Coluna de alvos */}
          <div className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {aba === "cargos"
                ? ROLE_ORDER.filter((r) => r !== "founder").map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors",
                        role === r ? "bg-primary/10 text-primary" : "text-foreground hover:bg-white/[0.08]"
                      )}
                    >
                      <span className={cn("size-2.5 rounded-full", ROLE_DOT[r])} />
                      <span className="flex-1 truncate">{ROLE_LABELS[r]}</span>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {perms?.get(r)?.size ?? 0}
                      </span>
                    </button>
                  ))
                : (areas ?? []).map((a) => (
                    <div
                      key={a.key}
                      className={cn(
                        "group flex items-center gap-1 rounded-xl pr-1 transition-colors",
                        areaAtual === a.key ? "bg-primary/10" : "hover:bg-white/[0.08]"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setArea(a.key)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm font-semibold",
                          areaAtual === a.key ? "text-primary" : "text-foreground"
                        )}
                      >
                        <span>{a.emoji}</span>
                        <span className="flex-1 truncate">{a.label}</span>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {areaPerms?.get(a.key)?.size ?? 0}
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Remover área"
                        onClick={() => {
                          if (
                            confirm(
                              `Remover a área "${a.label}"? Ela será retirada de todos os usuários.`
                            )
                          ) {
                            mutRemoverArea.mutate(a.key);
                          }
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
            </div>

            {aba === "areas" && (
              <div className="border-t border-border p-3">
                {novaAreaOpen ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={novoEmoji}
                        onChange={(e) => setNovoEmoji(e.target.value)}
                        placeholder="🏷️"
                        className="w-14 rounded-lg border border-border bg-black/25 px-2 py-2 text-center text-sm outline-none focus:border-primary/60"
                      />
                      <input
                        value={novaLabel}
                        onChange={(e) => {
                          setNovaLabel(e.target.value);
                          if (!novaKey)
                            setNovaKey(
                              e.target.value
                                .toLowerCase()
                                .normalize("NFD")
                                .replace(/[\u0300-\u036f]/g, "")
                                .replace(/[^a-z0-9]+/g, "_")
                            );
                        }}
                        placeholder="Nome da área"
                        className="min-w-0 flex-1 rounded-lg border border-border bg-black/25 px-3 py-2 text-sm outline-none focus:border-primary/60"
                      />
                    </div>
                    <input
                      value={novaKey}
                      onChange={(e) => setNovaKey(e.target.value)}
                      placeholder="chave_interna"
                      className="w-full rounded-lg border border-border bg-black/25 px-3 py-2 font-mono text-xs outline-none focus:border-primary/60"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNovaAreaOpen(false)}
                        className="flex-1 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-white/[0.08]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={
                          mutCriarArea.isPending ||
                          novaLabel.trim().length < 2 ||
                          novaKey.trim().length < 2
                        }
                        onClick={() => mutCriarArea.mutate()}
                        className="flex-1 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {mutCriarArea.isPending ? "Salvando..." : "Salvar área"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setNovaAreaOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Plus className="size-3.5" /> Nova área
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Matriz de categorias x ações */}
          <div className="min-h-0 overflow-y-auto p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Permissões de <strong className="text-foreground">{alvoNome}</strong> —{" "}
                {totalLiberadas} de {CATEGORIES.length} categorias liberadas
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() =>
                    CATEGORIES.forEach((c) => aplicar(c.key, true, [...ALL_ACTIONS]))
                  }
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
                >
                  <Sparkles className="size-3.5" /> Liberar tudo
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => CATEGORIES.forEach((c) => aplicar(c.key, false))}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
                >
                  <Ban className="size-3.5" /> Bloquear tudo
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {CATEGORIES.map((cat) => {
                const acoes = atual.get(cat.key) ?? [];
                const liberada = atual.has(cat.key);
                return (
                  <div
                    key={cat.key}
                    className={cn(
                      "rounded-xl border p-3 transition-colors",
                      liberada ? "border-primary/40 bg-primary/5" : "border-border bg-white/[0.035]"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() =>
                          liberada ? aplicar(cat.key, false) : aplicar(cat.key, true, ["view"])
                        }
                        className="flex items-center gap-2 text-left text-sm font-semibold text-foreground disabled:opacity-60"
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md border",
                            liberada
                              ? "border-white/15 bg-white/[0.09] text-foreground"
                              : "border-border"
                          )}
                        >
                          {liberada ? <Check className="size-3" /> : null}
                        </span>
                        {cat.label}
                      </button>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {ACTIONS.map((action) => {
                          const Icon = ACTION_ICONS[action.key];
                          const on = acoes.includes(action.key);
                          return (
                            <button
                              key={action.key}
                              type="button"
                              disabled={salvando}
                              title={action.hint}
                              onClick={() => toggleAction(cat.key, action.key)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-60",
                                on
                                  ? "border-white/15 bg-white/[0.07] text-foreground"
                                  : "border-border bg-black/25 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <Icon className="size-3.5" />
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
          <p className="text-[11px] text-muted-foreground">
            As permissões de áreas somam com as do cargo. O FOUNDER sempre tem acesso total.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
