/**
 * Magnata HOST: jogo de tabuleiro de imóveis da praça do HOKI (regras).
 *
 * Tudo aqui é conta pura: recebe o estado da partida e uma ação e devolve o
 * estado novo. Só o computador do anfitrião aplica as ações; os outros recebem
 * o estado pronto, então todo mundo vê a mesma partida.
 */
import type { Visual } from "@/lib/hoki";

export const SALDO_INICIAL = 1500;
export const SALARIO = 200;
export const FIANCA = 50;
export const MAX_JOGADORES = 6;
export const MIN_JOGADORES = 2;
export const TEMPO_RAPIDO_MS = 30 * 60_000;
export const TEMPO_LEILAO_MS = 20_000;
/** Tempo de cada passo do mascote no tabuleiro (ms). */
export const PASSO_MS = 300;
export const N_CASAS = 36;
export const POR_LADO = 9;
export const DELEGACIA = 9;

export const dinheiro = (v: number) => `H$ ${Math.round(v).toLocaleString("pt-BR")}`;

/** Cores dos jogadores (o cone na cabeça, o contorno na barra e as placas dos imóveis). */
export const CORES = [
  { nome: "Vermelho", hex: "#ff4b4b" },
  { nome: "Azul", hex: "#3d8bff" },
  { nome: "Verde", hex: "#35c46a" },
  { nome: "Amarelo", hex: "#ffc933" },
  { nome: "Roxo", hex: "#a56bff" },
  { nome: "Laranja", hex: "#ff8a3d" },
] as const;

/** Grupos de cor dos imóveis e quanto custa cada construção no grupo. */
export const GRUPOS = [
  { nome: "Café", cor: "#9b6a4a", obra: 50 },
  { nome: "Bairro", cor: "#5cc8f0", obra: 50 },
  { nome: "Oficinas", cor: "#e86bb8", obra: 100 },
  { nome: "Orla", cor: "#ff9a3d", obra: 100 },
  { nome: "Noite", cor: "#f04848", obra: 150 },
  { nome: "Centro", cor: "#f5d33a", obra: 150 },
  { nome: "Cidade", cor: "#38b866", obra: 200 },
  { nome: "Luxo", cor: "#3a62e8", obra: 200 },
] as const;

export type TipoCasa =
  "partida" | "delegacia" | "praca" | "blitz" | "imovel" | "companhia" | "noticia" | "taxa";
export interface Casa {
  tipo: TipoCasa;
  nome: string;
  icone: string;
  grupo?: number;
  preco?: number;
  /** Quanto se paga ao cair (taxas). */
  valor?: number;
}
const imovel = (nome: string, grupo: number, preco: number, icone: string): Casa => ({
  tipo: "imovel",
  nome,
  grupo,
  preco,
  icone,
});
const cia = (nome: string, icone: string): Casa => ({
  tipo: "companhia",
  nome,
  preco: 200,
  icone,
});
const noticia: Casa = { tipo: "noticia", nome: "Plantão HOST", icone: "📰" };
const taxa = (nome: string, valor: number, icone: string): Casa => ({
  tipo: "taxa",
  nome,
  valor,
  icone,
});

/** As 36 casas, a partir da Partida, no sentido em que os mascotes andam. */
export const CASAS: Casa[] = [
  { tipo: "partida", nome: "Partida", icone: "🚩" },
  imovel("Cat Café", 0, 60, "🐱"),
  noticia,
  imovel("Vanilla", 0, 70, "🍦"),
  taxa("Imposto da Prefeitura", 150, "🧾"),
  cia("Táxi HOST", "🚕"),
  imovel("Barbearia", 1, 100, "💈"),
  imovel("Lava-Jato", 1, 100, "💧"),
  imovel("Mercadinho 24h", 1, 120, "🛒"),
  { tipo: "delegacia", nome: "Delegacia", icone: "🚔" },
  imovel("Mecânica Host", 2, 140, "🔧"),
  noticia,
  imovel("Auto Peças", 2, 140, "⚙️"),
  imovel("Host Motors", 2, 160, "🏎️"),
  cia("Rádio HOST FM", "📻"),
  imovel("Leblon", 3, 180, "🏖️"),
  imovel("Copacabana", 3, 180, "🌴"),
  imovel("Ipanema", 3, 200, "🌊"),
  { tipo: "praca", nome: "Folga na Praça", icone: "⛲" },
  imovel("Vitrinni Lounge", 4, 220, "🍸"),
  noticia,
  imovel("Boate Neon", 4, 220, "🎶"),
  imovel("Arena de Eventos", 4, 240, "🎤"),
  cia("Heliponto", "🚁"),
  imovel("Av. Paulista", 5, 260, "🏙️"),
  taxa("Multa de Trânsito", 100, "🚦"),
  imovel("Centro Comercial", 5, 280, "🏬"),
  { tipo: "blitz", nome: "Blitz", icone: "🚨" },
  imovel("Host Hospital", 6, 300, "🏥"),
  noticia,
  imovel("Fórum", 6, 300, "⚖️"),
  imovel("Prefeitura", 6, 320, "🏛️"),
  cia("Porto HOST", "⚓"),
  imovel("Mansão do Morro", 7, 350, "🏡"),
  taxa("Taxa de Luxo", 100, "💎"),
  imovel("Cobertura HOST", 7, 400, "🌇"),
];

/** Aluguel de um imóvel: sem construção, com 1 a 4 casas e com hotel. */
export function tabelaDeAluguel(preco: number): number[] {
  const b = Math.max(2, Math.round(preco * 0.1 - 4));
  return [b, b * 5, b * 15, b * 36, b * 44, b * 52];
}
/** Aluguel das companhias, conforme quantas o dono tem. */
export const ALUGUEL_DAS_CIAS = [25, 50, 100, 200];
export const obraDe = (c: number) => GRUPOS[CASAS[c]?.grupo ?? 0]?.obra ?? 0;
export const hipotecaDe = (c: number) => Math.round((CASAS[c]?.preco ?? 0) / 2);
export const resgateDe = (c: number) => Math.ceil(hipotecaDe(c) * 1.1);
export const doGrupo = (g: number) =>
  CASAS.flatMap((c, i) => (c.tipo === "imovel" && c.grupo === g ? [i] : []));

export type Efeito =
  | { e: "ganha"; v: number }
  | { e: "paga"; v: number }
  | { e: "vai"; casa: number }
  | { e: "anda"; n: number }
  | { e: "preso" }
  | { e: "habeas" }
  | { e: "cadaUm"; v: number }
  | { e: "reforma"; casa: number; hotel: number };
/** Cartas do Plantão HOST: notícias boas e ruins da cidade. */
export const NOTICIAS: { texto: string; efeito: Efeito }[] = [
  { texto: "Seu evento lotou a cidade. Receba o cachê.", efeito: { e: "ganha", v: 150 } },
  { texto: "Você achou uma maleta esquecida no táxi.", efeito: { e: "ganha", v: 100 } },
  { texto: "Restituição da Prefeitura caiu na conta.", efeito: { e: "ganha", v: 50 } },
  { texto: "Seu vídeo viralizou. Os patrocinadores pagaram.", efeito: { e: "ganha", v: 200 } },
  { texto: "É seu aniversário! Cada jogador te dá um presente.", efeito: { e: "cadaUm", v: 30 } },
  { texto: "Guincho levou o seu carro. Pague o pátio.", efeito: { e: "paga", v: 100 } },
  { texto: "Conta do hospital chegou.", efeito: { e: "paga", v: 80 } },
  { texto: "Você pagou a rodada para a staff inteira.", efeito: { e: "paga", v: 50 } },
  {
    texto: "Vistoria nos imóveis: pague por cada construção sua.",
    efeito: { e: "reforma", casa: 25, hotel: 100 },
  },
  { texto: "Carona de helicóptero até a Partida.", efeito: { e: "vai", casa: 0 } },
  { texto: "Tem show hoje! Vá para a Arena de Eventos.", efeito: { e: "vai", casa: 22 } },
  { texto: "Atalho pela orla: avance 3 casas.", efeito: { e: "anda", n: 3 } },
  { texto: "Rua interditada: volte 3 casas.", efeito: { e: "anda", n: -3 } },
  { texto: "Você foi parado na blitz. Vá para a Delegacia.", efeito: { e: "preso" } },
  { texto: "Habeas corpus: guarde para sair da Delegacia.", efeito: { e: "habeas" } },
  { texto: "Habeas corpus: guarde para sair da Delegacia.", efeito: { e: "habeas" } },
];

export interface Jogador {
  id: string;
  nome: string;
  /** Índice em CORES. */
  cor: number;
  visual: Visual;
  pronto: boolean;
  saldo: number;
  pos: number;
  /** 0 = livre; 1 a 3 = preso, na tentativa de número tal. */
  preso: number;
  habeas: number;
  falido: boolean;
  /** Ordem em que faliu (para a classificação). */
  falidoEm?: number;
}
export interface Posse {
  dono: string;
  /** 0 a 4 casas; 5 = hotel. */
  casas: number;
  hip: boolean;
}
export interface Troca {
  id: number;
  de: string;
  para: string;
  dou: number[];
  douD: number;
  quero: number[];
  queroD: number;
}
export type Etapa =
  "rolar" | "rolando" | "andando" | "decidir" | "leilao" | "carta" | "divida" | "livre";
export interface Lugar {
  id: string;
  patrimonio: number;
  saldo: number;
  lugar: number;
}
export interface Estado {
  /** Cresce a cada mudança: quem recebe fica sempre com o mais novo. */
  v: number;
  codigo: string;
  anfitriao: string;
  fase: "sala" | "jogo" | "fim";
  modo: "classico" | "rapido";
  /** Modo rápido: quando o tempo acaba (relógio do anfitrião). */
  fimEm: number | null;
  jogadores: Jogador[];
  vez: number;
  etapa: Etapa;
  /** Quando a etapa atual começou (para quem demora demais). */
  desde: number;
  dados: [number, number] | null;
  duplos: number;
  /** Tirou números iguais: joga de novo depois de resolver a casa. */
  bis: boolean;
  /** Hora em que o anfitrião resolve a etapa sozinho (dados parando, mascote chegando, leilão fechando). */
  prazo: number | null;
  posses: Record<number, Posse>;
  leilao: { casa: number; lance: number; de: string | null } | null;
  carta: number | null;
  /** A quem o jogador da vez deve (null = banco), enquanto estiver no vermelho. */
  credor: string | null;
  trocas: Troca[];
  historico: string[];
  baralho: number[];
  /** Último movimento, para todos animarem igual. `n` negativo anda para trás; `direto` vai sem passar pelas casas. */
  mov: { seq: number; id: string; de: number; n: number; direto?: boolean } | null;
  seq: number;
  ranking: Lugar[] | null;
}

export type Acao =
  | { t: "entrar"; nome: string; visual: Visual }
  | { t: "sair" }
  | { t: "pronto"; v: boolean }
  | { t: "modo"; modo: Estado["modo"] }
  | { t: "iniciar" }
  | { t: "rolar" }
  | { t: "fianca" }
  | { t: "habeas" }
  | { t: "comprar" }
  | { t: "recusar" }
  | { t: "lance"; v: number }
  | { t: "ok" }
  | { t: "encerrar" }
  | { t: "construir"; c: number }
  | { t: "vender"; c: number }
  | { t: "hipotecar"; c: number }
  | { t: "resgatar"; c: number }
  | { t: "pagar" }
  | { t: "falir" }
  | { t: "propor"; para: string; dou: number[]; douD: number; quero: number[]; queroD: number }
  | { t: "troca"; id: number; aceita: boolean }
  | { t: "denovo" }
  | { t: "_prazo" };

export function novaSala(
  codigo: string,
  anfitriao: { id: string; nome: string; visual: Visual },
): Estado {
  return {
    v: 1,
    codigo,
    anfitriao: anfitriao.id,
    fase: "sala",
    modo: "classico",
    fimEm: null,
    jogadores: [novoJogador(anfitriao.id, anfitriao.nome, anfitriao.visual, 0, true)],
    vez: 0,
    etapa: "rolar",
    desde: 0,
    dados: null,
    duplos: 0,
    bis: false,
    prazo: null,
    posses: {},
    leilao: null,
    carta: null,
    credor: null,
    trocas: [],
    historico: [],
    baralho: [],
    mov: null,
    seq: 0,
    ranking: null,
  };
}
const novoJogador = (
  id: string,
  nome: string,
  visual: Visual,
  cor: number,
  pronto = false,
): Jogador => ({
  id,
  nome: nome.slice(0, 24) || "HOKI",
  cor,
  visual,
  pronto,
  saldo: SALDO_INICIAL,
  pos: 0,
  preso: 0,
  habeas: 0,
  falido: false,
});

export const daVez = (e: Estado) => e.jogadores[e.vez];
export const ativos = (e: Estado) => e.jogadores.filter((j) => !j.falido);
export const jogador = (e: Estado, id: string) => e.jogadores.find((j) => j.id === id);
const anotar = (e: Estado, texto: string) => {
  e.historico.push(texto);
  if (e.historico.length > 40) e.historico.splice(0, e.historico.length - 40);
};

/** O dono tem o grupo de cor inteiro (sem contar hipoteca)? */
export function grupoCompleto(e: Estado, c: number) {
  const dono = e.posses[c]?.dono;
  const g = CASAS[c]?.grupo;
  return (
    dono !== undefined && g !== undefined && doGrupo(g).every((i) => e.posses[i]?.dono === dono)
  );
}
/** Quanto custa cair nesta casa agora (0 se for livre, do próprio, ou hipotecada). */
export function aluguelDe(e: Estado, c: number): number {
  const p = e.posses[c];
  const casa = CASAS[c];
  if (!p || !casa || p.hip) return 0;
  if (casa.tipo === "companhia") {
    const n = CASAS.filter((x, i) => x.tipo === "companhia" && e.posses[i]?.dono === p.dono).length;
    return ALUGUEL_DAS_CIAS[n - 1] ?? 25;
  }
  const t = tabelaDeAluguel(casa.preco ?? 0);
  if (p.casas > 0) return t[p.casas] ?? 0;
  return (t[0] ?? 0) * (grupoCompleto(e, c) ? 2 : 1);
}
/** Patrimônio: saldo, imóveis pelo preço (metade se hipotecado) e construções pelo custo. */
export function patrimonio(e: Estado, id: string) {
  let v = jogador(e, id)?.saldo ?? 0;
  for (const [k, p] of Object.entries(e.posses))
    if (p.dono === id)
      v += (p.hip ? hipotecaDe(+k) : (CASAS[+k]?.preco ?? 0)) + p.casas * obraDe(+k);
  return v;
}
const casasDoGrupo = (e: Estado, c: number) =>
  doGrupo(CASAS[c]?.grupo ?? -1).map((i) => e.posses[i]?.casas ?? 0);

/** Pode construir aqui? Devolve o motivo quando não pode. */
export function podeConstruir(e: Estado, c: number, id: string): string | null {
  const p = e.posses[c];
  if (!p || p.dono !== id || CASAS[c]?.tipo !== "imovel") return "Não é seu imóvel.";
  if (!grupoCompleto(e, c)) return "Complete o grupo de cor para construir.";
  if (doGrupo(CASAS[c]?.grupo ?? -1).some((i) => e.posses[i]?.hip)) return "Há hipoteca no grupo.";
  if (p.casas >= 5) return "Já tem hotel.";
  if (p.casas > Math.min(...casasDoGrupo(e, c))) return "Construa por igual no grupo.";
  if ((jogador(e, id)?.saldo ?? 0) < obraDe(c)) return "Saldo insuficiente.";
  return null;
}
export function podeVender(e: Estado, c: number, id: string): string | null {
  const p = e.posses[c];
  if (!p || p.dono !== id || p.casas < 1) return "Sem construção para vender.";
  if (p.casas < Math.max(...casasDoGrupo(e, c))) return "Venda por igual no grupo.";
  return null;
}
export function podeHipotecar(e: Estado, c: number, id: string): string | null {
  const p = e.posses[c];
  if (!p || p.dono !== id || p.hip) return "Não dá para hipotecar.";
  if (CASAS[c]?.tipo === "imovel" && casasDoGrupo(e, c).some((n) => n > 0))
    return "Venda as construções do grupo antes.";
  return null;
}
/** Imóvel pode entrar numa troca? (sem construções no grupo) */
export const trocavel = (e: Estado, c: number, id: string) =>
  e.posses[c]?.dono === id &&
  (CASAS[c]?.tipo !== "imovel" || casasDoGrupo(e, c).every((n) => n === 0));

function classificar(e: Estado): Lugar[] {
  const linha = (j: Jogador) => ({ id: j.id, patrimonio: patrimonio(e, j.id), saldo: j.saldo });
  const vivos = ativos(e)
    .map(linha)
    .sort((a, b) => b.patrimonio - a.patrimonio || b.saldo - a.saldo);
  const fora = e.jogadores
    .filter((j) => j.falido)
    .sort((a, b) => (b.falidoEm ?? 0) - (a.falidoEm ?? 0))
    .map((j) => ({ id: j.id, patrimonio: 0, saldo: 0 }));
  const lista: Lugar[] = [];
  vivos.forEach((l, i) => {
    const antes = lista[i - 1];
    // empate (mesmo patrimônio e mesmo saldo) divide o lugar
    const empate = antes && antes.patrimonio === l.patrimonio && antes.saldo === l.saldo;
    lista.push({ ...l, lugar: empate ? antes.lugar : i + 1 });
  });
  fora.forEach((l, i) => lista.push({ ...l, lugar: vivos.length + i + 1 }));
  return lista;
}
function encerrarPartida(e: Estado) {
  e.fase = "fim";
  e.prazo = null;
  e.leilao = null;
  e.carta = null;
  e.trocas = [];
  e.ranking = classificar(e);
  const campeoes = e.ranking.filter((l) => l.lugar === 1).map((l) => jogador(e, l.id)?.nome);
  anotar(
    e,
    campeoes.length > 1
      ? `Empate entre ${campeoes.join(" e ")}!`
      : `${campeoes[0]} venceu a partida!`,
  );
}
function proximo(e: Estado, agora: number) {
  e.duplos = 0;
  e.bis = false;
  e.dados = null;
  e.credor = null;
  if (ativos(e).length <= 1 || (e.modo === "rapido" && e.fimEm !== null && agora >= e.fimEm)) {
    encerrarPartida(e);
    return;
  }
  do e.vez = (e.vez + 1) % e.jogadores.length;
  while (e.jogadores[e.vez]?.falido);
  e.etapa = "rolar";
  e.desde = agora;
}
function prender(e: Estado, j: Jogador) {
  e.mov = { seq: ++e.seq, id: j.id, de: j.pos, n: 0, direto: true };
  j.pos = DELEGACIA;
  j.preso = 1;
  e.duplos = 0;
  e.bis = false;
  anotar(e, `${j.nome} foi para a Delegacia`);
}
/** Depois de resolver a casa: se ficou no vermelho, precisa levantar dinheiro; senão segue o turno. */
function seguir(e: Estado, agora: number) {
  const j = daVez(e);
  if (!j) return;
  e.prazo = null;
  e.desde = agora;
  if (j.saldo < 0) e.etapa = "divida";
  else {
    e.credor = null;
    e.etapa = e.bis && !j.preso ? "rolar" : "livre";
  }
}
function andar(e: Estado, j: Jogador, n: number, agora: number, direto = false) {
  const de = j.pos;
  e.mov = { seq: ++e.seq, id: j.id, de, n, ...(direto ? { direto } : {}) };
  j.pos = (((de + n) % N_CASAS) + N_CASAS) % N_CASAS;
  if (n > 0 && de + n >= N_CASAS) {
    j.saldo += SALARIO;
    anotar(e, `${j.nome} passou pela Partida e recebeu ${dinheiro(SALARIO)}`);
  }
  e.etapa = "andando";
  e.prazo = agora + (direto ? 1200 : Math.abs(n) * PASSO_MS + 500);
}
function cair(e: Estado, agora: number) {
  const j = daVez(e);
  if (!j) return;
  const casa = CASAS[j.pos];
  const posse = e.posses[j.pos];
  if (casa?.tipo === "imovel" || casa?.tipo === "companhia") {
    if (!posse) {
      e.etapa = "decidir";
      e.prazo = null;
      e.desde = agora;
      return;
    }
    const dono = jogador(e, posse.dono);
    const valor = aluguelDe(e, j.pos);
    if (dono && dono.id !== j.id && !dono.falido && valor > 0) {
      j.saldo -= valor;
      dono.saldo += valor;
      e.credor = dono.id;
      anotar(e, `${dono.nome} recebeu ${dinheiro(valor)} de aluguel de ${j.nome} (${casa.nome})`);
    }
  } else if (casa?.tipo === "taxa") {
    j.saldo -= casa.valor ?? 0;
    e.credor = null;
    anotar(e, `${j.nome} pagou ${dinheiro(casa.valor ?? 0)} de ${casa.nome}`);
  } else if (casa?.tipo === "blitz") prender(e, j);
  else if (casa?.tipo === "noticia") {
    // acabou o baralho: volta embaralhado de outro jeito (7 não divide o total, então passa por todas)
    if (!e.baralho.length) e.baralho = NOTICIAS.map((_, i) => (i * 7 + e.seq) % NOTICIAS.length);
    e.carta = e.baralho.shift() ?? 0;
    e.etapa = "carta";
    e.prazo = null;
    e.desde = agora;
    return;
  }
  seguir(e, agora);
}
function aplicarCarta(e: Estado, agora: number) {
  const j = daVez(e);
  const carta = NOTICIAS[e.carta ?? -1];
  e.carta = null;
  if (!j || !carta) return seguir(e, agora);
  const f = carta.efeito;
  anotar(e, `${j.nome}: "${carta.texto}"`);
  if (f.e === "ganha") j.saldo += f.v;
  else if (f.e === "paga") {
    j.saldo -= f.v;
    e.credor = null;
  } else if (f.e === "habeas") j.habeas++;
  else if (f.e === "preso") prender(e, j);
  else if (f.e === "cadaUm") {
    for (const o of ativos(e))
      if (o.id !== j.id) {
        const v = Math.max(0, Math.min(f.v, o.saldo));
        o.saldo -= v;
        j.saldo += v;
      }
  } else if (f.e === "reforma") {
    let v = 0;
    for (const p of Object.values(e.posses))
      if (p.dono === j.id) v += p.casas === 5 ? f.hotel : p.casas * f.casa;
    j.saldo -= v;
    e.credor = null;
  } else if (f.e === "vai") return andar(e, j, (f.casa - j.pos + N_CASAS) % N_CASAS, agora);
  else if (f.e === "anda") return andar(e, j, f.n, agora);
  seguir(e, agora);
}
function falir(e: Estado, j: Jogador, agora: number) {
  const credor = e.credor ? jogador(e, e.credor) : undefined;
  // o credor já tinha recebido tudo: devolve o que o falido não conseguiu pagar e fica com os bens
  if (credor && j.saldo < 0) credor.saldo += j.saldo;
  for (const [k, p] of Object.entries(e.posses))
    if (p.dono === j.id) {
      if (credor && !credor.falido) e.posses[+k] = { dono: credor.id, casas: 0, hip: p.hip };
      else delete e.posses[+k];
    }
  if (credor) credor.habeas += j.habeas;
  j.habeas = 0;
  j.saldo = 0;
  j.falido = true;
  j.falidoEm = ++e.seq;
  e.trocas = e.trocas.filter((t) => t.de !== j.id && t.para !== j.id);
  anotar(e, `${j.nome} faliu`);
  if (daVez(e)?.id === j.id) proximo(e, agora);
  else if (ativos(e).length <= 1) encerrarPartida(e);
}
const trocaValida = (e: Estado, t: Omit<Troca, "id">) => {
  const a = jogador(e, t.de);
  const b = jogador(e, t.para);
  if (!a || !b || a.falido || b.falido || a.id === b.id) return false;
  if (!Number.isInteger(t.douD) || !Number.isInteger(t.queroD) || t.douD < 0 || t.queroD < 0)
    return false;
  if (t.douD > a.saldo || t.queroD > b.saldo) return false;
  if (!t.dou.length && !t.quero.length) return false;
  if (new Set([...t.dou, ...t.quero]).size !== t.dou.length + t.quero.length) return false;
  return t.dou.every((c) => trocavel(e, c, a.id)) && t.quero.every((c) => trocavel(e, c, b.id));
};

/**
 * Aplica uma ação de `de` na partida. Devolve o estado novo, ou null se a ação
 * não vale agora (fora da vez, sem saldo...). `sorte` devolve números de 0 a 1.
 */
export function aplicar(
  antes: Estado,
  de: string,
  a: Acao,
  agora: number,
  sorte: () => number = Math.random,
): Estado | null {
  const e = structuredClone(antes);
  e.v++;
  const eu = jogador(e, de);
  const vez = daVez(e);
  const minhaVez = e.fase === "jogo" && !!vez && vez.id === de;

  if (a.t === "_prazo") {
    if (e.fase !== "jogo" || !vez) return null;
    if (e.etapa === "rolando" && e.dados) {
      const [d1, d2] = e.dados;
      const iguais = d1 === d2;
      if (vez.preso) {
        if (iguais) {
          vez.preso = 0;
          anotar(e, `${vez.nome} tirou números iguais e saiu da Delegacia`);
          andar(e, vez, d1 + d2, agora);
        } else if (vez.preso >= 3) {
          vez.preso = 0;
          vez.saldo -= FIANCA;
          e.credor = null;
          anotar(e, `${vez.nome} pagou a fiança de ${dinheiro(FIANCA)}`);
          andar(e, vez, d1 + d2, agora);
        } else {
          vez.preso++;
          e.bis = false;
          seguir(e, agora);
        }
        return e;
      }
      if (iguais && ++e.duplos >= 3) {
        anotar(e, `${vez.nome} tirou iguais três vezes seguidas`);
        prender(e, vez);
        seguir(e, agora);
        return e;
      }
      e.bis = iguais;
      andar(e, vez, d1 + d2, agora);
      return e;
    }
    if (e.etapa === "andando") {
      cair(e, agora);
      return e;
    }
    if (e.etapa === "leilao" && e.leilao) {
      const { casa, lance, de: quem } = e.leilao;
      const comprador = quem ? jogador(e, quem) : undefined;
      if (comprador && comprador.saldo >= lance) {
        comprador.saldo -= lance;
        e.posses[casa] = { dono: comprador.id, casas: 0, hip: false };
        anotar(e, `${comprador.nome} arrematou ${CASAS[casa]?.nome} por ${dinheiro(lance)}`);
      } else anotar(e, `Ninguém arrematou ${CASAS[casa]?.nome}`);
      e.leilao = null;
      seguir(e, agora);
      return e;
    }
    return null;
  }

  if (a.t === "entrar") {
    if (e.fase !== "sala" || eu || e.jogadores.length >= MAX_JOGADORES) return null;
    const cor = CORES.findIndex((_, i) => !e.jogadores.some((j) => j.cor === i));
    e.jogadores.push(novoJogador(de, a.nome, a.visual, Math.max(0, cor)));
    return e;
  }
  if (!eu) return null;

  if (a.t === "sair") {
    if (e.fase === "sala" || e.fase === "fim") {
      e.jogadores = e.jogadores.filter((j) => j.id !== de);
      if (e.anfitriao === de) e.anfitriao = e.jogadores[0]?.id ?? "";
      return e;
    }
    if (eu.falido) return null;
    // desistiu no meio: os bens voltam para o banco
    if (minhaVez) {
      e.leilao = null;
      e.carta = null;
      e.prazo = null;
    }
    const credor = e.credor;
    e.credor = null;
    falir(e, eu, agora);
    if (e.fase === "jogo" && !minhaVez) e.credor = credor;
    return e;
  }

  if (e.fase === "sala") {
    if (a.t === "pronto") eu.pronto = !!a.v;
    else if (a.t === "modo" && de === e.anfitriao)
      e.modo = a.modo === "rapido" ? "rapido" : "classico";
    else if (a.t === "iniciar" && de === e.anfitriao) {
      if (e.jogadores.length < MIN_JOGADORES) return null;
      if (e.jogadores.some((j) => !j.pronto && j.id !== de)) return null;
      // ordem dos turnos sorteada
      for (let i = e.jogadores.length - 1; i > 0; i--) {
        const k = Math.floor(sorte() * (i + 1));
        [e.jogadores[i], e.jogadores[k]] = [e.jogadores[k]!, e.jogadores[i]!];
      }
      e.baralho = NOTICIAS.map((_, i) => i);
      for (let i = e.baralho.length - 1; i > 0; i--) {
        const k = Math.floor(sorte() * (i + 1));
        [e.baralho[i], e.baralho[k]] = [e.baralho[k]!, e.baralho[i]!];
      }
      e.fase = "jogo";
      e.vez = 0;
      e.etapa = "rolar";
      e.desde = agora + 4000;
      e.fimEm = e.modo === "rapido" ? agora + TEMPO_RAPIDO_MS : null;
      anotar(e, `Partida iniciada: ${e.jogadores[0]?.nome} começa`);
    } else return null;
    return e;
  }

  if (e.fase === "fim") {
    if (a.t !== "denovo" || de !== e.anfitriao) return null;
    const nova = novaSala(e.codigo, { id: de, nome: eu.nome, visual: eu.visual });
    nova.v = e.v;
    nova.modo = e.modo;
    nova.jogadores = e.jogadores.map((j) =>
      novoJogador(j.id, j.nome, j.visual, j.cor, j.id === de),
    );
    return nova;
  }

  // ---------- partida em andamento ----------
  if (a.t === "lance") {
    const l = e.leilao;
    if (e.etapa !== "leilao" || !l || eu.falido || l.de === de) return null;
    if (!Number.isInteger(a.v) || a.v < l.lance + 10 || a.v > eu.saldo) return null;
    l.lance = a.v;
    l.de = de;
    e.prazo = Math.max(e.prazo ?? 0, agora + 8000);
    anotar(e, `${eu.nome} deu lance de ${dinheiro(a.v)}`);
    return e;
  }
  if (a.t === "propor") {
    if (eu.falido) return null;
    const t = { de, para: a.para, dou: a.dou, douD: a.douD, quero: a.quero, queroD: a.queroD };
    if (!trocaValida(e, t)) return null;
    e.trocas = e.trocas.filter((x) => x.de !== de);
    e.trocas.push({ ...t, id: ++e.seq });
    anotar(e, `${eu.nome} propôs uma troca a ${jogador(e, a.para)?.nome}`);
    return e;
  }
  if (a.t === "troca") {
    const t = e.trocas.find((x) => x.id === a.id);
    if (!t || (t.de !== de && t.para !== de)) return null;
    e.trocas = e.trocas.filter((x) => x.id !== a.id);
    if (!a.aceita) return e;
    if (t.para !== de || !trocaValida(e, t)) return null;
    const dono = jogador(e, t.de);
    if (!dono) return null;
    for (const c of t.dou) e.posses[c]!.dono = eu.id;
    for (const c of t.quero) e.posses[c]!.dono = dono.id;
    dono.saldo += t.queroD - t.douD;
    eu.saldo += t.douD - t.queroD;
    // as outras propostas podem ter ficado sem sentido
    e.trocas = e.trocas.filter((x) => trocaValida(e, x));
    anotar(e, `${dono.nome} e ${eu.nome} fecharam uma troca`);
    return e;
  }

  if (!minhaVez || !vez) return null;
  const administra = e.etapa === "rolar" || e.etapa === "livre";
  switch (a.t) {
    case "rolar": {
      if (e.etapa !== "rolar") return null;
      const d = (): number => 1 + Math.min(5, Math.floor(sorte() * 6));
      e.dados = [d(), d()];
      e.etapa = "rolando";
      e.prazo = agora + 1500;
      anotar(e, `${vez.nome} tirou ${e.dados[0] + e.dados[1]} (${e.dados[0]} + ${e.dados[1]})`);
      return e;
    }
    case "fianca":
      if (e.etapa !== "rolar" || !vez.preso || vez.saldo < FIANCA) return null;
      vez.saldo -= FIANCA;
      vez.preso = 0;
      anotar(e, `${vez.nome} pagou a fiança de ${dinheiro(FIANCA)}`);
      return e;
    case "habeas":
      if (e.etapa !== "rolar" || !vez.preso || vez.habeas < 1) return null;
      vez.habeas--;
      vez.preso = 0;
      anotar(e, `${vez.nome} usou um habeas corpus`);
      return e;
    case "comprar": {
      const preco = CASAS[vez.pos]?.preco ?? 0;
      if (e.etapa !== "decidir" || e.posses[vez.pos] || vez.saldo < preco) return null;
      vez.saldo -= preco;
      e.posses[vez.pos] = { dono: vez.id, casas: 0, hip: false };
      anotar(e, `${vez.nome} comprou ${CASAS[vez.pos]?.nome} por ${dinheiro(preco)}`);
      seguir(e, agora);
      return e;
    }
    case "recusar":
      if (e.etapa !== "decidir") return null;
      e.leilao = { casa: vez.pos, lance: 0, de: null };
      e.etapa = "leilao";
      e.prazo = agora + TEMPO_LEILAO_MS;
      anotar(e, `${vez.nome} recusou ${CASAS[vez.pos]?.nome}: leilão aberto`);
      return e;
    case "ok":
      if (e.etapa !== "carta") return null;
      aplicarCarta(e, agora);
      return e;
    case "encerrar":
      if (e.etapa !== "livre" || vez.saldo < 0) return null;
      proximo(e, agora);
      return e;
    case "construir":
      if (!administra || podeConstruir(e, a.c, de)) return null;
      vez.saldo -= obraDe(a.c);
      e.posses[a.c]!.casas++;
      anotar(
        e,
        `${vez.nome} construiu ${e.posses[a.c]!.casas === 5 ? "um hotel" : "uma casa"} em ${CASAS[a.c]?.nome}`,
      );
      return e;
    case "vender":
      if ((!administra && e.etapa !== "divida") || podeVender(e, a.c, de)) return null;
      vez.saldo += obraDe(a.c) / 2;
      e.posses[a.c]!.casas--;
      anotar(e, `${vez.nome} vendeu uma construção de ${CASAS[a.c]?.nome}`);
      return e;
    case "hipotecar":
      if ((!administra && e.etapa !== "divida") || podeHipotecar(e, a.c, de)) return null;
      vez.saldo += hipotecaDe(a.c);
      e.posses[a.c]!.hip = true;
      anotar(e, `${vez.nome} hipotecou ${CASAS[a.c]?.nome}`);
      return e;
    case "resgatar":
      if (!administra || !e.posses[a.c]?.hip || e.posses[a.c]?.dono !== de) return null;
      if (vez.saldo < resgateDe(a.c)) return null;
      vez.saldo -= resgateDe(a.c);
      e.posses[a.c]!.hip = false;
      anotar(e, `${vez.nome} resgatou a hipoteca de ${CASAS[a.c]?.nome}`);
      return e;
    case "pagar":
      if (e.etapa !== "divida" || vez.saldo < 0) return null;
      seguir(e, agora);
      return e;
    case "falir":
      if (e.etapa !== "divida") return null;
      falir(e, vez, agora);
      return e;
    default:
      return null;
  }
}

/**
 * O que fazer no lugar de quem travou a partida (caiu a conexão ou demorou
 * demais): a jogada mais simples que deixa o jogo seguir.
 */
export function jogadaAutomatica(e: Estado): Acao | null {
  const j = daVez(e);
  if (e.fase !== "jogo" || !j) return null;
  if (e.etapa === "rolar") return { t: "rolar" };
  if (e.etapa === "decidir") return { t: "recusar" };
  if (e.etapa === "carta") return { t: "ok" };
  if (e.etapa === "livre") return { t: "encerrar" };
  if (e.etapa === "divida") {
    if (j.saldo >= 0) return { t: "pagar" };
    const minhas = Object.entries(e.posses)
      .filter(([, p]) => p.dono === j.id)
      .map(([k]) => +k);
    const obra = minhas.find((c) => !podeVender(e, c, j.id));
    if (obra !== undefined) return { t: "vender", c: obra };
    const livre = minhas.find((c) => !podeHipotecar(e, c, j.id));
    if (livre !== undefined) return { t: "hipotecar", c: livre };
    return { t: "falir" };
  }
  return null;
}
