import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Check,
  CheckCircle2,
  Eye,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ACTIONS,
  ALL_ACTIONS,
  CATEGORIAS_FIXAS,
  CATEGORIES,
  NIVEL_ACOES,
  NIVEL_LABELS,
  ROLE_DOT,
  ROLE_LABELS,
  ROLE_ORDER,
  actionsFor,
  nivelDe,
  useAreaPermissions,
  useAreas,
  usePermissions,
  useUserPermissionsAll,
  type ActionKey,
  type AppRole,
  type CategoryActions,
  type CategoryKey,
  type Nivel,
} from "@/lib/permissions";
import {
  deleteArea,
  listUsers,
  setAreaPermission,
  setRolePermission,
  setUserPermission,
  upsertArea,
} from "@/lib/users.functions";

const ACTION_ICONS: Record<ActionKey, typeof Eye> = {
  view: Eye,
  create: Plus,
  edit: Pencil,
  delete: Trash2,
  approve: CheckCircle2,
};

const NIVEIS: Nivel[] = ["nenhum", "ver", "editar"];

export type AbaPermissoes = "cargos" | "areas" | "usuarios";

export interface PermissoesModalProps {
  onClose: () => void;
  /** Abre direto numa aba (e, em Usuários, numa pessoa). */
  inicial?: { aba: AbaPermissoes; userId?: string };
}

/** Seletor de nível (Padrão / Sem acesso / Ver / Editar) de uma aba do painel. */
function SeletorNivel({
  atual,
  comPadrao,
  disabled,
  onEscolher,
}: {
  atual: Nivel | "personalizado" | "padrao";
  comPadrao?: boolean;
  disabled?: boolean;
  onEscolher: (n: Nivel | "padrao") => void;
}) {
  const opcoes: (Nivel | "padrao")[] = comPadrao ? ["padrao", ...NIVEIS] : NIVEIS;
  return (
    <div className="segmentos shrink-0" role="radiogroup">
      {opcoes.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          disabled={disabled}
          aria-checked={atual === n}
          data-ativo={atual === n}
          onClick={() => onEscolher(n)}
          className="disabled:opacity-50"
        >
          {n === "padrao" ? "Padrão" : NIVEL_LABELS[n]}
        </button>
      ))}
    </div>
  );
}

/**
 * Central de permissões (só FOUNDER): por cargo, por área ou por pessoa, define aba por aba
 * se pode ver ou editar. O ajuste fino (criar, excluir, aprovar) continua nos botões menores.
 * Também cria, edita e remove áreas personalizadas.
 */
export function PermissoesModal({ onClose, inicial }: PermissoesModalProps) {
  const queryClient = useQueryClient();
  const { data: perms } = usePermissions();
  const { data: areaPerms } = useAreaPermissions();
  const { data: areas } = useAreas();

  const [aba, setAba] = useState<AbaPermissoes>(inicial?.aba ?? "cargos");
  const [role, setRole] = useState<AppRole>("staff");
  const [area, setArea] = useState<string>("");
  const [userId, setUserId] = useState<string>(inicial?.userId ?? "");
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [novaAreaOpen, setNovaAreaOpen] = useState(false);
  const [novaKey, setNovaKey] = useState("");
  const [novaLabel, setNovaLabel] = useState("");
  const [novoEmoji, setNovoEmoji] = useState("🏷️");

  const { data: users } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => listUsers(),
    enabled: aba === "usuarios",
  });
  const { data: userPerms } = useUserPermissionsAll(aba === "usuarios");

  const areaAtual = area || areas?.[0]?.key || "";
  const pessoas = useMemo(() => {
    const q = buscaPessoa.trim().toLowerCase();
    const lista = [...(users ?? [])].sort(
      (a, b) =>
        ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
        a.username.localeCompare(b.username, "pt-BR"),
    );
    return q ? lista.filter((u) => u.username.toLowerCase().includes(q)) : lista;
  }, [users, buscaPessoa]);
  const pessoa = (users ?? []).find((u) => u.id === userId) ?? pessoas[0];
  const pessoaFounder = pessoa?.role === "founder";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    void queryClient.invalidateQueries({ queryKey: ["area-permissions"] });
    void queryClient.invalidateQueries({ queryKey: ["areas-list"] });
    void queryClient.invalidateQueries({ queryKey: ["users-list"] });
    void queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
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

  const mutUserPerm = useMutation({
    mutationFn: (vars: { category: string; actions: ActionKey[] | null }) => {
      if (!pessoa) throw new Error("Escolha uma pessoa");
      return setUserPermission({ data: { userId: pessoa.id, ...vars } });
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const mutCriarArea = useMutation({
    mutationFn: () =>
      upsertArea({
        data: {
          key: novaKey
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_"),
          label: novaLabel.trim(),
          emoji: novoEmoji.trim() || "•",
        },
      }),
    onSuccess: () => {
      toast.success("Área salva");
      setArea(
        novaKey
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_"),
      );
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

  const salvando = mutRolePerm.isPending || mutAreaPerm.isPending || mutUserPerm.isPending;

  /** Cargo/área: mapa aba -> ações. Pessoa: só as abas definidas para ela. */
  const atual: CategoryActions = useMemo(() => {
    if (aba === "cargos") return perms?.get(role) ?? new Map();
    if (aba === "areas") return areaPerms?.get(areaAtual) ?? new Map();
    return (pessoa && userPerms?.get(pessoa.id)) || new Map();
  }, [aba, perms, areaPerms, role, areaAtual, pessoa, userPerms]);

  /** O que a pessoa teria pelo cargo e pelas áreas (sem a permissão dela). */
  const herdado = (category: CategoryKey) =>
    pessoa ? actionsFor(pessoa.role, pessoa.areas, category, perms, areaPerms) : [];

  const aplicar = (category: string, allowed: boolean, actions?: ActionKey[]) => {
    if (aba === "usuarios") {
      mutUserPerm.mutate({ category, actions: allowed ? (actions ?? ["view"]) : [] });
      return;
    }
    const vars = { category, allowed, ...(actions ? { actions } : {}) };
    if (aba === "cargos") mutRolePerm.mutate(vars);
    else mutAreaPerm.mutate(vars);
  };

  const escolherNivel = (category: string, n: Nivel | "padrao") => {
    if (aba === "usuarios") {
      mutUserPerm.mutate({ category, actions: n === "padrao" ? null : NIVEL_ACOES[n] });
      return;
    }
    if (n === "padrao" || n === "nenhum") aplicar(category, false);
    else aplicar(category, true, NIVEL_ACOES[n]);
  };

  const toggleAction = (category: string, action: ActionKey) => {
    const current = atual.get(category) ?? [];
    const next = current.includes(action)
      ? current.filter((a) => a !== action)
      : ALL_ACTIONS.filter((a) => current.includes(a) || a === action);
    if (next.length === 0) aplicar(category, false);
    else aplicar(category, true, next);
  };

  const editaveis = CATEGORIES.filter((c) => !CATEGORIAS_FIXAS.includes(c.key));
  const totalLiberadas =
    aba === "usuarios"
      ? CATEGORIES.filter((c) => {
          const proprias = atual.get(c.key);
          return (proprias ?? herdado(c.key)).length > 0 || pessoaFounder;
        }).length
      : atual.size;
  const alvoNome =
    aba === "cargos"
      ? ROLE_LABELS[role]
      : aba === "areas"
        ? (areas?.find((a) => a.key === areaAtual)?.label ?? areaAtual)
        : (pessoa?.username ?? "—");
  const travado = aba === "usuarios" && (!pessoa || pessoaFounder);

  const todasEm = (n: Nivel | "padrao") => editaveis.forEach((c) => escolherNivel(c.key, n));

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
              Aba por aba, escolha quem pode ver ou editar: por cargo, por área ou por pessoa.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="segmentos" role="tablist">
              {(["cargos", "areas", "usuarios"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={aba === t}
                  onClick={() => setAba(t)}
                >
                  {t === "cargos" ? "Cargos" : t === "areas" ? "Áreas" : "Usuários"}
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
            {aba === "usuarios" && (
              <div className="border-b border-border p-3">
                <label className="flex h-9 items-center gap-2 rounded-full border border-border bg-black/25 px-3">
                  <Search className="size-3.5 text-muted-foreground" />
                  <input
                    value={buscaPessoa}
                    onChange={(e) => setBuscaPessoa(e.target.value)}
                    placeholder="Buscar pessoa"
                    aria-label="Buscar pessoa"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </label>
              </div>
            )}
            <div className="min-h-0 max-h-[30vh] flex-1 space-y-1 overflow-y-auto p-3 md:max-h-none">
              {aba === "cargos" &&
                ROLE_ORDER.filter((r) => r !== "founder").map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors",
                      role === r
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-white/[0.08]",
                    )}
                  >
                    <span className={cn("size-2.5 rounded-full", ROLE_DOT[r])} />
                    <span className="flex-1 truncate">{ROLE_LABELS[r]}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {perms?.get(r)?.size ?? 0}
                    </span>
                  </button>
                ))}

              {aba === "areas" &&
                (areas ?? []).map((a) => (
                  <div
                    key={a.key}
                    className={cn(
                      "group flex items-center gap-1 rounded-xl pr-1 transition-colors",
                      areaAtual === a.key ? "bg-primary/10" : "hover:bg-white/[0.08]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setArea(a.key)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm font-semibold",
                        areaAtual === a.key ? "text-primary" : "text-foreground",
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
                            `Remover a área "${a.label}"? Ela será retirada de todos os usuários.`,
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

              {aba === "usuarios" &&
                (users === undefined ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">Carregando…</p>
                ) : pessoas.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Ninguém encontrado.
                  </p>
                ) : (
                  pessoas.map((u) => {
                    const proprias = userPerms?.get(u.id)?.size ?? 0;
                    const ativo = pessoa?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setUserId(u.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors",
                          ativo
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-white/[0.08]",
                        )}
                      >
                        <span className={cn("size-2.5 shrink-0 rounded-full", ROLE_DOT[u.role])} />
                        <span className="min-w-0 flex-1 truncate">{u.username}</span>
                        {proprias > 0 && (
                          <span
                            title="Abas com permissão própria"
                            className="rounded-full bg-white/[0.08] px-1.5 text-[10px] font-semibold text-foreground"
                          >
                            {proprias}
                          </span>
                        )}
                      </button>
                    );
                  })
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
                                .replace(/[̀-ͯ]/g, "")
                                .replace(/[^a-z0-9]+/g, "_"),
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

          {/* Abas do painel x nível */}
          <div className="min-h-0 overflow-y-auto p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Permissões de <strong className="text-foreground">{alvoNome}</strong> —{" "}
                {totalLiberadas} de {CATEGORIES.length} abas liberadas
                {aba === "usuarios" && !pessoaFounder && (
                  <span className="block text-[11px]">
                    “Padrão” segue o cargo e as áreas da pessoa; as outras opções valem só para ela.
                  </span>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={salvando || travado}
                  onClick={() => todasEm("ver")}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground disabled:opacity-50"
                >
                  <Eye className="size-3.5" /> Ver tudo
                </button>
                {aba !== "usuarios" ? (
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => todasEm("editar")}
                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground disabled:opacity-50"
                  >
                    <Pencil className="size-3.5" /> Editar tudo
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={salvando || travado}
                    onClick={() => todasEm("padrao")}
                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground disabled:opacity-50"
                  >
                    <RotateCcw className="size-3.5" /> Tudo no padrão
                  </button>
                )}
                <button
                  type="button"
                  disabled={salvando || travado}
                  onClick={() => todasEm("nenhum")}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
                >
                  <Ban className="size-3.5" /> Bloquear tudo
                </button>
              </div>
            </div>

            {aba === "usuarios" && pessoaFounder ? (
              <p className="rounded-xl border border-border bg-white/[0.035] px-4 py-10 text-center text-sm text-muted-foreground">
                <strong className="text-foreground">{pessoa?.username}</strong> é FOUNDER e sempre
                tem acesso total a todas as abas.
              </p>
            ) : (
              <div className="space-y-2">
                {CATEGORIES.map((cat) => {
                  const fixa = CATEGORIAS_FIXAS.includes(cat.key);
                  const proprias = atual.get(cat.key);
                  const usando =
                    aba === "usuarios" ? (proprias ?? herdado(cat.key)) : (proprias ?? []);
                  const liberada = usando.length > 0;
                  const nivel =
                    aba === "usuarios" && !proprias ? "padrao" : nivelDe(proprias ?? []);
                  const heranca =
                    aba === "usuarios" && !proprias ? nivelDe(herdado(cat.key)) : null;
                  return (
                    <div
                      key={cat.key}
                      className={cn(
                        "rounded-xl border p-3 transition-colors",
                        liberada
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-white/[0.035]",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-md border",
                              liberada
                                ? "border-white/15 bg-white/[0.09] text-foreground"
                                : "border-border",
                            )}
                          >
                            {liberada ? <Check className="size-3" /> : null}
                          </span>
                          <span className="text-sm font-semibold text-foreground">{cat.label}</span>
                          {fixa && (
                            <span
                              title="Essa aba segue uma regra fixa e não muda por aqui"
                              className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                            >
                              <Lock className="size-3" /> Regra fixa
                            </span>
                          )}
                          {heranca && !fixa && (
                            <span className="text-[11px] text-muted-foreground">
                              pelo cargo/áreas:{" "}
                              {heranca === "personalizado"
                                ? "personalizado"
                                : NIVEL_LABELS[heranca]}
                            </span>
                          )}
                          {!heranca && nivel === "personalizado" && (
                            <span className="text-[11px] text-muted-foreground">personalizado</span>
                          )}
                        </div>
                        <SeletorNivel
                          atual={nivel}
                          comPadrao={aba === "usuarios"}
                          disabled={salvando || fixa || travado}
                          onEscolher={(n) => escolherNivel(cat.key, n)}
                        />
                      </div>

                      {!fixa && (aba !== "usuarios" || proprias) && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          {ACTIONS.map((action) => {
                            const Icon = ACTION_ICONS[action.key];
                            const on = (proprias ?? []).includes(action.key);
                            return (
                              <button
                                key={action.key}
                                type="button"
                                disabled={salvando || travado}
                                title={action.hint}
                                onClick={() => toggleAction(cat.key, action.key)}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60",
                                  on
                                    ? "border-white/15 bg-white/[0.07] text-foreground"
                                    : "border-border bg-black/25 text-muted-foreground hover:text-foreground",
                                )}
                              >
                                <Icon className="size-3.5" />
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
          <p className="text-[11px] text-muted-foreground">
            As áreas somam com o cargo. A permissão de uma pessoa vale no lugar das duas. O FOUNDER
            sempre tem acesso total.
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
