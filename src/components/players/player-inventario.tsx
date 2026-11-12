import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AtSign,
  Backpack,
  Cake,
  CarFront,
  Check,
  Clock,
  Copy,
  Crosshair,
  Crown,
  Flame,
  IdCard,
  KeyRound,
  Maximize2,
  Medal,
  Minimize2,
  Minus,
  Package,
  Phone,
  Search,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { copiarTexto } from "@/lib/copiar";
import { Logo } from "@/components/dashboard/Logo";
import { CartaoBancoHost } from "@/components/players/inventario-banco";
import { InventarioFundo } from "@/components/players/inventario-fundo";
import { brl, itemBase, itemTipo, kd, LEVEL_MAX, type ItemTipo, type Player } from "@/lib/players";

const R2 = "https://image.hostgg.com.br";
const urlItem = (spawn: string) => `${R2}/inventory/${encodeURIComponent(spawn)}.png`;
const urlVeiculo = (spawn: string) => `${R2}/game/garage/${encodeURIComponent(spawn)}.png`;

const vars = (o: Record<string, string | number>) => o as CSSProperties;
const atraso = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });
const movimentoReduzido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const num = (n: number) => n.toLocaleString("pt-BR");

type Item = { spawn: string; qtd: number };
type Gaveta = "garagem" | "mochila";

/** Conta do valor mostrado até o novo, desacelerando no final. */
function useContador(alvo: number, duracao = 1100) {
  const [v, setV] = useState(0);
  const atual = useRef(0);
  useEffect(() => {
    if (movimentoReduzido()) {
      atual.current = alvo;
      setV(alvo);
      return;
    }
    const de = atual.current;
    let raf = 0;
    const ini = performance.now();
    const passo = (t: number) => {
      const x = Math.min(1, (t - ini) / duracao);
      const valor = de + (alvo - de) * (1 - Math.pow(1 - x, 4));
      atual.current = valor;
      setV(valor);
      if (x < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracao]);
  return v;
}

/** Fica verdadeiro um instante depois de montar (para as barras e anéis encherem). */
function useAposMontar(ms: number) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPronto(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return pronto;
}

/**
 * Mouse → inclinação da cena dos painéis (um só requestAnimationFrame, que para quando
 * assenta). Desligado no toque e com "reduzir movimento". A malha de holograma do fundo
 * acompanha o mouse por conta própria.
 */
function useParallax(
  area: RefObject<HTMLDivElement | null>,
  cena: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const el = area.current;
    if (!el || movimentoReduzido()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let alvoX = 0;
    let alvoY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    const quadro = () => {
      x += (alvoX - x) * 0.07;
      y += (alvoY - y) * 0.07;
      const c = cena.current;
      if (c) {
        c.style.transform = `rotateX(${(3 - y * 3.2).toFixed(3)}deg) rotateY(${(x * 4.5).toFixed(3)}deg)`;
      }
      raf = Math.abs(alvoX - x) + Math.abs(alvoY - y) < 0.0008 ? 0 : requestAnimationFrame(quadro);
    };
    const mover = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      alvoX = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      alvoY = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      if (!raf) raf = requestAnimationFrame(quadro);
    };
    const sair = () => {
      alvoX = 0;
      alvoY = 0;
      if (!raf) raf = requestAnimationFrame(quadro);
    };
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerleave", sair);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerleave", sair);
    };
  }, [area, cena]);
}

type Fase = "fechado" | "aberto" | "fechando";

function lerAberta(chave: string) {
  try {
    return localStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}

function gravarAberta(chave: string, aberta: boolean) {
  try {
    localStorage.setItem(chave, aberta ? "1" : "0");
  } catch {
    // navegador sem armazenamento: só não lembra da próxima vez
  }
}

/**
 * Garagem e mochila abrem e fecham com animação e lembram como o usuário deixou.
 * `inicio` fica verdadeiro até o primeiro clique: assim a primeira aparição usa a
 * entrada do modal, e as seguintes usam a animação de abrir/ligar.
 */
function useGaveta(chave: string) {
  const [estado, setEstado] = useState<{ fase: Fase; inicio: boolean }>(() => ({
    fase: lerAberta(chave) ? "aberto" : "fechado",
    inicio: true,
  }));
  useEffect(() => {
    if (estado.fase !== "fechando") return;
    const t = setTimeout(() => setEstado({ fase: "fechado", inicio: false }), 240);
    return () => clearTimeout(t);
  }, [estado.fase]);
  const abrir = useCallback(() => {
    setEstado({ fase: "aberto", inicio: false });
    gravarAberta(chave, true);
  }, [chave]);
  const fechar = useCallback(() => {
    setEstado((e) => (e.fase === "aberto" ? { fase: "fechando", inicio: false } : e));
    gravarAberta(chave, false);
  }, [chave]);
  const alternar = useCallback(() => {
    if (estado.fase === "fechado") abrir();
    else if (estado.fase === "aberto") fechar();
  }, [estado.fase, abrir, fechar]);
  return { ...estado, abrir, fechar, alternar };
}

export function CopyBtn({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(false), 1200);
    return () => clearTimeout(t);
  }, [ok]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void copiarTexto(value).then((deu) => {
          if (deu) setOk(true);
        });
      }}
      aria-label={`Copiar ${label}`}
      title={`Copiar ${label}`}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-white/[0.07] hover:text-foreground",
        className,
      )}
    >
      {ok ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/** Marca HOST padrão, usada no lugar da foto de perfil. */
export function HostAvatar({ className, logo = "h-[42%]" }: { className?: string; logo?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.05]",
        className,
      )}
    >
      <Logo className={logo} />
    </span>
  );
}

/** Foto do item ou do carro; se não existir, mostra o ícone no lugar. */
function Imagem({ src, fallback: Icon }: { src: string; fallback: LucideIcon }) {
  const [erro, setErro] = useState(false);
  if (erro) return <Icon className="size-6 text-white/30" strokeWidth={1.3} />;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setErro(true)}
    />
  );
}

/** Ícone de traço fino dentro de um círculo de vidro. */
function Icone({
  icone: Icon,
  vermelho,
  pequeno,
}: {
  icone: LucideIcon;
  vermelho?: boolean | undefined;
  pequeno?: boolean | undefined;
}) {
  return (
    <span className={cn("inv-ico", pequeno && "inv-ico-sm", vermelho && "inv-ico-vermelho")}>
      <Icon className={pequeno ? "size-[13px]" : "size-[15px]"} strokeWidth={1.5} />
    </span>
  );
}

function Coin3D({ size = 32 }: { size?: number }) {
  const camadas = 6;
  return (
    <div style={{ width: size, height: size, perspective: 500 }} className="shrink-0">
      <div
        className="relative size-full"
        style={{ transformStyle: "preserve-3d", animation: "host-coin-spin 5s linear infinite" }}
      >
        {Array.from({ length: camadas }, (_, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full bg-[#7a0808]"
            style={{ transform: `translateZ(${(i - camadas / 2) * 0.6}px)` }}
          />
        ))}
        {[0, 180].map((rot) => (
          <div
            key={rot}
            className="absolute inset-0 grid place-items-center rounded-full"
            style={{
              transform: `rotateY(${rot}deg) translateZ(${(camadas / 2) * 0.6}px)`,
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

/** Avatar HOST dentro de um anel que mostra o progresso do level. */
function AvatarNivel({ level }: { level: number }) {
  const id = `inv-nivel-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const pronto = useAposMontar(420);
  const pct = pronto ? Math.min(1, Math.max(0, level / LEVEL_MAX)) : 0;
  return (
    <span className="relative grid size-[78px] shrink-0 place-items-center">
      <span className="inv-avatar-orbita" aria-hidden />
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff7a6c" />
            <stop offset="1" stopColor="#ce0e0e" />
          </linearGradient>
        </defs>
        <circle
          cx="40"
          cy="40"
          r="37"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="2"
        />
        <circle
          cx="40"
          cy="40"
          r="37"
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct * 100} 100`}
          style={{ transition: "stroke-dasharray 1200ms cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <HostAvatar className="size-[60px] bg-black/50" />
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[#e5231b] px-1.5 py-px font-display text-[10px] font-bold text-white tabular-nums shadow-[0_0_12px_rgba(229,35,27,0.5)]">
        LV {level}
      </span>
    </span>
  );
}

function Bloco({
  icone: Icon,
  titulo,
  contagem,
  indice,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  contagem?: number;
  indice: number;
  children: ReactNode;
}) {
  return (
    <section
      className="pf-sobe rounded-[20px] border border-white/[0.06] bg-white/[0.025] px-4 pb-3 pt-3.5"
      style={atraso(500 + indice * 80)}
    >
      <h3 className="mb-1.5 flex items-center gap-2 font-display text-[13.5px] font-semibold text-white">
        <Icon className="size-3.5 text-white/45" strokeWidth={1.6} />
        {titulo}
        {contagem !== undefined && (
          <span className="text-[11px] font-normal text-white/40 tabular-nums">{contagem}</span>
        )}
      </h3>
      {children}
    </section>
  );
}

function MiniTile({
  topo,
  valor,
  rotulo,
  indice,
}: {
  topo: ReactNode;
  valor: string;
  rotulo: string;
  indice: number;
}) {
  return (
    <div
      className="inv-tile pf-pop !flex-row items-center gap-3 !py-2.5"
      style={atraso(420 + indice * 70)}
    >
      <span className="grid size-[30px] shrink-0 place-items-center">{topo}</span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[15px] font-semibold leading-tight text-white tabular-nums">
          {valor}
        </span>
        <span className="block text-[11px] text-white/45">{rotulo}</span>
      </span>
    </div>
  );
}

function PerfilPainel({ p, coins }: { p: Player; coins: number }) {
  const linhas: { icone: LucideIcon; k: string; v: string; copiar?: boolean }[] = [
    { icone: Cake, k: "Idade", v: p.idade != null ? `${p.idade} anos` : "—" },
    { icone: Phone, k: "Telefone", v: p.telefone ?? "—", copiar: true },
    {
      icone: AtSign,
      k: "Discord",
      v: p.discord_nome ? `@${p.discord_nome}` : (p.discord_id ?? "—"),
      copiar: true,
    },
    { icone: KeyRound, k: "License", v: p.license || "—", copiar: true },
    {
      icone: Clock,
      k: "Último login",
      v: p.ultimo_login ? new Date(p.ultimo_login).toLocaleDateString("pt-BR") : "—",
    },
  ];
  return (
    <section
      aria-label={`Perfil de ${p.nome || "player"}`}
      className="inv-painel inv-esq inv-entra-esq"
      style={atraso(120)}
    >
      <div className="inv-rolagem inv-perfil-rolagem flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
        <div className="flex items-center gap-4">
          <AvatarNivel level={p.level} />
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                p.online
                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                  : "border-white/10 bg-white/[0.04] text-white/55",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  p.online ? "animate-pulse bg-emerald-400" : "bg-white/30",
                )}
              />
              {p.online ? "Online" : "Offline"}
            </span>
            <h2 className="mt-1.5 truncate font-display text-[19px] font-semibold leading-tight text-white">
              {p.nome || "Sem nome"}
              {p.passaporte && (
                <span className="ml-1.5 font-normal text-white/40">#{p.passaporte}</span>
              )}
            </h2>
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-xs",
                p.rank_vip ? "text-amber-200" : "text-white/50",
              )}
            >
              <Crown className="size-3" strokeWidth={1.6} /> {p.rank_vip ?? "Sem VIP"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniTile
            indice={0}
            topo={<Icone icone={Wallet} />}
            valor={brl(p.carteira)}
            rotulo="Carteira"
          />
          <MiniTile
            indice={1}
            topo={<Coin3D size={28} />}
            valor={num(Math.round(coins))}
            rotulo="HOST Coins"
          />
        </div>

        <Bloco icone={IdCard} titulo="Identificação" indice={0}>
          <dl>
            {linhas.map((l) => (
              <div
                key={l.k}
                className="flex h-[38px] items-center gap-2.5 border-t border-white/[0.05] text-[12.5px] first:border-t-0"
              >
                <Icone icone={l.icone} pequeno />
                <dt className="shrink-0 text-white/50">{l.k}</dt>
                <dd className="ml-auto min-w-0 truncate text-white/90 tabular-nums" title={l.v}>
                  {l.v}
                </dd>
                {l.copiar && l.v !== "—" && <CopyBtn value={l.v} label={l.k} className="-mr-1.5" />}
              </div>
            ))}
          </dl>
        </Bloco>

        <Bloco icone={Users} titulo="Grupos" contagem={p.grupos.length} indice={1}>
          <div className="mt-1 flex flex-wrap gap-1.5 pb-1">
            {p.grupos.map((g) => (
              <span
                key={g}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] py-1 pl-2 pr-2.5 text-[11.5px] text-white/85 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
              >
                <Shield className="size-3 text-white/35" strokeWidth={1.6} />
                {g}
              </span>
            ))}
            {p.grupos.length === 0 && <span className="text-xs text-white/40">Sem grupos.</span>}
          </div>
        </Bloco>
      </div>
    </section>
  );
}

/** Painel de rank: level, K/D e todos os números de combate, grandes e com ícones. */
function RankPainel({ p }: { p: Player }) {
  const pronto = useAposMontar(650);
  const hs = p.kills ? Math.round((p.headshots / p.kills) * 100) : 0;
  const pct = Math.min(1, Math.max(0, p.level / LEVEL_MAX));
  const metricas: {
    icone: LucideIcon;
    rotulo: string;
    valor: string;
    extra?: string;
    barra?: number;
    vermelho?: boolean;
  }[] = [
    { icone: Crosshair, rotulo: "Kills", valor: num(p.kills), vermelho: true },
    { icone: Skull, rotulo: "Mortes", valor: num(p.mortes) },
    { icone: Target, rotulo: "Headshots", valor: num(p.headshots), extra: `${hs}%`, barra: hs },
    { icone: Flame, rotulo: "Maior sequência", valor: num(p.maior_sequencia) },
    { icone: Sparkles, rotulo: "XP", valor: num(p.xp) },
  ];
  return (
    <section aria-label="Rank" className="inv-painel inv-meio inv-entra-baixo" style={atraso(300)}>
      <header className="flex h-[62px] shrink-0 items-center gap-3 px-5">
        <span className="inv-ico-tile">
          <Medal className="size-[17px]" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] font-semibold leading-tight text-white">Rank</h3>
          <p className="truncate text-[11px] text-white/45">Level, K/D e combate</p>
        </div>
        <span className={cn("inv-pilula", p.rank_vip && "inv-pilula-vip")}>
          <Crown className="size-3" strokeWidth={1.6} />
          {p.rank_vip ?? "Sem VIP"}
        </span>
      </header>
      <div className="inv-rolagem flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="inv-tile pf-pop" style={atraso(420)}>
            <span className="flex items-center gap-2.5 text-[12px] text-white/55">
              <Icone icone={Trophy} /> Level
            </span>
            <p className="mt-3 font-display text-[34px] font-semibold leading-none text-white tabular-nums">
              {p.level}
              <span className="ml-1.5 text-[15px] font-medium text-white/35">/ {LEVEL_MAX}</span>
            </p>
            <span className="inv-barra mt-3">
              <span style={{ width: `${pronto ? pct * 100 : 0}%` }} />
            </span>
            <p className="mt-2 text-[11px] text-white/40">
              {(pct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do level máximo
            </p>
          </div>
          <div className="inv-tile pf-pop" style={atraso(480)}>
            <span className="flex items-center gap-2.5 text-[12px] text-white/55">
              <Icone icone={Swords} vermelho /> K/D
            </span>
            <p className="mt-3 font-display text-[34px] font-semibold leading-none text-white tabular-nums">
              {kd(p).toFixed(2)}
            </p>
            <p className="mt-auto pt-3 text-[11px] text-white/40 tabular-nums">
              {num(p.kills)} kills · {num(p.mortes)} mortes
            </p>
          </div>
        </div>
        <div className="grid flex-1 auto-rows-[minmax(104px,1fr)] grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-3">
          {metricas.map((m, i) => (
            <div
              key={m.rotulo}
              className={cn("inv-tile pf-pop", i === metricas.length - 1 && "max-sm:col-span-2")}
              style={atraso(540 + i * 60)}
            >
              <Icone icone={m.icone} vermelho={m.vermelho} />
              <p className="mt-auto pt-3 font-display text-[26px] font-semibold leading-none text-white tabular-nums">
                {m.valor}
                {m.extra && (
                  <span className="ml-1 text-[12px] font-medium text-white/45">· {m.extra}</span>
                )}
              </p>
              <p className="mt-1.5 truncate text-[11px] text-white/45">{m.rotulo}</p>
              {m.barra !== undefined && (
                <span className="inv-barra mt-2">
                  <span style={{ width: `${pronto ? m.barra : 0}%` }} />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CabecalhoPainel({
  icone: Icon,
  titulo,
  info,
  rotuloIcone,
  onIcone,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  info: string;
  rotuloIcone: string;
  onIcone: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 px-4">
      <button
        type="button"
        onClick={onIcone}
        aria-label={rotuloIcone}
        title={rotuloIcone}
        className="inv-ico-tile"
      >
        <Icon className="size-[17px]" strokeWidth={1.5} />
      </button>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-[15px] font-semibold leading-tight text-white">
          {titulo}
        </h3>
        <p className="truncate text-[11px] text-white/45 tabular-nums">{info}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">{children}</div>
    </header>
  );
}

function Busca({
  valor,
  onChange,
  rotulo,
  className,
}: {
  valor: string;
  onChange: (v: string) => void;
  rotulo: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inv-busca flex h-8 items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 transition-colors focus-within:border-white/25",
        className,
      )}
    >
      <Search className="size-3 shrink-0 text-white/40" />
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar"
        aria-label={rotulo}
        className="w-full min-w-0 bg-transparent text-xs text-white outline-none placeholder:text-white/35"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className="shrink-0 text-white/40 transition-colors hover:text-white"
        >
          <X className="size-3" />
        </button>
      )}
    </label>
  );
}

function BotaoIcone({
  icone: Icon,
  rotulo,
  onClick,
}: {
  icone: LucideIcon;
  rotulo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      className="grid size-8 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white"
    >
      <Icon className="size-4" strokeWidth={1.6} />
    </button>
  );
}

/** Garagem ou mochila fechada: um holograma pequeno, com as primeiras fotos girando. */
function Lancador({
  icone: Icon,
  titulo,
  resumo,
  acao,
  atalho,
  previas,
  largo,
  classe,
  style,
  onAbrir,
}: {
  icone: LucideIcon;
  titulo: string;
  resumo: string;
  acao: string;
  atalho: string;
  previas: string[];
  largo?: boolean;
  classe?: string | undefined;
  style?: CSSProperties | undefined;
  onAbrir: () => void;
}) {
  const n = previas.length;
  return (
    <button
      type="button"
      onClick={onAbrir}
      data-som-passar
      aria-label={`${acao}: ${resumo}`}
      aria-keyshortcuts={atalho}
      className={cn("inv-painel inv-dir inv-lancador", classe)}
      style={style}
    >
      <span className="inv-holo-palco" aria-hidden>
        <span className="inv-holo">
          <span className="inv-holo-base">
            <svg viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="47"
                fill="none"
                stroke="rgba(255,255,255,0.32)"
                strokeWidth="0.7"
                strokeDasharray="1.5 4.5"
              />
              <circle
                cx="50"
                cy="50"
                r="34"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="0.6"
              />
            </svg>
          </span>
          <span className="inv-holo-cone" />
          {n > 0 && (
            <span className="inv-orbita">
              {previas.map((src, i) => (
                <span
                  key={`${src}-${i}`}
                  className={cn(
                    "inv-orbita-item",
                    largo ? "inv-orbita-largo" : "inv-orbita-quadrado",
                  )}
                  style={vars({ "--i": i, "--n": n })}
                >
                  <span>
                    <Imagem src={src} fallback={Icon} />
                  </span>
                </span>
              ))}
            </span>
          )}
          <span className="inv-holo-icone">
            <span className="inv-holo-anel" />
            <Icon strokeWidth={1.1} />
          </span>
        </span>
      </span>
      <span className="inv-lancador-texto">
        <span className="font-display text-[17px] font-semibold text-white">{titulo}</span>
        <span className="mt-0.5 text-[11.5px] text-white/50 tabular-nums">{resumo}</span>
        <span className="inv-lancador-botao">
          <Icon className="size-[15px]" strokeWidth={1.6} />
          {acao}
          <kbd>{atalho}</kbd>
        </span>
      </span>
    </button>
  );
}

function CarroCard({ spawn, indice, grande }: { spawn: string; indice: number; grande?: boolean }) {
  return (
    <li
      className={cn("inv-carro pf-pop", grande && "inv-carro-grande")}
      style={atraso(Math.min(indice, 18) * 26 + (grande ? 140 : 180))}
    >
      <span className="inv-carro-foto">
        <Imagem src={urlVeiculo(spawn)} fallback={CarFront} />
      </span>
      <span className="flex items-center gap-1 pb-1.5 pl-3 pr-1.5">
        <span className="min-w-0 flex-1 truncate text-[12px] text-white/90" title={spawn}>
          {spawn}
        </span>
        <CopyBtn value={spawn} label={`spawn ${spawn}`} />
      </span>
    </li>
  );
}

function GaragemPainel({
  veiculos,
  busca,
  setBusca,
  classe,
  style,
  onRecolher,
  onExpandir,
}: {
  veiculos: string[];
  busca: string;
  setBusca: (v: string) => void;
  classe?: string | undefined;
  style?: CSSProperties | undefined;
  onRecolher: () => void;
  onExpandir: () => void;
}) {
  const q = busca.trim().toLowerCase();
  const lista = q ? veiculos.filter((v) => v.toLowerCase().includes(q)) : veiculos;
  const n = veiculos.length;
  return (
    <section aria-label="Garagem" className={cn("inv-painel inv-dir", classe)} style={style}>
      <span className="inv-flash" aria-hidden />
      <CabecalhoPainel
        icone={CarFront}
        titulo="Garagem"
        info={`${n} ${n === 1 ? "veículo" : "veículos"}`}
        rotuloIcone="Recolher garagem"
        onIcone={onRecolher}
      >
        <BotaoIcone icone={Maximize2} rotulo="Expandir garagem" onClick={onExpandir} />
        <BotaoIcone icone={Minus} rotulo="Recolher garagem" onClick={onRecolher} />
      </CabecalhoPainel>
      <div className="shrink-0 px-4 pb-3">
        <Busca valor={busca} onChange={setBusca} rotulo="Buscar na garagem" />
      </div>
      <ul className="inv-rolagem grid min-h-0 flex-1 auto-rows-max grid-cols-2 content-start gap-2 overflow-y-auto px-4 pb-4">
        {lista.map((v, i) => (
          <CarroCard key={`${v}-${i}`} spawn={v} indice={i} />
        ))}
        {lista.length === 0 && (
          <li className="col-span-full py-10 text-center text-xs text-white/40">
            {n === 0 ? "Nenhum veículo na garagem." : "Nada encontrado."}
          </li>
        )}
      </ul>
    </section>
  );
}

const ROTULO_TIPO: Record<ItemTipo, string> = {
  arma: "Arma",
  municao: "Munição",
  eletronico: "Eletrônico",
  outro: "Item",
};

function Slot({ item, indice, grande }: { item: Item; indice: number; grande?: boolean }) {
  const tipo = itemTipo(item.spawn);
  return (
    <li
      title={item.spawn}
      data-tipo={tipo}
      className={cn("inv-slot pf-pop", grande && "inv-slot-grande")}
      style={atraso(Math.min(indice, 24) * 22 + (grande ? 140 : 180))}
    >
      <span className="inv-slot-qtd">{num(item.qtd)}x</span>
      <CopyBtn
        value={item.spawn}
        label={`spawn ${item.spawn}`}
        className="inv-slot-copiar size-6 rounded-md"
      />
      <span className="inv-slot-foto">
        <Imagem src={urlItem(item.spawn)} fallback={Package} />
      </span>
      <span className="inv-slot-nome">{item.spawn}</span>
      {grande && <span className="inv-slot-tipo">{ROTULO_TIPO[tipo]}</span>}
    </li>
  );
}

function MochilaPainel({
  itens,
  resumo,
  busca,
  setBusca,
  classe,
  style,
  onRecolher,
  onExpandir,
}: {
  itens: Item[];
  resumo: string;
  busca: string;
  setBusca: (v: string) => void;
  classe?: string | undefined;
  style?: CSSProperties | undefined;
  onRecolher: () => void;
  onExpandir: () => void;
}) {
  const q = busca.trim().toLowerCase();
  const lista = q ? itens.filter((i) => i.spawn.toLowerCase().includes(q)) : itens;
  const vazios = q ? 0 : Math.max(12, Math.ceil(lista.length / 3) * 3) - lista.length;
  return (
    <section aria-label="Mochila" className={cn("inv-painel inv-dir", classe)} style={style}>
      <span className="inv-flash" aria-hidden />
      <CabecalhoPainel
        icone={Backpack}
        titulo="Mochila"
        info={resumo}
        rotuloIcone="Recolher mochila"
        onIcone={onRecolher}
      >
        <BotaoIcone icone={Maximize2} rotulo="Expandir mochila" onClick={onExpandir} />
        <BotaoIcone icone={Minus} rotulo="Recolher mochila" onClick={onRecolher} />
      </CabecalhoPainel>
      <div className="shrink-0 px-4 pb-3">
        <Busca valor={busca} onChange={setBusca} rotulo="Buscar na mochila" />
      </div>
      <ul className="inv-rolagem grid min-h-0 flex-1 auto-rows-max grid-cols-3 content-start gap-2 overflow-y-auto px-4 pb-4">
        {lista.length === 0 && (
          <li className="col-span-full py-6 text-center text-xs text-white/40">
            {itens.length === 0 ? "Mochila vazia." : "Nada encontrado."}
          </li>
        )}
        {lista.map((item, i) => (
          <Slot key={item.spawn} item={item} indice={i} />
        ))}
        {Array.from({ length: vazios }, (_, i) => (
          <li key={`vazio-${i}`} className="inv-slot inv-slot-vazio" aria-hidden />
        ))}
      </ul>
    </section>
  );
}

const FILTROS: { id: ItemTipo | "todos"; rotulo: string }[] = [
  { id: "todos", rotulo: "Tudo" },
  { id: "arma", rotulo: "Armas" },
  { id: "municao", rotulo: "Munição" },
  { id: "eletronico", rotulo: "Eletrônicos" },
  { id: "outro", rotulo: "Outros" },
];

/** Janela grande por cima do palco (garagem ou mochila expandida). */
function Janela({
  icone: Icon,
  titulo,
  info,
  saindo,
  onRecolher,
  ferramentas,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  info: string;
  saindo: boolean;
  onRecolher: () => void;
  ferramentas: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn("inv-exp-fundo", saindo && "inv-exp-saindo")} onClick={onRecolher}>
      <section
        aria-label={`${titulo} expandida`}
        className="inv-exp"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-3 px-5 pb-4 pt-5">
          <span className="inv-ico-tile">
            <Icon className="size-[17px]" strokeWidth={1.5} />
          </span>
          <div className="mr-auto min-w-0">
            <h3 className="font-display text-[17px] font-semibold leading-tight text-white">
              {titulo}
            </h3>
            <p className="text-[11.5px] text-white/50 tabular-nums">{info}</p>
          </div>
          {ferramentas}
          <button type="button" onClick={onRecolher} className="inv-botao-claro">
            <Minimize2 className="size-3.5" strokeWidth={2} />
            Recolher
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function MochilaExpandida({
  itens,
  unidades,
  busca,
  setBusca,
  saindo,
  onRecolher,
}: {
  itens: Item[];
  unidades: number;
  busca: string;
  setBusca: (v: string) => void;
  saindo: boolean;
  onRecolher: () => void;
}) {
  const [tipo, setTipo] = useState<ItemTipo | "todos">("todos");
  const contagem = useMemo(() => {
    const c: Record<ItemTipo | "todos", number> = {
      todos: itens.length,
      arma: 0,
      municao: 0,
      eletronico: 0,
      outro: 0,
    };
    for (const i of itens) c[itemTipo(i.spawn)]++;
    return c;
  }, [itens]);
  const q = busca.trim().toLowerCase();
  const lista = itens.filter(
    (i) =>
      (tipo === "todos" || itemTipo(i.spawn) === tipo) && (!q || i.spawn.toLowerCase().includes(q)),
  );
  const vazios =
    q || tipo !== "todos" ? 0 : Math.max(32, Math.ceil(lista.length / 8) * 8) - lista.length;
  return (
    <Janela
      icone={Backpack}
      titulo="Mochila"
      info={`${itens.length} ${itens.length === 1 ? "item" : "itens"} · ${num(unidades)} unidades`}
      saindo={saindo}
      onRecolher={onRecolher}
      ferramentas={
        <>
          <div className="segmentos max-w-full overflow-x-auto">
            {FILTROS.filter((f) => f.id === "todos" || contagem[f.id] > 0).map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={tipo === f.id}
                onClick={() => setTipo(f.id)}
              >
                {f.rotulo}
                <span className="tabular-nums opacity-60">{contagem[f.id]}</span>
              </button>
            ))}
          </div>
          <Busca
            valor={busca}
            onChange={setBusca}
            rotulo="Buscar na mochila"
            className="w-full sm:w-56"
          />
        </>
      }
    >
      <ul className="inv-rolagem grid min-h-0 flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(128px,1fr))] content-start gap-3 overflow-y-auto px-5 pb-5">
        {lista.length === 0 && (
          <li className="col-span-full py-16 text-center text-sm text-white/40">
            Nada encontrado.
          </li>
        )}
        {lista.map((item, i) => (
          <Slot key={item.spawn} item={item} indice={i} grande />
        ))}
        {Array.from({ length: vazios }, (_, i) => (
          <li key={`vazio-${i}`} className="inv-slot inv-slot-grande inv-slot-vazio" aria-hidden />
        ))}
      </ul>
    </Janela>
  );
}

function GaragemExpandida({
  veiculos,
  busca,
  setBusca,
  saindo,
  onRecolher,
}: {
  veiculos: string[];
  busca: string;
  setBusca: (v: string) => void;
  saindo: boolean;
  onRecolher: () => void;
}) {
  const q = busca.trim().toLowerCase();
  const lista = q ? veiculos.filter((v) => v.toLowerCase().includes(q)) : veiculos;
  const n = veiculos.length;
  return (
    <Janela
      icone={CarFront}
      titulo="Garagem"
      info={`${n} ${n === 1 ? "veículo" : "veículos"}`}
      saindo={saindo}
      onRecolher={onRecolher}
      ferramentas={
        <Busca
          valor={busca}
          onChange={setBusca}
          rotulo="Buscar na garagem"
          className="w-full sm:w-64"
        />
      }
    >
      <ul className="inv-rolagem grid min-h-0 flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(190px,1fr))] content-start gap-3 overflow-y-auto px-5 pb-5">
        {lista.map((v, i) => (
          <CarroCard key={`${v}-${i}`} spawn={v} indice={i} grande />
        ))}
        {lista.length === 0 && (
          <li className="col-span-full py-16 text-center text-sm text-white/40">
            {n === 0 ? "Nenhum veículo na garagem." : "Nada encontrado."}
          </li>
        )}
      </ul>
    </Janela>
  );
}

export function PlayerInventario({ player: p, onClose }: { player: Player; onClose: () => void }) {
  const [saindo, setSaindo] = useState(false);
  const fechar = useCallback(() => setSaindo(true), []);
  const raizRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<HTMLDivElement>(null);
  useParallax(conteudoRef, cenaRef);

  const garagem = useGaveta("host-inv-garagem");
  const mochila = useGaveta("host-inv-mochila");
  const [expandido, setExpandido] = useState<{ tipo: Gaveta; saindo: boolean } | null>(null);
  const [buscaGaragem, setBuscaGaragem] = useState("");
  const [buscaMochila, setBuscaMochila] = useState("");
  const recolher = useCallback(
    () => setExpandido((e) => (e && !e.saindo ? { ...e, saindo: true } : e)),
    [],
  );

  useEffect(() => {
    if (!saindo) return;
    const t = setTimeout(onClose, 210);
    return () => clearTimeout(t);
  }, [saindo, onClose]);

  useEffect(() => {
    if (!expandido?.saindo) return;
    const t = setTimeout(() => setExpandido(null), 230);
    return () => clearTimeout(t);
  }, [expandido]);

  // trava a rolagem da página por trás e leva o foco para o modal
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    raizRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc fecha (primeiro a janela expandida); G e M abrem e fecham garagem e mochila
  const { alternar: alternarGaragem } = garagem;
  const { alternar: alternarMochila } = mochila;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (expandido) recolher();
        else fechar();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || expandido) return;
      const alvo = e.target;
      if (
        alvo instanceof HTMLElement &&
        (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))
      )
        return;
      const k = e.key.toLowerCase();
      if (k === "g") alternarGaragem();
      else if (k === "m") alternarMochila();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandido, recolher, fechar, alternarGaragem, alternarMochila]);

  // Mesmo spawn com seriais diferentes vira um item só.
  const itens = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of p.inventario) {
      const s = itemBase(i.item);
      m.set(s, (m.get(s) ?? 0) + i.qtd);
    }
    return [...m].map(([spawn, qtd]) => ({ spawn, qtd }));
  }, [p.inventario]);
  const unidades = useMemo(() => itens.reduce((s, i) => s + i.qtd, 0), [itens]);

  const saldo = useContador(p.banco);
  const coins = useContador(p.host_coins);

  const nVeiculos = p.veiculos.length;
  const resumoGaragem =
    nVeiculos === 0 ? "Nenhum veículo" : `${nVeiculos} ${nVeiculos === 1 ? "veículo" : "veículos"}`;
  const resumoMochila =
    itens.length === 0
      ? "Mochila vazia"
      : `${itens.length} ${itens.length === 1 ? "item" : "itens"} · ${num(unidades)} un.`;
  const classeGaveta = (g: ReturnType<typeof useGaveta>) =>
    g.fase === "fechando" ? "inv-fecha" : g.inicio ? "inv-entra-dir" : "inv-abre";

  // Vai direto no <body>, como as outras janelas: fica por cima de tudo (até do HOKI flutuante).
  return createPortal(
    <div
      ref={raizRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Perfil de ${p.nome || "player"}`}
      className={cn("inv-raiz outline-none", saindo && "inv-saindo")}
    >
      <div className="inv-veu" onClick={fechar} />
      <div className="inv-palco">
        <InventarioFundo />

        <div ref={conteudoRef} className="inv-conteudo">
          <header className="inv-topo">
            <span className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.28em] text-white/45">
              <span className="size-1.5 rounded-full bg-[#e5231b] shadow-[0_0_10px_#e5231b]" />
              <span className="hidden sm:inline">Inventário do player</span>
            </span>
            <Logo className="absolute left-1/2 top-1/2 h-6 -translate-x-1/2 -translate-y-1/2 [&_path]:fill-white" />
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              title="Fechar (Esc)"
              className="ml-auto grid size-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/70 transition-all duration-200 hover:rotate-90 hover:text-white"
            >
              <X className="size-4" strokeWidth={1.6} />
            </button>
          </header>

          <div ref={cenaRef} className="inv-cena">
            <div className="inv-grade">
              <div className="inv-coluna">
                <PerfilPainel p={p} coins={coins} />
              </div>

              <div className="inv-coluna inv-col-centro">
                <CartaoBancoHost
                  p={p}
                  saldo={saldo}
                  coins={coins}
                  className="inv-entra-cartao"
                  style={atraso(200)}
                />
                <div className="inv-slot-rank">
                  <RankPainel p={p} />
                </div>
              </div>

              <div className="inv-coluna inv-col-direita">
                <div className="inv-gaveta" data-aberta={garagem.fase === "aberto"}>
                  {garagem.fase === "fechado" ? (
                    <Lancador
                      icone={CarFront}
                      titulo="Garagem"
                      resumo={resumoGaragem}
                      acao="Abrir garagem"
                      atalho="G"
                      previas={p.veiculos.slice(0, 5).map(urlVeiculo)}
                      largo
                      classe={garagem.inicio ? "inv-entra-dir" : "inv-liga"}
                      style={garagem.inicio ? atraso(160) : undefined}
                      onAbrir={garagem.abrir}
                    />
                  ) : (
                    <GaragemPainel
                      veiculos={p.veiculos}
                      busca={buscaGaragem}
                      setBusca={setBuscaGaragem}
                      classe={classeGaveta(garagem)}
                      style={garagem.inicio ? atraso(160) : undefined}
                      onRecolher={garagem.fechar}
                      onExpandir={() => setExpandido({ tipo: "garagem", saindo: false })}
                    />
                  )}
                </div>
                <div className="inv-gaveta" data-aberta={mochila.fase === "aberto"}>
                  {mochila.fase === "fechado" ? (
                    <Lancador
                      icone={Backpack}
                      titulo="Mochila"
                      resumo={resumoMochila}
                      acao="Abrir mochila"
                      atalho="M"
                      previas={itens.slice(0, 6).map((i) => urlItem(i.spawn))}
                      classe={mochila.inicio ? "inv-entra-dir" : "inv-liga"}
                      style={mochila.inicio ? atraso(240) : undefined}
                      onAbrir={mochila.abrir}
                    />
                  ) : (
                    <MochilaPainel
                      itens={itens}
                      resumo={resumoMochila}
                      busca={buscaMochila}
                      setBusca={setBuscaMochila}
                      classe={classeGaveta(mochila)}
                      style={mochila.inicio ? atraso(240) : undefined}
                      onRecolher={mochila.fechar}
                      onExpandir={() => setExpandido({ tipo: "mochila", saindo: false })}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <footer className="inv-rodape" aria-hidden>
            <span>
              <kbd>G</kbd> Garagem
            </span>
            <span>
              <kbd>M</kbd> Mochila
            </span>
            <span>
              <kbd>Esc</kbd> Fechar
            </span>
          </footer>
        </div>

        {expandido?.tipo === "mochila" && (
          <MochilaExpandida
            itens={itens}
            unidades={unidades}
            busca={buscaMochila}
            setBusca={setBuscaMochila}
            saindo={expandido.saindo}
            onRecolher={recolher}
          />
        )}
        {expandido?.tipo === "garagem" && (
          <GaragemExpandida
            veiculos={p.veiculos}
            busca={buscaGaragem}
            setBusca={setBuscaGaragem}
            saindo={expandido.saindo}
            onRecolher={recolher}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
