import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  KeyRound,
  Trash2,
  ShieldCheck,
  Lock,
  Copy,
  MapPin,
  X,
  Search,
  IdCard,
  Check,
  Pencil,
  ChevronRight,
  Users,
  Crown,
  BarChart3,
  AlertTriangle,
  Clapperboard,
  Plus,
  AtSign,
  ArrowUpCircle,
  Network,
  Table2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MinimalSelect } from "@/components/ui/minimal-select";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import {
  ROLE_LABELS,
  ROLE_ORDER,
  ROLE_DOT,
  useMyRole,
  useCan,
  useAreas,
  AREAS,
  AREA_LABELS,
  AREA_EMOJIS,
  type AppRole,
} from "@/lib/permissions";
import {
  listUsers,
  createUser,
  deleteUser,
  resetUserPassword,
  updateUserRole,
  setUserAreas,
  setUserIdentifiers,
  renameUser,
} from "@/lib/users.functions";
import {
  listCasting,
  createCasting,
  updateCasting,
  deleteCasting,
  type CastingRow,
  type CastingInput,
} from "@/lib/casting";
import type { EquipeUser } from "@/lib/equipe-merge";
import { PageHeader } from "@/components/page-header";
import { PermissoesModal } from "@/components/permissoes-modal";
import { TeamOrgChart, PersonDrawer } from "@/components/equipe/team-org-chart";


export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Equipe | HOST Admin" },
      {
        name: "description",
        content: "Painel único da equipe HOST: usuários, cargos, áreas e casting.",
      },
      { property: "og:title", content: "Equipe | HOST Admin" },
      {
        property: "og:description",
        content: "Gestão de usuários, cargos, áreas e casting do servidor HOST.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EquipePage,
});

type UserRow = EquipeUser;
type Aba = "equipe" | "casting";

const ABAS: { key: Aba; label: string; icon: typeof Users }[] = [
  { key: "equipe", label: "Equipe", icon: Users },
  { key: "casting", label: "Casting", icon: Clapperboard },
];

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const EMPTY_CASTING: CastingInput = { nome: "", host_id: "", discord_id: "", obs: "" };

/** Converte um nome de casting em username válido (minúsculo, sem acentos/símbolos). */
function slugUsername(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function isOnline(value: string | null) {
  return !!value && Date.now() - new Date(value).getTime() < ONLINE_WINDOW_MS;
}

/** Formata o último acesso de forma relativa (ex.: "há 3 h", "há 5 d") */
function formatUltimoLogin(value: string | null): string {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "";
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `há ${dias} d`;
  return new Date(value).toLocaleDateString("pt-BR");
}

function UltimoLogin({ value }: { value: string | null }) {
  if (!value) {
    return (
      <span title="Nunca logou" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-destructive/40 bg-destructive/15 text-xs font-semibold text-destructive">
        X
      </span>
    );
  }
  return (
    <span
      title={new Date(value).toLocaleString("pt-BR")}
      className="text-xs font-medium text-muted-foreground"
    >
      {formatUltimoLogin(value)}
    </span>
  );
}

function CopyValue({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs text-foreground">
      <span className="truncate">{value}</span>
      <button
        type="button"
        title="Copiar"
        onClick={() => {
          void navigator.clipboard
            .writeText(value)
            .then(() => toast.success("Copiado!"))
            .catch(() => toast.error("Não foi possível copiar"));
        }}
        className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
      >
        <Copy className="size-3" />
      </button>
    </span>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="rounded-xl glass p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-foreground font-display">{value}</p>
    </div>
  );
}

function EquipePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: myRole, isLoading: loadingRole } = useMyRole();
  const { data: areasList } = useAreas();
  const can = useCan();

  const legacyManager = myRole === "founder" || myRole === "c_level";
  const podeVer = legacyManager || can("usuarios", "view") || can("controle_staff", "view");
  const podeCriar = legacyManager || can("usuarios", "create");
  const podeEditar = legacyManager || can("usuarios", "edit");
  const podeExcluir = legacyManager || can("usuarios", "delete");
  const isFounder = myRole === "founder";

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => listUsers(),
    enabled: podeVer,
  });

  const { data: casting, isLoading: loadingCasting } = useQuery({
    queryKey: ["casting-list"],
    queryFn: () => listCasting(),
    enabled: podeVer,
  });

  const [aba, setAba] = useState<Aba>("equipe");
  const [visao, setVisao] = useState<"org" | "tabela">("org");
  const [selecionado, setSelecionado] = useState<UserRow | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem("host-equipe-visao");
      if (v === "org" || v === "tabela") setVisao(v);
    } catch {}
  }, []);
  const trocarVisao = (v: "org" | "tabela") => {
    setVisao(v);
    try {
      localStorage.setItem("host-equipe-visao", v);
    } catch {}
  };
  const [busca, setBusca] = useState("");
  const [areaFiltro, setAreaFiltro] = useState<string>("todas");
  const [cargoFiltro, setCargoFiltro] = useState<string>("todos");

  const [novoOpen, setNovoOpen] = useState(false);
  const [novoUser, setNovoUser] = useState("");
  const [novoRole, setNovoRole] = useState<AppRole>("staff");
  const [tokenGerado, setTokenGerado] = useState<{ username: string; token: string } | null>(null);

  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [areaTarget, setAreaTarget] = useState<UserRow | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  /** Áreas em que o usuário é LÍDER (subconjunto de selectedAreas) */
  const [selectedLideres, setSelectedLideres] = useState<string[]>([]);
  const [idsTarget, setIdsTarget] = useState<UserRow | null>(null);
  const [discordId, setDiscordId] = useState("");
  const [hostId, setHostId] = useState("");
  const [renameTarget, setRenameTarget] = useState<UserRow | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [permOpen, setPermOpen] = useState(false);

  /** null = fechado, { id: null } = novo registro */
  const [castingForm, setCastingForm] = useState<
    ({ id: string | null } & CastingInput) | null
  >(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["users-list"] });
    void queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    void queryClient.invalidateQueries({ queryKey: ["area-permissions"] });
  };
  const invalidateCasting = () => {
    void queryClient.invalidateQueries({ queryKey: ["casting-list"] });
  };

  const copiarToken = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Token copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const mutCreate = useMutation({
    mutationFn: async () => {
      const username = novoUser.trim().toLowerCase();
      const res = await createUser({ data: { username, role: novoRole } });
      return { ...res, username };
    },
    onSuccess: (res) => {
      toast.success("Usuário criado com sucesso");
      setNovoOpen(false);
      setTokenGerado({ username: res.username, token: res.token });
      setNovoUser("");
      setNovoRole("staff");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const mutDelete = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("Usuário excluído");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const mutReset = useMutation({
    mutationFn: () => {
      if (!resetTarget) throw new Error("Selecione um usuário para gerar o token");
      return resetUserPassword({ data: { userId: resetTarget.id } });
    },
    onSuccess: (res) => {
      toast.success("Token de acesso gerado");
      setTokenGerado({ username: resetTarget!.username, token: res.token });
      setResetTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const mutRename = useMutation({
    mutationFn: () => {
      if (!renameTarget) throw new Error("Selecione um usuário");
      return renameUser({
        data: { userId: renameTarget.id, username: novoNome.trim().toLowerCase() },
      });
    },
    onSuccess: () => {
      toast.success("Nome atualizado");
      setRenameTarget(null);
      setNovoNome("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const mutRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) =>
      updateUserRole({ data: { userId, role } }),
    onSuccess: () => {
      toast.success("Cargo atualizado");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const mutArea = useMutation({
    mutationFn: ({
      userId,
      areas,
      lideres,
    }: {
      userId: string;
      areas: string[];
      lideres: string[];
    }) => setUserAreas({ data: { userId, areas, lideres } }),
    onSuccess: () => {
      toast.success("Áreas atualizadas");
      setAreaTarget(null);
      setSelectedAreas([]);
      setSelectedLideres([]);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const mutIds = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      setUserIdentifiers({
        data: { userId, discord_id: discordId.trim(), host_id: hostId.trim() },
      }),
    onSuccess: () => {
      toast.success("Identificadores atualizados");
      setIdsTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const mutCastingSave = useMutation({
    mutationFn: async () => {
      if (!castingForm) throw new Error("Formulário indisponível");
      if (!castingForm.nome.trim()) throw new Error("Informe o nome do casting");
      const payload: CastingInput = {
        nome: castingForm.nome,
        host_id: castingForm.host_id,
        discord_id: castingForm.discord_id,
        obs: castingForm.obs,
      };
      if (castingForm.id) await updateCasting(castingForm.id, payload);
      else await createCasting(payload);
    },
    onSuccess: () => {
      toast.success("Casting salvo");
      setCastingForm(null);
      invalidateCasting();
    },
    onError: (e) => toast.error(e.message),
  });

  const mutCastingDelete = useMutation({
    mutationFn: (id: string) => deleteCasting(id),
    onSuccess: () => {
      toast.success("Registro de casting excluído");
      invalidateCasting();
    },
    onError: (e) => toast.error(e.message),
  });

  /** Promove um registro de casting a usuário do painel com cargo Support. */
  const mutUpar = useMutation({
    mutationFn: async (row: CastingRow) => {
      const username = slugUsername(row.nome);
      if (!username) throw new Error("Nome do casting inválido para criar usuário");
      const res = await createUser({ data: { username, role: "support" as AppRole } });
      if (row.discord_id.trim() || row.host_id.trim()) {
        await setUserIdentifiers({
          data: {
            userId: res.id,
            discord_id: row.discord_id.trim(),
            host_id: row.host_id.trim(),
          },
        });
      }
      await deleteCasting(row.id);
      return { username, token: res.token };
    },
    onSuccess: (res) => {
      toast.success(`${res.username} promovido a Support`);
      setTokenGerado({ username: res.username, token: res.token });
      invalidate();
      invalidateCasting();
    },
    onError: (e) => toast.error(e.message),
  });

  const openAreaEditor = (user: UserRow) => {
    setAreaTarget(user);
    setSelectedAreas(user.areas);
    setSelectedLideres(
      user.areas.filter((area) => (user.areaNiveis ?? {})[area] === "lider")
    );
  };

  const openIdsEditor = (user: UserRow) => {
    setIdsTarget(user);
    setDiscordId(user.discord_id);
    setHostId(user.host_id);
  };

  const openRename = (user: UserRow) => {
    setRenameTarget(user);
    setNovoNome(user.username);
  };

  const toggleSelectedArea = (area: string) => {
    setSelectedAreas((current) => {
      if (current.includes(area)) {
        setSelectedLideres((lid) => lid.filter((item) => item !== area));
        return current.filter((item) => item !== area);
      }
      return [...current, area];
    });
  };

  /** Define se o usuário é líder ou auxiliar na área marcada */
  const setNivelArea = (area: string, nivel: "lider" | "auxiliar") => {
    setSelectedLideres((current) =>
      nivel === "lider"
        ? current.includes(area)
          ? current
          : [...current, area]
        : current.filter((item) => item !== area)
    );
  };

  const areasDisponiveis = useMemo(
    () =>
      areasList ??
      AREAS.map((a, i) => ({ key: a.key, label: a.label, emoji: a.emoji, ordem: i + 1 })),
    [areasList]
  );

  const areaLabel = (area: string) => {
    const found = areasDisponiveis.find((a) => a.key === area);
    if (found) return `${found.emoji} ${found.label}`;
    return `${AREA_EMOJIS[area] ?? "•"} ${AREA_LABELS[area as keyof typeof AREA_LABELS] ?? area}`;
  };

  /** Equipe = usuários do painel, sempre ordenados pela hierarquia de cargos */
  const linhas: UserRow[] = useMemo(() => {
    const lista = [...((users ?? []) as UserRow[])];
    return lista.sort(
      (a, b) =>
        ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
        a.username.localeCompare(b.username, "pt-BR")
    );
  }, [users]);

  const areaStats = useMemo(() => {
    const keys = Array.from(new Set(linhas.flatMap((u) => u.areas)));
    return keys
      .map((key) => ({
        area: key,
        label: areaLabel(key),
        total: linhas.filter((u) => u.areas.includes(key)).length,
      }))
      .sort((a, b) => a.total - b.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, areasDisponiveis]);
  const maxArea = Math.max(1, ...areaStats.map((a) => a.total));

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((u) => {
      if (cargoFiltro !== "todos" && u.role !== cargoFiltro) return false;
      if (areaFiltro !== "todas" && !u.areas.includes(areaFiltro)) return false;
      if (!q) return true;
      return [u.username, ROLE_LABELS[u.role], u.host_id, u.discord_id, ...u.areas]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [linhas, busca, areaFiltro, cargoFiltro]);

  const castingFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = (casting ?? []) as CastingRow[];
    if (!q) return lista;
    return lista.filter((r) =>
      [r.nome, r.host_id, r.discord_id, r.obs].join(" ").toLowerCase().includes(q)
    );
  }, [casting, busca]);

  if (loadingRole) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!podeVer) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Lock className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground font-display">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para acessar a gestão da equipe.
        </p>
        <button
          onClick={() => void navigate({ to: "/" })}
          className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 pb-10 pt-6 md:px-8 xl:px-10 space-y-6">
      <PageHeader
        title="Equipe"
        subtitle="Usuários do painel organizados por cargo, áreas e controle de casting."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nome, ID, cargo, área..."
                className="w-64 rounded-xl glass py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-colors focus:border-primary/60"
              />
            </div>
            {podeCriar && aba === "casting" ? (
              <button
                onClick={() => setCastingForm({ id: null, ...EMPTY_CASTING })}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="size-4" /> Novo casting
              </button>
            ) : null}
            {podeCriar && aba !== "casting" ? (
              <button
                onClick={() => {
                  setNovoUser("");
                  setNovoRole("staff");
                  setNovoOpen(true);
                }}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <UserPlus className="size-4" /> Criar usuário
              </button>
            ) : null}
          </div>
        }
      />

      {/* Dashboard */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Equipe" value={linhas.length} icon={Users} />
        <StatCard
          label="Coordenação+"
          value={
            linhas.filter((u) =>
              (["founder", "c_level", "direcao", "coordinator"] as AppRole[]).includes(u.role)
            ).length
          }
          icon={Crown}
        />
        <StatCard label="Áreas ativas" value={areaStats.length} icon={BarChart3} />
        <StatCard label="Casting" value={(casting ?? []).length} icon={Clapperboard} />
      </div>

      {/* Abas */}
      <div className="flex flex-wrap items-center gap-2">
        {ABAS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
              aba === a.key
                ? "border-white/15 bg-white/[0.07] text-foreground"
                : "glass text-muted-foreground hover:bg-white/[0.08]"
            )}
          >
            <a.icon className="size-4" /> {a.label}
          </button>
        ))}
        {aba === "equipe" && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="glass flex items-center gap-0.5 rounded-full p-1" role="group" aria-label="Modo de visualização">
              {([
                { v: "org", icon: Network, label: "Organograma" },
                { v: "tabela", icon: Table2, label: "Tabela" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  onClick={() => trocarVisao(o.v)}
                  title={o.label}
                  aria-label={o.label}
                  aria-pressed={visao === o.v}
                  className={cn(
                    "grid size-8 place-items-center rounded-full transition-colors duration-200",
                    visao === o.v ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <o.icon className="size-4" strokeWidth={1.7} />
                </button>
              ))}
            </div>
            <div className="w-48">
              <MinimalSelect
                value={cargoFiltro}
                onChange={setCargoFiltro}
                className="rounded-full glass font-semibold"
                options={[
                  { value: "todos", label: "Todos os cargos" },
                  ...ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
                ]}
              />
            </div>
            <div className="w-48">
              <MinimalSelect
                value={areaFiltro}
                onChange={setAreaFiltro}
                className="rounded-full glass font-semibold"
                options={[
                  { value: "todas", label: "Todas as áreas" },
                  ...areaStats.map((a) => ({ value: a.area, label: a.label })),
                ]}
              />
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl glass">
        {loadingUsers || (aba === "casting" && loadingCasting) ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Carregando equipe...</p>
        ) : aba === "equipe" && visao === "org" ? (
          <div className="p-3">
            <TeamOrgChart
              users={filtradas}
              areas={areasDisponiveis}
              selectedId={selecionado?.id ?? null}
              onSelect={setSelecionado}
            />
          </div>
        ) : aba === "equipe" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">ID Host</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">ID Discord</th>
                  <th className="px-4 py-3">Áreas</th>
                  <th className="px-4 py-3">Último login</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  filtradas.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 align-top last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.host_id || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <img
                              src={u.avatar_url || DEFAULT_AVATAR_URL}
                              alt={u.username}
                              className="size-8 rounded-lg border border-border bg-muted object-cover"
                            />
                            <span
                              className={cn(
                                "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card",
                                isOnline(u.last_sign_in_at) ? "bg-emerald-500" : "bg-muted-foreground/50"
                              )}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">
                              {u.username}
                              {u.host_id ? (
                                <span className="text-muted-foreground"> #{u.host_id}</span>
                              ) : null}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {podeEditar && u.role !== "founder" ? (
                          <div className="flex items-center gap-1.5">
                            <span className={cn("size-2 shrink-0 rounded-full", ROLE_DOT[u.role])} />
                            <MinimalSelect
                              value={u.role}
                              onChange={(v) => mutRole.mutate({ userId: u.id, role: v as AppRole })}
                              className="rounded-lg bg-black/25 px-2 py-1 text-xs font-semibold"
                              options={ROLE_ORDER.filter((x) => isFounder || x !== "founder").map((x) => ({
                                value: x,
                                label: ROLE_LABELS[x],
                              }))}
                            />
                          </div>
                        ) : (
                          <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            {ROLE_LABELS[u.role]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CopyValue value={u.discord_id} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {u.areas.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            u.areas.map((a) => {
                              const lider = (u.areaNiveis ?? {})[a] === "lider";
                              return (
                                <span
                                  key={a}
                                  title={lider ? "Líder da área" : "Auxiliar da área"}
                                  className={cn(
                                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                    lider
                                      ? "border-white/15 bg-white/[0.07] text-foreground"
                                      : "border-border bg-accent text-accent-foreground"
                                  )}
                                >
                                  {lider ? <Crown className="size-3" /> : null}
                                  {areaLabel(a)}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <UltimoLogin value={u.last_sign_in_at} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {podeEditar ? (
                            <>
                              <button
                                onClick={() => openRename(u)}
                                title="Renomear usuário"
                                className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                              >
                                <AtSign className="size-3.5" />
                              </button>
                              <button
                                onClick={() => openIdsEditor(u)}
                                title="Editar IDs"
                                className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() => openAreaEditor(u)}
                                title="Editar áreas"
                                className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                              >
                                <MapPin className="size-3.5" />
                              </button>
                              <button
                                onClick={() => setResetTarget(u)}
                                title="Gerar token de acesso"
                                className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                              >
                                <KeyRound className="size-3.5" />
                              </button>
                            </>
                          ) : null}
                          {podeExcluir && u.role !== "founder" ? (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Excluir o usuário "${u.username}"? Essa ação não pode ser desfeita.`
                                  )
                                ) {
                                  mutDelete.mutate(u.id);
                                }
                              }}
                              title="Excluir usuário"
                              className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Casting</th>
                <th className="px-4 py-3">ID Host</th>
                <th className="px-4 py-3">ID Discord</th>
                <th className="px-4 py-3">Observação</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {castingFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum registro de casting.
                  </td>
                </tr>
              ) : (
                castingFiltrado.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2.5 font-semibold text-foreground">{r.nome || "—"}</td>
                    <td className="px-4 py-2.5">
                      <CopyValue value={r.host_id} />
                    </td>
                    <td className="px-4 py-2.5">
                      <CopyValue value={r.discord_id} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.obs || "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {podeEditar ? (
                          <button
                            onClick={() =>
                              setCastingForm({
                                id: r.id,
                                nome: r.nome,
                                host_id: r.host_id,
                                discord_id: r.discord_id,
                                obs: r.obs,
                              })
                            }
                            title="Editar casting"
                            className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        ) : null}
                         {podeCriar ? (
                          <button
                            onClick={() => {
                              const username = slugUsername(r.nome);
                              if (!username) {
                                toast.error("Nome do casting inválido para criar usuário");
                                return;
                              }
                              if (
                                confirm(
                                  `Upar "${r.nome}" para Support? Será criado o usuário "${username}" e o registro sairá do casting.`
                                )
                              ) {
                                mutUpar.mutate(r);
                              }
                            }}
                            disabled={mutUpar.isPending}
                            title="Upar para Support"
                            className="rounded-lg border border-primary/40 p-1.5 text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                          >
                            <ArrowUpCircle className="size-3.5" />
                          </button>
                        ) : null}
                        {podeExcluir ? (
                          <button
                            onClick={() => {
                              if (confirm(`Excluir o casting "${r.nome}"?`)) mutCastingDelete.mutate(r.id);
                            }}
                            title="Excluir casting"
                            className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal renomear usuário */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl glass-modal p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground font-display">
                <AtSign className="size-5 text-primary" /> Renomear {renameTarget.username}
              </h2>
              <button
                onClick={() => setRenameTarget(null)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Novo usuário</label>
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="ex: lelet"
              className="w-full rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              O login passa a ser feito com o novo nome. A senha atual continua a mesma.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setRenameTarget(null)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-white/[0.08]"
              >
                Cancelar
              </button>
              <button
                onClick={() => mutRename.mutate()}
                disabled={mutRename.isPending || novoNome.trim().length < 3}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {mutRename.isPending ? "Salvando..." : "Salvar nome"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal casting */}
      {castingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl glass-modal p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground font-display">
                <Clapperboard className="size-5 text-primary" />
                {castingForm.id ? "Editar casting" : "Novo casting"}
              </h2>
              <button
                onClick={() => setCastingForm(null)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Nome</label>
                <input
                  value={castingForm.nome}
                  onChange={(e) => setCastingForm({ ...castingForm, nome: e.target.value })}
                  className="w-full rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">ID Host</label>
                <input
                  value={castingForm.host_id}
                  onChange={(e) => setCastingForm({ ...castingForm, host_id: e.target.value })}
                  className="w-full rounded-lg border border-border bg-black/25 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">ID Discord</label>
                <input
                  value={castingForm.discord_id}
                  onChange={(e) => setCastingForm({ ...castingForm, discord_id: e.target.value })}
                  className="w-full rounded-lg border border-border bg-black/25 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Observação</label>
                <input
                  value={castingForm.obs}
                  onChange={(e) => setCastingForm({ ...castingForm, obs: e.target.value })}
                  className="w-full rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCastingForm(null)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-white/[0.08]"
              >
                Cancelar
              </button>
              <button
                onClick={() => mutCastingSave.mutate()}
                disabled={mutCastingSave.isPending || !castingForm.nome.trim()}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {mutCastingSave.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Central de permissões — apenas FOUNDER */}
      {isFounder && (
        <button
          type="button"
          onClick={() => setPermOpen(true)}
          className="group flex w-full items-center justify-between gap-4 rounded-2xl glass px-5 py-4 text-left transition-colors hover:border-primary/50"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">Permissões</span>
              <span className="block text-xs text-muted-foreground">
                Cargos, áreas e o que cada um pode visualizar, criar, editar, excluir e aprovar.
              </span>
            </span>
          </span>
          <span className="flex items-center gap-3">
            <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:block">
              {ROLE_ORDER.length - 1} cargos · {areasDisponiveis.length} áreas
            </span>
            <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </span>
        </button>
      )}

      {permOpen && isFounder && <PermissoesModal onClose={() => setPermOpen(false)} />}

      {/* Modal criar usuário */}
      {novoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl glass-modal p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground font-display">
                <UserPlus className="size-5 text-primary" /> Criar usuário
              </h2>
              <button
                onClick={() => setNovoOpen(false)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Usuário</label>
                <input
                  value={novoUser}
                  onChange={(e) => setNovoUser(e.target.value)}
                  placeholder="ex: joao.silva"
                  className="w-full rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Cargo</label>
                <MinimalSelect
                  value={novoRole}
                  onChange={(v) => setNovoRole(v as AppRole)}
                  className="rounded-lg bg-black/25"
                  options={ROLE_ORDER.filter((r) => isFounder || r !== "founder").map((r) => ({
                    value: r,
                    label: ROLE_LABELS[r],
                  }))}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setNovoOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-white/[0.08]"
              >
                Cancelar
              </button>
              <button
                onClick={() => mutCreate.mutate()}
                disabled={mutCreate.isPending || novoUser.trim().length < 3}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {mutCreate.isPending ? "Gerando token..." : "Criar e gerar token"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal IDs Discord / Host */}
      {idsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl glass-modal p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground font-display">
                <IdCard className="size-5 text-primary" /> IDs de {idsTarget.username}
              </h2>
              <button
                onClick={() => setIdsTarget(null)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">ID Discord</label>
                <input
                  value={discordId}
                  onChange={(e) => setDiscordId(e.target.value)}
                  placeholder="ex: 285948123456789012"
                  className="w-full rounded-lg border border-border bg-black/25 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">ID Host</label>
                <input
                  value={hostId}
                  onChange={(e) => setHostId(e.target.value)}
                  placeholder="ex: 1024"
                  className="w-full rounded-lg border border-border bg-black/25 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/60"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setIdsTarget(null)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-white/[0.08]"
              >
                Cancelar
              </button>
              <button
                onClick={() => mutIds.mutate({ userId: idsTarget.id })}
                disabled={mutIds.isPending}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {mutIds.isPending ? "Salvando..." : "Salvar IDs"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gerar token (reset de senha) */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl glass-modal p-6">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground font-display">
                <KeyRound className="size-5 text-primary" /> Gerar token de acesso
              </h2>
              <button
                onClick={() => setResetTarget(null)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Será gerado um novo token temporário para{" "}
              <strong className="text-foreground">{resetTarget.username}</strong>. A senha anterior deixa de
              funcionar e o usuário criará uma nova senha no próximo login.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setResetTarget(null)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-white/[0.08]"
              >
                Cancelar
              </button>
              <button
                onClick={() => mutReset.mutate()}
                disabled={mutReset.isPending}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {mutReset.isPending ? "Gerando..." : "Gerar token"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal token gerado */}
      {tokenGerado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl glass-modal p-6">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground font-display">
                <KeyRound className="size-5 text-primary" /> Token de acesso
              </h2>
              <button
                onClick={() => setTokenGerado(null)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Envie este token para <strong className="text-foreground">{tokenGerado.username}</strong>. Ele
              entra com o token no lugar da senha e criará a própria senha no primeiro acesso. Este token é
              exibido apenas agora.
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-black/25 px-3 py-2.5">
              <code className="flex-1 select-all break-all font-mono text-sm font-semibold text-primary">
                {tokenGerado.token}
              </code>
              <button
                onClick={() => copiarToken(tokenGerado.token)}
                title="Copiar token"
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
              >
                <Copy className="size-4" />
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setTokenGerado(null)}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal áreas do usuário */}
      {areaTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl glass-modal p-6">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground font-display">
                <MapPin className="size-5 text-primary" /> Áreas de {areaTarget.username}
              </h2>
              <button
                onClick={() => {
                  setAreaTarget(null);
                  setSelectedAreas([]);
                }}
                aria-label="Fechar"
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Marque uma ou mais áreas e defina se o usuário é <b>Líder</b> ou{" "}
              <b>Auxiliar</b> em cada uma. As permissões das áreas somam com as do cargo.
            </p>
            <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {areasDisponiveis.map((area) => {
                const checked = selectedAreas.includes(area.key);
                const isLider = selectedLideres.includes(area.key);
                return (
                  <div
                    key={area.key}
                    className={cn(
                      "rounded-xl border px-3 py-2 transition-colors",
                      checked
                        ? isLider
                          ? "border-primary bg-primary/15"
                          : "border-primary/50 bg-primary/5"
                        : "border-border bg-white/[0.035]"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSelectedArea(area.key)}
                      className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold"
                    >
                      <span
                        className={cn(
                          "flex min-w-0 items-center gap-1.5 truncate",
                          checked ? "text-primary" : "text-foreground"
                        )}
                      >
                        {checked && isLider ? <Crown className="size-3.5 shrink-0" /> : null}
                        <span className="truncate">
                          {area.emoji} {area.label}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          checked
                            ? "border-white/15 bg-white/[0.09] text-foreground"
                            : "border-border bg-black/25"
                        )}
                      >
                        {checked ? <Check className="size-3" /> : null}
                      </span>
                    </button>
                    {checked ? (
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setNivelArea(area.key, "lider")}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors",
                            isLider
                              ? "border-white/15 bg-white/[0.09] text-foreground"
                              : "border-border bg-black/25 text-muted-foreground hover:bg-white/[0.08]"
                          )}
                        >
                          <Crown className="size-3" /> Líder
                        </button>
                        <button
                          type="button"
                          onClick={() => setNivelArea(area.key, "auxiliar")}
                          className={cn(
                            "flex-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors",
                            !isLider
                              ? "border-foreground/30 bg-accent text-foreground"
                              : "border-border bg-black/25 text-muted-foreground hover:bg-white/[0.08]"
                          )}
                        >
                          Auxiliar
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedAreas([]);
                  setSelectedLideres([]);
                }}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-white/[0.08]"
              >
                Limpar áreas
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAreaTarget(null);
                    setSelectedAreas([]);
                    setSelectedLideres([]);
                  }}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-white/[0.08]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    mutArea.mutate({
                      userId: areaTarget.id,
                      areas: selectedAreas,
                      lideres: selectedLideres,
                    })
                  }
                  disabled={mutArea.isPending}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {mutArea.isPending ? "Salvando..." : "Salvar áreas"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {aba === "equipe" && selecionado && (() => {
        const atual = linhas.find((u) => u.id === selecionado.id) ?? selecionado;
        return (
          <PersonDrawer
            user={atual}
            areas={areasDisponiveis}
            onClose={() => setSelecionado(null)}
            podeEditar={podeEditar}
            podeExcluir={podeExcluir}
            onRename={() => openRename(atual)}
            onEditIds={() => openIdsEditor(atual)}
            onEditAreas={() => openAreaEditor(atual)}
            onResetToken={() => setResetTarget(atual)}
            onDelete={() => {
              if (confirm(`Excluir o usuário "${atual.username}"? Essa ação não pode ser desfeita.`)) {
                mutDelete.mutate(atual.id);
                setSelecionado(null);
              }
            }}
          />
        );
      })()}
    </div>
  );
}
