import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as PonteiroReact,
  type ReactNode,
} from "react";
import {
  Apple,
  Droplet,
  Heart,
  LogOut,
  MousePointerClick,
  Shield,
  Sunrise,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { ROLE_LABELS, useMyRole } from "@/lib/permissions";
import { useSouVisita } from "@/lib/hoki-visita";
import type { SeloDaPlaquinha } from "@/lib/fazenda/selos";
import { BANNER_PADRAO, useMeuPerfil } from "@/components/perfil/perfil-cartao";
import { Hoki2D } from "./hoki-2d";
import { Quadro, TONS } from "./hud-jogador";
import {
  ABAS_ONLINE,
  naAbaOnline,
  ondeEstaOnline,
  type AbaOnline,
  type PessoaOnlineAgora,
} from "./online-agora";
import { criarNomePontilhado, type NomePontilhado } from "./nome-pontilhado";

/**
 * Tela de entrada do HOKI (a praça só abre depois de acordar):
 *
 * - em cima, a ilha de verdade flutuando (é o próprio motor da praça, com o fundo transparente:
 *   dá para ver quem está andando por lá) na frente do nome escrito em pontinhos;
 * - ao lado, o meu perfil, o botão "Acordar agora" e as barras do meu HOKI;
 * - embaixo, quem está online, em células.
 *
 * O `palco` (o quadro da praça) fica sempre no mesmo lugar da árvore do React: na entrada ele é a
 * ilha flutuando; acordado, ocupa a tela toda (por isso a praça não é montada de novo).
 *
 * Movimento: a ilha inclina com o ponteiro e o nome anda ao contrário; os pontinhos acendem em
 * vermelho; as células entram em fila, sobem e ganham um brilho que segue o mouse; rolando a
 * página (--rol de 0 a 1) a parte de cima se afasta e o nome se desmancha.
 */
export function InicioDoHoki({
  mostrar,
  palcoCheio,
  palco,
  nivel,
  corNivel,
  aoEntrar,
  fome,
  sede,
  energia,
  higiene,
  vida = 100,
  onComer,
  onBeber,
  onDescansar,
  pessoas,
  selos,
  onPessoa,
}: {
  /** Mostra a tela de entrada (falso = só o palco, com a praça aberta). */
  mostrar: boolean;
  /** O palco está ocupando a tela toda (a praça abriu ou está abrindo/fechando por cima). */
  palcoCheio: boolean;
  /** O quadro da praça (o motor 3D). */
  palco: ReactNode;
  nivel: number;
  corNivel: { fundo: string; texto: string };
  /** Acorda e entra na praça. */
  aoEntrar: () => void;
  fome: number;
  sede: number;
  energia: number;
  higiene: number;
  vida?: number;
  onComer: () => void;
  onBeber: () => void;
  onDescansar: () => void;
  pessoas: PessoaOnlineAgora[];
  selos: Record<string, SeloDaPlaquinha> | undefined;
  /** Clicou em alguém (abre o perfil do HOKI). */
  onPessoa: (id: string) => void;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const heroi = useRef<HTMLDivElement>(null);
  const caixaDoNome = useRef<HTMLDivElement>(null);
  const nomeRef = useRef<NomePontilhado | null>(null);
  const { data: perfil } = useMeuPerfil();
  const { data: cargo } = useMyRole();
  const visita = useSouVisita();

  // o nome em pontinhos, atrás da ilha
  useEffect(() => {
    const caixa = caixaDoNome.current;
    const area = heroi.current;
    if (!mostrar || !caixa || !area) return;
    const n = criarNomePontilhado(caixa, { nome: "HOKI", area, altura: 0.52 });
    nomeRef.current = n;
    return () => {
      n.descartar();
      nomeRef.current = null;
    };
  }, [mostrar]);

  // rolagem da página: de 0 (no topo) a 1 (a parte de cima já saiu)
  useEffect(() => {
    const el = raiz.current;
    const alto = heroi.current;
    const rolo = el?.closest<HTMLElement>(".page-main");
    if (!mostrar || !el || !alto || !rolo) return;
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const p = Math.max(0, Math.min(1, rolo.scrollTop / ((alto.offsetHeight || 1) * 0.85)));
      el.style.setProperty("--rol", p.toFixed(3));
      nomeRef.current?.rolagem(p);
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    rolo.addEventListener("scroll", aoRolar, { passive: true });
    medir();
    return () => {
      rolo.removeEventListener("scroll", aoRolar);
      if (quadro) cancelAnimationFrame(quadro);
      el.style.setProperty("--rol", "0");
    };
  }, [mostrar]);

  // a ilha inclina para o ponteiro (e o nome, atrás, anda ao contrário: dá profundidade)
  const inclinarIlha = (e: PonteiroReact<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--hx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty("--hy", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  const soltarIlha = (e: PonteiroReact<HTMLDivElement>) => {
    e.currentTarget.style.setProperty("--hx", "0");
    e.currentTarget.style.setProperty("--hy", "0");
  };
  // o cartão do perfil inclina para o ponteiro, com um brilho que acompanha
  const inclinar = (e: PonteiroReact<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ix", (x - 0.5).toFixed(3));
    el.style.setProperty("--iy", (y - 0.5).toFixed(3));
    el.style.setProperty("--bx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--by", `${(y * 100).toFixed(1)}%`);
    el.setAttribute("data-inclinado", "1");
  };
  const soltar = (e: PonteiroReact<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.style.setProperty("--ix", "0");
    el.style.setProperty("--iy", "0");
    el.removeAttribute("data-inclinado");
  };

  const barras = Math.round(Math.max(0, Math.min(100, vida)) / 10);
  return (
    <div
      ref={raiz}
      className={cn("hoki-inicio", !mostrar && "hoki-inicio-jogo")}
      style={{ "--rol": 0 } as CSSProperties}
    >
      {/* ---------- a ilha de verdade flutuando, com o nome atrás ---------- */}
      <div
        ref={heroi}
        className={cn("hoki-heroi", palcoCheio && "hoki-heroi-solto")}
        onPointerMove={mostrar ? inclinarIlha : undefined}
        onPointerLeave={mostrar ? soltarIlha : undefined}
      >
        {mostrar ? (
          <div className="hoki-heroi-fundo">
            <h1 className="sr-only">HOKI</h1>
            <div ref={caixaDoNome} className="hoki-heroi-nome" />
            <button
              type="button"
              onClick={aoEntrar}
              className="hoki-heroi-entrar"
              aria-label="Acordar e entrar na praça"
            />
            <p className="hoki-heroi-dica" aria-hidden>
              <MousePointerClick className="size-3.5" strokeWidth={2} /> clique na ilha para entrar
            </p>
          </div>
        ) : null}
        {palco}
      </div>

      {/* ---------- eu: perfil, acordar e as barras do meu HOKI ---------- */}
      {mostrar && (
        <div className="hoki-lado">
          <div
            className="hoki-cartao glass hc hoki-some"
            onPointerMove={inclinar}
            onPointerLeave={soltar}
          >
            <div className="relative h-[64px] overflow-hidden">
              <img
                src={perfil?.banner_url || BANNER_PADRAO}
                alt=""
                draggable={false}
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/15 to-black/80" />
              {visita && (
                <button
                  type="button"
                  onClick={() =>
                    void supabase.auth.signOut().then(() => window.location.assign("/auth"))
                  }
                  className="absolute right-2 top-2 flex h-7 items-center gap-1.5 rounded-full bg-black/60 px-2.5 text-[11px] font-medium text-white/85 backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white"
                >
                  <LogOut className="size-3" /> Sair
                </button>
              )}
            </div>
            <div className="relative flex items-end gap-3 px-3.5 pb-3">
              <span className="relative -mt-6 block size-12 shrink-0 overflow-hidden rounded-2xl bg-black ring-[3px] ring-black/60">
                <img
                  src={perfil?.avatar_url || DEFAULT_AVATAR_URL}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                />
              </span>
              <div className="min-w-0 flex-1 pb-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h2 className="truncate font-display text-[16px] font-semibold leading-tight tracking-tight">
                    {perfil?.username || "…"}
                  </h2>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-bold"
                    style={{ background: corNivel.fundo, color: corNivel.texto }}
                    title="Nível do HOKI (HOST FAZENDAS)"
                  >
                    HOKI Nv {nivel}
                  </span>
                </div>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {visita ? "Visita" : ROLE_LABELS[cargo ?? "staff"]}
                </p>
              </div>
              <span
                className="mb-1 flex shrink-0 items-center gap-1.5 text-[10.5px] text-white/55"
                title="Seu HOKI está dormindo no berço"
              >
                <span className="size-1.5 rounded-full bg-white/30" />
                <span className="hidden min-[430px]:inline">dormindo</span>
              </span>
            </div>
            <span aria-hidden className="hoki-cartao-brilho" />
          </div>

          <button type="button" onClick={aoEntrar} className="hoki-acordar hoki-some">
            <span aria-hidden className="hoki-acordar-brilho" />
            <Sunrise className="size-[18px]" strokeWidth={2} />
            <span>Acordar agora</span>
          </button>

          <div className="hoki-some flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1 pr-[5px]">
              <Quadro tom={TONS.maca} valor={fome} titulo="Fome (tocar: comer)" onClick={onComer}>
                <Apple className="size-[18px]" fill="currentColor" strokeWidth={1.4} />
              </Quadro>
              <Quadro tom={TONS.gota} valor={sede} titulo="Sede (tocar: beber)" onClick={onBeber}>
                <Droplet className="size-[17px]" fill="currentColor" strokeWidth={0} />
              </Quadro>
              <Quadro
                tom={TONS.raio}
                valor={energia}
                titulo="Energia (tocar: soneca)"
                onClick={onDescansar}
              >
                <Zap className="size-[18px]" fill="currentColor" strokeWidth={0} />
              </Quadro>
              <Quadro tom={TONS.escudo} valor={higiene} titulo="Higiene">
                <Shield className="size-[18px]" fill="currentColor" strokeWidth={0} />
              </Quadro>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-[3px]"
                role="meter"
                aria-label="Vida"
                aria-valuenow={vida}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "hoki-barra h-[22px] w-[14px] -skew-x-[10deg] rounded-[3px] transition-colors duration-500",
                      i < barras
                        ? "bg-gradient-to-b from-[#e53941] to-[#b51a22] shadow-[0_0_8px_rgba(230,50,60,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]"
                        : "bg-[#5a3a3f]/55",
                    )}
                    style={{ "--n": i } as CSSProperties}
                  />
                ))}
              </div>
              <Quadro tom={TONS.vida} valor={vida} titulo="Vida" grande>
                <Heart className="size-5" fill="currentColor" strokeWidth={0} />
              </Quadro>
            </div>
          </div>
        </div>
      )}

      {/* ---------- quem está online, em células ---------- */}
      {mostrar && <CelulasOnline pessoas={pessoas} selos={selos} onPessoa={onPessoa} />}
    </div>
  );
}

/** Ordem das células: eu, quem está acordado no lobby, quem está na fazenda e, por fim, quem dorme. */
const pesoDoLugar = (p: PessoaOnlineAgora) => (p.dorme ? 2 : p.naFazenda ? 1 : 0);

/** Quem está online agora, em células: abas com o total de cada lugar e um cartãozinho por pessoa. */
function CelulasOnline({
  pessoas,
  selos,
  onPessoa,
}: {
  pessoas: PessoaOnlineAgora[];
  selos: Record<string, SeloDaPlaquinha> | undefined;
  onPessoa: (id: string) => void;
}) {
  const [aba, setAba] = useState<AbaOnline>("online");
  const abas = useRef<HTMLDivElement>(null);
  const [marca, setMarca] = useState<{ x: number; w: number } | null>(null);
  // a pílula branca desliza até a aba escolhida
  useLayoutEffect(() => {
    const caixa = abas.current;
    if (!caixa) return;
    const medir = () => {
      const el = caixa.querySelector<HTMLElement>('[aria-selected="true"]');
      if (el) setMarca({ x: el.offsetLeft, w: el.offsetWidth });
    };
    medir();
    const o = new ResizeObserver(medir);
    o.observe(caixa);
    return () => o.disconnect();
  }, [aba, pessoas.length]);

  const lista = useMemo(
    () =>
      pessoas
        .filter((p) => naAbaOnline(p, aba))
        .sort(
          (a, b) =>
            Number(!!b.souEu) - Number(!!a.souEu) ||
            pesoDoLugar(a) - pesoDoLugar(b) ||
            (selos?.[b.id]?.nivel ?? 0) - (selos?.[a.id]?.nivel ?? 0) ||
            a.nome.localeCompare(b.nome),
        ),
    [pessoas, aba, selos],
  );
  // brilho que segue o ponteiro dentro da célula
  const luz = (e: PonteiroReact<HTMLDivElement>) => {
    const c = (e.target as Element).closest<HTMLElement>(".hoki-celula");
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty("--lx", `${(e.clientX - r.left).toFixed(0)}px`);
    c.style.setProperty("--ly", `${(e.clientY - r.top).toFixed(0)}px`);
  };

  return (
    <section className="hoki-online" aria-label="Quem está online agora">
      <header className="hoki-online-topo">
        <h2 className="hoki-online-titulo">
          <span className="hoki-online-vivo" aria-hidden />
          Online agora <span className="font-normal text-white/50">· {pessoas.length}</span>
        </h2>
        <div ref={abas} className="hoki-abas" role="tablist" aria-label="Onde estão">
          {marca && (
            <span
              aria-hidden
              className="hoki-abas-marca"
              style={{ translate: `${marca.x}px 0`, width: marca.w }}
            />
          )}
          {ABAS_ONLINE.map((a) => {
            const n = pessoas.filter((p) => naAbaOnline(p, a.id)).length;
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => setAba(a.id)}
                className="hoki-aba"
              >
                <b className="tabular-nums">{n}</b>
                <span>{a.nome}</span>
              </button>
            );
          })}
        </div>
      </header>
      {/* a chave refaz a entrada em fila sempre que a aba muda */}
      <div key={aba} className="hoki-celulas" onPointerMove={luz}>
        {lista.map((p, i) => {
          const selo = selos?.[p.id];
          const estado = p.dorme ? "dorme" : p.naFazenda ? "fazenda" : "lobby";
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPessoa(p.id)}
              title={`Ver o HOKI de ${p.nome}`}
              className="hoki-celula"
              data-estado={estado}
              style={{ "--i": Math.min(i, 14) } as CSSProperties}
            >
              <span className="hoki-celula-foto">
                <span className="hoki-celula-rosto">
                  <Hoki2D visual={p.visual} busto />
                </span>
                {p.dorme && (
                  <span className="hoki-celula-zz" aria-hidden>
                    z<i>z</i>
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="flex min-w-0 items-center gap-1.5">
                  {p.tag && <span className="hoki-celula-tag">{p.tag}</span>}
                  <span className="truncate text-[13px] font-semibold">{p.nome}</span>
                  {p.souEu && <span className="shrink-0 text-[10.5px] text-white/45">(você)</span>}
                </span>
                <span className="hoki-celula-onde">
                  <i aria-hidden />
                  <span className="truncate">{ondeEstaOnline(p)}</span>
                </span>
              </span>
              <span
                className="hoki-celula-nivel"
                title={selo ? `Nível ${selo.nivel} (HOST FAZENDAS)` : "Ainda sem fazenda"}
                style={
                  selo
                    ? { background: selo.fundo, color: selo.texto }
                    : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
                }
              >
                {selo ? `Nv ${selo.nivel}` : "Nv –"}
              </span>
            </button>
          );
        })}
        {lista.length === 0 && <p className="hoki-celulas-vazio">Ninguém aqui agora.</p>}
      </div>
    </section>
  );
}
