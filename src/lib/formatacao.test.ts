import { test } from "node:test";
import assert from "node:assert/strict";
import { alternarMarca, lerLinha, mudarCaixa, prefixarLinhas, tipoDaLinha } from "./formatacao";

test("lê as marcas do Discord, uma dentro da outra", () => {
  assert.deepEqual(lerLinha("Ola **tudo *bem*** ok"), [
    "Ola ",
    { t: "b", filhos: ["tudo ", { t: "i", filhos: ["bem"] }] },
    " ok",
  ]);
  assert.deepEqual(lerLinha("__sub__ ~~ris~~ ||seg|| `cod *x*`"), [
    { t: "u", filhos: ["sub"] },
    " ",
    { t: "s", filhos: ["ris"] },
    " ",
    { t: "spoiler", filhos: ["seg"] },
    " ",
    { t: "code", filhos: ["cod *x*"] },
  ]);
  // sublinhado no meio de palavra não vira itálico
  assert.deepEqual(lerLinha("nome_do_arquivo"), ["nome_do_arquivo"]);
});

test("links viram link", () => {
  const n = lerLinha("veja https://hostgg.dev/players.");
  assert.deepEqual(n, ["veja ", { t: "link", href: "https://hostgg.dev/players" }, "."]);
});

test("tipo da linha", () => {
  assert.deepEqual(tipoDaLinha("# Título"), { tipo: "h1", conteudo: "Título" });
  assert.deepEqual(tipoDaLinha("-# pequeno"), { tipo: "pequeno", conteudo: "pequeno" });
  assert.deepEqual(tipoDaLinha("> fala"), { tipo: "citacao", conteudo: "fala" });
  assert.equal(tipoDaLinha("#741 é o ID").tipo, "texto");
});

test("botão negrito põe e tira as marcas", () => {
  const t = "Ola tudo bem";
  const a = alternarMarca(t, 9, 12, "**");
  assert.equal(a.texto, "Ola tudo **bem**");
  assert.equal(a.texto.slice(a.inicio, a.fim), "bem");
  const b = alternarMarca(a.texto, a.inicio, a.fim, "**");
  assert.equal(b.texto, t);
  // espaço selecionado junto fica fora da marca
  assert.equal(alternarMarca("um dois", 2, 7, "**").texto, "um **dois**".replace("um **", "um **"));
  assert.equal(alternarMarca("um dois", 2, 7, "**").texto, "um **dois**");
});

test("título, citação e maiúsculas", () => {
  assert.equal(prefixarLinhas("aviso\nlinha", 0, 3, "# ").texto, "# aviso\nlinha");
  assert.equal(prefixarLinhas("# aviso", 2, 4, "# ").texto, "aviso");
  assert.equal(prefixarLinhas("# aviso", 2, 4, "## ").texto, "## aviso");
  assert.equal(prefixarLinhas("a\nb", 0, 3, "> ").texto, "> a\n> b");
  assert.equal(prefixarLinhas("> a\n> b", 0, 7, "> ").texto, "a\nb");
  assert.equal(mudarCaixa("ola mundo", 4, 9, "maiusculas").texto, "ola MUNDO");
});

test("editor: texto guardado ↔ HTML ida e volta", async () => {
  const { markdownParaHtml, htmlParaMarkdown, textoSemMarcas } = await import("./formatacao");
  const md = "# Aviso\nOla **tudo *bem*** e __sub__\n> citação\n\nfim ||segredo||";
  const html = markdownParaHtml(md);
  assert.match(html, /<h1>Aviso<\/h1>/);
  assert.match(html, /<b>tudo <i>bem<\/i><\/b>/);
  // DOM mínimo de mentira (o teste roda fora do navegador)
  type N = { nodeType: number; nodeName: string; textContent: string | null; childNodes: N[]; getAttribute?: (n: string) => string | null };
  const txt = (s: string): N => ({ nodeType: 3, nodeName: "#text", textContent: s, childNodes: [] });
  const el = (tag: string, kids: N[], attrs: Record<string, string> = {}): N => ({ nodeType: 1, nodeName: tag.toUpperCase(), textContent: null, childNodes: kids, getAttribute: (n) => attrs[n] ?? null });
  const raiz = el("div", [
    el("h1", [txt("Aviso")]),
    el("div", [txt("Ola "), el("b", [txt("tudo "), el("i", [txt("bem")])]), txt(" e "), el("u", [txt("sub")])]),
    el("blockquote", [txt("citação")]),
    el("div", [el("br", [])]),
    el("div", [txt("fim "), el("span", [txt("segredo")], { "data-spoiler": "1" })]),
  ]);
  assert.equal(htmlParaMarkdown(raiz), md);
  // negrito com espaço no fim fica "**bem** "
  assert.equal(htmlParaMarkdown(el("div", [el("div", [el("b", [txt("bem ")]), txt("x")])])), "**bem** x");
  assert.equal(textoSemMarcas("# Oi\n**forte** e *leve*"), "Oi forte e leve");
});
