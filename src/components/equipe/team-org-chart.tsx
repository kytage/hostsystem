import { Fragment, useMemo } from "react";
import { AtSign, Crown, KeyRound, MapPin, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/dashboard/Logo";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { ROLE_DOT, ROLE_LABELS, ROLE_ORDER } from "@/lib/roles";
import type { EquipeUser } from "@/lib/equipe-merge";
import { OrgCanvas } from "./org-canvas";

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const isOnline = (v: string | null) => !!v && Date.now() - new Date(v).getTime() < ONLINE_WINDOW_MS;
const PER_ROW = 8;

export interface AreaInfo {
  key: string;
  label: string;
  emoji: string;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const Stem = ({ h = "h-6" }: { h?: string }) => <div className={cn("mx-auto w-px bg-white/15", h)} />;

/** Linha de cards ligados por um "barramento" horizontal, como num organograma. */
function TreeRow({ children }: { children: React.ReactNode[] }) {
  return (
    <div className="flex justify-center">
      {children.map((child, i) => (
        <div
          key={i}
          className={cn(
            "relative px-2.5 pt-6",
            children.length > 1 &&
              "before:absolute before:left-0 before:right-1/2 before:top-0 before:border-t before:border-white/15 after:absolute after:left-1/2 after:right-0 after:top-0 after:border-t after:border-white/15 first:before:hidden last:after:hidden",
          )}
        >
          <span className="absolute left-1/2 top-0 h-6 w-px bg-white/15" />
          {child}
        </div>
      ))}
    </div>
  );
}

export function PersonNode({
  user,
  areas,
  selected,
  onClick,
  highlightArea,
}: {
  user: EquipeUser;
  areas: Map<string, AreaInfo>;
  selected?: boolean;
  onClick?: () => void;
  highlightArea?: string;
}) {
  const online = isOnline(user.last_sign_in_at);
  const lider = highlightArea ? (user.areaNiveis ?? {})[highlightArea] === "lider" : false;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass surface-hover group flex w-[200px] flex-col gap-2.5 rounded-2xl p-3 text-left hover:-translate-y-0.5",
        selected && "border-white/25 bg-white/[0.08]",
        lider && "border-primary/40",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="relative shrink-0">
          <img
            src={user.avatar_url || DEFAULT_AVATAR_URL}
            alt=""
            className="size-10 rounded-xl border border-white/10 bg-black/40 object-cover"
            draggable={false}
          />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-black",
              online ? "bg-emerald-500" : "bg-white/25",
            )}
          />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-[13px] font-semibold">
            {lider && <Crown className="size-3 shrink-0 text-primary" />}
            {user.username}
          </p>
          <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            <span className={cn("size-1.5 shrink-0 rounded-full", ROLE_DOT[user.role])} />
            {ROLE_LABELS[user.role]}
          </p>
        </div>
      </div>
      {!highlightArea && (
        <div className="flex min-h-[22px] flex-wrap gap-1">
          {user.areas.length === 0 ? (
            <span className="text-[10.5px] text-ink-3">Sem área</span>
          ) : (
            <>
              {user.areas.slice(0, 3).map((a) => {
                const info = areas.get(a);
                const isLider = (user.areaNiveis ?? {})[a] === "lider";
                return (
                  <span
                    key={a}
                    title={`${info?.label ?? a}${isLider ? " · Líder" : ""}`}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-1.5 py-px text-[10.5px]",
                      isLider ? "border-primary/35 bg-primary/10 text-foreground" : "border-white/[0.08] bg-white/[0.04] text-muted-foreground",
                    )}
                  >
                    {info?.emoji ?? "•"} {info?.label ?? a}
                  </span>
                );
              })}
              {user.areas.length > 3 && (
                <span className="rounded-full border border-white/[0.08] px-1.5 py-px text-[10.5px] text-ink-3">+{user.areas.length - 3}</span>
              )}
            </>
          )}
        </div>
      )}
    </button>
  );
}

export function TeamOrgChart({
  users,
  areas,
  selectedId,
  onSelect,
}: {
  users: EquipeUser[];
  areas: AreaInfo[];
  selectedId: string | null;
  onSelect: (user: EquipeUser) => void;
}) {
  const areaMap = useMemo(() => new Map(areas.map((a) => [a.key, a])), [areas]);
  const levels = useMemo(
    () =>
      ROLE_ORDER.map((role) => ({
        role,
        people: users.filter((u) => u.role === role).sort((a, b) => a.username.localeCompare(b.username, "pt-BR")),
      })).filter((l) => l.people.length > 0),
    [users],
  );

  if (users.length === 0) {
    return <p className="px-4 py-16 text-center text-sm text-muted-foreground">Nenhum membro encontrado com esses filtros.</p>;
  }

  return (
    <OrgCanvas>
      <div className="flex min-w-max flex-col items-center px-10 pb-16">
        {/* raiz */}
        <div className="glass-elevated flex items-center gap-3 rounded-2xl px-5 py-3.5">
          <Logo className="h-6" />
          <div>
            <p className="font-display text-sm font-semibold">HOST</p>
            <p className="text-[11px] text-muted-foreground">
              {users.length} membro{users.length === 1 ? "" : "s"} · {levels.length} níve{levels.length === 1 ? "l" : "is"}
            </p>
          </div>
        </div>

        {levels.map((level) => (
          <Fragment key={level.role}>
            <Stem h="h-8" />
            <div className="glass-inset flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", ROLE_DOT[level.role])} />
              {ROLE_LABELS[level.role]}
              <span className="text-ink-3">· {level.people.length}</span>
            </div>
            {chunk(level.people, PER_ROW).map((row, i) => (
              <div key={i} className={cn(i > 0 && "mt-3")}>
                {i === 0 ? <Stem h="h-3" /> : null}
                <TreeRow>
                  {row.map((u) => (
                    <PersonNode key={u.id} user={u} areas={areaMap} selected={u.id === selectedId} onClick={() => onSelect(u)} />
                  ))}
                </TreeRow>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </OrgCanvas>
  );
}

/** Painel lateral com os detalhes do membro e atalhos de gestão. */
export function PersonDrawer({
  user,
  areas,
  onClose,
  podeEditar,
  podeExcluir,
  onRename,
  onEditIds,
  onEditAreas,
  onResetToken,
  onDelete,
}: {
  user: EquipeUser;
  areas: AreaInfo[];
  onClose: () => void;
  podeEditar: boolean;
  podeExcluir: boolean;
  onRename: () => void;
  onEditIds: () => void;
  onEditAreas: () => void;
  onResetToken: () => void;
  onDelete: () => void;
}) {
  const areaMap = new Map(areas.map((a) => [a.key, a]));
  const online = isOnline(user.last_sign_in_at);
  const acoes = [
    { label: "Áreas", icon: MapPin, onClick: onEditAreas },
    { label: "IDs", icon: Pencil, onClick: onEditIds },
    { label: "Renomear", icon: AtSign, onClick: onRename },
    { label: "Token", icon: KeyRound, onClick: onResetToken },
  ];
  return (
    <aside className="glass-modal animate-rise fixed bottom-4 right-4 top-4 z-40 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col rounded-[22px] p-5">
      <div className="flex items-start justify-between">
        <p className="eyebrow">Membro</p>
        <button onClick={onClose} aria-label="Fechar" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.07] hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="relative">
          <img src={user.avatar_url || DEFAULT_AVATAR_URL} alt="" className="size-14 rounded-2xl border border-white/10 object-cover" />
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-black", online ? "bg-emerald-500" : "bg-white/25")} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">{user.username}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", ROLE_DOT[user.role])} />
            {ROLE_LABELS[user.role]} · {online ? "online agora" : "offline"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="glass-inset rounded-xl p-3">
          <p className="text-[10.5px] uppercase tracking-wider text-ink-3">ID Host</p>
          <p className="mt-1 truncate font-mono text-sm">{user.host_id || "—"}</p>
        </div>
        <div className="glass-inset rounded-xl p-3">
          <p className="text-[10.5px] uppercase tracking-wider text-ink-3">Discord</p>
          <p className="mt-1 truncate font-mono text-sm">{user.discord_id || "—"}</p>
        </div>
      </div>

      <p className="mt-5 text-xs font-medium text-muted-foreground">Áreas</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {user.areas.length === 0 ? (
          <p className="glass-inset rounded-xl px-3 py-3 text-xs text-ink-3">Nenhuma área atribuída.</p>
        ) : (
          user.areas.map((a) => {
            const info = areaMap.get(a);
            const lider = (user.areaNiveis ?? {})[a] === "lider";
            return (
              <div key={a} className="glass-inset flex items-center justify-between rounded-xl px-3 py-2 text-sm">
                <span>
                  {info?.emoji ?? "•"} {info?.label ?? a}
                </span>
                <span className={cn("flex items-center gap-1 text-[11px]", lider ? "text-primary" : "text-ink-3")}>
                  {lider && <Crown className="size-3" />}
                  {lider ? "Líder" : "Auxiliar"}
                </span>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-5 text-xs text-ink-3">
        Último login: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("pt-BR") : "nunca"}
      </p>

      {(podeEditar || podeExcluir) && (
        <div className="mt-auto space-y-2 pt-5">
          {podeEditar && (
            <div className="grid grid-cols-4 gap-2">
              {acoes.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.04] py-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                >
                  <a.icon className="size-4" strokeWidth={1.7} />
                  {a.label}
                </button>
              ))}
            </div>
          )}
          {podeExcluir && user.role !== "founder" && (
            <button
              onClick={onDelete}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.07] py-2 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              <Trash2 className="size-3.5" /> Excluir usuário
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
