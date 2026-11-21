import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bold, ChevronDown, Code, EyeOff, Italic, Quote, Strikethrough, Underline } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra de formatação igual à do Discord, para TODO o site: selecione um trecho (ou clique 2x numa
 * palavra) em qualquer campo de descrição (EditorTexto) e ela aparece em cima. O texto fica
 * formatado de verdade na hora (negrito aparece negrito, sem os ** à vista).
 * Ctrl+B, Ctrl+I e Ctrl+U também funcionam (são do próprio navegador).
 */

const editorDa = (n: Node | null): HTMLElement | null => {
  const el = n instanceof HTMLElement ? n : n?.parentElement ?? null;
  return (el?.closest("[data-editor-texto]") as HTMLElement | null) ?? null;
};

function selecaoNoEditor() {
  const s = window.getSelection();
  if (!s || s.rangeCount === 0 || s.isCollapsed) return null;
  const r = s.getRangeAt(0);
  const ed = editorDa(r.commonAncestorContainer);
  if (!ed || ed.getAttribute("contenteditable") !== "true") return null;
  return { s, r, ed };
}

/** Avisa o editor que mudou (para ele salvar o texto). */
const avisar = (ed: HTMLElement) => ed.dispatchEvent(new Event("input", { bubbles: true }));

/** Elemento de bloco (linha) onde está o cursor. */
function blocoAtual(ed: HTMLElement, n: Node): HTMLElement | null {
  let el: HTMLElement | null = n instanceof HTMLElement ? n : n.parentElement;
  while (el && el !== ed) {
    if (/^(DIV|P|H1|H2|H3|BLOCKQUOTE)$/.test(el.tagName) && el.parentElement === ed) return el;
    el = el.parentElement;
  }
  return null;
}

/** Envolve (ou tira) a seleção num elemento: código ou spoiler. */
function alternarEmbrulho(tipo: "code" | "spoiler") {
  const sel = selecaoNoEditor();
  if (!sel) return;
  const { s, r, ed } = sel;
  const seletor = tipo === "code" ? "code" : "[data-spoiler]";
  const ja = (r.commonAncestorContainer instanceof HTMLElement ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement)?.closest(seletor);
  if (ja && ed.contains(ja)) {
    ja.replaceWith(...Array.from(ja.childNodes));
  } else {
    const novo = document.createElement(tipo === "code" ? "code" : "span");
    if (tipo === "spoiler") novo.setAttribute("data-spoiler", "1");
    novo.appendChild(r.extractContents());
    r.insertNode(novo);
    s.removeAllRanges();
    const nr = document.createRange();
    nr.selectNodeContents(novo);
    s.addRange(nr);
  }
  avisar(ed);
}

/** Muda a linha: título, subtítulo, citação, texto pequeno ou normal. */
function mudarLinha(tipo: "h1" | "h2" | "h3" | "blockquote" | "pequeno" | "div") {
  const sel = selecaoNoEditor();
  if (!sel) return;
  const { r, ed } = sel;
  const atual = blocoAtual(ed, r.startContainer);
  const igual =
    atual &&
    ((tipo === "pequeno" && atual.hasAttribute("data-pequeno")) ||
      (tipo !== "pequeno" && atual.tagName.toLowerCase() === tipo));
  const alvo = igual ? "div" : tipo;
  document.execCommand("formatBlock", false, alvo === "pequeno" ? "p" : alvo);
  const depois = blocoAtual(ed, window.getSelection()?.getRangeAt(0).startContainer ?? r.startContainer);
  if (depois) {
    if (alvo === "pequeno") depois.setAttribute("data-pequeno", "1");
    else depois.removeAttribute("data-pequeno");
  }
  avisar(ed);
}

function mudarCaixaNoEditor(caixa: "maiusculas" | "minusculas") {
  const sel = selecaoNoEditor();
  if (!sel) return;
  const texto = sel.s.toString();
  document.execCommand("insertText", false, caixa === "maiusculas" ? texto.toLocaleUpperCase("pt-BR") : texto.toLocaleLowerCase("pt-BR"));
  avisar(sel.ed);
}

export function BarraDeFormatacao() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const [ativos, setAtivos] = useState<Record<string, boolean>>({});
  const quadro = useRef(0);

  useEffect(() => {
    const olhar = () => {
      cancelAnimationFrame(quadro.current);
      quadro.current = requestAnimationFrame(() => {
        const sel = selecaoNoEditor();
        if (!sel) {
          setPos(null);
          setMenu(false);
          return;
        }
        const caixa = sel.r.getBoundingClientRect();
        const x = Math.min(Math.max(caixa.left + caixa.width / 2, 190), window.innerWidth - 190);
        setPos({ x, y: Math.max(caixa.top, 56) });
        setAtivos({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          strikeThrough: document.queryCommandState("strikeThrough"),
        });
      });
    };
    document.addEventListener("selectionchange", olhar);
    window.addEventListener("scroll", olhar, true);
    window.addEventListener("resize", olhar);
    return () => {
      cancelAnimationFrame(quadro.current);
      document.removeEventListener("selectionchange", olhar);
      window.removeEventListener("scroll", olhar, true);
      window.removeEventListener("resize", olhar);
    };
  }, []);

  if (!pos || typeof document === "undefined") return null;

  const comando = (c: string) => () => {
    const sel = selecaoNoEditor();
    if (!sel) return;
    document.execCommand(c);
    avisar(sel.ed);
    setAtivos((a) => ({ ...a, [c]: document.queryCommandState(c) }));
  };
  const linha = (t: Parameters<typeof mudarLinha>[0]) => () => {
    mudarLinha(t);
    setMenu(false);
  };

  const botoes = [
    { r: "Negrito (Ctrl+B)", i: Bold, f: comando("bold"), on: ativos["bold"] },
    { r: "Itálico (Ctrl+I)", i: Italic, f: comando("italic"), on: ativos["italic"] },
    { r: "Sublinhado (Ctrl+U)", i: Underline, f: comando("underline"), on: ativos["underline"] },
    { r: "Riscado", i: Strikethrough, f: comando("strikeThrough"), on: ativos["strikeThrough"] },
  ];
  const depois = [
    { r: "Citação", i: Quote, f: linha("blockquote") },
    { r: "Código", i: Code, f: () => alternarEmbrulho("code") },
    { r: "Spoiler (esconde até clicar)", i: EyeOff, f: () => alternarEmbrulho("spoiler") },
  ];

  return createPortal(
    <div
      className="barra-fmt"
      style={{ left: pos.x, top: pos.y }}
      // não deixa o clique tirar a seleção do campo
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
      aria-label="Formatar texto"
    >
      {botoes.map((b) => (
        <button key={b.r} type="button" title={b.r} aria-label={b.r} aria-pressed={!!b.on} onClick={b.f} className={cn("barra-fmt-btn", b.on && "barra-fmt-btn-on")}>
          <b.i className="size-[17px]" strokeWidth={2.3} />
        </button>
      ))}
      <span className="barra-fmt-sep" />
      {depois.map((b) => (
        <button key={b.r} type="button" title={b.r} aria-label={b.r} onClick={b.f} className="barra-fmt-btn">
          <b.i className="size-[17px]" strokeWidth={2.1} />
        </button>
      ))}
      <span className="barra-fmt-sep" />
      <div className="relative">
        <button type="button" title="Texto: título, tamanho e MAIÚSCULAS" onClick={() => setMenu((v) => !v)} className={cn("barra-fmt-btn barra-fmt-texto", menu && "barra-fmt-btn-on")}>
          Aa <ChevronDown className="size-3" />
        </button>
        {menu && (
          <div className="barra-fmt-menu">
            <button type="button" onClick={linha("h1")}>
              <span className="text-[17px] font-bold">Título</span>
            </button>
            <button type="button" onClick={linha("h2")}>
              <span className="text-[15px] font-bold">Subtítulo</span>
            </button>
            <button type="button" onClick={linha("h3")}>
              <span className="text-[13.5px] font-semibold">Título menor</span>
            </button>
            <button type="button" onClick={linha("div")}>
              <span className="text-[13px]">Texto normal</span>
            </button>
            <button type="button" onClick={linha("pequeno")}>
              <span className="text-[11.5px] text-muted-foreground">Texto pequeno</span>
            </button>
            <span className="barra-fmt-menu-sep" />
            <button type="button" onClick={() => { mudarCaixaNoEditor("maiusculas"); setMenu(false); }}>
              <span className="text-[12.5px] font-semibold tracking-wide">MAIÚSCULAS</span>
            </button>
            <button type="button" onClick={() => { mudarCaixaNoEditor("minusculas"); setMenu(false); }}>
              <span className="text-[12.5px]">minúsculas</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
