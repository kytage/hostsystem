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
  ChevronDown,
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

  // rolagem da página: de 0 (a parte de cima ainda inteira na janela) a 1 (ela já saiu por cima)
  useEffect(() => {
    const el = raiz.current;
    const alto = heroi.current;
    const rolo = el?.closest<HTMLElement>(".page-main");
    if (!mostrar || !el || !alto || !rolo) return;
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      // (medido pela posição da própria seção: na tela inicial ela não começa no topo da página)
      const passou = rolo.getBoundingClientRect().top - el.getBoundingClientRect().top;
      const p = Math.max(0, Math.min(1, passou / ((alto.offsetHeight || 1) * 0.85)));
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

  const cheio = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  /** As quatro necessidades do HOKI (tocar numa das três primeiras cuida dela). */
  const necessidades = [
    {
      nome: "Fome",
      valor: cheio(fome),
      cor: "#7ccf5a",
      Icone: Apple,
      acao: onComer,
      dica: "Fome (tocar: comer)",
    },
    {
      nome: "Sede",
      valor: cheio(sede),
      cor: "#5fb4e6",
      Icone: Droplet,
      acao: onBeber,
      dica: "Sede (tocar: beber)",
    },
    {
      nome: "Energia",
      valor: cheio(energia),
      cor: "#a898ff",
      Icone: Zap,
      acao: onDescansar,
      dica: "Energia (tocar: soneca)",
    },
    {
      nome: "Higiene",
      valor: cheio(higiene),
      cor: "#6ea2ee",
      Icone: Shield,
      acao: undefined,
      dica: "Higiene",
    },
  ];
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
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={perfil?.banner_url || BANNER_PADRAO}
                alt=""
                draggable={false}
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/60" />
            </div>
            <div className="relative flex items-center gap-3 px-3 py-2.5">
              <span className="relative block size-10 shrink-0 overflow-hidden rounded-xl bg-black ring-2 ring-black/50">
                <img
                  src={perfil?.avatar_url || DEFAULT_AVATAR_URL}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h2 className="truncate font-display text-[16px] font-semibold leading-tight tracking-tight">
                    {perfil?.username || "…"}
                  </h2>
                </div>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {visita ? "Visita" : ROLE_LABELS[cargo ?? "staff"]}
                </p>
              </div>
              {visita ? (
                <button
                  type="button"
                  onClick={() =>
                    void supabase.auth.signOut().then(() => window.location.assign("/auth"))
                  }
                  className="shrink-0 flex h-7 items-center gap-1.5 rounded-full bg-black/60 px-2.5 text-[11px] font-medium text-white/85 backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white"
                >
                  <LogOut className="size-3" /> Sair
                </button>
              ) : (
                <span
                  className="flex shrink-0 items-center gap-1.5 text-[10.5px] text-white/55"
                  title="Seu HOKI está dormindo no berço"
                >
                  <span className="size-1.5 rounded-full bg-white/30" />
                  <span className="hidden min-[430px]:inline">dormindo</span>
                </span>
              )}
            </div>
            <span aria-hidden className="hoki-cartao-brilho" />
          </div>

          {/* o meu HOKI num cartão só: o nível, a vida e as quatro necessidades */}
          <div className="hoki-estado glass hc hoki-some">
            <div className="hoki-estado-topo">
              <span
                className="hoki-estado-nivel"
                style={{ background: corNivel.fundo, color: corNivel.texto }}
                title="Nível do HOKI (HOST FAZENDAS)"
              >
                Nv {nivel}
              </span>
              <span className="hoki-estado-rotulo">Meu HOKI</span>
              <span className="hoki-estado-vida" title="Vida">
                <Heart fill="currentColor" strokeWidth={0} />
                {cheio(vida)}%
              </span>
            </div>
            <div
              className="hoki-medidor hoki-medidor-vida"
              role="meter"
              aria-label="Vida"
              aria-valuenow={cheio(vida)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ "--v": cheio(vida) / 100 } as CSSProperties} />
            </div>
            <div className="hoki-necessidades">
              {necessidades.map(({ nome, valor, cor, Icone, acao, dica }) => {
                const miolo = (
                  <>
                    <Icone fill="currentColor" strokeWidth={0} />
                    <span className="sr-only">{nome}</span>
                    <b>{valor}%</b>
                    <span className="hoki-medidor" aria-hidden>
                      <i style={{ "--v": valor / 100 } as CSSProperties} />
                    </span>
                  </>
                );
                const estilo = { "--cor": cor } as CSSProperties;
                return acao ? (
                  <button
                    key={nome}
                    type="button"
                    onClick={acao}
                    title={dica}
                    className="hoki-necessidade"
                    style={estilo}
                  >
                    {miolo}
                  </button>
                ) : (
                  <div key={nome} title={dica} className="hoki-necessidade" style={estilo}>
                    {miolo}
                  </div>
                );
              })}
            </div>
          </div>

          <button type="button" onClick={aoEntrar} className="hoki-acordar hoki-some">
            <Sunrise className="size-[17px]" strokeWidth={2} />
            <span>Acordar agora</span>
          </button>
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
  /** As pessoas só aparecem depois de um clique (no título ou numa aba); outro clique recolhe. */
  const [aberto, setAberto] = useState(false);
  const abas = useRef<HTMLDivElement>(null);
  const [marca, setMarca] = useState<{ x: number; w: number } | null>(null);
  // a pílula branca desliza até a aba escolhida
  useLayoutEffect(() => {
    const caixa = abas.current;
    if (!caixa) return;
    const medir = () => {
      const el = caixa.querySelector<HTMLElement>('[aria-selected="true"]');
      setMarca(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    medir();
    const o = new ResizeObserver(medir);
    o.observe(caixa);
    return () => o.disconnect();
  }, [aba, aberto, pessoas.length]);

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
        <h2 className="contents">
          <button
            type="button"
            className="hoki-online-titulo"
            aria-expanded={aberto}
            onClick={() => setAberto((v) => !v)}
            title={aberto ? "Recolher" : "Ver quem está online"}
          >
            <span className="hoki-online-vivo" aria-hidden />
            Online agora <span className="font-normal text-white/50">· {pessoas.length}</span>
            <ChevronDown className="hoki-online-seta" strokeWidth={2} aria-hidden />
          </button>
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
                aria-selected={aberto && aba === a.id}
                onClick={() => {
                  // tocar de novo na aba aberta recolhe a lista
                  if (aberto && aba === a.id) setAberto(false);
                  else {
                    setAba(a.id);
                    setAberto(true);
                  }
                }}
                className="hoki-aba"
              >
                <b className="tabular-nums">{n}</b>
                <span>{a.nome}</span>
              </button>
            );
          })}
        </div>
      </header>
      {/* (a chave refaz a entrada em fila sempre que a aba muda) */}
      {aberto && (
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
                    {p.souEu && (
                      <span className="shrink-0 text-[10.5px] text-white/45">(você)</span>
                    )}
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
      )}
    </section>
  );
}
