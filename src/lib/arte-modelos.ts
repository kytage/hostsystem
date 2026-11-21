/**
 * Padrão de arte da HOST (novo, de novembro de 2026): fundo branco, barra lateral vermelha e
 * preta, logo "HOST world" no canto, etiqueta preta + rótulo espaçado, título condensado preto com
 * palavra em vermelho, faixa preta com borda vermelha, painel vermelho na diagonal com o
 * personagem e o rodapé "(HOST)® WORLD ©2026". Aqui ficam as cores, os formatos e a leitura do
 * texto que o staff digita no gerador.
 */

export const CORES_HOST = [
  { nome: "Vermelho HOST", hex: "#CE0F0F", uso: "Cor principal: logo, destaques, painel e faixas." },
  { nome: "Preto HOST", hex: "#111111", uso: "Títulos, etiquetas e linhas das tabelas." },
  { nome: "Branco", hex: "#FFFFFF", uso: "Fundo das artes e texto sobre o preto." },
  { nome: "Vermelho escuro", hex: "#C2291C", uso: "Cor do arquivo oficial (COR HEX). Sombras e detalhes." },
  { nome: "Rosa HOST", hex: "#FBE7E7", uso: "Logo clara, para usar sobre fundo escuro." },
  { nome: "Cinza claro", hex: "#F1F1F1", uso: "Fundos de apoio e separadores." },
] as const;

export const FONTES_HOST = [
  {
    nome: "Anton",
    css: "'Anton', sans-serif",
    uso: "Títulos grandes (BENEFÍCIO E ARMAS, TABELA DE VALORES).",
    exemplo: "TABELA DE VALORES",
    link: "https://fonts.google.com/specimen/Anton",
  },
  {
    nome: "Bebas Neue",
    css: "'Bebas Neue', sans-serif",
    uso: "Faixa preta, nomes de produto e valores das tabelas.",
    exemplo: "SETAGEM NO DISCORD",
    link: "https://fonts.google.com/specimen/Bebas+Neue",
  },
  {
    nome: "Montserrat ExtraBold",
    css: "'Montserrat', sans-serif",
    uso: "Etiquetas e rótulos pequenos, com letras bem espaçadas.",
    exemplo: "AVISO ÀS ORGANIZAÇÕES",
    link: "https://fonts.google.com/specimen/Montserrat",
  },
] as const;

export const REGRAS_DA_ARTE = [
  "Fundo branco. A barra fina na esquerda é vermelha em cima e preta embaixo.",
  "Logo HOST world no canto de cima, à esquerda, sempre inteira e sem esticar.",
  "Etiqueta preta (ex.: ILEGAL) e, ao lado, o assunto em letras pequenas bem espaçadas.",
  "Título em Anton, preto, com UMA palavra (ou letra) em vermelho para dar ritmo.",
  "Faixa preta com borda vermelha na esquerda, texto em Bebas Neue branco.",
  "Painel vermelho na diagonal, do lado direito, com o personagem por cima.",
  "Rodapé com um traço vermelho e o texto (HOST)® WORLD ©2026.",
  "Use só as cores da paleta. Nada de gradiente colorido, sombra forte ou outra fonte.",
] as const;

export type FormatoArte = "banner" | "post" | "story" | "tabela";

export const FORMATOS_ARTE: { id: FormatoArte; nome: string; w: number; h: number; uso: string }[] = [
  { id: "banner", nome: "Banner", w: 2000, h: 625, uso: "Avisos no Discord" },
  { id: "post", nome: "Post", w: 1080, h: 1080, uso: "Feed do Instagram" },
  { id: "story", nome: "Story", w: 1080, h: 1920, uso: "Stories e TikTok" },
  { id: "tabela", nome: "Tabela", w: 2000, h: 1256, uso: "Tabelas de valores" },
];

export interface DadosArte {
  formato: FormatoArte;
  etiqueta: string;
  rotulo: string;
  /** Palavra entre *asteriscos* sai em vermelho. Quebra de linha vira linha nova. */
  titulo: string;
  faixa: string;
  rodape: string;
  tamanhoTitulo: number;
  painel: boolean;
  personagem: string | null;
  /** Tabela: colunas separadas por "---", seções com "# Título | legenda", linhas "Produto ; valor ; valor". */
  tabela: string;
  colunaA: string;
  colunaB: string;
}

export const TABELA_EXEMPLO = `# ARMAS | R$ / UNIDADE
FIVE-SEVEN ; R$ 55.000 ; R$ 50.000
UZI ; R$ 100.000 ; R$ 95.000
MTAR ; R$ 110.000 ; R$ 100.000
EVO ; R$ 100.000 ; R$ 90.000
SIG SAUER PDW ; R$ 110.000 ; R$ 100.000
TEC 9 ; R$ 110.000 ; R$ 100.000
MP5 ; R$ 100.000 ; R$ 90.000
GLOCK RAJADA ; R$ 100.000 ; R$ 90.000
SIG SAUER / G3 ; R$ 165.000 ; R$ 150.000
# MUNIÇÃO | R$ / 100 UNIDADES
MUNIÇÃO DE PISTOLA ; R$ 25.000 ; R$ 20.000
MUNIÇÃO DE SUB ; R$ 35.000 ; R$ 30.000
MUNIÇÃO DE FUZIL ; R$ 40.000 ; R$ 35.000
---
# HPI | R$ / UNIDADE
SORO ; R$ 4.000 ; R$ 3.000
ADRENALINA ; R$ 2.500 ; R$ 3.000
HOSTWATCH ; — ; R$ 5.000
ÁLCOOL EM GEL ; R$ 4.000 ; R$ 3.000
SABONETE ; R$ 4.000 ; R$ 3.000
BISTURI ; — ; —
BOLSA DE SANGUE ; R$ 2.000 ; R$ 1.500
# LAVAGEM | TAXA SOBRE O VALOR
LAVAGEM ; 35% ; 30%
# DESMANCHE | PORCENTAGEM
DESMANCHE ; 40% ; 50%
---
# CENTRAL | R$ / UNIDADE
C4 ; R$ 3.500 ; R$ 3.000
TOKEN ; R$ 3.500 ; R$ 3.000
CARTÃO AZUL ; R$ 12.500 ; R$ 10.000
CARTÃO VERMELHO ; R$ 17.500 ; R$ 15.000
CARTÃO PRETO ; R$ 25.000 ; R$ 20.000
SPRAY ; R$ 750 ; R$ 500
TRAVA ; R$ 3.000 ; R$ 2.000
BLOQUEADOR ; R$ 3.000 ; R$ 2.000
CONTABILIZADOR ; R$ 3.000 ; R$ 2.000
RASTREADOR ; R$ 4.000 ; R$ 3.000
PAGER ; R$ 17.000 ; R$ 15.000
DROGAS ; R$ 350 ; R$ 250`;

/** Tabela inicial: modelo para a pessoa trocar pelos itens de verdade. */
export const TABELA_INICIAL = `# SEÇÃO 1 | LEGENDA
ITEM 1 ; R$ 0.000 ; R$ 0.000
ITEM 2 ; R$ 0.000 ; R$ 0.000
ITEM 3 ; R$ 0.000 ; R$ 0.000
---
# SEÇÃO 2 | LEGENDA
ITEM 1 ; R$ 0.000 ; R$ 0.000
ITEM 2 ; R$ 0.000 ; R$ 0.000
---
# SEÇÃO 3 | LEGENDA
ITEM 1 ; R$ 0.000 ; R$ 0.000
ITEM 2 ; R$ 0.000 ; R$ 0.000`;

/** Textos iniciais genéricos (de propósito, para a pessoa sempre trocar). Valem para todo formato. */
export const TEXTO_INICIAL: Omit<DadosArte, "formato" | "personagem" | "tamanhoTitulo"> = {
  etiqueta: "ETIQUETA",
  rotulo: "ASSUNTO DA ARTE",
  titulo: "TÍTULO DA *ARTE*",
  faixa: "TEXTO DA FAIXA *AQUI*",
  rodape: "(HOST)® WORLD ©2026",
  painel: true,
  tabela: TABELA_INICIAL,
  colunaA: "SEM PARCERIA",
  colunaB: "COM PARCERIA",
};

/** Tamanho inicial do título em cada formato (trocar o formato só muda isso, não os textos). */
export const TAMANHO_DO_TITULO: Record<FormatoArte, number> = {
  banner: 172,
  post: 120,
  story: 150,
  tabela: 124,
};

export interface Trecho {
  t: string;
  vermelho: boolean;
}

/** "BENEFÍCIO *E* ARMAS" → linhas de trechos, com o que está entre asteriscos em vermelho. */
export function lerDestaque(texto: string): Trecho[][] {
  return texto.split(/\r?\n/).map((linha) => {
    const partes = linha.split("*");
    return partes
      .map((t, i) => ({ t, vermelho: i % 2 === 1 }))
      .filter((p) => p.t.length > 0);
  });
}

export interface LinhaTabela {
  produto: string;
  a: string;
  b: string;
}
export interface SecaoTabela {
  titulo: string;
  legenda: string;
  linhas: LinhaTabela[];
}

/** Lê o texto da tabela: colunas por "---", seções por "# Título | legenda", linhas "Produto ; A ; B". */
export function lerTabela(texto: string): SecaoTabela[][] {
  const colunas: SecaoTabela[][] = [[]];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    if (/^-{3,}$/.test(linha)) {
      colunas.push([]);
      continue;
    }
    const col = colunas[colunas.length - 1]!;
    if (linha.startsWith("#")) {
      const [titulo = "", legenda = ""] = linha.replace(/^#+/, "").split("|").map((s) => s.trim());
      col.push({ titulo, legenda, linhas: [] });
      continue;
    }
    if (col.length === 0) col.push({ titulo: "", legenda: "", linhas: [] });
    const [produto = "", a = "", b = ""] = linha.split(";").map((s) => s.trim());
    col[col.length - 1]!.linhas.push({ produto, a: a || "—", b: b || "—" });
  }
  return colunas.filter((c) => c.length > 0);
}

/** "R$ 55.000" → { moeda: "R$", valor: "55.000" }; "35%" → { moeda: "", valor: "35%" }. */
export function separarMoeda(v: string): { moeda: string; valor: string } {
  const m = v.match(/^(R\$|US\$|\$)\s*(.+)$/);
  return m ? { moeda: m[1]!, valor: m[2]! } : { moeda: "", valor: v };
}

/** Nome do arquivo baixado: "host-banner-beneficio-e-armas.png". */
export function nomeDoArquivo(d: Pick<DadosArte, "formato" | "titulo">): string {
  const base = d.titulo
    .replace(/\*/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `host-${d.formato}${base ? `-${base}` : ""}.png`;
}
