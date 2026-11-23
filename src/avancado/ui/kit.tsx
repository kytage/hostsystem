// Kit de componentes do HOST CENTRAL (visual do painel da staff).
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Check, Copy, Loader2, Search, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { CONFIANCAS, corDe, nomeDe, type Opcao } from "@/avancado/shared/dominio";

export const cn = clsx;

/** Avisos rápidos no canto da tela. */
export const aviso = {
  ok: (texto: string): void => void toast.success(texto),
  erro: (texto: string): void => void toast.error(texto),
  info: (texto: string): void => void toast(texto),
};

/* ---------------- página e cartões ---------------- */

export function Pagina({ sobretitulo, titulo, descricao, acoes, children }: { sobretitulo?: string; titulo: string; descricao?: ReactNode; acoes?: ReactNode; children: ReactNode }) {
  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div className="min-w-0">
          {sobretitulo && <p className="sobretitulo">{sobretitulo}</p>}
          <h1 className="pagina-titulo">{titulo}</h1>
          {descricao && <p className="pagina-descricao">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </header>
      {children}
    </div>
  );
}

export function Cartao({ titulo, nota, acao, children, className, semPadding }: { titulo?: ReactNode; nota?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string; semPadding?: boolean }) {
  return (
    <section className={cn("vidro", !semPadding && "cartao", className)}>
      {(titulo || acao) && (
        <header className={cn("mb-3 flex items-start justify-between gap-3", semPadding && "px-4 pt-4")}>
          <div className="min-w-0">
            {titulo && <h2 className="cartao-titulo">{titulo}</h2>}
            {nota && <p className="cartao-nota mt-0.5">{nota}</p>}
          </div>
          {acao && <div className="flex shrink-0 items-center gap-1.5">{acao}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Número que conta de zero até o valor, uma vez. */
function Contagem({ valor }: { valor: number }) {
  const [mostrado, setMostrado] = useState(0);
  const feito = useRef(false);
  useEffect(() => {
    if (feito.current || valor === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMostrado(valor);
      feito.current = true;
      return;
    }
    feito.current = true;
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / 700);
      setMostrado(Math.round(valor * (1 - Math.pow(1 - t, 3))));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor]);
  return <>{mostrado.toLocaleString("pt-BR")}</>;
}

export function Indice({ valor, titulo, nota, icone: Icone, alerta, aoClicar, solto = true }: { valor: number | string; titulo: string; nota?: ReactNode; icone?: LucideIcon; alerta?: boolean; aoClicar?: () => void; solto?: boolean }) {
  const miolo = (
    <>
      <span className="indice-valor">{typeof valor === "number" ? <Contagem valor={valor} /> : valor}</span>
      {Icone && (
        <span className="indice-icone" aria-hidden>
          <Icone size={15} strokeWidth={1.75} />
        </span>
      )}
      <span className="indice-rotulo">{titulo}</span>
      {nota !== undefined && nota !== null && nota !== "" && <span className="indice-nota">{nota}</span>}
    </>
  );
  const classe = cn("indice", solto ? "vidro" : "veu");
  if (aoClicar)
    return (
      <button type="button" className={cn(classe, "transition-colors hover:brightness-125")} onClick={aoClicar} data-alerta={alerta ? "" : undefined}>
        {miolo}
      </button>
    );
  return (
    <div className={classe} data-alerta={alerta ? "" : undefined}>
      {miolo}
    </div>
  );
}
export function Indices({ children, colunas }: { children: ReactNode; colunas?: number }) {
  return (
    <div className="indices" style={{ "--quantos": colunas ?? 4 } as CSSProperties}>
      {children}
    </div>
  );
}

/* ---------------- botões ---------------- */

type Variante = "principal" | "secundario" | "fantasma" | "perigo";
export function Botao({ variante = "secundario", pequeno, icone: Icone, carregando, children, className, ...resto }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; pequeno?: boolean; icone?: LucideIcon; carregando?: boolean }) {
  return (
    <button type="button" {...resto} disabled={resto.disabled || carregando} className={cn("botao", `botao-${variante}`, pequeno && "botao-pequeno", className)}>
      {carregando ? <Loader2 size={15} className="animate-spin" /> : Icone ? <Icone size={15} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}
export function BotaoIcone({ icone: Icone, rotulo, className, ...resto }: ButtonHTMLAttributes<HTMLButtonElement> & { icone: LucideIcon; rotulo: string }) {
  return (
    <button type="button" {...resto} aria-label={rotulo} title={rotulo} className={cn("botao-icone", className)}>
      <Icone size={16} strokeWidth={1.75} />
    </button>
  );
}
export function BotaoCopiar({ texto, rotulo = "Copiar", aoCopiar, variante = "secundario", pequeno = true }: { texto: string; rotulo?: string; aoCopiar?: () => void; variante?: Variante; pequeno?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // navegador sem permissão: usa o jeito antigo
      const t = document.createElement("textarea");
      t.value = texto;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopiado(true);
    aviso.ok("Copiado");
    aoCopiar?.();
    window.setTimeout(() => setCopiado(false), 1600);
  };
  return (
    <Botao variante={variante} pequeno={pequeno} icone={copiado ? Check : Copy} onClick={() => void copiar()}>
      {copiado ? "Copiado" : rotulo}
    </Botao>
  );
}

/* ---------------- campos ---------------- */

export function Rotulo({ rotulo, dica, children, className }: { rotulo: string; dica?: string | undefined; children: ReactNode; className?: string | undefined }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="rotulo" title={dica}>
        {rotulo}
      </span>
      {children}
    </label>
  );
}
export function Campo({ rotulo, dica, classeCaixa, ...resto }: InputHTMLAttributes<HTMLInputElement> & { rotulo?: string; dica?: string; classeCaixa?: string }) {
  const input = <input {...resto} className={cn("campo", resto.className)} />;
  return rotulo ? (
    <Rotulo rotulo={rotulo} dica={dica} className={classeCaixa}>
      {input}
    </Rotulo>
  ) : (
    input
  );
}
/** Área de texto que cresce com o conteúdo. */
export function AreaTexto({ rotulo, dica, classeCaixa, linhas = 3, ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo?: string; dica?: string; classeCaixa?: string; linhas?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(520, el.scrollHeight + 2)}px`;
  }, [resto.value]);
  const area = <textarea ref={ref} rows={linhas} {...resto} className={cn("campo", resto.className)} />;
  return rotulo ? (
    <Rotulo rotulo={rotulo} dica={dica} className={classeCaixa}>
      {area}
    </Rotulo>
  ) : (
    area
  );
}
export function Selecao({ rotulo, opcoes, vazio, classeCaixa, ...resto }: SelectHTMLAttributes<HTMLSelectElement> & { rotulo?: string; opcoes: readonly Opcao[]; vazio?: string; classeCaixa?: string }) {
  const select = (
    <select {...resto} className={cn("campo", resto.className)}>
      {vazio !== undefined && <option value="">{vazio}</option>}
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nome}
        </option>
      ))}
    </select>
  );
  return rotulo ? (
    <Rotulo rotulo={rotulo} className={classeCaixa}>
      {select}
    </Rotulo>
  ) : (
    select
  );
}
export function CampoBusca({ valor, aoMudar, placeholder = "Buscar", className }: { valor: string; aoMudar: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={cn("campo-busca", className)}>
      <Search size={15} strokeWidth={1.75} className="shrink-0" />
      <input value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} />
      {valor && (
        <button type="button" onClick={() => aoMudar("")} aria-label="Limpar busca" className="grid size-5 place-items-center rounded-full hover:bg-white/10">
          <X size={13} />
        </button>
      )}
    </label>
  );
}
export function Marcar({ marcado, aoMudar, rotulo }: { marcado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label={rotulo}
      title={rotulo}
      className="marcar"
      onClick={(e) => {
        e.stopPropagation();
        aoMudar(!marcado);
      }}
    >
      <Check size={13} strokeWidth={3} />
    </button>
  );
}

/* ---------------- abas e etiquetas ---------------- */

export interface Aba<T extends string = string> {
  id: T;
  nome: string;
  contador?: number | undefined;
  alerta?: boolean | undefined;
  icone?: LucideIcon | undefined;
}
export function Segmentos<T extends string>({ abas, valor, aoMudar, rotulo }: { abas: readonly Aba<T>[]; valor: T; aoMudar: (v: T) => void; rotulo?: string }) {
  return (
    <div className="segmentos" role="tablist" aria-label={rotulo}>
      {abas.map((a) => (
        <button key={a.id} type="button" role="tab" aria-selected={valor === a.id} onClick={() => aoMudar(a.id)}>
          {a.icone && <a.icone size={14} strokeWidth={2} />}
          {a.nome}
          {a.contador !== undefined && a.contador > 0 && <span className={cn("contador", a.alerta && "contador-alerta")}>{a.contador}</span>}
        </button>
      ))}
    </div>
  );
}

export function Etiqueta({ children, cor, fraca, className, titulo }: { children: ReactNode; cor?: string | undefined; fraca?: boolean | undefined; className?: string | undefined; titulo?: string | undefined }) {
  return (
    <span className={cn("etiqueta", fraca && "etiqueta-fraca", className)} style={cor ? ({ "--cor": cor } as CSSProperties) : undefined} title={titulo}>
      {cor && <i aria-hidden />}
      {children}
    </span>
  );
}
/** Etiqueta de uma lista do vocabulário (ex.: etapa, prioridade, status). */
export function EtiquetaDe({ lista, id, fraca }: { lista: readonly Opcao[]; id: string | null | undefined; fraca?: boolean }) {
  if (!id) return null;
  const o = lista.find((x) => x.id === id);
  return (
    <Etiqueta cor={o?.cor} fraca={fraca} titulo={o?.dica}>
      {o?.nome ?? id}
    </Etiqueta>
  );
}
/** Confirmado / Estimativa / Hipótese — sempre ao lado de cidade, tamanho e indício. */
export function EtiquetaConfianca({ valor }: { valor: string }) {
  if (!valor || valor === "desconhecida") return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium" style={{ color: corDe(CONFIANCAS, valor) }} title={CONFIANCAS.find((c) => c.id === valor)?.dica}>
      <i className="ponto" style={{ "--cor": corDe(CONFIANCAS, valor), width: 5, height: 5 } as CSSProperties} aria-hidden />
      {nomeDe(CONFIANCAS, valor)}
    </span>
  );
}
export function Demo() {
  return <span className="etiqueta etiqueta-demo">DEMO</span>;
}

/* ---------------- estados ---------------- */

export function Vazio({ icone: Icone, titulo, texto, acao }: { icone?: LucideIcon; titulo: string; texto?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="vazio">
      {Icone && (
        <span className="vazio-icone">
          <Icone size={18} strokeWidth={1.75} />
        </span>
      )}
      <p className="text-[13.5px] font-medium text-tx-1">{titulo}</p>
      {texto && <p className="max-w-[46ch] text-[12.5px] text-tx-3">{texto}</p>}
      {acao && <div className="mt-1">{acao}</div>}
    </div>
  );
}
export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="grid gap-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="esqueleto h-11" />
      ))}
    </div>
  );
}
export function ErroDeCarga({ erro }: { erro: unknown }) {
  return <Vazio titulo="Não consegui carregar" texto={erro instanceof Error ? erro.message : "Tente recarregar a página."} />;
}

/** Guarda o valor digitado e só avisa depois de uma pausa (para buscas). */
export function useAtrasado<T>(valor: T, ms = 250): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setV(valor), ms);
    return () => window.clearTimeout(t);
  }, [valor, ms]);
  return v;
}
