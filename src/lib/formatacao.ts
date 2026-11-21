/**
 * Formatação de texto igual à do Discord, usada em todo o site (descrições, avisos, anotações...).
 * O texto fica guardado com as marcas e a tela mostra já formatado:
 *   **negrito**  *itálico* ou _itálico_  __sublinhado__  ~~riscado~~  ||spoiler||  `código`
 *   linhas: "# Título", "## Subtítulo", "### Menor", "-# texto pequeno", "> citação", "- item"
 * A barra flutuante (src/components/barra-formatacao.tsx) aplica as marcas ao selecionar o texto.
 */

export type Marca = "b" | "i" | "u" | "s" | "spoiler" | "code";
export type No = string | { t: Marca; filhos: No[] } | { t: "link"; href: string };

const REGRAS: { t: Marca | "link"; re: RegExp }[] = [
  { t: "code", re: /`([^`\n]+)`/ },
  // "(?!\*)": em "**tudo *bem***" o negrito fecha no último "**"
  { t: "b", re: /\*\*([^\n]+?)\*\*(?!\*)/ },
  { t: "u", re: /__([^\n]+?)__(?!_)/ },
  { t: "s", re: /~~([^\n]+?)~~/ },
  { t: "spoiler", re: /\|\|([^\n]+?)\|\|/ },
  { t: "i", re: /\*([^*\n]+?)\*/ },
  { t: "i", re: /(?<![\p{L}\p{N}])_([^_\n]+?)_(?![\p{L}\p{N}])/u },
  { t: "link", re: /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/ },
];

/** Lê uma linha e devolve os pedaços já com negrito, itálico... (pode ter um dentro do outro). */
export function lerLinha(texto: string): No[] {
  const saida: No[] = [];
  let resto = texto;
  while (resto) {
    let melhor: { i: number; m: RegExpExecArray; t: Marca | "link" } | null = null;
    for (const r of REGRAS) {
      const m = r.re.exec(resto);
      if (m && (melhor === null || m.index < melhor.i)) melhor = { i: m.index, m, t: r.t };
    }
    if (!melhor) {
      saida.push(resto);
      break;
    }
    if (melhor.i > 0) saida.push(resto.slice(0, melhor.i));
    if (melhor.t === "link") saida.push({ t: "link", href: melhor.m[0] });
    else if (melhor.t === "code") saida.push({ t: "code", filhos: [melhor.m[1] ?? ""] });
    else saida.push({ t: melhor.t, filhos: lerLinha(melhor.m[1] ?? "") });
    resto = resto.slice(melhor.i + melhor.m[0].length);
  }
  return saida;
}

export type TipoLinha = "h1" | "h2" | "h3" | "pequeno" | "citacao" | "lista" | "texto";

/** O tipo da linha pelo começo dela ("# ", "> ", "- "...). */
export function tipoDaLinha(linha: string): { tipo: TipoLinha; conteudo: string } {
  const regras: [RegExp, TipoLinha][] = [
    [/^###\s+/, "h3"],
    [/^##\s+/, "h2"],
    [/^#\s+/, "h1"],
    [/^-#\s+/, "pequeno"],
    [/^>\s?/, "citacao"],
    [/^\s*[-•]\s+/, "lista"],
  ];
  for (const [re, tipo] of regras) if (re.test(linha)) return { tipo, conteudo: linha.replace(re, "") };
  return { tipo: "texto", conteudo: linha };
}

/** Tem alguma marca de formatação? (para não trocar à toa o jeito de mostrar) */
export const temFormatacao = (texto: string) =>
  /(\*\*|__|~~|\|\||`|(^|\n)(#{1,3}|-#|>)\s|(^|\s)[*_][^\s])/.test(texto);

/* ------------------------------------------------------------------ aplicar na seleção */

export interface Edicao {
  texto: string;
  inicio: number;
  fim: number;
}

/** Põe (ou tira, se já tiver) as marcas em volta do trecho selecionado. */
export function alternarMarca(texto: string, inicio: number, fim: number, marca: string): Edicao {
  const sel = texto.slice(inicio, fim);
  const n = marca.length;
  // já tem a marca do lado de fora da seleção: tira
  if (texto.slice(inicio - n, inicio) === marca && texto.slice(fim, fim + n) === marca) {
    return {
      texto: texto.slice(0, inicio - n) + sel + texto.slice(fim + n),
      inicio: inicio - n,
      fim: fim - n,
    };
  }
  // a seleção já inclui a marca: tira
  if (sel.length > 2 * n && sel.startsWith(marca) && sel.endsWith(marca)) {
    const dentro = sel.slice(n, -n);
    return { texto: texto.slice(0, inicio) + dentro + texto.slice(fim), inicio, fim: inicio + dentro.length };
  }
  // espaços nas pontas ficam de fora da marca ("**palavra** " e não "**palavra **")
  const antes = sel.match(/^\s*/)?.[0] ?? "";
  const depois = sel.match(/\s*$/)?.[0] ?? "";
  const meio = sel.slice(antes.length, sel.length - depois.length);
  const novo = `${antes}${marca}${meio}${marca}${depois}`;
  return {
    texto: texto.slice(0, inicio) + novo + texto.slice(fim),
    inicio: inicio + antes.length + n,
    fim: inicio + antes.length + n + meio.length,
  };
}

/** Linhas inteiras da seleção (para citação, título...). */
function linhasDaSelecao(texto: string, inicio: number, fim: number) {
  const a = texto.lastIndexOf("\n", inicio - 1) + 1;
  let b = texto.indexOf("\n", fim > inicio && texto[fim - 1] === "\n" ? fim - 1 : fim);
  if (b === -1) b = texto.length;
  return { a, b, linhas: texto.slice(a, b).split("\n") };
}

const PREFIXO_DE_TITULO = /^(#{1,3}|-#)\s+/;

/** Muda o começo das linhas selecionadas: título, subtítulo, citação ou texto normal. */
export function prefixarLinhas(
  texto: string,
  inicio: number,
  fim: number,
  prefixo: "# " | "## " | "### " | "-# " | "> " | "",
): Edicao {
  const { a, b, linhas } = linhasDaSelecao(texto, inicio, fim);
  const semTitulo = (l: string) => l.replace(PREFIXO_DE_TITULO, "");
  const semCitacao = (l: string) => l.replace(/^>\s?/, "");
  let novas: string[];
  if (prefixo === "") {
    // texto normal: tira título e citação
    novas = linhas.map((l) => semTitulo(semCitacao(l)));
  } else if (prefixo === "> ") {
    const todas = linhas.every((l) => /^>/.test(l));
    novas = linhas.map((l) => (todas ? semCitacao(l) : `> ${semCitacao(l)}`));
  } else {
    // título: clicar de novo no mesmo volta para texto normal
    const todas = linhas.every((l) => l.startsWith(prefixo));
    novas = linhas.map((l) => (todas ? semTitulo(l) : prefixo + semTitulo(l)));
  }
  const bloco = novas.join("\n");
  return { texto: texto.slice(0, a) + bloco + texto.slice(b), inicio: a, fim: a + bloco.length };
}

/** MAIÚSCULAS / minúsculas no trecho selecionado. */
export function mudarCaixa(texto: string, inicio: number, fim: number, caixa: "maiusculas" | "minusculas"): Edicao {
  const sel = texto.slice(inicio, fim);
  const novo = caixa === "maiusculas" ? sel.toLocaleUpperCase("pt-BR") : sel.toLocaleLowerCase("pt-BR");
  return { texto: texto.slice(0, inicio) + novo + texto.slice(fim), inicio, fim: inicio + novo.length };
}

/* ------------------------------------------------------------------ editor que já mostra formatado */

const escaparHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function nosParaHtml(nos: No[]): string {
  return nos
    .map((n) => {
      if (typeof n === "string") return escaparHtml(n);
      if (n.t === "link") return escaparHtml(n.href);
      const dentro = nosParaHtml(n.filhos);
      switch (n.t) {
        case "b":
          return `<b>${dentro}</b>`;
        case "i":
          return `<i>${dentro}</i>`;
        case "u":
          return `<u>${dentro}</u>`;
        case "s":
          return `<s>${dentro}</s>`;
        case "code":
          return `<code>${dentro}</code>`;
        case "spoiler":
          return `<span data-spoiler="1">${dentro}</span>`;
      }
    })
    .join("");
}

/** Texto guardado (com as marcas) → HTML para o editor mostrar já formatado. */
export function markdownParaHtml(texto: string): string {
  if (!texto) return "";
  return texto
    .split("\n")
    .map((linha) => {
      const { tipo, conteudo } = tipoDaLinha(linha);
      const html = nosParaHtml(lerLinha(conteudo)) || "<br>";
      switch (tipo) {
        case "h1":
          return `<h1>${html}</h1>`;
        case "h2":
          return `<h2>${html}</h2>`;
        case "h3":
          return `<h3>${html}</h3>`;
        case "pequeno":
          return `<p data-pequeno="1">${html}</p>`;
        case "citacao":
          return `<blockquote>${html}</blockquote>`;
        default:
          return `<div>${tipo === "lista" ? escaparHtml(linha.slice(0, linha.length - conteudo.length)) : ""}${html}</div>`;
      }
    })
    .join("");
}

type NoDom = { nodeType: number; nodeName: string; textContent: string | null; childNodes: ArrayLike<NoDom> } & {
  getAttribute?: (n: string) => string | null;
  style?: { fontWeight?: string; fontStyle?: string; textDecoration?: string; textDecorationLine?: string };
};

/** Põe as marcas em volta, deixando os espaços das pontas de fora ("**bem** ", não "**bem **"). */
function envolver(dentro: string, marca: string): string {
  if (!dentro.trim()) return dentro;
  const a = dentro.match(/^\s*/)?.[0] ?? "";
  const b = dentro.match(/\s*$/)?.[0] ?? "";
  return `${a}${marca}${dentro.slice(a.length, dentro.length - b.length)}${marca}${b}`;
}

function inline(n: NoDom): string {
  if (n.nodeType === 3) return (n.textContent ?? "").replace(/\u00a0/g, " ");
  if (n.nodeType !== 1) return "";
  const tag = n.nodeName.toLowerCase();
  if (tag === "br") return "\n";
  const kids = Array.from(n.childNodes).map(inline).join("");
  const st = n.style;
  const deco = `${st?.textDecoration ?? ""} ${st?.textDecorationLine ?? ""}`;
  if (tag === "code") return kids ? `\`${kids.replace(/`/g, "")}\`` : "";
  if (n.getAttribute?.("data-spoiler")) return envolver(kids, "||");
  let out = kids;
  if (tag === "b" || tag === "strong" || st?.fontWeight === "bold" || Number(st?.fontWeight) >= 600) out = envolver(out, "**");
  if (tag === "i" || tag === "em" || st?.fontStyle === "italic") out = envolver(out, "*");
  if (tag === "u" || deco.includes("underline")) out = envolver(out, "__");
  if (tag === "s" || tag === "strike" || tag === "del" || deco.includes("line-through")) out = envolver(out, "~~");
  return out;
}

const BLOCOS = new Set(["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li", "ul", "ol", "pre"]);

/** HTML do editor → texto guardado com as marcas (o mesmo formato do Discord). */
export function htmlParaMarkdown(raiz: NoDom): string {
  const linhas: string[] = [];
  let atual: string | null = null;
  const fecharAtual = () => {
    if (atual !== null) linhas.push(...atual.split("\n"));
    atual = null;
  };
  const bloco = (el: NoDom) => {
    const tag = el.nodeName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      for (const f of Array.from(el.childNodes)) bloco(f);
      return;
    }
    // bloco com outros blocos dentro (ex.: <div><div>…</div></div>)
    if (Array.from(el.childNodes).some((f) => f.nodeType === 1 && BLOCOS.has(f.nodeName.toLowerCase()))) {
      const sub = htmlParaMarkdown(el);
      if (sub) linhas.push(...sub.split("\n"));
      return;
    }
    let texto = Array.from(el.childNodes).map(inline).join("");
    if (texto.endsWith("\n")) texto = texto.slice(0, -1); // o <br> do fim da linha não é linha nova
    const partes = texto.split("\n");
    const prefixo =
      tag === "h1" ? "# " : tag === "h2" ? "## " : tag === "h3" ? "### " : tag === "blockquote" ? "> " : tag === "li" ? "- " : el.getAttribute?.("data-pequeno") ? "-# " : "";
    linhas.push(...partes.map((p) => (prefixo && p.trim() ? prefixo + p : p)));
  };
  for (const n of Array.from(raiz.childNodes)) {
    if (n.nodeType === 1 && BLOCOS.has(n.nodeName.toLowerCase())) {
      fecharAtual();
      bloco(n);
    } else {
      atual = (atual ?? "") + inline(n);
    }
  }
  fecharAtual();
  // tira linhas vazias sobrando no fim
  while (linhas.length && !linhas[linhas.length - 1]!.trim()) linhas.pop();
  return linhas.join("\n");
}

/** Texto sem as marcas (para prévias de uma linha, títulos de aba, notificações). */
export function textoSemMarcas(texto: string): string {
  return texto
    .split("\n")
    .map((l) => tipoDaLinha(l).conteudo)
    .join(" ")
    .replace(/\*\*|__|~~|\|\||`/g, "")
    .replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}
