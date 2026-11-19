/**
 * PDF do player (Painel de Players): páginas 16:9 (1920x1080), tema escuro do painel.
 * Página 1: ficha (perfil, identificação e estatísticas das logs). Depois, conforme as opções:
 * grupos/inventário/veículos, lista de logs e punições.
 */
import type { jsPDF } from "jspdf";
import { carregarLogoHost } from "@/lib/relatorio-pdf-ui";
import { brl, itemBase, type Player } from "@/lib/players";
import { lerLog } from "@/lib/logs-leitura";
import {
  BANNER_PADRAO,
  FOTO_PADRAO,
  categoriaDoCanal,
  dataCurta,
  haQuanto,
  progressoNoRank,
  type CargoEmblema,
  type GrupoPlayer,
  type LogDoPlayer,
  type PunicaoDoPlayer,
  type RankNivel,
  type ResumoDeLogs,
  type Situacao,
} from "@/lib/player-perfil";

export interface OpcoesPdfPlayer {
  estatisticas: boolean;
  grupos: boolean;
  inventario: boolean;
  veiculos: boolean;
  listaLogs: boolean;
  qtdLogs: number;
  punicoes: boolean;
  observacao: string;
}

export const OPCOES_PDF_PADRAO: OpcoesPdfPlayer = {
  estatisticas: true,
  grupos: true,
  inventario: true,
  veiculos: true,
  listaLogs: true,
  qtdLogs: 60,
  punicoes: true,
  observacao: "",
};

export interface DadosPdfPlayer {
  p: Player;
  situacao: Situacao;
  cargo: CargoEmblema | null;
  rank: RankNivel;
  grupos: GrupoPlayer[];
  logs: LogDoPlayer[];
  resumo: ResumoDeLogs;
  punicoes: PunicaoDoPlayer[];
  geradoPor: string;
  /** Foto do player (Admin = foto do site); vazia = foto padrão. */
  foto?: string;
}

/* 1920x1080 px = 1440x810 pt */
const W = 1440;
const H = 810;
const M = 36;

type RGB = [number, number, number];
const C = {
  fundo: [9, 9, 9] as RGB,
  cartao: [19, 19, 20] as RGB,
  cartao2: [27, 27, 29] as RGB,
  linha: [40, 40, 44] as RGB,
  texto: [245, 245, 245] as RGB,
  suave: [150, 150, 158] as RGB,
  fraco: [95, 95, 102] as RGB,
  acento: [229, 35, 27] as RGB,
  laranja: [251, 146, 60] as RGB,
  verde: [52, 211, 153] as RGB,
};

const hexRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** A fonte padrão do PDF só tem Latin-1: tira emoji e símbolos fora dela. */
const limpo = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/[^\u0000-ÿ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const num = (n: number) => n.toLocaleString("pt-BR");

/** Carrega a imagem já reduzida (o PDF fica leve). Falha de rede/CORS = null (a página segue sem ela). */
function carregarImagemPng(
  src: string,
  max = 640,
  jpeg = false,
): Promise<{ dataUrl: string; width: number; height: number; formato: "PNG" | "JPEG" } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        if (jpeg) {
          // fundo escuro por baixo (JPEG não tem transparência)
          ctx.globalCompositeOperation = "destination-over";
          ctx.fillStyle = "#131314";
          ctx.fillRect(0, 0, c.width, c.height);
        }
        resolve({
          dataUrl: jpeg ? c.toDataURL("image/jpeg", 0.86) : c.toDataURL("image/png"),
          width: c.width,
          height: c.height,
          formato: jpeg ? "JPEG" : "PNG",
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fundo(doc: jsPDF) {
  doc.setFillColor(...C.fundo);
  doc.rect(0, 0, W, H, "F");
}

function cartao(doc: jsPDF, x: number, y: number, w: number, h: number, cor: RGB = C.cartao) {
  doc.setFillColor(...cor);
  doc.setDrawColor(...C.linha);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, y, w, h, 14, 14, "FD");
}

function rotulo(doc: jsPDF, t: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.suave);
  doc.text(limpo(t).toUpperCase(), x, y, { charSpace: 0.8 });
}

function texto(
  doc: jsPDF,
  t: string,
  x: number,
  y: number,
  o: { size?: number; cor?: RGB; bold?: boolean; align?: "left" | "right" | "center"; max?: number } = {},
) {
  doc.setFont("helvetica", o.bold ? "bold" : "normal");
  doc.setFontSize(o.size ?? 12);
  doc.setTextColor(...(o.cor ?? C.texto));
  let s = limpo(t) || "-";
  if (o.max) {
    while (s.length > 1 && doc.getTextWidth(s) > o.max) s = s.slice(0, -2);
    if (s !== (limpo(t) || "-")) s = `${s.trimEnd()}...`;
  }
  doc.text(s, x, y, { align: o.align ?? "left" });
}

function pilula(doc: jsPDF, t: string, x: number, y: number, cor: RGB, solida = false) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const s = limpo(t);
  const w = doc.getTextWidth(s) + 22;
  if (solida) doc.setFillColor(...cor);
  else doc.setFillColor(Math.round(cor[0] * 0.25), Math.round(cor[1] * 0.25), Math.round(cor[2] * 0.25));
  doc.setDrawColor(...cor);
  doc.setLineWidth(1);
  doc.roundedRect(x, y, w, 22, 11, 11, "FD");
  doc.setTextColor(...(solida ? C.texto : cor));
  doc.text(s, x + 11, y + 15);
  return w;
}

function cabecalho(doc: jsPDF, titulo: string, sub: string, logo: Awaited<ReturnType<typeof carregarLogoHost>>) {
  fundo(doc);
  // faixa vermelha fina no topo
  doc.setFillColor(...C.acento);
  doc.rect(0, 0, W, 4, "F");
  let x = M;
  if (logo) {
    const h = 26;
    const w = (logo.width / logo.height) * h;
    doc.addImage(logo.dataUrl, "PNG", M, 24, w, h);
    x = M + w + 18;
  }
  texto(doc, titulo, x, 44, { size: 20, bold: true });
  texto(doc, sub, W - M, 42, { size: 10, cor: C.suave, align: "right" });
}

function rodape(doc: jsPDF, pagina: number, total: number, nome: string) {
  doc.setDrawColor(...C.linha);
  doc.setLineWidth(0.6);
  doc.line(M, H - 30, W - M, H - 30);
  texto(doc, `HOST · Painel de Players · ${nome}`, M, H - 14, { size: 9, cor: C.fraco });
  texto(doc, `Página ${pagina} de ${total}`, W - M, H - 14, { size: 9, cor: C.fraco, align: "right" });
}

function barraProgresso(doc: jsPDF, x: number, y: number, w: number, frac: number, cor: RGB) {
  doc.setFillColor(...C.cartao2);
  doc.roundedRect(x, y, w, 7, 3.5, 3.5, "F");
  doc.setFillColor(...cor);
  doc.roundedRect(x, y, Math.max(7, w * Math.min(1, frac)), 7, 3.5, 3.5, "F");
}

/* ------------------------------------------------------------------ página 1: ficha */

async function paginaFicha(doc: jsPDF, d: DadosPdfPlayer, o: OpcoesPdfPlayer) {
  const { p, situacao, cargo, rank } = d;
  const top = 76;
  const alto = H - top - 46;

  /* coluna 1: perfil */
  const x1 = M;
  const w1 = 430;
  cartao(doc, x1, top, w1, alto);
  const [banner, foto, emblema] = await Promise.all([
    carregarImagemPng(BANNER_PADRAO, 900, true),
    // foto do site (Admin) e, se não carregar, a padrão
    (d.foto ? carregarImagemPng(d.foto, 260, true) : Promise.resolve(null)).then(
      (img) => img ?? carregarImagemPng(FOTO_PADRAO, 260, true),
    ),
    carregarImagemPng(rank.imagem, 150),
  ]);
  if (banner) doc.addImage(banner.dataUrl, banner.formato, x1 + 1, top + 1, w1 - 2, 140, undefined, "FAST");
  if (cargo) {
    const cor = hexRgb(cargo.cor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const largura = doc.getTextWidth(cargo.rotulo) + 22;
    pilula(doc, cargo.rotulo, x1 + w1 - 16 - largura, top + 14, cor, true);
  }
  // foto
  doc.setFillColor(...C.cartao);
  doc.roundedRect(x1 + 20, top + 92, 112, 112, 22, 22, "F");
  if (foto) doc.addImage(foto.dataUrl, foto.formato, x1 + 24, top + 96, 104, 104, undefined, "FAST");
  texto(doc, p.nome || "Sem nome", x1 + 146, top + 170, { size: 22, bold: true, max: w1 - 160 });
  texto(doc, `#${p.passaporte ?? "-"}${p.discord_nome ? `   @${p.discord_nome}` : ""}`, x1 + 146, top + 192, {
    size: 12,
    cor: C.suave,
    max: w1 - 160,
  });

  // status e situação
  let py = top + 226;
  let px = x1 + 20;
  px += pilula(doc, p.online ? "Online" : "Offline", px, py, p.online ? C.verde : C.suave) + 8;
  pilula(doc, situacao.rotulo, px, py, hexRgb(situacao.cor));
  py += 38;
  texto(doc, `Último login: ${p.ultimo_login ? `${dataCurta(p.ultimo_login)} (${haQuanto(p.ultimo_login)})` : "nunca"}`, x1 + 20, py, {
    size: 11,
    cor: C.suave,
  });
  if (situacao.detalhe) texto(doc, situacao.detalhe, x1 + 20, py + 16, { size: 11, cor: C.suave, max: w1 - 40 });

  // nível + rank
  py += 44;
  const corRank = rank.cor === "#000000" ? ([230, 230, 230] as RGB) : hexRgb(rank.cor);
  if (emblema) doc.addImage(emblema.dataUrl, "PNG", x1 + 20, py, 56, 56);
  else {
    doc.setFillColor(...corRank);
    doc.circle(x1 + 48, py + 28, 26, "F");
  }
  texto(doc, "LEVEL", x1 + 90, py + 18, { size: 9, cor: C.suave, bold: true });
  texto(doc, String(p.level), x1 + 90, py + 44, { size: 26, bold: true });
  texto(doc, rank.ate ? `próximo rank no nível ${rank.ate}` : "rank máximo", x1 + w1 - 20, py + 18, {
    size: 10,
    cor: C.suave,
    align: "right",
  });
  barraProgresso(doc, x1 + 150, py + 36, w1 - 170, progressoNoRank(p.level), corRank);

  // números
  py += 80;
  const nums: [string, string][] = [
    ["Host Coins", `${num(p.host_coins)} HC`],
    ["Banco", brl(p.banco)],
    ["Carteira", brl(p.carteira)],
    ["Telefone", p.telefone || "-"],
  ];
  const nw = (w1 - 40 - 10) / 2;
  nums.forEach(([r, v], i) => {
    const nx = x1 + 20 + (i % 2) * (nw + 10);
    const ny = py + Math.floor(i / 2) * 62;
    cartao(doc, nx, ny, nw, 54, C.cartao2);
    rotulo(doc, r, nx + 12, ny + 18);
    texto(doc, v, nx + 12, ny + 40, { size: 15, bold: true, max: nw - 24 });
  });

  /* coluna 2: identificação */
  const x2 = x1 + w1 + 16;
  const w2 = 420;
  cartao(doc, x2, top, w2, alto);
  rotulo(doc, "Identificação", x2 + 20, top + 28);
  const kd = p.mortes ? (p.kills / p.mortes).toFixed(2) : String(p.kills);
  const linhas: [string, string][] = [
    ["ID (passaporte)", p.passaporte ?? "-"],
    ["License (Steam Hex)", p.license || "-"],
    ["ID Discord", p.discord_id ?? "-"],
    ["Discord", p.discord_nome ? `@${p.discord_nome}` : "-"],
    ["Telefone", p.telefone ?? "-"],
    ["Idade", p.idade != null ? String(p.idade) : "-"],
    ["Level / XP", `${p.level} / ${num(p.xp)}`],
    ["Kills / Mortes", `${num(p.kills)} / ${num(p.mortes)}  (K/D ${kd})`],
    ["Headshots", num(p.headshots)],
    ["Maior sequência", num(p.maior_sequencia)],
    ["Grupos", String(d.grupos.length)],
    ["Itens / Veículos", `${p.inventario.length} / ${p.veiculos.length}`],
    ["Ficha atualizada", dataCurta(p.updated_at)],
  ];
  linhas.forEach(([r, v], i) => {
    const ly = top + 60 + i * 41;
    if (i > 0) {
      doc.setDrawColor(...C.linha);
      doc.setLineWidth(0.5);
      doc.line(x2 + 20, ly - 24, x2 + w2 - 20, ly - 24);
    }
    texto(doc, r, x2 + 20, ly, { size: 11, cor: C.suave });
    texto(doc, v, x2 + w2 - 20, ly, { size: 12, bold: true, align: "right", max: w2 - 190 });
  });

  /* coluna 3: estatísticas das logs (ou observação) */
  const x3 = x2 + w2 + 16;
  const w3 = W - M - x3;
  cartao(doc, x3, top, w3, alto);
  if (o.estatisticas) {
    rotulo(doc, "Logs do player — últimos 30 dias", x3 + 20, top + 28);
    const k: [string, string, boolean][] = [
      ["30 dias", `${num(d.resumo.total)}${d.logs.length >= 1000 ? "+" : ""}`, false],
      ["7 dias", num(d.resumo.ultimos7), false],
      ["Hoje", num(d.resumo.hoje), false],
      ["Anti-Cheat", num(d.resumo.antiCheat), d.resumo.antiCheat > 0],
    ];
    const kw = (w3 - 40 - 30) / 4;
    k.forEach(([r, v, alerta], i) => {
      const kx = x3 + 20 + i * (kw + 10);
      cartao(doc, kx, top + 42, kw, 62, alerta ? [60, 32, 14] : C.cartao2);
      rotulo(doc, r, kx + 12, top + 62);
      texto(doc, v, kx + 12, top + 92, { size: 20, bold: true, cor: alerta ? C.laranja : C.texto });
    });

    // atividade por dia
    const gx = x3 + 20;
    const gy = top + 124;
    const gw = w3 - 40;
    const gh = 210;
    cartao(doc, gx, gy, gw, gh, C.cartao2);
    rotulo(doc, "Atividade — últimos 14 dias", gx + 14, gy + 22);
    const max = Math.max(1, ...d.resumo.porDia.map((x) => x.total));
    const plotY = gy + 40;
    const plotH = gh - 72;
    const slot = (gw - 28) / d.resumo.porDia.length;
    d.resumo.porDia.forEach((dia, i) => {
      const bw = Math.min(26, slot * 0.6);
      const bx = gx + 14 + slot * i + (slot - bw) / 2;
      const bh = dia.total ? Math.max(3, (dia.total / max) * plotH) : 0;
      if (bh) {
        doc.setFillColor(...C.acento);
        doc.roundedRect(bx, plotY + plotH - bh, bw, bh, 4, 4, "F");
        texto(doc, String(dia.total), bx + bw / 2, plotY + plotH - bh - 5, { size: 8, align: "center", bold: true });
      } else {
        doc.setFillColor(...C.linha);
        doc.rect(bx, plotY + plotH - 1, bw, 1, "F");
      }
      texto(doc, dia.rotulo, bx + bw / 2, plotY + plotH + 16, { size: 8, cor: C.fraco, align: "center" });
    });

    // por categoria
    const cy = gy + gh + 16;
    const ch = alto - (cy - top) - 20;
    cartao(doc, gx, cy, gw, ch, C.cartao2);
    rotulo(doc, "Por categoria", gx + 14, cy + 22);
    const cats = d.resumo.porCategoria.slice(0, 7);
    const topo = cats[0]?.total ?? 1;
    if (cats.length === 0) texto(doc, "Nenhuma log nos últimos 30 dias.", gx + 14, cy + 50, { size: 11, cor: C.suave });
    cats.forEach((c, i) => {
      const ly = cy + 46 + i * ((ch - 60) / 7);
      texto(doc, c.nome, gx + 14, ly, { size: 11, max: 200 });
      texto(doc, num(c.total), gx + gw - 14, ly, { size: 11, bold: true, align: "right" });
      barraProgresso(doc, gx + 14, ly + 6, gw - 28, c.total / topo, c.id === "anti-cheat" ? C.laranja : C.acento);
    });
  } else {
    // sem estatísticas: a coluna mostra os grupos do player
    rotulo(doc, `Grupos (${d.grupos.length})`, x3 + 20, top + 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(...C.texto);
    const nomes = d.grupos.map((g) => (g.nivel !== null ? `${g.nome} (${g.nivel})` : g.nome)).join("   ·   ");
    doc.text(doc.splitTextToSize(limpo(nomes) || "Nenhum grupo.", w3 - 40).slice(0, 30), x3 + 20, top + 56);
  }

  /* observação: no espaço livre embaixo da coluna do perfil */
  if (o.observacao.trim()) {
    const oy = top + 520;
    const oh = alto - 540;
    cartao(doc, x1 + 20, oy, w1 - 40, oh, C.cartao2);
    rotulo(doc, "Observação", x1 + 34, oy + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...C.texto);
    const caber = Math.max(1, Math.floor((oh - 40) / 14));
    doc.text(doc.splitTextToSize(limpo(o.observacao), w1 - 68).slice(0, caber), x1 + 34, oy + 42);
  }
}

/* ------------------------------------------------------------------ página: grupos, inventário, veículos */

function colunaLista(
  doc: jsPDF,
  titulo: string,
  itens: { a: string; b?: string }[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  cartao(doc, x, y, w, h);
  rotulo(doc, `${titulo} (${itens.length})`, x + 18, y + 26);
  const linhaH = 24;
  const cabe = Math.floor((h - 50) / linhaH);
  const duasColunas = itens.length > cabe;
  const colW = duasColunas ? (w - 36 - 12) / 2 : w - 36;
  const max = duasColunas ? cabe * 2 : cabe;
  itens.slice(0, max).forEach((it, i) => {
    const col = duasColunas ? Math.floor(i / cabe) : 0;
    const lin = duasColunas ? i % cabe : i;
    const ix = x + 18 + col * (colW + 12);
    const iy = y + 44 + lin * linhaH;
    doc.setFillColor(...C.cartao2);
    doc.roundedRect(ix, iy, colW, linhaH - 5, 6, 6, "F");
    texto(doc, it.a, ix + 9, iy + 13, { size: 10, bold: true, max: colW - (it.b ? 70 : 18) });
    if (it.b) texto(doc, it.b, ix + colW - 9, iy + 13, { size: 9.5, cor: C.suave, align: "right" });
  });
  if (itens.length > max)
    texto(doc, `+${itens.length - max} não couberam nesta página`, x + 18, y + h - 12, { size: 9, cor: C.fraco });
  if (itens.length === 0) texto(doc, "Nada aqui.", x + 18, y + 54, { size: 11, cor: C.suave });
}

function paginaItens(doc: jsPDF, d: DadosPdfPlayer, o: OpcoesPdfPlayer) {
  const cols: { t: string; itens: { a: string; b?: string }[] }[] = [];
  if (o.grupos)
    cols.push({ t: "Grupos", itens: d.grupos.map((g) => ({ a: g.nome, ...(g.nivel !== null ? { b: `nível ${g.nivel}` } : {}) })) });
  if (o.inventario)
    cols.push({ t: "Inventário", itens: d.p.inventario.map((i) => ({ a: itemBase(i.item), b: `${num(i.qtd)}x` })) });
  if (o.veiculos) cols.push({ t: "Veículos", itens: d.p.veiculos.map((v, n) => ({ a: v, b: `index #${n + 1}` })) });
  const top = 76;
  const h = H - top - 46;
  const w = (W - M * 2 - 16 * (cols.length - 1)) / cols.length;
  cols.forEach((c, i) => colunaLista(doc, c.t, c.itens, M + i * (w + 16), top, w, h));
}

/* ------------------------------------------------------------------ páginas: logs e punições */

const LOGS_POR_PAGINA = 26;

function paginaLogs(doc: jsPDF, logs: LogDoPlayer[], de: number, ate: number, total: number) {
  const top = 76;
  cartao(doc, M, top, W - M * 2, H - top - 46);
  rotulo(doc, `Últimas logs (${de + 1}–${ate} de ${total})`, M + 20, top + 26);
  const cols = { hora: M + 20, cat: M + 150, tit: M + 420, det: M + 640 };
  texto(doc, "QUANDO", cols.hora, top + 50, { size: 8.5, cor: C.fraco, bold: true });
  texto(doc, "CATEGORIA · CANAL", cols.cat, top + 50, { size: 8.5, cor: C.fraco, bold: true });
  texto(doc, "AÇÃO", cols.tit, top + 50, { size: 8.5, cor: C.fraco, bold: true });
  texto(doc, "DETALHES", cols.det, top + 50, { size: 8.5, cor: C.fraco, bold: true });
  logs.slice(de, ate).forEach((l, i) => {
    const y = top + 72 + i * 23.5;
    if (i % 2 === 0) {
      doc.setFillColor(...C.cartao2);
      doc.rect(M + 10, y - 15, W - M * 2 - 20, 23.5, "F");
    }
    const cat = categoriaDoCanal(l.canal);
    const lida = lerLog(l.mensagem, l.dados, l.jogador_id, l.jogador_nome);
    const det = lida.linhas
      .filter((x) => x.rotulo)
      .slice(0, 4)
      .map((x) => `${x.rotulo}: ${x.valor}`)
      .join("  ·  ");
    const anti = cat.id === "anti-cheat";
    texto(doc, dataCurta(l.criado_em), cols.hora, y, { size: 10, cor: C.suave });
    texto(doc, `${cat.nome} · #${cat.canal}`, cols.cat, y, { size: 10, cor: anti ? C.laranja : C.texto, bold: anti, max: 255 });
    texto(doc, lida.titulo || lida.linhas[0]?.valor || "Log", cols.tit, y, { size: 10, bold: true, max: 205 });
    texto(doc, det || "-", cols.det, y, { size: 9.5, cor: C.suave, max: W - M - 30 - cols.det });
  });
}

function paginaPunicoes(doc: jsPDF, punicoes: PunicaoDoPlayer[]) {
  const top = 76;
  cartao(doc, M, top, W - M * 2, H - top - 46);
  rotulo(doc, `Punições registradas (${punicoes.length})`, M + 20, top + 26);
  if (punicoes.length === 0) {
    texto(doc, "Nenhuma punição registrada para este ID.", M + 20, top + 60, { size: 12, cor: C.suave });
    return;
  }
  const cols = { data: M + 20, pun: M + 170, dias: M + 420, staff: M + 500, mot: M + 680 };
  texto(doc, "DATA", cols.data, top + 50, { size: 8.5, cor: C.fraco, bold: true });
  texto(doc, "PUNIÇÃO", cols.pun, top + 50, { size: 8.5, cor: C.fraco, bold: true });
  texto(doc, "DIAS", cols.dias, top + 50, { size: 8.5, cor: C.fraco, bold: true });
  texto(doc, "STAFF", cols.staff, top + 50, { size: 8.5, cor: C.fraco, bold: true });
  texto(doc, "MOTIVO", cols.mot, top + 50, { size: 8.5, cor: C.fraco, bold: true });
  punicoes.slice(0, 26).forEach((x, i) => {
    const y = top + 72 + i * 23.5;
    if (i % 2 === 0) {
      doc.setFillColor(...C.cartao2);
      doc.rect(M + 10, y - 15, W - M * 2 - 20, 23.5, "F");
    }
    const ban = /banim|banido/i.test(x.punicao);
    texto(doc, dataCurta(x.data), cols.data, y, { size: 10, cor: C.suave });
    texto(doc, x.punicao, cols.pun, y, { size: 10, bold: true, cor: ban ? C.acento : C.texto, max: 240 });
    texto(doc, x.dias != null ? String(x.dias) : "-", cols.dias, y, { size: 10 });
    texto(doc, x.staff, cols.staff, y, { size: 10, max: 170 });
    texto(doc, x.motivo, cols.mot, y, { size: 9.5, cor: C.suave, max: W - M - 30 - cols.mot });
  });
  if (punicoes.length > 26)
    texto(doc, `+${punicoes.length - 26} punições mais antigas`, M + 20, H - 60, { size: 9, cor: C.fraco });
}

/* ------------------------------------------------------------------ montagem */

export async function gerarPdfPlayer(d: DadosPdfPlayer, o: OpcoesPdfPlayer): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [W, H], compress: true });
  const logo = await carregarLogoHost();
  const nome = `${limpo(d.p.nome) || "Player"} #${d.p.passaporte ?? "-"}`;
  const sub = `Gerado em ${dataCurta(new Date().toISOString())}${d.geradoPor ? ` por ${d.geradoPor}` : ""}`;

  // quais páginas vão
  const paginas: (() => void | Promise<void>)[] = [];
  paginas.push(async () => {
    cabecalho(doc, `Ficha do player · ${nome}`, sub, logo);
    await paginaFicha(doc, d, o);
  });
  if (o.grupos || o.inventario || o.veiculos)
    paginas.push(() => {
      cabecalho(doc, "Grupos, inventário e veículos", nome, logo);
      paginaItens(doc, d, o);
    });
  if (o.listaLogs && d.logs.length > 0) {
    const lista = d.logs.slice(0, o.qtdLogs);
    for (let i = 0; i < lista.length; i += LOGS_POR_PAGINA) {
      const de = i;
      paginas.push(() => {
        cabecalho(doc, "Logs do player", nome, logo);
        paginaLogs(doc, lista, de, Math.min(de + LOGS_POR_PAGINA, lista.length), lista.length);
      });
    }
  }
  if (o.punicoes)
    paginas.push(() => {
      cabecalho(doc, "Punições", nome, logo);
      paginaPunicoes(doc, d.punicoes);
    });

  for (let i = 0; i < paginas.length; i++) {
    if (i > 0) doc.addPage([W, H], "landscape");
    await paginas[i]!();
    rodape(doc, i + 1, paginas.length, nome);
  }
  const arquivo = `player-${d.p.passaporte ?? "sem-id"}-${limpo(d.p.nome).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "ficha"}.pdf`;
  doc.save(arquivo);
}
