import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Car, Check, Copy, Crown, Package, Search, Target, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/dashboard/Logo";
import { brl, itemBase, kd, LEVEL_MAX, type Player } from "@/lib/players";

const R2 = "https://image.hostgg.com.br";
const urlItem = (spawn: string) => `${R2}/inventory/${encodeURIComponent(spawn)}.png`;
const urlVeiculo = (spawn: string) => `${R2}/game/garage/${encodeURIComponent(spawn)}.png`;

/** Conta de 0 até o valor, desacelerando no final. */
function useContador(alvo: number, duracao = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(alvo);
      return;
    }
    let raf = 0;
    const ini = performance.now();
    const passo = (t: number) => {
      const x = Math.min(1, (t - ini) / duracao);
      setV(alvo * (1 - Math.pow(1 - x, 4)));
      if (x < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracao]);
  return v;
}

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
      className={cn("grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-white/[0.07] hover:text-foreground", className)}
    >
      {ok ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/** Marca HOST padrão, usada no lugar da foto de perfil. */
export function HostAvatar({ className, logo = "h-[42%]" }: { className?: string; logo?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.05]", className)}>
      <Logo className={logo} />
    </span>
  );
}

function Foto({ src, fallback: Icon }: { src: string; fallback: typeof Package }) {
  const [erro, setErro] = useState(false);
  useEffect(() => setErro(false), [src]);
  return (
    <span className="grid h-9 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.04]">
      {erro ? (
        <Icon className="size-4 text-ink-3" strokeWidth={1.6} />
      ) : (
        <img src={src} alt="" loading="lazy" draggable={false} onError={() => setErro(true)} className="size-full object-contain p-0.5" />
      )}
    </span>
  );
}

function Coin3D({ size = 48 }: { size?: number }) {
  const camadas = 6;
  return (
    <div style={{ width: size, height: size, perspective: 500 }} className="shrink-0">
      <div className="relative size-full" style={{ transformStyle: "preserve-3d", animation: "host-coin-spin 5s linear infinite" }}>
        {Array.from({ length: camadas }, (_, i) => (
          <div key={i} className="absolute inset-0 rounded-full bg-[#7a0808]" style={{ transform: `translateZ(${i - camadas / 2}px)` }} />
        ))}
        {[0, 180].map((rot) => (
          <div
            key={rot}
            className="absolute inset-0 grid place-items-center rounded-full"
            style={{
              transform: `rotateY(${rot}deg) translateZ(${camadas / 2}px)`,
              backfaceVisibility: "hidden",
              background: "radial-gradient(circle at 35% 30%, #f43a3a, #ce0e0e 50%, #6d0505 100%)",
            }}
          >
            <Logo className="h-[40%] [&_path]:fill-white" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LevelCirculo({ level }: { level: number }) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPronto(true), 320);
    return () => clearTimeout(t);
  }, []);
  const pct = pronto ? Math.min(1, Math.max(0, level / LEVEL_MAX)) : 0;
  return (
    <span className="relative grid size-12 place-items-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r="21" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.09)" strokeWidth="3" />
        <circle cx="24" cy="24" r="21" fill="none" stroke="#ce0e0e" strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct * 100} 100`} style={{ transition: "stroke-dasharray 900ms cubic-bezier(.2,.7,.2,1)" }} />
      </svg>
      <span className="font-display text-sm font-semibold tabular-nums">{level}</span>
    </span>
  );
}

function Tile({ topo, valor, rotulo, indice }: { topo: ReactNode; valor: string; rotulo: string; indice: number }) {
  return (
    <div style={{ animationDelay: `${210 + indice * 60}ms` }} className="pf-pop flex min-w-0 flex-col items-center px-2 py-1 text-center">
      <span className="grid h-12 place-items-center">{topo}</span>
      <p className="mt-2.5 max-w-full truncate font-display text-[15px] font-semibold tabular-nums">{valor}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{rotulo}</p>
    </div>
  );
}

const bloco = "rounded-[24px] border border-white/[0.06] bg-white/[0.025]";

function ListaBloco<T>({ titulo, itens, filtro, render }: {
  titulo: string;
  itens: T[];
  filtro: (i: T, q: string) => boolean;
  render: (i: T, n: number) => ReactNode;
}) {
  const [busca, setBusca] = useState("");
  const q = busca.trim().toLowerCase();
  const lista = q ? itens.filter((i) => filtro(i, q)) : itens;
  return (
    <section className={cn(bloco, "flex min-w-0 flex-col p-4 xl:h-full")}>
      <div className="flex h-8 shrink-0 items-center gap-3 px-1">
        <h3 className="font-display text-[15px] font-semibold">{titulo}</h3>
        <span className="text-xs tabular-nums text-ink-3">{itens.length}</span>
        <label className="ml-auto flex h-8 w-36 items-center gap-2 rounded-full bg-white/[0.04] px-3">
          <Search className="size-3 text-ink-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label={`Buscar em ${titulo}`} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-3" />
        </label>
      </div>
      <ul className="mt-3 h-[320px] overflow-y-auto xl:h-auto xl:min-h-0 xl:flex-1">
        {lista.map((i, n) => render(i, n))}
        {lista.length === 0 && <li className="py-14 text-center text-xs text-ink-3">Nada encontrado.</li>}
      </ul>
    </section>
  );
}

function Linha({ foto, spawn, qtd, indice }: { foto: ReactNode; spawn: string; qtd?: number; indice: number }) {
  return (
    <li style={{ animationDelay: `${Math.min(indice, 16) * 28 + 220}ms` }} className="pf-linha flex h-12 items-center gap-3 rounded-xl px-1 transition-[background-color,transform] duration-200 hover:translate-x-1 hover:bg-white/[0.04]">
      {foto}
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/90" title={spawn}>{spawn}</span>
      {qtd !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{qtd.toLocaleString("pt-BR")}x</span>}
      <CopyBtn value={spawn} label={`spawn ${spawn}`} />
    </li>
  );
}

function Dados({ titulo, linhas }: { titulo: string; linhas: { k: string; v: string; copiar?: boolean }[] }) {
  return (
    <section className={cn(bloco, "min-w-0 px-5 py-4")}>
      <h3 className="font-display text-[15px] font-semibold">{titulo}</h3>
      <dl className="mt-2">
        {linhas.map((l) => (
          <div key={l.k} className="flex h-9 items-center gap-2 border-t border-white/[0.05] text-[13px] first:border-t-0">
            <dt className="text-muted-foreground">{l.k}</dt>
            <dd className="ml-auto min-w-0 truncate tabular-nums">{l.v}</dd>
            {l.copiar && l.v !== "—" && <CopyBtn value={l.v} label={l.k} className="-mr-1" />}
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PlayerInventario({ player: p, onClose }: { player: Player; onClose: () => void }) {
  const [saindo, setSaindo] = useState(false);
  const fechar = useCallback(() => setSaindo(true), []);

  useEffect(() => {
    if (!saindo) return;
    const t = setTimeout(onClose, 210);
    return () => clearTimeout(t);
  }, [saindo, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fechar]);

  // Mesmo spawn com seriais diferentes vira uma linha só.
  const itens = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of p.inventario) {
      const s = itemBase(i.item);
      m.set(s, (m.get(s) ?? 0) + i.qtd);
    }
    return [...m].map(([spawn, qtd]) => ({ spawn, qtd }));
  }, [p.inventario]);

  const banco = useContador(p.banco);
  const coins = useContador(p.host_coins);
  const [inteiro, centavos] = banco.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(",");
  const hs = p.kills ? Math.round((p.headshots / p.kills) * 100) : 0;
  const circulo = "grid size-12 place-items-center rounded-full";
  const atraso = (ms: number) => ({ animationDelay: `${ms}ms` });

  return (
    <div className={cn("fixed inset-0 z-50 overflow-y-auto p-3 xl:flex xl:items-center xl:overflow-hidden xl:p-6", saindo && "pf-saindo")} role="dialog" aria-modal="true" aria-label={`Perfil de ${p.nome}`}>
      <div className="pf-fade fixed inset-0 bg-black/85 backdrop-blur-md" onClick={fechar} />

      <div className="pf-modal relative mx-auto flex w-full max-w-[1680px] flex-col overflow-hidden rounded-[32px] border border-white/[0.07] bg-[#060606] shadow-[0_40px_120px_rgba(0,0,0,0.75)] xl:h-full xl:max-h-[1000px]">
        <div aria-hidden className="pf-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" style={{ background: "radial-gradient(52% 100% at 50% 0%, rgba(150,10,18,0.62), rgba(80,6,10,0.25) 55%, transparent 100%)" }} />

        <header className="relative grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-5 pt-4 xl:px-6">
          <span className="flex items-center gap-1.5 justify-self-start rounded-full bg-black/35 px-3 py-1.5 text-[11px] text-foreground/75">
            <span className={cn("size-1.5 rounded-full", p.online ? "animate-pulse bg-emerald-400" : "bg-white/30")} />
            {p.online ? "Online" : "Offline"}
          </span>
          <Logo className="h-6 [&_path]:fill-white" />
          <button onClick={fechar} aria-label="Fechar" className="grid size-9 place-items-center justify-self-end rounded-full bg-black/35 text-foreground/75 transition-all duration-200 hover:rotate-90 hover:text-foreground">
            <X className="size-4" />
          </button>
        </header>

        <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[380px_minmax(0,1fr)_380px] xl:p-6 xl:pt-3">
          <div className="pf-esquerda min-h-0 xl:h-full" style={atraso(90)}>
            <ListaBloco
              titulo="Inventário"
              itens={itens}
              filtro={(i, q) => i.spawn.toLowerCase().includes(q)}
              render={(i, n) => <Linha key={i.spawn} indice={n} spawn={i.spawn} qtd={i.qtd} foto={<Foto src={urlItem(i.spawn)} fallback={Package} />} />}
            />
          </div>

          <div className="order-first flex min-h-0 min-w-0 flex-col gap-4 xl:order-none xl:overflow-y-auto">
            <div className="pf-sobe flex shrink-0 flex-col items-center pt-1 text-center" style={atraso(60)}>
              <HostAvatar className="size-16 bg-black/40" />
              <h2 className="mt-3 max-w-full truncate font-display text-xl font-semibold">
                {p.nome || "Sem nome"}
                {p.passaporte && <span className="ml-1.5 font-normal text-foreground/45">#{p.passaporte}</span>}
              </h2>
              <p className={cn("mt-0.5 flex items-center gap-1 text-xs", p.rank_vip ? "text-amber-200" : "text-foreground/55")}>
                <Crown className="size-3" /> {p.rank_vip ?? "Sem VIP"}
              </p>
              <p className="mt-5 text-xs text-foreground/55">Dinheiro no banco</p>
              <p className="mt-1 max-w-full truncate font-display text-[26px] font-semibold leading-tight tracking-tight tabular-nums xl:text-[30px]">
                {inteiro}
                <span className="text-foreground/30">,{centavos}</span>
                <span className="ml-1.5 text-xs font-medium text-foreground/60">BRL</span>
              </p>
            </div>

            <div className="pf-sobe grid shrink-0 grid-cols-2 gap-y-4 rounded-[24px] border border-white/[0.08] bg-white/[0.05] px-2 py-4 backdrop-blur-xl sm:grid-cols-4" style={atraso(150)}>
              <Tile indice={0} topo={<span className={cn(circulo, "bg-primary text-white shadow-[0_0_24px_rgba(206,14,14,0.45)]")}><Target className="size-5" strokeWidth={1.8} /></span>} valor={kd(p).toFixed(2)} rotulo="K/D" />
              <Tile indice={1} topo={<LevelCirculo level={p.level} />} valor={`${p.level} / ${LEVEL_MAX}`} rotulo="Level" />
              <Tile indice={2} topo={<Coin3D />} valor={Math.round(coins).toLocaleString("pt-BR")} rotulo="HOST Coins" />
              <Tile indice={3} topo={<span className={cn(circulo, "bg-white/[0.07] text-foreground/85")}><Wallet className="size-5" strokeWidth={1.6} /></span>} valor={brl(p.carteira)} rotulo="Carteira" />
            </div>

            <div className="pf-sobe grid shrink-0 grid-cols-1 gap-4 md:grid-cols-2" style={atraso(230)}>
              <Dados
                titulo="Identificação"
                linhas={[
                  { k: "Idade", v: p.idade != null ? `${p.idade} anos` : "—" },
                  { k: "Telefone", v: p.telefone ?? "—", copiar: true },
                  { k: "Discord", v: p.discord_nome ? `@${p.discord_nome}` : p.discord_id ?? "—", copiar: true },
                  { k: "License", v: p.license, copiar: true },
                  { k: "Último login", v: p.ultimo_login ? new Date(p.ultimo_login).toLocaleDateString("pt-BR") : "—" },
                ]}
              />
              <Dados
                titulo="Combate"
                linhas={[
                  { k: "Kills", v: p.kills.toLocaleString("pt-BR") },
                  { k: "Mortes", v: p.mortes.toLocaleString("pt-BR") },
                  { k: "Headshots", v: `${p.headshots.toLocaleString("pt-BR")} · ${hs}%` },
                  { k: "Maior sequência", v: p.maior_sequencia.toLocaleString("pt-BR") },
                  { k: "XP", v: p.xp.toLocaleString("pt-BR") },
                ]}
              />
            </div>

            <section className={cn(bloco, "pf-sobe min-h-[104px] flex-1 p-4 text-center xl:overflow-y-auto")} style={atraso(310)}>
              <h3 className="font-display text-[15px] font-semibold">
                Grupos <span className="ml-1 text-xs font-normal text-ink-3">{p.grupos.length}</span>
              </h3>
              <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                {p.grupos.map((g) => (
                  <span key={g} className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-foreground/85 transition-colors hover:bg-white/[0.1]">{g}</span>
                ))}
                {p.grupos.length === 0 && <span className="text-xs text-ink-3">Sem grupos.</span>}
              </div>
            </section>
          </div>

          <div className="pf-direita min-h-0 xl:h-full" style={atraso(90)}>
            <ListaBloco
              titulo="Garagem"
              itens={p.veiculos}
              filtro={(v, q) => v.toLowerCase().includes(q)}
              render={(v, n) => <Linha key={v} indice={n} spawn={v} foto={<Foto src={urlVeiculo(v)} fallback={Car} />} />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
