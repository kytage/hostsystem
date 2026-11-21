import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  Copy,
  Download,
  FileIcon,
  FolderOpen,
  ImagePlus,
  Loader2,
  Paintbrush,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRealtimeTable } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import {
  CORES_HOST,
  FONTES_HOST,
  FORMATOS_ARTE,
  PADRAO_DA_ARTE,
  REGRAS_DA_ARTE,
  lerDestaque,
  lerTabela,
  nomeDoArquivo,
  separarMoeda,
  type DadosArte,
  type FormatoArte,
} from "@/lib/arte-modelos";
import {
  anexarArquivo,
  apagarArquivo,
  apagarTopico,
  criarTopico,
  editarTopico,
  ehImagemArte,
  fetchArquivos,
  fetchTopicos,
  linksDosArquivos,
  tamanhoBonito,
  type ArquivoArte,
  type TopicoArte,
} from "@/lib/marketing-artes";
import { EditorTexto } from "@/components/editor-texto";
import { TextoFormatado } from "@/components/texto-formatado";

type Sub = "manual" | "gerador" | "topicos";

/** Aba Artes do Marketing: aberta para toda a staff. */
export function MarketingArtes({ podeGerir }: { podeGerir: boolean }) {
  const [sub, setSub] = useState<Sub>("gerador");
  return (
    <div className="mt-4">
      <div className="segmentos" role="group" aria-label="Artes">
        <button type="button" aria-pressed={sub === "gerador"} onClick={() => setSub("gerador")}>
          <Paintbrush className="size-3.5" /> Gerar arte
        </button>
        <button type="button" aria-pressed={sub === "manual"} onClick={() => setSub("manual")}>
          <BookOpen className="size-3.5" /> Manual de identidade
        </button>
        <button type="button" aria-pressed={sub === "topicos"} onClick={() => setSub("topicos")}>
          <FolderOpen className="size-3.5" /> Artes de marketing
        </button>
      </div>
      {sub === "manual" ? (
        <ManualDeIdentidade />
      ) : sub === "gerador" ? (
        <GeradorDeArte />
      ) : (
        <TopicosDeArtes podeGerir={podeGerir} />
      )}
    </div>
  );
}

/* ================================================================== manual */

const LOGOS = [
  { nome: "Símbolo vermelho", arquivo: "host-simbolo-vermelho", fundo: "#ffffff", formatos: ["png", "svg", "pdf"] },
  { nome: "Símbolo claro", arquivo: "host-simbolo-claro", fundo: "#111111", formatos: ["png", "svg", "pdf"] },
  { nome: "Logo extensa vermelha", arquivo: "host-extenso-vermelho", fundo: "#ffffff", formatos: ["png", "svg", "pdf"] },
  { nome: "Logo extensa clara", arquivo: "host-extenso-claro", fundo: "#111111", formatos: ["png", "svg", "pdf"] },
  { nome: "HOST world (artes)", arquivo: "host-world", fundo: "#ffffff", formatos: ["png"] },
  { nome: "Personagem (sem fundo)", arquivo: "personagem", fundo: "#CE0F0F", formatos: ["png"] },
] as const;

/** Elementos soltos da identidade (pasta "Elementos Separados - PNG"); a miniatura fica em /mini. */
const ELEMENTOS: { nome: string; arquivo: string; fundo: string; cobrir?: boolean }[] = [
  { nome: "Beyond the Limits", arquivo: "beyond-the-limits.png", fundo: "#ffffff" },
  { nome: "Símbolo na parede", arquivo: "simbolo-textura.jpg", fundo: "#f1f1f1", cobrir: true },
  { nome: "HOST condensado", arquivo: "host-condensado.png", fundo: "#ffffff" },
  { nome: "Season 3.0", arquivo: "season-3.png", fundo: "#ffffff" },
  { nome: "Selo Season 3.0", arquivo: "selo-season.png", fundo: "#ffffff" },
  { nome: "Estrela", arquivo: "estrela.png", fundo: "#ffffff" },
  { nome: "Olhos 3.0", arquivo: "olhos-3-0.png", fundo: "#ffffff" },
  { nome: "Desenhos em retícula", arquivo: "desenhos-reticula.png", fundo: "#ffffff" },
  { nome: "Textura de parede", arquivo: "textura-parede.png", fundo: "#f1f1f1", cobrir: true },
  { nome: "Textura de papel", arquivo: "textura-papel.png", fundo: "#f1f1f1", cobrir: true },
  { nome: "Personagem 2K", arquivo: "personagem-2k.png", fundo: "#CE0F0F" },
];

function Bloco({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="glass rounded-[22px] p-5">
      <h3 className="hc-titulo">{titulo}</h3>
      {nota && <p className="hc-nota mt-0.5">{nota}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ManualDeIdentidade() {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = (hex: string) => {
    void navigator.clipboard.writeText(hex);
    setCopiado(hex);
    setTimeout(() => setCopiado((c) => (c === hex ? null : c)), 1400);
  };
  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");
  return (
    <div className="mt-4 grid gap-3.5">
      <Bloco titulo="Logos" nota="Baixe sempre daqui. Não estique, não troque a cor e deixe espaço livre em volta.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {LOGOS.map((l) => (
            <div key={l.arquivo} className="overflow-hidden rounded-2xl border border-white/[0.08]">
              <div className="grid h-32 place-items-center p-4" style={{ background: l.fundo }}>
                <img src={`/marca/${l.arquivo}.png`} alt={l.nome} className="max-h-24 max-w-full object-contain" />
              </div>
              <div className="p-3">
                <p className="truncate text-[12.5px] font-medium text-foreground">{l.nome}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {l.formatos.map((f) => (
                    <a
                      key={f}
                      href={`/marca/${l.arquivo}.${f}`}
                      download={`${l.arquivo}.${f}`}
                      className="arte-baixar"
                    >
                      <Download className="size-3" /> {f.toUpperCase()}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Elementos" nota="Peças soltas para montar as artes: slogan, texturas, desenhos e selos. Clique para baixar no tamanho original.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {ELEMENTOS.map((e) => (
            <a
              key={e.arquivo}
              href={`/marca/elementos/${e.arquivo}`}
              download={e.arquivo}
              className="group overflow-hidden rounded-2xl border border-white/[0.08] transition hover:border-white/20"
            >
              <span className="grid h-32 place-items-center overflow-hidden" style={{ background: e.fundo }}>
                <img
                  src={`/marca/elementos/mini/${e.arquivo.replace(/\.\w+$/, ".webp")}`}
                  alt={e.nome}
                  loading="lazy"
                  className={cn("max-w-full", e.cobrir ? "size-full object-cover" : "max-h-28 object-contain p-2")}
                />
              </span>
              <span className="flex items-center justify-between gap-2 p-3">
                <span className="truncate text-[12.5px] font-medium text-foreground">{e.nome}</span>
                <Download className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
              </span>
            </a>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Cores" nota="Clique para copiar o código da cor.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {CORES_HOST.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => copiar(c.hex)}
              className="overflow-hidden rounded-2xl border border-white/[0.08] text-left transition hover:border-white/20"
            >
              <span className="block h-20" style={{ background: c.hex }} />
              <span className="block p-3">
                <span className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-foreground">
                  {c.nome}
                  {copiado === c.hex ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5 text-muted-foreground" />
                  )}
                </span>
                <span className="mt-0.5 block font-mono text-[11.5px] text-muted-foreground">
                  {c.hex} · rgb({rgb(c.hex)})
                </span>
                <span className="hc-nota mt-1 block">{c.uso}</span>
              </span>
            </button>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Tipografia" nota="As três fontes são gratuitas, do Google Fonts.">
        <div className="grid gap-3 md:grid-cols-3">
          {FONTES_HOST.map((f) => (
            <div key={f.nome} className="rounded-2xl border border-white/[0.08] bg-white p-4 text-[#111]">
              <p
                style={{ fontFamily: f.css, fontWeight: f.nome.includes("Montserrat") ? 800 : 400, letterSpacing: f.nome.includes("Montserrat") ? "0.3em" : undefined }}
                className={f.nome.includes("Montserrat") ? "text-[14px]" : "text-[40px] leading-none"}
              >
                {f.exemplo}
              </p>
              <p className="mt-3 text-[12.5px] font-semibold">{f.nome}</p>
              <p className="text-[12px] text-[#555]">{f.uso}</p>
              <a href={f.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] font-semibold text-[#CE0F0F] hover:underline">
                Baixar a fonte
              </a>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Padrão das artes" nota="Toda arte nova segue este modelo. O gerador já faz tudo isso sozinho.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <ol className="space-y-2 text-[13px] text-foreground">
            {REGRAS_DA_ARTE.map((r, i) => (
              <li key={r} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#CE0F0F] text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5">{r}</span>
              </li>
            ))}
          </ol>
          <div className="grid gap-3">
            <img src="/marca/exemplo-banner.webp" alt="Exemplo de banner no padrão HOST" className="w-full rounded-xl" />
            <img src="/marca/exemplo-tabela.webp" alt="Exemplo de tabela no padrão HOST" className="w-full rounded-xl" />
          </div>
        </div>
      </Bloco>
    </div>
  );
}

/* ================================================================== gerador */

const VERMELHO = "#CE0F0F";
const PRETO = "#111111";
const ANTON = "'Anton', 'Bebas Neue', Impact, sans-serif";
const BEBAS = "'Bebas Neue', 'Anton', Impact, sans-serif";
const MONT = "'Montserrat', 'Inter', sans-serif";

const URL_FONTES_ARTE =
  "https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Montserrat:wght@700;800&display=swap";
let fontesEmbutidas: Promise<string> | null = null;

const paraDataUrl = (b: Blob) =>
  new Promise<string>((ok, erro) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result));
    fr.onerror = erro;
    fr.readAsDataURL(b);
  });

/** As três fontes da arte já dentro do CSS (latin), para o PNG sair com elas. */
function cssDasFontes(): Promise<string> {
  fontesEmbutidas ??= (async () => {
    const css = await (await fetch(URL_FONTES_ARTE)).text();
    const blocos = css.split(/(?=\/\* )/).filter((b) => /^\/\* latin(-ext)? \*\//.test(b));
    const prontos = await Promise.all(
      blocos.map(async (b) => {
        const m = b.match(/url\((https:[^)]+)\)/);
        if (!m?.[1]) return b;
        return b.replace(m[1], await paraDataUrl(await (await fetch(m[1])).blob()));
      }),
    );
    return prontos.join("\n");
  })().catch((e) => {
    fontesEmbutidas = null;
    throw e;
  });
  return fontesEmbutidas;
}

/** Desenha a arte em PNG no tamanho real, pelo próprio navegador (sai igual à prévia). */
export async function gerarPng(el: HTMLElement, w: number, h: number): Promise<Blob> {
  await document.fonts.ready;
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(el, {
    width: w,
    height: h,
    pixelRatio: 1,
    backgroundColor: "#ffffff",
    fontEmbedCSS: await cssDasFontes(),
  });
  if (!blob) throw new Error("sem imagem");
  return blob;
}

function novaArte(formato: FormatoArte): DadosArte {
  return { formato, personagem: null, ...PADRAO_DA_ARTE[formato] };
}

function GeradorDeArte() {
  const [d, setD] = useState<DadosArte>(() => novaArte("banner"));
  const [baixando, setBaixando] = useState(false);
  const arteRef = useRef<HTMLDivElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(900);
  const f = FORMATOS_ARTE.find((x) => x.id === d.formato)!;
  const set = <K extends keyof DadosArte>(k: K, v: DadosArte[K]) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setLargura(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // o preview cabe na largura e, nos formatos altos, também na altura da tela
  const escala = Math.min(largura / f.w, (f.h > f.w ? 760 : 9999) / f.h);

  const trocarFormato = (formato: FormatoArte) =>
    setD((x) => ({ ...novaArte(formato), personagem: x.personagem }));

  const escolherPersonagem = (file: File | undefined) => {
    if (!file) return;
    if (d.personagem) URL.revokeObjectURL(d.personagem);
    set("personagem", URL.createObjectURL(file));
  };

  const baixar = async () => {
    const el = arteRef.current;
    if (!el) return;
    setBaixando(true);
    try {
      const blob = await gerarPng(el, f.w, f.h);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDoArquivo(d);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success(`Arte baixada (${f.w}×${f.h}).`);
    } catch {
      toast.error("Não deu para gerar a imagem. Tente de novo.");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="mt-4 grid gap-3.5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section className="glass space-y-4 rounded-[22px] p-5 xl:sticky xl:top-6 xl:self-start">
        <div>
          <p className="arte-rotulo">Formato</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {FORMATOS_ARTE.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => trocarFormato(x.id)}
                className={cn("arte-formato", d.formato === x.id && "arte-formato-on")}
              >
                <b>{x.nome}</b>
                <span>
                  {x.w}×{x.h} · {x.uso}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Etiqueta (preta)" valor={d.etiqueta} onChange={(v) => set("etiqueta", v.toUpperCase())} />
          <Campo rotulo="Assunto" valor={d.rotulo} onChange={(v) => set("rotulo", v.toUpperCase())} />
        </div>
        <Campo
          rotulo="Título"
          dica="Coloque entre *asteriscos* o que sai em vermelho. Enter quebra a linha."
          valor={d.titulo}
          onChange={(v) => set("titulo", v.toUpperCase())}
          linhas={2}
        />
        <div>
          <p className="arte-rotulo">Tamanho do título · {d.tamanhoTitulo}px</p>
          <input
            type="range"
            min={70}
            max={260}
            value={d.tamanhoTitulo}
            onChange={(e) => set("tamanhoTitulo", Number(e.target.value))}
            className="mt-2 w-full accent-[#CE0F0F]"
          />
        </div>
        {d.formato === "tabela" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="1ª coluna de valor" valor={d.colunaA} onChange={(v) => set("colunaA", v.toUpperCase())} />
              <Campo rotulo="2ª coluna (vermelha)" valor={d.colunaB} onChange={(v) => set("colunaB", v.toUpperCase())} />
            </div>
            <Campo
              rotulo="Itens da tabela"
              dica={'"# TÍTULO | legenda" abre uma seção · "Produto ; valor ; valor" é uma linha · "---" passa para a próxima coluna.'}
              valor={d.tabela}
              onChange={(v) => set("tabela", v)}
              linhas={12}
              mono
            />
          </>
        ) : (
          <Campo
            rotulo="Faixa preta"
            dica="Também aceita *vermelho*. Deixe vazio para tirar a faixa."
            valor={d.faixa}
            onChange={(v) => set("faixa", v.toUpperCase())}
          />
        )}
        <Campo rotulo="Rodapé" valor={d.rodape} onChange={(v) => set("rodape", v)} />

        <div className="flex flex-wrap items-center gap-2">
          <label className="arte-baixar cursor-pointer">
            <UserRound className="size-3.5" /> Trocar personagem
            <input type="file" accept="image/png,image/webp" className="hidden" onChange={(e) => escolherPersonagem(e.target.files?.[0])} />
          </label>
          {d.personagem && (
            <button type="button" className="arte-baixar" onClick={() => set("personagem", null)}>
              <RotateCcw className="size-3.5" /> Personagem padrão
            </button>
          )}
          <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <input type="checkbox" checked={d.painel} onChange={(e) => set("painel", e.target.checked)} className="accent-[#CE0F0F]" />
            Painel vermelho + personagem
          </label>
        </div>
        <p className="hc-nota">Para trocar o personagem, use PNG sem fundo (recortado).</p>

        <div className="flex gap-2 pt-1">
          <Button onClick={baixar} disabled={baixando} className="flex-1">
            {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Baixar PNG ({f.w}×{f.h})
          </Button>
          <Button variant="outline" onClick={() => setD((x) => ({ ...novaArte(x.formato), personagem: x.personagem }))} title="Voltar o texto de exemplo">
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </section>

      <section className="glass rounded-[22px] p-4">
        <div ref={caixaRef} className="w-full">
          <div
            className="relative mx-auto overflow-hidden rounded-lg shadow-2xl"
            style={{ width: f.w * escala, height: f.h * escala }}
          >
            <div id="arte-escala" style={{ transform: `scale(${escala})`, transformOrigin: "top left", width: f.w, height: f.h }}>
              <div ref={arteRef}>
                <ArteHost d={d} />
              </div>
            </div>
          </div>
        </div>
        <p className="hc-nota mt-3 text-center">
          Prévia em tamanho reduzido. O PNG sai em {f.w}×{f.h}.
        </p>
      </section>
    </div>
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
  dica,
  linhas,
  mono,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  dica?: string;
  linhas?: number;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="arte-rotulo">{rotulo}</span>
      {linhas ? (
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          rows={linhas}
          // aqui o *asterisco* já tem outro uso (palavra vermelha): sem a barra de formatação
          data-sem-formatacao
          className={cn("arte-input mt-1.5 resize-y", mono && "font-mono text-[11.5px]")}
        />
      ) : (
        <input value={valor} onChange={(e) => onChange(e.target.value)} className="arte-input mt-1.5" />
      )}
      {dica && <span className="hc-nota mt-1 block">{dica}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ desenho da arte */

function Titulo({ texto, tamanho, estilo }: { texto: string; tamanho: number; estilo?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: ANTON,
        fontSize: tamanho,
        lineHeight: "normal",
        color: PRETO,
        textTransform: "uppercase",
        marginTop: -0.27 * tamanho,
        marginBottom: -0.24 * tamanho,
        ...estilo,
      }}
    >
      {lerDestaque(texto).map((linha, i) => (
        <div key={i} style={{ whiteSpace: "nowrap", marginTop: i > 0 ? -0.5 * tamanho : 0 }}>
          {linha.length === 0
            ? " "
            : linha.map((t, j) => (
                <span key={j} style={{ color: t.vermelho ? VERMELHO : PRETO }}>
                  {t.t}
                </span>
              ))}
        </div>
      ))}
    </div>
  );
}

function Faixa({ texto, tamanho, estilo }: { texto: string; tamanho: number; estilo?: CSSProperties }) {
  if (!texto.trim()) return null;
  return (
    <div
      style={{
        display: "inline-block",
        background: PRETO,
        borderLeft: `${Math.round(tamanho * 0.34)}px solid ${VERMELHO}`,
        borderRadius: Math.round(tamanho * 0.16),
        padding: `${Math.round(tamanho * 0.06)}px ${Math.round(tamanho * 0.62)}px ${Math.round(tamanho * 0.0)}px ${Math.round(tamanho * 0.52)}px`,
        fontFamily: BEBAS,
        fontSize: tamanho,
        lineHeight: "normal",
        letterSpacing: "0.01em",
        color: "#fff",
        whiteSpace: "nowrap",
        ...estilo,
      }}
    >
      {lerDestaque(texto)
        .flat()
        .map((t, i) => (
          <span key={i} style={{ color: t.vermelho ? VERMELHO : "#fff" }}>
            {t.t}
          </span>
        ))}
    </div>
  );
}

function Etiqueta({ etiqueta, rotulo, tamanho }: { etiqueta: string; rotulo: string; tamanho: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: tamanho * 1.1 }}>
      {etiqueta.trim() && (
        <span
          style={{
            background: PRETO,
            color: "#fff",
            fontFamily: MONT,
            fontWeight: 800,
            fontSize: tamanho,
            letterSpacing: "0.3em",
            padding: `${tamanho * 0.42}px ${tamanho * 0.95}px ${tamanho * 0.38}px ${tamanho * 1.1}px`,
            borderRadius: tamanho * 0.25,
            lineHeight: "normal",
          }}
        >
          {etiqueta}
        </span>
      )}
      {rotulo.trim() && (
        <span style={{ fontFamily: MONT, fontWeight: 800, fontSize: tamanho, letterSpacing: "0.3em", color: PRETO, lineHeight: "normal" }}>
          {rotulo}
        </span>
      )}
    </div>
  );
}

function Rodape({ texto, tamanho, cor = PRETO }: { texto: string; tamanho: number; cor?: string }) {
  if (!texto.trim()) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: tamanho * 1.1 }}>
      <span style={{ width: tamanho * 3.4, height: tamanho * 0.3, background: cor === PRETO ? VERMELHO : cor }} />
      <span style={{ fontFamily: MONT, fontWeight: 800, fontSize: tamanho, letterSpacing: "0.25em", color: cor, lineHeight: "normal" }}>
        {texto}
      </span>
    </div>
  );
}

function Barra({ largura, corte }: { largura: number; corte: number }) {
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: largura, height: corte, background: VERMELHO }} />
      <div style={{ position: "absolute", left: 0, top: corte, bottom: 0, width: largura, background: PRETO }} />
    </>
  );
}

/** Painel vermelho inclinado (skew em vez de clip-path, para o PNG sair igual à prévia). */
function Painel({
  estilo,
  inclinacao,
  marca,
  interno,
}: {
  estilo: CSSProperties;
  inclinacao: string;
  marca: number;
  interno?: CSSProperties;
}) {
  return (
    <div style={{ position: "absolute", overflow: "hidden", ...estilo }}>
      <div
        style={{
          position: "absolute",
          inset: "-10% -30% -10% 0",
          background: VERMELHO,
          transform: inclinacao,
          transformOrigin: "bottom left",
          ...interno,
        }}
      />
      <img
        src="/marca/host-world.png"
        alt=""
        style={{ position: "absolute", right: "-6%", top: "8%", width: marca, opacity: 0.16, filter: "brightness(0.45)" }}
      />
    </div>
  );
}

function Personagem({ src, estilo }: { src: string | null; estilo: CSSProperties }) {
  return <img src={src ?? "/marca/personagem.png"} alt="" style={{ position: "absolute", width: "auto", ...estilo }} />;
}

export function ArteHost({ d }: { d: DadosArte }) {
  const f = FORMATOS_ARTE.find((x) => x.id === d.formato)!;
  const base: CSSProperties = { position: "relative", width: f.w, height: f.h, background: "#fff", overflow: "hidden" };

  if (d.formato === "banner")
    return (
      <div style={base}>
        {d.painel && (
          <>
            <Painel estilo={{ right: 0, top: 0, width: 675, height: 625 }} inclinacao="skewX(-9deg)" marca={760} />
            <Personagem src={d.personagem} estilo={{ right: 40, bottom: 0, height: 600 }} />
          </>
        )}
        <Barra largura={20} corte={212} />
        <img src="/marca/host-world.png" alt="" style={{ position: "absolute", left: 72, top: 34, width: 332 }} />
        <div style={{ position: "absolute", left: 432, top: 80 }}>
          <Etiqueta etiqueta={d.etiqueta} rotulo={d.rotulo} tamanho={19} />
        </div>
        <div style={{ position: "absolute", left: 75, top: 182, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 34 }}>
          <Titulo texto={d.titulo} tamanho={d.tamanhoTitulo} />
          <Faixa texto={d.faixa} tamanho={52} />
        </div>
        <div style={{ position: "absolute", left: 78, bottom: 42 }}>
          <Rodape texto={d.rodape} tamanho={17} />
        </div>
      </div>
    );

  if (d.formato === "post")
    return (
      <div style={base}>
        {d.painel && (
          <>
            <Painel estilo={{ right: 0, top: 0, width: 470, height: 1080 }} inclinacao="skewX(-8deg)" marca={560} />
            <Personagem src={d.personagem} estilo={{ right: -60, bottom: 0, height: 760 }} />
          </>
        )}
        <Barra largura={16} corte={300} />
        <img src="/marca/host-world.png" alt="" style={{ position: "absolute", left: 60, top: 50, width: 280 }} />
        <div style={{ position: "absolute", left: 62, top: 228 }}>
          <Etiqueta etiqueta={d.etiqueta} rotulo={d.rotulo} tamanho={17} />
        </div>
        <div style={{ position: "absolute", left: 60, top: 300, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 30 }}>
          <Titulo texto={d.titulo} tamanho={d.tamanhoTitulo} />
          <Faixa texto={d.faixa} tamanho={40} />
        </div>
        <div style={{ position: "absolute", left: 62, bottom: 52 }}>
          <Rodape texto={d.rodape} tamanho={15} />
        </div>
      </div>
    );

  if (d.formato === "story")
    return (
      <div style={base}>
        {d.painel && (
          <>
            <Painel
              estilo={{ left: 0, right: 0, bottom: 0, height: 900 }}
              inclinacao="skewY(-12deg)"
              interno={{ inset: "230px 0 -40% 0", transformOrigin: "top left" }}
              marca={820}
            />
            <Personagem src={d.personagem} estilo={{ right: 20, bottom: 0, height: 1020 }} />
          </>
        )}
        <Barra largura={16} corte={520} />
        <img src="/marca/host-world.png" alt="" style={{ position: "absolute", left: 70, top: 90, width: 330 }} />
        <div style={{ position: "absolute", left: 72, top: 300 }}>
          <Etiqueta etiqueta={d.etiqueta} rotulo={d.rotulo} tamanho={20} />
        </div>
        <div style={{ position: "absolute", left: 70, top: 380, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 36 }}>
          <Titulo texto={d.titulo} tamanho={d.tamanhoTitulo} />
          <Faixa texto={d.faixa} tamanho={50} />
        </div>
        <div style={{ position: "absolute", left: 72, bottom: 70 }}>
          <Rodape texto={d.rodape} tamanho={18} cor={d.painel ? "#fff" : PRETO} />
        </div>
      </div>
    );

  // tabela
  const colunas = lerTabela(d.tabela);
  return (
    <div style={base}>
      {d.painel && (
        <div style={{ position: "absolute", right: 0, top: 0, width: 640, height: 335, overflow: "hidden" }}>
          <Painel estilo={{ inset: 0 }} inclinacao="skewX(-9deg)" marca={640} />
          <Personagem src={d.personagem} estilo={{ right: 70, top: 28, height: 880 }} />
        </div>
      )}
      <Barra largura={15} corte={335} />
      <div style={{ position: "absolute", left: 15, right: 0, top: 335, height: 8, background: PRETO }} />
      <img src="/marca/host-world.png" alt="" style={{ position: "absolute", left: 58, top: 38, width: 365 }} />
      <div style={{ position: "absolute", left: 452, top: 90 }}>
        <Etiqueta etiqueta={d.etiqueta} rotulo={d.rotulo} tamanho={17} />
      </div>
      <div style={{ position: "absolute", left: 62, top: 170 }}>
        <Titulo texto={d.titulo} tamanho={d.tamanhoTitulo} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 65,
          right: 65,
          top: 385,
          bottom: 78,
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(1, colunas.length)}, minmax(0, 1fr))`,
          gap: 34,
          alignItems: "start",
        }}
      >
        {colunas.map((secoes, ci) => (
          <div key={ci}>
            {secoes.map((s, si) => (
              <div key={si} style={{ marginBottom: 26 }}>
                {s.titulo && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 8 }}>
                    <span style={{ fontFamily: ANTON, fontSize: 50, lineHeight: "normal", color: VERMELHO }}>{s.titulo}</span>
                    {s.legenda && (
                      <span style={{ fontFamily: MONT, fontWeight: 800, fontSize: 14, letterSpacing: "0.2em", color: PRETO }}>{s.legenda}</span>
                    )}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 150px 146px", padding: "0 0 8px 22px", fontFamily: MONT, fontWeight: 800, fontSize: 12.5, letterSpacing: "0.14em" }}>
                  <span style={{ color: PRETO }}>PRODUTO</span>
                  <span style={{ color: PRETO, textAlign: "right", paddingRight: 16 }}>{d.colunaA}</span>
                  <span style={{ color: VERMELHO, textAlign: "right", paddingRight: 16 }}>{d.colunaB}</span>
                </div>
                {s.linhas.map((l, li) => (
                  <div
                    key={li}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) 150px 146px",
                      height: 42,
                      marginBottom: 6,
                      background: PRETO,
                      borderLeft: `6px solid ${VERMELHO}`,
                      borderRadius: 6,
                      overflow: "hidden",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontFamily: BEBAS, fontSize: 29, color: "#fff", paddingLeft: 16, whiteSpace: "nowrap", overflow: "hidden" }}>{l.produto}</span>
                    <Valor v={l.a} />
                    <Valor v={l.b} vermelho />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 65, right: 65, bottom: 30, display: "flex", alignItems: "center", gap: 22, fontFamily: MONT, fontWeight: 800, fontSize: 13, letterSpacing: "0.2em", color: PRETO }}>
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 13, height: 13, borderRadius: 3, background: PRETO }} /> {d.colunaA}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 13, height: 13, borderRadius: 3, background: VERMELHO }} /> {d.colunaB}
        </span>
        <span>· VALORES EM R$</span>
        <span style={{ marginLeft: "auto" }}>{d.rodape}</span>
      </div>
    </div>
  );
}

function Valor({ v, vermelho }: { v: string; vermelho?: boolean }) {
  const { moeda, valor } = separarMoeda(v);
  return (
    <span
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 6,
        paddingRight: 16,
        background: vermelho ? VERMELHO : "transparent",
        color: "#fff",
      }}
    >
      {moeda && <span style={{ fontFamily: MONT, fontWeight: 700, fontSize: 12, opacity: 0.75 }}>{moeda}</span>}
      <span style={{ fontFamily: BEBAS, fontSize: 29, lineHeight: "normal" }}>{valor}</span>
    </span>
  );
}

/* ================================================================== tópicos */

const KEY_TOPICOS = ["marketing-artes-topicos"];
const KEY_ARQUIVOS = ["marketing-artes-arquivos"];

function TopicosDeArtes({ podeGerir }: { podeGerir: boolean }) {
  useRealtimeTable("marketing_artes_topicos", [KEY_TOPICOS]);
  useRealtimeTable("marketing_artes_arquivos", [KEY_ARQUIVOS]);
  const qc = useQueryClient();
  const topicos = useQuery({ queryKey: KEY_TOPICOS, queryFn: fetchTopicos });
  const arquivos = useQuery({ queryKey: KEY_ARQUIVOS, queryFn: fetchArquivos });
  const eu = useQuery({
    queryKey: ["eu-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });
  const [aberto, setAberto] = useState<string | null>(null);
  const [editando, setEditando] = useState<Partial<TopicoArte> | null>(null);
  const lista = topicos.data ?? [];
  const atual = lista.find((t) => t.id === aberto) ?? lista[0] ?? null;
  const doTopico = useMemo(
    () => (arquivos.data ?? []).filter((a) => a.topico_id === atual?.id),
    [arquivos.data, atual?.id],
  );
  const pode = (dono: string | null) => podeGerir || (!!dono && dono === eu.data);

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: KEY_TOPICOS });
    void qc.invalidateQueries({ queryKey: KEY_ARQUIVOS });
  };

  if (topicos.isError)
    return (
      <p className="glass mt-4 rounded-[22px] p-8 text-center text-sm text-muted-foreground">
        Os tópicos ainda não estão no banco. (A atualização do banco desta aba precisa ser aplicada.)
      </p>
    );

  return (
    <div className="mt-4 grid gap-3.5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="glass rounded-[22px] p-3 xl:sticky xl:top-6 xl:self-start">
        <div className="flex items-center justify-between px-2 pb-2">
          <p className="arte-rotulo">Tópicos</p>
          <button type="button" className="arte-baixar" onClick={() => setEditando({})}>
            <Plus className="size-3.5" /> Novo
          </button>
        </div>
        {topicos.isLoading ? (
          <Loader2 className="mx-auto my-6 size-4 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-0.5">
            {lista.map((t) => {
              const n = (arquivos.data ?? []).filter((a) => a.topico_id === t.id).length;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setAberto(t.id)}
                    className={cn("arte-topico", atual?.id === t.id && "arte-topico-on")}
                  >
                    <FolderOpen className="size-4 shrink-0" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                    <span className="tabular-nums text-[11px] opacity-60">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {atual ? (
        <Topico
          key={atual.id}
          topico={atual}
          arquivos={doTopico}
          carregando={arquivos.isLoading}
          podeTopico={pode(atual.criado_por_id)}
          podeArquivo={(a) => pode(a.criado_por_id)}
          onEditar={() => setEditando(atual)}
          onApagado={() => {
            setAberto(null);
            atualizar();
          }}
          onMudou={atualizar}
          todosArquivos={arquivos.data ?? []}
        />
      ) : (
        <section className="glass grid min-h-[240px] place-items-center rounded-[22px] p-8 text-center text-sm text-muted-foreground">
          Crie o primeiro tópico para começar a guardar as artes.
        </section>
      )}

      {editando && (
        <TopicoDialog
          inicial={editando}
          onClose={() => setEditando(null)}
          onSalvo={(id) => {
            setEditando(null);
            if (id) setAberto(id);
            atualizar();
          }}
          proximaOrdem={(lista.at(-1)?.ordem ?? 0) + 1}
        />
      )}
    </div>
  );
}

function Topico({
  topico,
  arquivos,
  todosArquivos,
  carregando,
  podeTopico,
  podeArquivo,
  onEditar,
  onApagado,
  onMudou,
}: {
  topico: TopicoArte;
  arquivos: ArquivoArte[];
  todosArquivos: ArquivoArte[];
  carregando: boolean;
  podeTopico: boolean;
  podeArquivo: (a: ArquivoArte) => boolean;
  onEditar: () => void;
  onApagado: () => void;
  onMudou: () => void;
}) {
  const [enviando, setEnviando] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const links = useQuery({
    queryKey: ["marketing-artes-links", arquivos.map((a) => a.caminho).join("|")],
    queryFn: () => linksDosArquivos(arquivos.map((a) => a.caminho)),
    enabled: arquivos.length > 0,
    staleTime: 50 * 60_000,
  });

  const enviar = async (files: FileList | File[] | null) => {
    const lista = [...(files ?? [])];
    if (!lista.length) return;
    setEnviando(lista.length);
    let ok = 0;
    for (const file of lista) {
      try {
        await anexarArquivo(topico.id, file);
        ok++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Falhou: ${file.name}`);
      }
      setEnviando((n) => n - 1);
    }
    if (ok) toast.success(ok === 1 ? "Arquivo anexado." : `${ok} arquivos anexados.`);
    onMudou();
  };

  const apagar = useMutation({
    mutationFn: apagarArquivo,
    onSuccess: () => {
      toast.success("Arquivo apagado.");
      onMudou();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu para apagar."),
  });

  const apagarTudo = useMutation({
    mutationFn: () => apagarTopico(topico.id, todosArquivos),
    onSuccess: () => {
      toast.success("Tópico apagado.");
      onApagado();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu para apagar."),
  });

  return (
    <section
      className={cn("glass rounded-[22px] p-5 transition", arrastando && "ring-2 ring-[#CE0F0F]/60")}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        void enviar(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="pagina-titulo !mt-0 !text-[22px]">{topico.titulo}</h3>
          {topico.descricao && <p className="hc-nota mt-1 whitespace-pre-wrap"><TextoFormatado texto={topico.descricao} /></p>}
          <p className="hc-nota mt-1">
            {arquivos.length} arquivo{arquivos.length === 1 ? "" : "s"}
            {topico.criado_por ? ` · criado por ${topico.criado_por}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex">
            <span className="arte-enviar">
              {enviando > 0 ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {enviando > 0 ? `Enviando ${enviando}…` : "Anexar arquivos"}
            </span>
            <input type="file" multiple className="hidden" onChange={(e) => void enviar(e.target.files)} disabled={enviando > 0} />
          </label>
          {podeTopico && (
            <>
              <Button variant="outline" size="sm" onClick={onEditar}>
                <Pencil className="size-3.5" /> Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Apagar o tópico "${topico.titulo}" e os ${arquivos.length} arquivos dele? Não dá para desfazer.`))
                    apagarTudo.mutate();
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {carregando ? (
        <Loader2 className="mx-auto my-10 size-5 animate-spin text-muted-foreground" />
      ) : arquivos.length === 0 ? (
        <label className="mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-white/[0.12] px-6 py-12 text-center">
          <ImagePlus className="size-6 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-[13px] text-foreground">Arraste as artes aqui ou clique para escolher</span>
          <span className="hc-nota">Imagens, PSD, PDF, vídeos… até 50 MB cada.</span>
          <input type="file" multiple className="hidden" onChange={(e) => void enviar(e.target.files)} />
        </label>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
          {arquivos.map((a) => {
            const url = links.data?.get(a.caminho);
            return (
              <div key={a.id} className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                <a href={url} target="_blank" rel="noreferrer" className="grid aspect-[4/3] place-items-center bg-black/30">
                  {ehImagemArte(a) && url ? (
                    <img src={url} alt={a.nome} className="size-full object-contain" loading="lazy" />
                  ) : (
                    <FileIcon className="size-8 text-muted-foreground" strokeWidth={1.5} />
                  )}
                </a>
                <div className="p-3">
                  <p className="truncate text-[12.5px] font-medium text-foreground" title={a.nome}>
                    {a.nome}
                  </p>
                  <p className="hc-nota truncate">
                    {[tamanhoBonito(a.tamanho), a.criado_por, new Date(a.created_at).toLocaleDateString("pt-BR")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <a href={url ? `${url}&download=${encodeURIComponent(a.nome)}` : undefined} className="arte-baixar">
                      <Download className="size-3" /> Baixar
                    </a>
                    {podeArquivo(a) && (
                      <button
                        type="button"
                        className="arte-baixar opacity-60 hover:opacity-100"
                        onClick={() => {
                          if (window.confirm(`Apagar "${a.nome}"? Não dá para desfazer.`)) apagar.mutate(a);
                        }}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TopicoDialog({
  inicial,
  onClose,
  onSalvo,
  proximaOrdem,
}: {
  inicial: Partial<TopicoArte>;
  onClose: () => void;
  onSalvo: (id?: string) => void;
  proximaOrdem: number;
}) {
  const [titulo, setTitulo] = useState(inicial.titulo ?? "");
  const [descricao, setDescricao] = useState(inicial.descricao ?? "");
  const salvar = useMutation({
    mutationFn: async () => {
      if (inicial.id) await editarTopico(inicial.id, { titulo, descricao: descricao.trim() || null });
      else await criarTopico({ titulo, descricao, ordem: proximaOrdem });
    },
    onSuccess: () => {
      toast.success(inicial.id ? "Tópico salvo." : "Tópico criado.");
      onSalvo(inicial.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não deu para salvar."),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>{inicial.id ? "Editar tópico" : "Novo tópico"}</DialogTitle>
        <form
          className="mt-2 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (titulo.trim()) salvar.mutate();
          }}
        >
          <label className="block">
            <span className="arte-rotulo">Nome do tópico</span>
            <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} className="arte-input mt-1.5" placeholder="Ex.: Artes de eventos" />
          </label>
          <label className="block">
            <span className="arte-rotulo">Descrição (opcional)</span>
            <EditorTexto value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className="arte-input mt-1.5 resize-y" />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!titulo.trim() || salvar.isPending}>
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
