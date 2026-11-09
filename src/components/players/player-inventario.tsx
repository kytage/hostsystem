import { useEffect, useRef, useState, type ReactNode } from "react";
import { Backpack, Car, Check, Copy, Crosshair, Crown, Package, Skull, Smartphone, Swords, Target, Users, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/dashboard/Logo";
import { brl, itemBase, itemTipo, kd, LEVEL_MAX, type Player } from "@/lib/players";

/* ------------------------------------------------------------------ *
 * Peças pequenas
 * ------------------------------------------------------------------ */

export function CopyBtn({ value, label, className }: { value: string; label: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(value).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        });
      }}
      aria-label={`Copiar ${label}`}
      title={`Copiar ${label}`}
      className={cn("grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-white/[0.07] hover:text-foreground", className)}
    >
      {ok ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function Painel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[18px] border border-white/[0.07] bg-[#0c0c0c]/80 backdrop-blur-xl", className)}>{children}</div>;
}

/** Moeda HOST girando em 3D (faces + espessura empilhada). */
function Coin3D({ size = 44 }: { size?: number }) {
  const camadas = 8;
  return (
    <div style={{ width: size, height: size, perspective: 600 }} className="shrink-0">
      <div className="relative size-full" style={{ transformStyle: "preserve-3d", animation: "host-coin-spin 4.5s linear infinite" }}>
        {Array.from({ length: camadas }, (_, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full"
            style={{ transform: `translateZ(${i - camadas / 2}px)`, background: i === 0 || i === camadas - 1 ? undefined : "#7a0808" }}
          />
        ))}
        {[0, 180].map((rot) => (
          <div
            key={rot}
            className="absolute inset-0 grid place-items-center rounded-full border border-red-300/30"
            style={{
              transform: `rotateY(${rot}deg) translateZ(${camadas / 2}px)`,
              backfaceVisibility: "hidden",
              background: "radial-gradient(circle at 35% 30%, #ff4a4a, #ce0e0e 45%, #6d0505 100%)",
              boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.12), 0 0 24px rgba(206,14,14,0.35)",
            }}
          >
            <Logo className="h-[42%] [&_path]:fill-white" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Identidade 3D (inclina com o mouse, clique vira)
 * ------------------------------------------------------------------ */

function Identidade3D({ p }: { p: Player }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, gx: 50, gy: 50 });
  const [virado, setVirado] = useState(false);

  const campos: [string, string][] = [
    ["Passaporte", p.passaporte ? `#${p.passaporte}` : "—"],
    ["Idade", p.idade != null ? `${p.idade} anos` : "—"],
    ["Telefone", p.telefone ?? "—"],
    ["Rank", p.rank_vip ?? "Sem VIP"],
    ["Discord", p.discord_nome ? `@${p.discord_nome}` : p.discord_id ?? "—"],
    ["Grupos", String(p.grupos.length)],
  ];

  const face = "absolute inset-0 overflow-hidden rounded-[18px] border border-white/[0.09]";
  return (
    <div
      ref={ref}
      style={{ perspective: 1100 }}
      className="h-[230px] cursor-pointer select-none"
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        setTilt({ x: (0.5 - py) * 16, y: (px - 0.5) * 20, gx: px * 100, gy: py * 100 });
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0, gx: 50, gy: 50 })}
      onClick={() => setVirado((v) => !v)}
      title="Clique para virar"
    >
      <div
        className="relative size-full transition-transform duration-500 ease-out"
        style={{ transformStyle: "preserve-3d", transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y + (virado ? 180 : 0)}deg)` }}
      >
        {/* frente */}
        <div
          className={face}
          style={{ backfaceVisibility: "hidden", background: "linear-gradient(145deg, #1a1a1a 0%, #0b0b0b 55%, #1b0505 100%)" }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70 mix-blend-screen"
            style={{ background: `radial-gradient(420px circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.10), transparent 45%)` }}
          />
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <Logo className="h-3.5" /> Identidade
            </span>
            <span className={cn("flex items-center gap-1 text-[10px]", p.online ? "text-emerald-400" : "text-ink-3")}>
              <span className={cn("size-1.5 rounded-full", p.online ? "bg-emerald-400" : "bg-white/25")} />
              {p.online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
          <div className="flex gap-3.5 p-4" style={{ transform: "translateZ(30px)" }}>
            <div className="grid h-[104px] w-[84px] shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] font-display text-4xl font-semibold text-foreground/90 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              {(p.nome || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[17px] font-semibold leading-tight">{p.nome || "Sem nome"}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {campos.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[9px] uppercase tracking-wider text-ink-3">{k}</dt>
                    <dd className="truncate text-[11.5px] text-foreground/90">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
            <div className="flex h-5 items-end gap-[2px] opacity-40">
              {p.license.split("").slice(0, 26).map((c, i) => (
                <span key={i} className="w-[2px] bg-white" style={{ height: `${30 + (c.charCodeAt(0) % 7) * 10}%` }} />
              ))}
            </div>
            <span className="truncate font-mono text-[9.5px] text-ink-3">{p.license}</span>
          </div>
        </div>

        {/* verso */}
        <div
          className={cn(face, "grid place-items-center")}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "linear-gradient(145deg, #1b0505 0%, #0b0b0b 50%, #161616 100%)" }}
        >
          <div className="text-center" style={{ transform: "translateZ(30px)" }}>
            <Logo className="mx-auto h-10 opacity-90" />
            <p className="mt-3 font-display text-3xl font-semibold tabular-nums">
              LVL {p.level}
              <span className="text-base text-ink-3"> / {LEVEL_MAX}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{p.rank_vip ?? "Sem VIP"}</p>
            <p className="mt-4 font-mono text-[10px] text-ink-3">{p.license}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Level (anel) e combate
 * ------------------------------------------------------------------ */

function LevelRing({ p }: { p: Player }) {
  const pct = Math.min(1, Math.max(0, p.level / LEVEL_MAX));
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <Painel className="flex items-center gap-4 p-4">
      <div className="relative size-[128px] shrink-0">
        <svg viewBox="0 0 128 128" className="size-full -rotate-90">
          <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
          <circle
            cx="64"
            cy="64"
            r={R}
            fill="none"
            stroke="url(#lvl)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.7,.2,1)" }}
          />
          <defs>
            <linearGradient id="lvl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff5a5a" />
              <stop offset="100%" stopColor="#ce0e0e" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink-3">Level</p>
            <p className="font-display text-3xl font-semibold leading-none tabular-nums">{p.level}</p>
            <p className="mt-0.5 text-[10px] text-ink-3">de {LEVEL_MAX}</p>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Rank</p>
          <p className={cn("mt-1 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-semibold", p.rank_vip ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-white/[0.08] text-muted-foreground")}>
            <Crown className="size-3.5" /> {p.rank_vip ?? "Sem VIP"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">XP</p>
          <p className="mt-0.5 flex items-center gap-1 text-sm tabular-nums">
            <Zap className="size-3.5 text-primary" /> {p.xp.toLocaleString("pt-BR")}
          </p>
        </div>
        <p className="text-[11px] text-ink-3">{Math.round(pct * 100)}% do level máximo</p>
      </div>
    </Painel>
  );
}

function Combate({ p }: { p: Player }) {
  const total = p.kills + p.mortes;
  const pk = total ? (p.kills / total) * 100 : 50;
  const hs = p.kills ? Math.round((p.headshots / p.kills) * 100) : 0;
  const stats = [
    { k: "Kills", v: p.kills, icon: Swords, cls: "text-emerald-300" },
    { k: "Mortes", v: p.mortes, icon: Skull, cls: "text-primary" },
    { k: "K/D", v: kd(p).toFixed(2), icon: Target, cls: "text-foreground" },
    { k: "Headshots", v: `${p.headshots} · ${hs}%`, icon: Crosshair, cls: "text-foreground" },
  ];
  return (
    <Painel className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Kills / Mortes</p>
        <p className="text-[11px] text-ink-3">Maior sequência: <span className="text-foreground">{p.maior_sequencia}</span></p>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div className="h-full bg-emerald-400/80 transition-[width] duration-700" style={{ width: total ? `${pk}%` : "0%" }} />
        <div className="h-full flex-1" style={{ background: total ? "rgba(206,14,14,0.8)" : undefined }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.k} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-3">
              <s.icon className="size-3" /> {s.k}
            </p>
            <p className={cn("mt-0.5 font-display text-lg font-semibold tabular-nums", s.cls)}>{typeof s.v === "number" ? s.v.toLocaleString("pt-BR") : s.v}</p>
          </div>
        ))}
      </div>
    </Painel>
  );
}

/* ------------------------------------------------------------------ *
 * Slots
 * ------------------------------------------------------------------ */

const TIPO = {
  arma: { icon: Crosshair, cls: "text-red-300", ring: "group-hover:border-primary/50" },
  municao: { icon: Target, cls: "text-amber-200", ring: "group-hover:border-amber-400/40" },
  eletronico: { icon: Smartphone, cls: "text-sky-200", ring: "group-hover:border-sky-400/40" },
  outro: { icon: Package, cls: "text-foreground/70", ring: "group-hover:border-white/25" },
} as const;

function Slot({ children, title, qtd, filled }: { children?: ReactNode; title?: string; qtd?: number; filled: boolean }) {
  return (
    <div className="group [perspective:600px]" title={title}>
      <div
        className={cn(
          "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border p-1.5 text-center transition-all duration-200",
          filled
            ? "border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.015] group-hover:[transform:translateZ(18px)_rotateX(8deg)] group-hover:shadow-[0_14px_28px_rgba(0,0,0,0.55)]"
            : "border-white/[0.04] bg-white/[0.012]",
        )}
      >
        {qtd !== undefined && <span className="absolute left-1.5 top-1 text-[10px] font-semibold tabular-nums text-muted-foreground">{qtd}x</span>}
        {children}
      </div>
    </div>
  );
}

type Aba = "inventario" | "veiculos" | "grupos";

/* ------------------------------------------------------------------ *
 * Tela principal
 * ------------------------------------------------------------------ */

export function PlayerInventario({ player: p, onClose }: { player: Player; onClose: () => void }) {
  const [aba, setAba] = useState<Aba>("inventario");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const totalItens = p.inventario.reduce((s, i) => s + i.qtd, 0);
  const abas: { id: Aba; label: string; n: number; icon: typeof Backpack }[] = [
    { id: "inventario", label: "Inventário", n: totalItens, icon: Backpack },
    { id: "veiculos", label: "Veículos", n: p.veiculos.length, icon: Car },
    { id: "grupos", label: "Grupos", n: p.grupos.length, icon: Users },
  ];
  const minSlots = 30;
  const vazios = (n: number) => Math.max(0, (n < minSlots ? minSlots : Math.ceil(n / 6) * 6) - n);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Perfil de ${p.nome}`}>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(900px 420px at 50% -10%, rgba(206,14,14,0.22), transparent 70%)" }}
      />

      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col px-4 py-6 md:px-6">
        <header className="animate-rise mb-4 flex items-center gap-3">
          <p className="eyebrow">Perfil do player</p>
          <span className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[11px] text-ink-3">ESC para fechar</span>
          <button onClick={onClose} aria-label="Fechar" className="grid size-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* coluna esquerda */}
          <div className="animate-rise space-y-4">
            <Identidade3D p={p} />
            <LevelRing p={p} />
            <Combate p={p} />
            <Painel className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[9.5px] uppercase tracking-wider text-ink-3">License</span>
                <span className="block truncate font-mono text-xs">{p.license}</span>
              </span>
              <CopyBtn value={p.license} label="license" />
              {(p.discord_id || p.discord_nome) && <CopyBtn value={p.discord_id ?? p.discord_nome ?? ""} label="Discord" />}
            </Painel>
          </div>

          {/* coluna direita */}
          <div className="animate-rise flex min-w-0 flex-col gap-4" style={{ animationDelay: "60ms" }}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { k: "Carteira", v: brl(p.carteira) },
                { k: "Banco", v: brl(p.banco) },
              ].map((m) => (
                <Painel key={m.k} className="flex items-center gap-3 p-4">
                  <span className="font-display text-2xl font-bold text-primary">R$</span>
                  <span className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-3">{m.k}</span>
                    <span className="block truncate font-display text-lg font-semibold tabular-nums">{m.v.replace("R$", "").trim()}</span>
                  </span>
                </Painel>
              ))}
              <Painel className="flex items-center gap-3 p-4">
                <Coin3D />
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-3">HOST Coins</span>
                  <span className="block truncate font-display text-lg font-semibold tabular-nums">{p.host_coins.toLocaleString("pt-BR")}</span>
                </span>
              </Painel>
            </div>

            <Painel className="flex min-h-0 flex-1 flex-col p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-black/30 p-1">
                  {abas.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAba(a.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
                        aba === a.id ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <a.icon className="size-3.5" /> {a.label} <span className="text-ink-3">{a.n}</span>
                    </button>
                  ))}
                </div>
                <p className="ml-auto truncate font-display text-sm font-semibold">{p.nome}</p>
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                {aba === "inventario" && (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 xl:grid-cols-6">
                    {p.inventario.map((i, idx) => {
                      const t = TIPO[itemTipo(i.item)];
                      return (
                        <Slot key={`${i.item}-${idx}`} filled qtd={i.qtd} title={i.item}>
                          <t.icon className={cn("size-6", t.cls)} strokeWidth={1.6} />
                          <span className="w-full truncate text-[10px] leading-tight text-foreground/80">{itemBase(i.item).replace(/^weapon_/i, "")}</span>
                        </Slot>
                      );
                    })}
                    {Array.from({ length: vazios(p.inventario.length) }, (_, i) => (
                      <Slot key={`v${i}`} filled={false} />
                    ))}
                  </div>
                )}
                {aba === "veiculos" && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                    {p.veiculos.map((v) => (
                      <Slot key={v} filled title={v}>
                        <Car className="size-6 text-foreground/70" strokeWidth={1.5} />
                        <span className="w-full truncate font-mono text-[10px] text-foreground/80">{v}</span>
                      </Slot>
                    ))}
                    {p.veiculos.length === 0 && <p className="col-span-full py-10 text-center text-sm text-ink-3">Sem veículos.</p>}
                  </div>
                )}
                {aba === "grupos" && (
                  <div className="flex flex-wrap gap-2">
                    {p.grupos.map((g) => (
                      <span key={g} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm">
                        {g}
                      </span>
                    ))}
                    {p.grupos.length === 0 && <p className="w-full py-10 text-center text-sm text-ink-3">Sem grupos.</p>}
                  </div>
                )}
              </div>
            </Painel>
          </div>
        </div>
      </div>
    </div>
  );
}
