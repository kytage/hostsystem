/**
 * HOST FAZENDAS — regras do jogo (contas puras, sem banco e sem tela).
 *
 * O servidor carrega o jogador e a ilha, chama `aplicar` com a hora do servidor
 * e grava o resultado numa transação só. A interface usa as mesmas funções só
 * para mostrar prévias (preços, tempos, o que está liberado): quem decide é o servidor.
 */
import {
  ANIMAIS,
  BATERIAS,
  BONUS_DIARIO,
  BONUS_SEMANAL,
  CARGAS_INICIAIS,
  CARGAS_MAXIMAS,
  CONQUISTAS,
  corLevel,
  cultura,
  expansaoDe,
  FESTIVAL,
  INICIO,
  item,
  MAESTRIA,
  MATERIAIS,
  MISSOES_DIARIAS,
  MISSOES_SEMANAIS,
  NIVEL_SEMANAIS,
  nivelDoXp,
  PRECO_ARAR,
  projeto,
  proximaExpansao,
  SOCIAL,
  TRATORES,
  TUTORIAL_FIM,
  XP_ARAR,
  XP_MAXIMO,
  type Material,
  type Meta,
  type QualTrator,
  type Recompensa,
} from "./catalogo";

export type Privacidade = "amigos" | "convite" | "privada";
export type Origem = "loja" | "granas" | "tutorial" | "premio" | "projeto";

export interface Canteiro {
  estado: "arado" | "crescendo";
  cultura?: string;
  plantadoEm?: number;
  maduroEm?: number;
  plantioId?: string;
  valorVenda?: number;
  xpColheita?: number;
  adubo?: { id: string; nome: string; reducaoMs: number };
}
export interface Objeto {
  id: string;
  item: string;
  x: number;
  z: number;
  rot: number;
  /** Hora da próxima coleta (árvores e animais); null nas decorações. */
  prontoEm: number | null;
  origem: Origem;
}
export interface Guardado {
  id: string;
  item: string;
  /** Tempo que faltava quando foi guardado (a produção pausa); null = ciclo inteiro. */
  restanteMs: number | null;
  origem: Origem;
}
export interface ProjetoNaIlha {
  id: string;
  x: number;
  z: number;
  /** Etapa atual (0 = primeira). */
  etapa: number;
  /** Progresso de cada meta da etapa atual. */
  progresso: number[];
  concluido: boolean;
}
export interface Ilha {
  tamanho: number;
  privacidade: Privacidade;
  canteiros: Record<string, Canteiro>;
  objetos: Objeto[];
  projetos: ProjetoNaIlha[];
  maquinas: Partial<Record<QualTrator, { cargas: number }>>;
  /** Quantas vezes a fazenda foi roubada no dia (horário de Brasília). */
  roubos?: { dia: string; quantos: number };
}
export interface Jogador {
  xp: number;
  nivel: number;
  ouros: number;
  granas: number;
  materiais: Record<Material, number>;
  /** Etapa do tutorial (1 a 6); 7 = concluído. */
  tutorial: number;
  tutorialConta: number;
  /** Marcas de prêmios dados uma vez só (kit, galinha, maestrias, trocas do festival...). */
  recompensas: string[];
  titulos: string[];
  corLevel: string;
  presenca: { dia: string; sequencia: number };
  maestrias: Record<string, number>;
  conquistas: Record<string, "pendente" | "resgatada">;
  totais: {
    colheitas: number;
    coletas: number;
    adubacoes: number;
    projetos: number;
    tratorOps: number;
  };
  diario: {
    dia: string;
    colheitas: number;
    coletas: number;
    plantios: number;
    adubacoes: number;
    feitas: string[];
    bonusPendente: boolean;
    adubosPorIlha: Record<string, number>;
    presentes: number;
    presentesPara: string[];
    /** Roubos feitos hoje e as fazendas (donos) já roubadas hoje. */
    roubos?: number;
    roubadas?: string[];
  };
  semanal: {
    semana: string;
    colheitas: number;
    coletas: number;
    adubacoes: number;
    colheitasExtra: number;
    dias: string[];
    feitas: string[];
  };
  inventario: Guardado[];
  festival: { fichas: number; dia: string; hoje: number; colheitas: number };
}
export interface Evento {
  tipo:
    | "info"
    | "ouros"
    | "xp"
    | "nivel"
    | "cor"
    | "grana"
    | "conquista"
    | "missao"
    | "maestria"
    | "item"
    | "presenca"
    | "produto";
  texto: string;
  /** "produto": de onde veio (id da cultura ou do objeto), para a mochila do HOKI receber uma unidade. */
  fonte?: string;
}
export interface Contexto {
  agora: number;
  novoId: () => string;
  /** Amigos com ilha (para o requisito de vizinhos da expansão). */
  vizinhos?: number;
}
export class ErroDoJogo extends Error {}
function falha(texto: string): never {
  throw new ErroDoJogo(texto);
}

// ---------------- datas no horário de Brasília (UTC−3, sem horário de verão) ----------------
const FUSO_MS = 3 * 3_600_000;
export const diaBR = (ms: number) => new Date(ms - FUSO_MS).toISOString().slice(0, 10);
export function semanaBR(ms: number) {
  const d = new Date(ms - FUSO_MS);
  const recuo = (d.getUTCDay() + 6) % 7; // segunda-feira = 0
  return new Date(d.getTime() - recuo * 86_400_000).toISOString().slice(0, 10);
}
export const diaAnterior = (dia: string) =>
  new Date(Date.parse(`${dia}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
/** Início do dia de Brasília (em UTC), para contar presentes recebidos "hoje". */
export const inicioDoDiaBR = (ms: number) => Date.parse(`${diaBR(ms)}T00:00:00Z`) + FUSO_MS;

// ---------------- estado inicial ----------------
const materiaisZerados = (): Record<Material, number> => ({
  tabua: 0,
  tijolo: 0,
  cimento: 0,
  ferramenta: 0,
});
export function novoJogador(agora: number): Jogador {
  return {
    xp: 0,
    nivel: 1,
    ouros: INICIO.ouros,
    granas: INICIO.granas,
    materiais: materiaisZerados(),
    tutorial: 1,
    tutorialConta: 0,
    recompensas: [],
    titulos: [],
    corLevel: "vermelho",
    presenca: { dia: "", sequencia: 0 },
    maestrias: {},
    conquistas: {},
    totais: { colheitas: 0, coletas: 0, adubacoes: 0, projetos: 0, tratorOps: 0 },
    diario: novoDiario(diaBR(agora)),
    semanal: novaSemana(semanaBR(agora)),
    inventario: [],
    festival: { fichas: 0, dia: diaBR(agora), hoje: 0, colheitas: 0 },
  };
}
export function novaIlha(): Ilha {
  const canteiros: Record<string, Canteiro> = {};
  for (const [x, z] of INICIO.arados) canteiros[chave(x, z)] = { estado: "arado" };
  return {
    tamanho: INICIO.tamanho,
    privacidade: "amigos",
    canteiros,
    objetos: [],
    projetos: [],
    maquinas: {},
  };
}
const novoDiario = (dia: string): Jogador["diario"] => ({
  dia,
  colheitas: 0,
  coletas: 0,
  plantios: 0,
  adubacoes: 0,
  feitas: [],
  bonusPendente: false,
  adubosPorIlha: {},
  presentes: 0,
  presentesPara: [],
  roubos: 0,
  roubadas: [],
});
const novaSemana = (semana: string): Jogador["semanal"] => ({
  semana,
  colheitas: 0,
  coletas: 0,
  adubacoes: 0,
  colheitasExtra: 0,
  dias: [],
  feitas: [],
});
export const chave = (x: number, z: number) => `${x},${z}`;

/** Zera os contadores do dia e da semana quando eles viram (horário de Brasília). */
export function renovarPeriodos(j: Jogador, agora: number) {
  const dia = diaBR(agora);
  if (j.diario.dia !== dia) j.diario = novoDiario(dia);
  const semana = semanaBR(agora);
  if (j.semanal.semana !== semana) j.semanal = novaSemana(semana);
  if (j.festival.dia !== dia) j.festival = { ...j.festival, dia, hoje: 0 };
}

// ---------------- XP, níveis e recompensas ----------------
/** Soma XP (até o teto), sobe os níveis que couberem e dá 1 Grana por nível de 2 a 100. */
export function creditarXP(j: Jogador, quantidade: number, ev: Evento[]) {
  if (quantidade <= 0) return;
  const antes = j.nivel;
  j.xp = Math.min(XP_MAXIMO, j.xp + quantidade);
  const depois = nivelDoXp(j.xp);
  for (let n = antes + 1; n <= depois; n++) {
    if (n >= 2 && n <= 100) j.granas += 1;
    const cores = CORES_DO_NIVEL.get(n);
    if (cores) for (const c of cores) ev.push({ tipo: "cor", texto: `Nova cor liberada: ${c}` });
    if (n === 100 && !j.recompensas.includes("mestre-100")) {
      j.recompensas.push("mestre-100");
      j.titulos.push("Mestre da HOST Fazendas");
      j.inventario.push({
        id: `trofeu-mestre-${j.xp}`,
        item: "trofeu-mestre",
        restanteMs: null,
        origem: "premio",
      });
      ev.push({ tipo: "item", texto: "Título Mestre da HOST Fazendas e o Troféu Mestre!" });
    }
  }
  if (depois > antes) {
    ev.push({ tipo: "nivel", texto: `Você chegou ao nível ${depois}!` });
    const g = Math.max(0, Math.min(depois, 100) - Math.max(antes, 1));
    if (g > 0) ev.push({ tipo: "grana", texto: `+${g} HOST Grana${g > 1 ? "s" : ""}` });
  }
  j.nivel = depois;
}
const CORES_DO_NIVEL = (() => {
  const m = new Map<number, string[]>();
  for (const id of [
    "dourado",
    "verde_claro",
    "amarelo",
    "roxo_claro",
    "branco",
    "azul",
    "verde_escuro",
    "vermelho_escuro",
    "turquesa_escuro",
    "roxo_escuro",
    "cinza_escuro",
    "preto",
  ]) {
    const c = corLevel(id);
    m.set(c.nivel, [...(m.get(c.nivel) ?? []), c.nome]);
  }
  return m;
})();
export function creditar(j: Jogador, r: Recompensa, ev: Evento[], ctx: Contexto) {
  if (r.ouros) j.ouros += r.ouros;
  if (r.granas) j.granas += r.granas;
  for (const [m, q] of Object.entries(r.materiais ?? {})) j.materiais[m as Material] += q ?? 0;
  for (const it of r.itens ?? [])
    j.inventario.push({ id: ctx.novoId(), item: it, restanteMs: null, origem: "premio" });
  if (r.titulo && !j.titulos.includes(r.titulo)) j.titulos.push(r.titulo);
  if (r.xp) creditarXP(j, r.xp, ev);
}
export function textoDaRecompensa(r: Recompensa) {
  const partes: string[] = [];
  if (r.ouros) partes.push(`${r.ouros.toLocaleString("pt-BR")} Ouros`);
  if (r.xp) partes.push(`${r.xp} XP`);
  if (r.granas) partes.push(`${r.granas} Grana${r.granas > 1 ? "s" : ""}`);
  for (const [m, q] of Object.entries(r.materiais ?? {}))
    if (q) partes.push(`${q} ${MATERIAIS.find((x) => x.id === m)?.nome ?? m}${q > 1 ? "s" : ""}`);
  for (const it of r.itens ?? []) partes.push(item(it)?.nome ?? it);
  if (r.titulo) partes.push(`título ${r.titulo}`);
  return partes.join(", ");
}

// ---------------- presença diária ----------------
export function registrarPresenca(j: Jogador, agora: number, ev: Evento[]) {
  const dia = diaBR(agora);
  if (j.presenca.dia === dia) return;
  const seguida = j.presenca.dia === diaAnterior(dia) && j.presenca.sequencia < 7;
  j.presenca = { dia, sequencia: seguida ? j.presenca.sequencia + 1 : 1 };
  if (j.presenca.sequencia === 7) {
    j.granas += 3;
    ev.push({ tipo: "presenca", texto: "7 dias seguidos na fazenda: +3 HOST Granas!" });
  } else ev.push({ tipo: "presenca", texto: `Presença do dia: ${j.presenca.sequencia} de 7` });
}

// ---------------- missões, conquistas, maestria e festival ----------------
type Contador = "colheitas" | "coletas" | "plantios" | "adubacoes";
const tutorialFeito = (j: Jogador) => j.tutorial >= TUTORIAL_FIM;
function contar(j: Jogador, contador: Contador, n: number, ev: Evento[], ctx: Contexto) {
  if (n <= 0) return;
  renovarPeriodos(j, ctx.agora);
  if (contador === "colheitas") j.totais.colheitas += n;
  if (contador === "coletas") j.totais.coletas += n;
  if (contador === "adubacoes") j.totais.adubacoes += n;
  if (tutorialFeito(j)) {
    j.diario[contador] += n;
    for (const m of MISSOES_DIARIAS) {
      if (j.diario.feitas.includes(m.id) || j.diario[m.contador] < m.alvo) continue;
      j.diario.feitas.push(m.id);
      creditar(j, m.recompensa, ev, ctx);
      ev.push({ tipo: "missao", texto: `Missão diária concluída: ${m.nome}` });
      if (!j.semanal.dias.includes(j.diario.dia)) j.semanal.dias.push(j.diario.dia);
      if (j.diario.feitas.filter((f) => f !== BONUS_DIARIO.id).length === BONUS_DIARIO.alvo) {
        j.diario.bonusPendente = true;
        ev.push({
          tipo: "missao",
          texto: "3 diárias no mesmo dia: escolha seu material nas Missões!",
        });
      }
    }
  }
  if (j.nivel >= NIVEL_SEMANAIS && tutorialFeito(j)) {
    const s = j.semanal;
    if (contador === "colheitas") {
      if (s.feitas.includes("s-colher")) s.colheitasExtra += n;
      s.colheitas += n;
    }
    if (contador === "coletas") s.coletas += n;
    if (contador === "adubacoes") s.adubacoes += n;
    const prontas: Record<string, boolean> = {
      "s-colher": s.colheitas >= 150,
      "s-coletar": s.coletas >= 30,
      "s-dias": s.dias.length >= 3,
      "s-ajuda": s.adubacoes >= 12 || s.colheitasExtra >= 80,
    };
    for (const m of MISSOES_SEMANAIS) {
      if (s.feitas.includes(m.id) || !prontas[m.id]) continue;
      s.feitas.push(m.id);
      creditar(j, m.recompensa, ev, ctx);
      ev.push({ tipo: "missao", texto: `Missão semanal concluída: ${m.nome}` });
    }
    if (
      !s.feitas.includes(BONUS_SEMANAL.id) &&
      MISSOES_SEMANAIS.every((m) => s.feitas.includes(m.id))
    ) {
      s.feitas.push(BONUS_SEMANAL.id);
      creditar(j, BONUS_SEMANAL.recompensa, ev, ctx);
      ev.push({ tipo: "missao", texto: "Todas as semanais concluídas: +2 HOST Granas!" });
    }
  }
}
/** Marca as conquistas alcançadas (o jogador resgata a recompensa no painel). */
function verConquistas(j: Jogador, i: Ilha | null, ev: Evento[]) {
  const ouros = Object.values(j.maestrias).filter((n) => n >= 500).length;
  const alcancou: Record<string, boolean> = {
    "primeira-colheita": j.totais.colheitas >= 1,
    "fazenda-movimento": j.totais.colheitas >= 100,
    "maos-na-terra": j.totais.colheitas >= 1000,
    "boa-vizinhanca": j.totais.adubacoes >= 50,
    construtor: j.totais.projetos >= 3,
    "ilha-completa": (i?.tamanho ?? 0) >= 20,
    "mestre-culturas": ouros >= 6,
  };
  for (const c of CONQUISTAS)
    if (alcancou[c.id] && !j.conquistas[c.id]) {
      j.conquistas[c.id] = "pendente";
      ev.push({ tipo: "conquista", texto: `Conquista desbloqueada: ${c.nome}` });
    }
}
function maestria(j: Jogador, culturaId: string, n: number, ev: Evento[], ctx: Contexto) {
  const antes = j.maestrias[culturaId] ?? 0;
  const depois = antes + n;
  j.maestrias[culturaId] = depois;
  MAESTRIA.forEach((m, k) => {
    const marca = `maestria:${culturaId}:${k}`;
    if (depois >= m.colheitas && !j.recompensas.includes(marca)) {
      j.recompensas.push(marca);
      creditar(
        j,
        { ...m.recompensa, ...(k === 2 ? { itens: [`placa-${culturaId}`] } : {}) },
        ev,
        ctx,
      );
      ev.push({
        tipo: "maestria",
        texto: `Maestria ${m.medalha} em ${cultura(culturaId)?.nome ?? culturaId}!`,
      });
    }
  });
}
export const festivalAtivo = (agora: number) =>
  agora >= FESTIVAL.inicio && agora < FESTIVAL.inicio + FESTIVAL.duracaoMs;
export const lojaDoFestivalAberta = (agora: number) =>
  agora >= FESTIVAL.inicio && agora < FESTIVAL.inicio + FESTIVAL.duracaoMs + FESTIVAL.lojaExtraMs;
function fichasDoFestival(j: Jogador, n: number, ev: Evento[], agora: number) {
  if (!festivalAtivo(agora)) return;
  j.festival.colheitas += n;
  while (j.festival.colheitas >= FESTIVAL.colheitasPorFicha) {
    j.festival.colheitas -= FESTIVAL.colheitasPorFicha;
    if (j.festival.hoje >= FESTIVAL.fichasPorDia) continue;
    j.festival.hoje += 1;
    j.festival.fichas += 1;
    ev.push({ tipo: "item", texto: "+1 Ficha da Colheita" });
  }
}
/** Avança as metas dos projetos ativos. */
function metaDeProjeto(i: Ilha, ok: (m: Meta) => boolean, n: number) {
  for (const p of i.projetos) {
    if (p.concluido) continue;
    const etapa = projeto(p.id)?.etapas[p.etapa];
    etapa?.metas.forEach((m, k) => {
      if (m.tipo !== "colocados" && ok(m))
        p.progresso[k] = Math.min(m.quantidade, (p.progresso[k] ?? 0) + n);
    });
  }
}

// ---------------- terreno e ocupação ----------------
const dentro = (i: Ilha, x: number, z: number) =>
  Number.isInteger(x) && Number.isInteger(z) && x >= 0 && z >= 0 && x < i.tamanho && z < i.tamanho;
/** Quadrados ocupados por objetos e projetos (projetos ocupam 2 × 2). */
export function ocupacao(i: Ilha, exceto?: string) {
  const s = new Set<string>();
  for (const o of i.objetos) if (o.id !== exceto) s.add(chave(o.x, o.z));
  for (const p of i.projetos)
    if (p.id !== exceto)
      for (const [dx, dz] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const)
        s.add(chave(p.x + dx, p.z + dz));
  return s;
}
export const limiteDeObjetos = (i: Ilha) => expansaoDe(i.tamanho).objetos;
export const objetosContados = (i: Ilha) => i.objetos.length + i.projetos.length;
function lugarLivre(i: Ilha, x: number, z: number, exceto?: string, w = 1, h = 1) {
  const oc = ocupacao(i, exceto);
  for (let dx = 0; dx < w; dx++)
    for (let dz = 0; dz < h; dz++) {
      const px = x + dx;
      const pz = z + dz;
      if (!dentro(i, px, pz)) return false;
      if (oc.has(chave(px, pz)) || i.canteiros[chave(px, pz)]) return false;
    }
  return true;
}
/** Quadrados de trabalho de um trator a partir de (x, z), com rotação (0 ou 1 = girado 90°). */
export function areaDoTrator(qual: QualTrator, x: number, z: number, rot: number) {
  const [w, h] = TRATORES[qual].area;
  const [a, b] = rot % 2 ? [h, w] : [w, h];
  const lista: [number, number][] = [];
  for (let dx = 0; dx < a; dx++) for (let dz = 0; dz < b; dz++) lista.push([x + dx, z + dz]);
  return lista;
}

// ---------------- ações do dono ----------------
export type Acao =
  | { t: "arar"; x: number; z: number }
  | { t: "plantar"; x: number; z: number; cultura: string }
  | { t: "colher"; x: number; z: number; plantioId?: string | undefined }
  | { t: "remover"; x: number; z: number }
  | { t: "comprar"; item: string }
  | { t: "colocar"; id: string; x: number; z: number; rot: number }
  | { t: "mover"; id: string; x: number; z: number; rot: number }
  | { t: "guardar"; id: string }
  | { t: "vender"; id: string }
  | { t: "coletar"; id: string }
  | { t: "coletarGrupo"; projeto: string }
  | { t: "expandir"; rota: "ouros" | "granas" }
  | { t: "cor"; id: string }
  | { t: "conquista"; id: string }
  | { t: "bonusDiario"; material: Material }
  | { t: "privacidade"; modo: Privacidade }
  | { t: "tutorialLoja" }
  | { t: "kit" }
  | { t: "festival"; troca: string }
  | { t: "comprarTrator"; qual: QualTrator }
  | { t: "bateria"; qual: QualTrator; pacote: string; moeda: "ouros" | "granas" }
  | {
      t: "trator";
      qual: QualTrator;
      modo: "arar" | "plantar" | "colher";
      x: number;
      z: number;
      rot: number;
      cultura?: string | undefined;
    }
  | { t: "projetoColocar"; id: string; x: number; z: number }
  | { t: "projetoConcluir"; id: string };

export interface Estado {
  j: Jogador;
  i: Ilha;
}
export interface Resultado extends Estado {
  ev: Evento[];
}

function arar(e: Estado, x: number, z: number, ev: Evento[], cobrar = true) {
  const { j, i } = e;
  if (!dentro(i, x, z)) falha("Esse quadrado fica fora do seu terreno.");
  if (i.canteiros[chave(x, z)]) falha("Esse quadrado já está preparado.");
  if (ocupacao(i).has(chave(x, z))) falha("Esse quadrado está ocupado.");
  if (cobrar && j.ouros < PRECO_ARAR) falha("Ouros insuficientes para arar.");
  j.ouros -= PRECO_ARAR;
  i.canteiros[chave(x, z)] = { estado: "arado" };
  creditarXP(j, XP_ARAR, ev);
}
function plantar(e: Estado, x: number, z: number, id: string, ev: Evento[], ctx: Contexto) {
  const { j, i } = e;
  const c = cultura(id) ?? falha("Semente desconhecida.");
  const can = i.canteiros[chave(x, z)];
  if (!can || can.estado !== "arado") falha("Plante em um quadrado arado.");
  if (j.nivel < c.nivel) falha(`${c.nome} libera no nível ${c.nivel}.`);
  if (j.ouros < c.semente) falha("Ouros insuficientes para a semente.");
  j.ouros -= c.semente;
  i.canteiros[chave(x, z)] = {
    estado: "crescendo",
    cultura: c.id,
    plantadoEm: ctx.agora,
    maduroEm: ctx.agora + c.tempoMs,
    plantioId: ctx.novoId(),
    valorVenda: c.venda,
    xpColheita: c.xpColher,
  };
  creditarXP(j, c.xpPlantar, ev);
  contar(j, "plantios", 1, ev, ctx);
  if (j.tutorial === 2 && c.id === "morango") {
    j.tutorialConta += 1;
    if (j.tutorialConta >= INICIO.arados.length) {
      j.tutorial = 3;
      j.tutorialConta = 0;
    }
  }
}
function colher(
  e: Estado,
  x: number,
  z: number,
  plantioId: string | undefined,
  ev: Evento[],
  ctx: Contexto,
) {
  const { j, i } = e;
  const can = i.canteiros[chave(x, z)];
  if (!can || can.estado !== "crescendo" || can.maduroEm === undefined)
    falha("Não há nada para colher aqui.");
  if (plantioId && can.plantioId !== plantioId) falha("Esse canteiro mudou. Atualize a ilha.");
  if (ctx.agora < can.maduroEm) falha("Ainda não está maduro.");
  j.ouros += can.valorVenda ?? 0;
  ev.push({
    tipo: "ouros",
    texto: `+${can.valorVenda} Ouros (${cultura(can.cultura ?? "")?.nome ?? "colheita"})`,
  });
  creditarXP(j, can.xpColheita ?? 0, ev);
  delete i.canteiros[chave(x, z)];
  contar(j, "colheitas", 1, ev, ctx);
  if (can.cultura) {
    // uma unidade da colheita vai para a mochila do HOKI (comer, beber ou vender no Comércio)
    ev.push({ tipo: "produto", texto: "", fonte: can.cultura });
    maestria(j, can.cultura, 1, ev, ctx);
    const id = can.cultura;
    metaDeProjeto(i, (m) => m.tipo === "colheitas" && (!m.cultura || m.cultura === id), 1);
  }
  fichasDoFestival(j, 1, ev, ctx.agora);
  if (j.tutorial === 3 || j.tutorial === 4) {
    j.tutorial = 4;
    j.tutorialConta += 1;
    if (j.tutorialConta >= INICIO.arados.length) {
      j.tutorial = 5;
      j.tutorialConta = 0;
      if (!j.recompensas.includes("galinha-inicial")) {
        j.recompensas.push("galinha-inicial");
        j.inventario.push({
          id: ctx.novoId(),
          item: "galinha",
          restanteMs: null,
          origem: "tutorial",
        });
        ev.push({ tipo: "item", texto: "Você ganhou a Galinha Inicial! Coloque-a na ilha." });
      }
    }
  }
}
function coletar(e: Estado, o: Objeto, ev: Evento[], ctx: Contexto) {
  const { j, i } = e;
  const it = item(o.item);
  if (!it?.tempoMs || o.prontoEm === null) falha("Isso não produz nada.");
  if (ctx.agora < (o.prontoEm ?? 0)) falha("A produção ainda não está pronta.");
  j.ouros += it.venda ?? 0;
  creditarXP(j, it.xp ?? 0, ev);
  o.prontoEm = ctx.agora + it.tempoMs;
  contar(j, "coletas", 1, ev, ctx);
  ev.push({ tipo: "produto", texto: "", fonte: o.item });
  const produto =
    it.tipo === "arvore"
      ? "arvore"
      : it.produto === "Ovos"
        ? "ovos"
        : it.produto === "Lã"
          ? "la"
          : "outro";
  metaDeProjeto(i, (m) => m.tipo === "coletas" && (!m.produto || m.produto === produto), 1);
  return it.venda ?? 0;
}

export function aplicar(antes: Estado, a: Acao, ctx: Contexto): Resultado {
  const e: Estado = structuredClone(antes);
  const { j, i } = e;
  const ev: Evento[] = [];
  renovarPeriodos(j, ctx.agora);
  switch (a.t) {
    case "arar":
      arar(e, a.x, a.z, ev);
      break;
    case "plantar":
      plantar(e, a.x, a.z, a.cultura, ev, ctx);
      break;
    case "colher":
      colher(e, a.x, a.z, a.plantioId, ev, ctx);
      break;
    case "remover":
      if (!i.canteiros[chave(a.x, a.z)]) falha("Não há canteiro aqui.");
      delete i.canteiros[chave(a.x, a.z)];
      break;
    case "comprar": {
      const it = item(a.item) ?? falha("Item desconhecido.");
      if (it.premio) falha("Esse item não está à venda.");
      if (j.nivel < it.nivel) falha(`${it.nome} libera no nível ${it.nivel}.`);
      if (it.granas) {
        if (j.granas < it.granas) falha("Granas insuficientes.");
        j.granas -= it.granas;
      } else {
        if (j.ouros < it.compra) falha("Ouros insuficientes.");
        j.ouros -= it.compra;
      }
      j.inventario.push({
        id: ctx.novoId(),
        item: it.id,
        restanteMs: null,
        origem: it.granas ? "granas" : "loja",
      });
      ev.push({ tipo: "item", texto: `${it.nome} foi para o seu inventário.` });
      break;
    }
    case "colocar": {
      const k = j.inventario.findIndex((g) => g.id === a.id);
      const g = j.inventario[k] ?? falha("Esse item não está no inventário.");
      if (objetosContados(i) >= limiteDeObjetos(i))
        falha("Limite de objetos da ilha atingido. Expanda o terreno.");
      if (!lugarLivre(i, a.x, a.z)) falha("Esse lugar está ocupado ou fora do terreno.");
      const it = item(g.item);
      j.inventario.splice(k, 1);
      i.objetos.push({
        id: g.id,
        item: g.item,
        x: a.x,
        z: a.z,
        rot: ((a.rot % 4) + 4) % 4,
        prontoEm: it?.tempoMs ? ctx.agora + (g.restanteMs ?? it.tempoMs) : null,
        origem: g.origem,
      });
      if (j.tutorial === 5 && g.origem === "tutorial" && g.item === "galinha") j.tutorial = 6;
      break;
    }
    case "mover": {
      const o = i.objetos.find((x) => x.id === a.id);
      if (!o) {
        // estruturas dos animais e as outras obras (galinheiro, aprisco, pomar...) ocupam 2 × 2
        const p = i.projetos.find((x) => x.id === a.id) ?? falha("Objeto não encontrado.");
        if (!lugarLivre(i, a.x, a.z, p.id, 2, 2))
          falha("O projeto precisa de 2 × 2 quadrados livres.");
        p.x = a.x;
        p.z = a.z;
        break;
      }
      if (!lugarLivre(i, a.x, a.z, o.id)) falha("Esse lugar está ocupado ou fora do terreno.");
      o.x = a.x;
      o.z = a.z;
      o.rot = ((a.rot % 4) + 4) % 4;
      break;
    }
    case "guardar": {
      const k = i.objetos.findIndex((x) => x.id === a.id);
      const o = i.objetos[k] ?? falha("Objeto não encontrado.");
      i.objetos.splice(k, 1);
      j.inventario.push({
        id: o.id,
        item: o.item,
        restanteMs: o.prontoEm === null ? null : Math.max(0, o.prontoEm - ctx.agora),
        origem: o.origem,
      });
      break;
    }
    case "vender": {
      const ko = i.objetos.findIndex((x) => x.id === a.id);
      const kg = j.inventario.findIndex((x) => x.id === a.id);
      const alvo = i.objetos[ko] ?? j.inventario[kg] ?? falha("Objeto não encontrado.");
      if (alvo.origem !== "loja") falha("Esse item não se vende: só pode ser guardado.");
      const it = item(alvo.item);
      const valor = Math.floor((it?.compra ?? 0) * 0.25);
      if (ko >= 0) i.objetos.splice(ko, 1);
      else j.inventario.splice(kg, 1);
      j.ouros += valor;
      ev.push({ tipo: "ouros", texto: `+${valor} Ouros pela venda de ${it?.nome ?? "item"}` });
      break;
    }
    case "coletar": {
      const o = i.objetos.find((x) => x.id === a.id) ?? falha("Objeto não encontrado.");
      const v = coletar(e, o, ev, ctx);
      ev.push({
        tipo: "ouros",
        texto: `+${v} Ouros (${item(o.item)?.produto ?? item(o.item)?.nome ?? "coleta"})`,
      });
      break;
    }
    case "coletarGrupo": {
      const p = i.projetos.find((x) => x.id === a.projeto) ?? falha("Projeto não encontrado.");
      const etapasFeitas = p.concluido ? 2 : p.etapa;
      if (etapasFeitas < 1 || (a.projeto === "pomar" && etapasFeitas < 2))
        falha("Conclua a etapa do projeto para coletar em grupo.");
      const tipo =
        a.projeto === "galinheiro"
          ? "galinha"
          : a.projeto === "aprisco"
            ? "ovelha"
            : a.projeto === "pomar"
              ? "arvore"
              : "";
      const cap = a.projeto === "pomar" ? 8 : etapasFeitas >= 2 ? 8 : 4;
      const maduros = i.objetos
        .filter(
          (o) =>
            (tipo === "arvore" ? item(o.item)?.tipo === "arvore" : o.item === tipo) &&
            o.prontoEm !== null &&
            ctx.agora >= o.prontoEm,
        )
        .slice(0, cap);
      if (!maduros.length) falha("Nenhuma produção pronta para coletar.");
      let soma = 0;
      for (const o of maduros) soma += coletar(e, o, ev, ctx);
      ev.push({ tipo: "ouros", texto: `+${soma} Ouros (${maduros.length} coletas)` });
      break;
    }
    case "expandir": {
      const nova = proximaExpansao(i.tamanho) ?? falha("Sua ilha já está no tamanho máximo.");
      if (j.nivel < nova.nivel)
        falha(`A expansão ${nova.tamanho} × ${nova.tamanho} libera no nível ${nova.nivel}.`);
      if (a.rota === "ouros") {
        if ((ctx.vizinhos ?? 0) < nova.vizinhos)
          falha(`Precisa de ${nova.vizinhos} vizinho(s) com ilha.`);
        if (j.ouros < nova.ouros) falha("Ouros insuficientes.");
        j.ouros -= nova.ouros;
      } else {
        if (j.granas < nova.granas) falha("Granas insuficientes.");
        j.granas -= nova.granas;
      }
      i.tamanho = nova.tamanho;
      ev.push({ tipo: "info", texto: `Terreno ampliado para ${nova.tamanho} × ${nova.tamanho}!` });
      break;
    }
    case "cor": {
      const c = corLevel(a.id);
      if (c.id !== a.id) falha("Cor desconhecida.");
      if (j.nivel < c.nivel) falha(`Libera no nível ${c.nivel}.`);
      j.corLevel = c.id;
      break;
    }
    case "conquista": {
      const c = CONQUISTAS.find((x) => x.id === a.id) ?? falha("Conquista desconhecida.");
      if (j.conquistas[c.id] !== "pendente")
        falha("Essa conquista não tem recompensa para resgatar.");
      if (c.id === "primeira-colheita" && !tutorialFeito(j))
        falha("Conclua o tutorial para resgatar.");
      j.conquistas[c.id] = "resgatada";
      creditar(j, c.recompensa as Recompensa, ev, ctx);
      ev.push({ tipo: "conquista", texto: `Recompensa resgatada: ${c.nome}` });
      break;
    }
    case "bonusDiario": {
      if (!j.diario.bonusPendente) falha("Não há bônus para resgatar hoje.");
      if (!MATERIAIS.some((m) => m.id === a.material)) falha("Material desconhecido.");
      j.diario.bonusPendente = false;
      j.diario.feitas.push(BONUS_DIARIO.id);
      creditar(j, { ...BONUS_DIARIO.recompensa, materiais: { [a.material]: 1 } }, ev, ctx);
      break;
    }
    case "privacidade":
      if (!["amigos", "convite", "privada"].includes(a.modo)) falha("Modo desconhecido.");
      i.privacidade = a.modo;
      break;
    case "tutorialLoja":
      if (j.tutorial === 1) j.tutorial = 2;
      break;
    case "kit":
      if (j.tutorial !== 6 || j.recompensas.includes("kit"))
        falha("O Kit do Fazendeiro ainda não está disponível.");
      j.recompensas.push("kit");
      creditar(j, INICIO.kit, ev, ctx);
      j.tutorial = TUTORIAL_FIM;
      ev.push({ tipo: "item", texto: "Kit do Fazendeiro coletado! Tutorial concluído." });
      break;
    case "festival": {
      const t = FESTIVAL.trocas.find((x) => x.id === a.troca) ?? falha("Troca desconhecida.");
      if (!lojaDoFestivalAberta(ctx.agora)) falha("A loja do Festival está fechada.");
      if (j.recompensas.includes(`festival:${t.id}`)) falha("Você já resgatou essa recompensa.");
      if (j.festival.fichas < t.fichas) falha("Fichas insuficientes.");
      j.festival.fichas -= t.fichas;
      j.recompensas.push(`festival:${t.id}`);
      if (item(t.id))
        j.inventario.push({ id: ctx.novoId(), item: t.id, restanteMs: null, origem: "premio" });
      ev.push({ tipo: "item", texto: `${t.nome} resgatado!` });
      break;
    }
    case "comprarTrator": {
      const t = TRATORES[a.qual] ?? falha("Máquina desconhecida.");
      if (i.maquinas[a.qual]) falha("Você já tem essa máquina.");
      if (j.nivel < t.nivel) falha(`${t.nome} libera no nível ${t.nivel}.`);
      if (a.qual === "superTrator" && !i.projetos.find((p) => p.id === "garagem")?.concluido)
        falha("Conclua a Garagem para comprar o Super Trator.");
      if (j.ouros < t.compra) falha("Ouros insuficientes.");
      j.ouros -= t.compra;
      i.maquinas[a.qual] = { cargas: CARGAS_INICIAIS };
      ev.push({ tipo: "item", texto: `${t.nome} comprado com ${CARGAS_INICIAIS} cargas!` });
      break;
    }
    case "bateria": {
      const m = i.maquinas[a.qual] ?? falha("Você não tem essa máquina.");
      const b = BATERIAS.find((x) => x.id === a.pacote) ?? falha("Pacote desconhecido.");
      if (j.nivel < TRATORES.trator.nivel) falha("Baterias liberam no nível 20.");
      if (m.cargas + b.cargas > CARGAS_MAXIMAS)
        falha(`A máquina guarda no máximo ${CARGAS_MAXIMAS} cargas.`);
      if (a.moeda === "granas") {
        if (j.granas < b.granas) falha("Granas insuficientes.");
        j.granas -= b.granas;
      } else {
        if (j.ouros < b.ouros) falha("Ouros insuficientes.");
        j.ouros -= b.ouros;
      }
      m.cargas += b.cargas;
      break;
    }
    case "trator": {
      const m = i.maquinas[a.qual] ?? falha("Você não tem essa máquina.");
      const area = areaDoTrator(a.qual, a.x, a.z, a.rot);
      const oc = ocupacao(i);
      const validos = area.filter(([x, z]) => {
        if (!dentro(i, x, z)) return false;
        const can = i.canteiros[chave(x, z)];
        if (a.modo === "arar") return !can && !oc.has(chave(x, z));
        if (a.modo === "plantar") return can?.estado === "arado";
        return (
          can?.estado === "crescendo" && can.maduroEm !== undefined && ctx.agora >= can.maduroEm
        );
      });
      if (!validos.length) {
        ev.push({ tipo: "info", texto: "Nenhum quadrado válido nessa área: nenhuma carga usada." });
        break;
      }
      if (m.cargas < 1) falha("Bateria vazia. Recarregue a máquina.");
      if (a.modo === "arar" && j.ouros < PRECO_ARAR * validos.length)
        falha("Ouros insuficientes para todos os quadrados.");
      if (a.modo === "plantar") {
        const c = cultura(a.cultura ?? "") ?? falha("Escolha uma semente.");
        if (j.nivel < c.nivel) falha(`${c.nome} libera no nível ${c.nivel}.`);
        if (j.ouros < c.semente * validos.length)
          falha("Ouros insuficientes para todos os quadrados.");
      }
      for (const [x, z] of validos) {
        if (a.modo === "arar") arar(e, x, z, ev);
        else if (a.modo === "plantar") plantar(e, x, z, a.cultura ?? "", ev, ctx);
        else colher(e, x, z, undefined, ev, ctx);
      }
      m.cargas -= 1;
      j.totais.tratorOps += 1;
      metaDeProjeto(i, (mt) => mt.tipo === "trator", 1);
      ev.push({
        tipo: "info",
        texto: `${TRATORES[a.qual].nome}: ${validos.length} quadrado(s) trabalhados.`,
      });
      break;
    }
    case "projetoColocar": {
      const p = projeto(a.id) ?? falha("Projeto desconhecido.");
      if (j.nivel < p.nivel) falha(`${p.nome} libera no nível ${p.nivel}.`);
      if (i.projetos.some((x) => x.id === p.id)) falha("Esse projeto já está na ilha.");
      if (objetosContados(i) >= limiteDeObjetos(i)) falha("Limite de objetos da ilha atingido.");
      if (!lugarLivre(i, a.x, a.z, undefined, 2, 2))
        falha("O projeto precisa de 2 × 2 quadrados livres.");
      i.projetos.push({
        id: p.id,
        x: a.x,
        z: a.z,
        etapa: 0,
        progresso: p.etapas[0]!.metas.map(() => 0),
        concluido: false,
      });
      ev.push({ tipo: "info", texto: `Projeto ${p.nome} ativado: a etapa 1 começou.` });
      break;
    }
    case "projetoConcluir": {
      const pi = i.projetos.find((x) => x.id === a.id) ?? falha("Projeto não encontrado.");
      const p = projeto(pi.id)!;
      if (pi.concluido) falha("Projeto já concluído.");
      const etapa = p.etapas[pi.etapa]!;
      const progresso = progressoDoProjeto(i, pi);
      if (etapa.metas.some((m, k) => (progresso[k] ?? 0) < m.quantidade))
        falha("Ainda faltam tarefas dessa etapa.");
      for (const [mat, q] of Object.entries(etapa.materiais))
        if (j.materiais[mat as Material] < (q ?? 0)) falha("Materiais insuficientes.");
      for (const [mat, q] of Object.entries(etapa.materiais))
        j.materiais[mat as Material] -= q ?? 0;
      creditar(j, etapa.recompensa, ev, ctx);
      ev.push({ tipo: "item", texto: `${p.nome}: etapa ${pi.etapa + 1} concluída!` });
      if (pi.etapa + 1 >= p.etapas.length) {
        pi.concluido = true;
        j.totais.projetos += 1;
      } else {
        pi.etapa += 1;
        pi.progresso = p.etapas[pi.etapa]!.metas.map(() => 0);
      }
      break;
    }
    default:
      falha("Ação desconhecida.");
  }
  verConquistas(j, i, ev);
  return { j, i, ev };
}
/** Progresso de cada meta da etapa atual (as de "colocados" contam o que está na ilha agora). */
export function progressoDoProjeto(i: Ilha, pi: ProjetoNaIlha) {
  const etapa = projeto(pi.id)?.etapas[pi.etapa];
  return (etapa?.metas ?? []).map((m, k) =>
    m.tipo === "colocados"
      ? Math.min(m.quantidade, i.objetos.filter((o) => o.item === m.item).length)
      : (pi.progresso[k] ?? 0),
  );
}

// ---------------- visitante: adubar o canteiro de um amigo ----------------
export function adubar(
  visitante: Jogador,
  ilhaDoDono: Ilha,
  donoId: string,
  info: { id: string; nome: string },
  x: number,
  z: number,
  plantioId: string | undefined,
  ctx: Contexto,
) {
  const j = structuredClone(visitante);
  const i = structuredClone(ilhaDoDono);
  const ev: Evento[] = [];
  renovarPeriodos(j, ctx.agora);
  if ((j.diario.adubosPorIlha[donoId] ?? 0) >= SOCIAL.adubosPorIlha)
    falha("Você já adubou 3 canteiros nessa ilha hoje.");
  // o total do dia fica numa chave à parte (o contador das missões só anda depois do tutorial)
  if ((j.diario.adubosPorIlha["__total"] ?? 0) >= SOCIAL.adubosPorDia)
    falha("Você já usou os 10 adubos de hoje.");
  const can = i.canteiros[chave(x, z)];
  if (!can || can.estado !== "crescendo" || can.maduroEm === undefined)
    falha("Só dá para adubar canteiros em crescimento.");
  if (plantioId && can.plantioId !== plantioId) falha("Esse canteiro mudou. Atualize a ilha.");
  if (can.adubo) falha("Esse canteiro já recebeu adubo neste ciclo.");
  const restante = can.maduroEm - ctx.agora;
  if (restante <= SOCIAL.aduboMinRestanteMs)
    falha("Falta pouco para ficar pronto: não precisa de adubo.");
  const reducao = Math.min(SOCIAL.aduboMaxMs, Math.floor(restante * SOCIAL.aduboFracao));
  can.maduroEm -= reducao;
  can.adubo = { id: info.id, nome: info.nome, reducaoMs: reducao };
  j.diario.adubosPorIlha[donoId] = (j.diario.adubosPorIlha[donoId] ?? 0) + 1;
  j.diario.adubosPorIlha["__total"] = (j.diario.adubosPorIlha["__total"] ?? 0) + 1;
  creditarXP(j, SOCIAL.xpAdubo, ev);
  contar(j, "adubacoes", 1, ev, ctx);
  verConquistas(j, null, ev);
  return { visitante: j, ilha: i, reducao, ev };
}
/** Projetos do visitante que contam adubações (Pomar etapa 2): avançados na ilha dele. */
export function adubacaoNaIlhaDoVisitante(i: Ilha) {
  const nova = structuredClone(i);
  metaDeProjeto(nova, (m) => m.tipo === "adubacoes", 1);
  return nova;
}

// ---------------- visitante: roubar a fazenda de alguém ----------------
export interface Roubo {
  /** O que foi levado (cultura ou item da ilha), com o nome para mostrar. */
  levou: { id: string; nome: string; qtd: number }[];
  ouros: number;
  /** Canteiros em crescimento pisoteados (a planta morre e o canteiro volta a arado). */
  estragados: number;
}
/**
 * Um roubo leva as colheitas maduras mais valiosas e a produção pronta de animais e árvores
 * (o ciclo recomeça para o dono) e pisoteia canteiros em crescimento, sorteados. Quem rouba
 * fica com os Ouros e com o produto na mochila do HOKI, sem XP nem missões.
 * Limites: 3 por dia para quem rouba (uma vez em cada fazenda), 3 por dia em cada fazenda e
 * nada de roubar quem ainda está no tutorial.
 */
export function roubar(
  ladrao: Jogador,
  ilhaDaVitima: Ilha,
  vitima: { id: string; tutorial: number },
  ctx: Contexto & { sorte?: () => number },
) {
  const j = structuredClone(ladrao);
  const i = structuredClone(ilhaDaVitima);
  const ev: Evento[] = [];
  renovarPeriodos(j, ctx.agora);
  const dia = diaBR(ctx.agora);
  const feitos = j.diario.roubos ?? 0;
  const roubadas = j.diario.roubadas ?? [];
  if (feitos >= SOCIAL.roubosPorDia)
    falha(`Você já fez os ${SOCIAL.roubosPorDia} roubos de hoje. Volte amanhã!`);
  if (roubadas.includes(vitima.id)) falha("Você já roubou essa fazenda hoje.");
  if (vitima.tutorial < TUTORIAL_FIM)
    falha("Essa fazenda ainda está no tutorial: deixe o vizinho aprender em paz.");
  const recebidos = i.roubos?.dia === dia ? i.roubos.quantos : 0;
  if (recebidos >= SOCIAL.roubosRecebidosPorDia)
    falha(
      `Essa fazenda já foi roubada ${SOCIAL.roubosRecebidosPorDia} vezes hoje: a vizinhança está de olho.`,
    );
  const sorte = ctx.sorte ?? Math.random;
  const levou = new Map<string, Roubo["levou"][number]>();
  const anotar = (id: string, nome: string) => {
    const x = levou.get(id);
    if (x) x.qtd += 1;
    else levou.set(id, { id, nome, qtd: 1 });
  };
  let ouros = 0;
  // 1) colheitas maduras, das mais valiosas (o canteiro fica livre, como numa colheita)
  const maduros = Object.entries(i.canteiros)
    .filter(([, c]) => estadoDoCanteiro(c, ctx.agora) === "maduro")
    .sort((a, b) => (b[1].valorVenda ?? 0) - (a[1].valorVenda ?? 0))
    .slice(0, SOCIAL.rouboMaduros);
  for (const [k, c] of maduros) {
    ouros += c.valorVenda ?? 0;
    delete i.canteiros[k];
    if (!c.cultura) continue;
    anotar(c.cultura, cultura(c.cultura)?.nome ?? c.cultura);
    ev.push({ tipo: "produto", texto: "", fonte: c.cultura });
  }
  // 2) produção pronta de animais e árvores (o dono espera o ciclo inteiro de novo)
  const prontos = i.objetos
    .filter((o) => o.prontoEm !== null && ctx.agora >= o.prontoEm && !!item(o.item)?.tempoMs)
    .sort((a, b) => (item(b.item)?.venda ?? 0) - (item(a.item)?.venda ?? 0))
    .slice(0, SOCIAL.rouboProducoes);
  for (const o of prontos) {
    const it = item(o.item)!;
    ouros += it.venda ?? 0;
    o.prontoEm = ctx.agora + (it.tempoMs ?? 0);
    anotar(o.item, it.produto ?? (it.tipo === "arvore" ? `Frutas (${it.nome})` : it.nome));
    ev.push({ tipo: "produto", texto: "", fonte: o.item });
  }
  // 3) na fuga, pisoteia canteiros que ainda estavam crescendo
  const crescendo = Object.keys(i.canteiros)
    .filter((k) => estadoDoCanteiro(i.canteiros[k], ctx.agora) === "crescendo")
    .sort();
  let estragados = 0;
  while (estragados < SOCIAL.rouboEstragos && crescendo.length) {
    const sorteado = Math.min(crescendo.length - 1, Math.floor(sorte() * crescendo.length));
    const [k] = crescendo.splice(sorteado, 1);
    i.canteiros[k!] = { estado: "arado" };
    estragados += 1;
  }
  if (!levou.size && !estragados)
    falha("Não há nada para roubar nem estragar nessa fazenda agora.");
  j.ouros += ouros;
  j.diario.roubos = feitos + 1;
  j.diario.roubadas = [...roubadas, vitima.id];
  i.roubos = { dia, quantos: recebidos + 1 };
  const roubo: Roubo = { levou: [...levou.values()], ouros, estragados };
  if (ouros > 0) ev.push({ tipo: "ouros", texto: `+${ouros} Ouros do roubo` });
  return { ladrao: j, ilha: i, ev, roubo };
}
const juntar = (l: string[]) =>
  l.length <= 1 ? (l[0] ?? "") : `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`;
/** "levou 2× Morango e 1× Ovos e estragou 2 canteiros" (registro da ilha e avisos). */
export function textoDoRoubo(r: Roubo) {
  const partes: string[] = [];
  if (r.levou.length) partes.push(`levou ${juntar(r.levou.map((x) => `${x.qtd}× ${x.nome}`))}`);
  if (r.estragados) partes.push(`estragou ${r.estragados} canteiro${r.estragados > 1 ? "s" : ""}`);
  return partes.join(" e ") || "não levou nada";
}
/** Quantos roubos ainda dá para fazer hoje. */
export function roubosRestantes(j: Jogador, agora: number) {
  if (j.diario.dia !== diaBR(agora)) return SOCIAL.roubosPorDia;
  return Math.max(0, SOCIAL.roubosPorDia - (j.diario.roubos ?? 0));
}

// ---------------- ajuda para a interface ----------------
export function estadoDoCanteiro(
  c: Canteiro | undefined,
  agora: number,
): "livre" | "arado" | "crescendo" | "maduro" {
  if (!c) return "livre";
  if (c.estado === "arado") return "arado";
  return c.maduroEm !== undefined && agora >= c.maduroEm ? "maduro" : "crescendo";
}
export const ANIMAL_IDS = new Set(ANIMAIS.map((a) => a.id));
