import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealtimeTable } from "@/lib/realtime";
import { fetchPlayersDoGrupo } from "@/lib/players";
import { FOTO_PADRAO, haQuanto } from "@/lib/player-perfil";

/** Aba "Players" da setagem: todos que têm o grupo (ex.: Muni01), online primeiro. */
export function IlegalPlayersSet({ setagem }: { setagem: string }) {
  const [busca, setBusca] = useState("");
  useRealtimeTable("players", [["players-do-grupo", setagem]]);
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["players-do-grupo", setagem],
    queryFn: () => fetchPlayersDoGrupo(setagem),
    enabled: !!setagem.trim(),
    staleTime: 30_000,
  });
  const alvo = setagem.trim().toLowerCase();
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return data
      .map((p) => {
        const g = p.grupos.find((x) => x.split(":")[0]!.trim().toLowerCase() === alvo);
        const nivel = g && g.includes(":") ? Number(g.split(":")[1]) : null;
        return { p, nivel: Number.isFinite(nivel) ? nivel : null };
      })
      .filter(({ p }) => !q || [p.nome, p.passaporte, p.discord_nome].some((v) => v?.toLowerCase().includes(q)));
  }, [data, busca, alvo]);
  const online = data.filter((p) => p.online).length;

  if (!setagem.trim())
    return <p className="py-12 text-center text-sm text-muted-foreground">Esta setagem ainda não tem nome.</p>;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-muted-foreground" />
          <b className="tabular-nums">{data.length}</b> com o grupo <b className="font-mono">{setagem}</b>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            <i className="size-1.5 rounded-full bg-emerald-400" /> {online} online agora
          </span>
        </span>
        <label className="campo-busca ml-auto w-full sm:w-64">
          <Search className="size-[14px] shrink-0" strokeWidth={1.75} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou ID" />
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando players...
        </div>
      ) : isError ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Não deu para carregar os players.</p>
      ) : data.length === 0 ? (
        <p className="mx-auto max-w-md py-12 text-center text-sm text-muted-foreground">
          Ninguém com o grupo <b className="font-mono">{setagem}</b> ainda. A lista se preenche sozinha conforme o
          servidor manda as fichas dos players (ou você não tem acesso à área Players).
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.06]">
          {lista.map(({ p, nivel }) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02]">
              <span className="relative shrink-0">
                <img src={FOTO_PADRAO} alt="" className="size-8 rounded-lg object-cover" />
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#111]",
                    p.online ? "bg-emerald-400" : "bg-white/25",
                  )}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">
                  {p.nome || "Sem nome"} <span className="font-normal text-ink-3">#{p.passaporte ?? "—"}</span>
                </span>
                <span className="block truncate text-[11px] text-ink-3">
                  {p.online ? "Online agora" : `Último login ${haQuanto(p.ultimo_login)}`}
                  {p.discord_nome ? ` · @${p.discord_nome}` : ""}
                </span>
              </span>
              {nivel !== null && (
                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10.5px] font-bold text-primary" title="Nível no grupo (1 = o mais alto)">
                  nv {nivel}
                </span>
              )}
              <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:block">Level {p.level}</span>
              {p.passaporte && (
                <Link
                  to="/players"
                  search={{ jogador: p.passaporte }}
                  className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-white/[0.06] hover:text-foreground"
                  title="Abrir o perfil do player"
                >
                  <UserRound className="size-3.5" />
                </Link>
              )}
            </li>
          ))}
          {lista.length === 0 && <li className="py-8 text-center text-[12px] text-ink-3">Ninguém com essa busca.</li>}
        </ul>
      )}
    </div>
  );
}
