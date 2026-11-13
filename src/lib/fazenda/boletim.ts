/**
 * HOST FAZENDAS — Boletim da Roça: uma vez por dia, uma história de ficção sobre alguém que
 * roubou uma fazenda. É montada com modelos de texto (sem IA), sorteados com uma semente fixa,
 * então a mesma semente sempre conta a mesma história. Os textos evitam palavras com gênero
 * para quem roubou (não sabemos como cada pessoa prefere ser chamada).
 */
export interface RouboDoBoletim {
  ladrao: string;
  vitima: string;
  levou: { nome: string; qtd: number }[];
  ouros: number;
  estragados: number;
  /** Quando foi o roubo (ms). */
  em: number;
}
export interface TextoDoBoletim {
  titulo: string;
  texto: string;
}

/** Número fixo a partir de um texto (FNV-1a). */
export function sementeDe(texto: string) {
  let h = 2166136261;
  for (const ch of texto) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** Sorteio repetível (mulberry32): mesma semente, mesma sequência. */
export function sorteio(semente: number) {
  // embaralha a semente antes (sementes vizinhas, como 1, 2 e 3, davam a mesma primeira escolha)
  let a = semente >>> 0;
  a = Math.imul(a ^ (a >>> 16), 0x85ebca6b);
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
  a = (a ^ (a >>> 16)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const juntar = (l: string[]) =>
  l.length <= 1 ? (l[0] ?? "") : `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`;
const ouros = (v: number) => Math.floor(v).toLocaleString("pt-BR");
const canteiros = (n: number) => (n === 1 ? "um canteiro" : `${n} canteiros`);
/** Hora do roubo no horário de Brasília (UTC−3). */
const horaBR = (ms: number) => new Date(ms - 3 * 3_600_000).getUTCHours();

const MANCHETES = [
  "Mistério na fazenda de {vitima}!",
  "Plantão da Roça: sumiço na fazenda de {vitima}",
  "O mistério da cesta de {item}",
  "Alerta na vizinhança: a cesta de {ladrao} estava cheia demais",
  "Escândalo no campo: {vitima} procura a colheita de {item}",
  "A cerca de {vitima} não segurou {ladrao}",
  "Exclusivo: as pegadas levam até {ladrao}",
  "Furto na plantação deixa {vitima} de cabelo em pé",
];
const QUANDO: Record<"madrugada" | "manha" | "tarde" | "noite", string[]> = {
  madrugada: [
    "Lá pelas {hora} da madrugada, quando até os galos ainda roncavam,",
    "Na calada da madrugada, com a ilha inteira dormindo,",
  ],
  manha: [
    "Numa manhã tranquila, com o orvalho ainda brilhando nas folhas,",
    "Bem cedinho, na hora do café com pão de queijo,",
  ],
  tarde: [
    "Debaixo do sol quente das {hora} da tarde,",
    "No meio da tarde, quando todo mundo tirava aquela soneca,",
  ],
  noite: ["Quando a lua subiu sobre as ilhas,", "Numa noite sem estrelas e com muito vento,"],
};
const ENTRADAS = [
  "{ladrao} entrou na ponta dos pés na fazenda de {vitima}.",
  "{ladrao} chegou à fazenda de {vitima} com um disfarce de espantalho que não enganou ninguém.",
  "{ladrao} pulou a cerca de {vitima} com uma cesta vazia e um sorriso suspeito.",
  "{ladrao} apareceu na fazenda de {vitima} dizendo que só ia regar as plantas.",
  "{ladrao} atravessou o portal da ilha de {vitima} assobiando, como quem não quer nada.",
  "{ladrao} desembarcou na ilha de {vitima} de óculos escuros e chapéu de palha.",
];
const LEVOU = [
  "Quando o sol nasceu, faltavam {itens} na plantação.",
  "Saiu de lá com {itens} e ainda deu tchau para as galinhas.",
  "A cesta voltou pesada: {itens}, que valem uns {ouros} Ouros no mercado.",
  "Na contagem da manhã seguinte, deram falta de {itens}.",
  "Encheu os bolsos com {itens}, sem deixar nem um bilhetinho de desculpas.",
];
const ESTRAGOU = [
  "Na correria da fuga, ainda amassou {canteiros} que estavam crescendo.",
  "E, para piorar, deixou {canteiros} pisoteados pelo caminho.",
  "As pegadas de bota ficaram marcadas em {canteiros} que não resistiram.",
];
const SO_ESTRAGOU = [
  "Não achou nada maduro e, de pura birra, pisoteou {canteiros}.",
  "Voltou de mãos vazias, mas não sem antes passar por cima de {canteiros}.",
];
const TESTEMUNHAS = [
  "A vaca Mimosa viu tudo, mas até agora se recusa a dar depoimento.",
  "O espantalho jura que piscou, só que ninguém acreditou nele.",
  "Um pato que passava confirmou a história com um sonoro “quá”.",
  "As galinhas fizeram um alvoroço daqueles, mas ninguém entendeu o que diziam.",
  "O cachorro da fazenda estava ocupado demais correndo atrás de uma borboleta.",
  "Um coelho afirma ter visto um vulto saindo com a cesta transbordando.",
];
const DESFECHOS = [
  "A polícia da roça segue investigando, e todas as pistas apontam para {ladrao}.",
  "{vitima} promete instalar um espantalho bem mais bravo.",
  "Até o fechamento desta edição, {ladrao} não quis comentar.",
  "Na praça, já tem gente dizendo que {ladrao} anda com os bolsos cheios de terra.",
  "Fica o aviso para toda a vizinhança: tranque bem a porteira hoje à noite!",
  "A redação apurou que {ladrao} comprou sementes novas logo depois. Coincidência?",
];

/** Monta a manchete e a história do dia a partir de um roubo (sempre a mesma para a semente). */
export function escreverBoletim(r: RouboDoBoletim, semente: number): TextoDoBoletim {
  const sorte = sorteio(semente);
  const um = <T>(l: readonly T[]) => l[Math.floor(sorte() * l.length)]!;
  const h = horaBR(r.em);
  const periodo = h < 5 ? "madrugada" : h < 12 ? "manha" : h < 18 ? "tarde" : "noite";
  const minusc = (t: string) => t.toLocaleLowerCase("pt-BR");
  const principal = [...r.levou].sort((a, b) => b.qtd - a.qtd)[0];
  const itens = juntar(r.levou.map((x) => minusc(x.nome)));
  // meia-noite e meio-dia não cabem em "lá pelas {hora}": aí só valem os textos sem hora
  const semHora = h === 0 || h === 12;
  const trocar = (t: string) =>
    t
      .replaceAll("{ladrao}", r.ladrao)
      .replaceAll("{vitima}", r.vitima)
      .replaceAll("{itens}", itens)
      .replaceAll("{ouros}", ouros(r.ouros))
      .replaceAll("{canteiros}", canteiros(r.estragados))
      .replaceAll("{hora}", String(h > 12 ? h - 12 : h))
      .replaceAll("{item}", principal ? minusc(principal.nome) : "");
  // a manchete com o item só vale quando levou alguma coisa
  const manchetes = principal ? MANCHETES : MANCHETES.filter((m) => !m.includes("{item}"));
  const titulo = trocar(um(manchetes));
  const quando = QUANDO[periodo].filter((q) => !semHora || !q.includes("{hora}"));
  const comeco = `${trocar(um(quando))} ${trocar(um(ENTRADAS))}`;
  const meio: string[] = [];
  if (r.levou.length) {
    meio.push(trocar(um(LEVOU)));
    if (r.estragados) meio.push(trocar(um(ESTRAGOU)));
  } else if (r.estragados) meio.push(trocar(um(SO_ESTRAGOU)));
  const texto = [
    comeco,
    `${meio.join(" ")} ${trocar(um(TESTEMUNHAS))}`.trim(),
    trocar(um(DESFECHOS)),
  ].join("\n\n");
  return { titulo, texto };
}

/** Escolhe o roubo do dia (repetível para o mesmo dia), sem repetir os que já saíram. */
export function escolherRoubo<T extends { id: string }>(
  roubos: T[],
  dia: string,
  jaSairam: ReadonlySet<string>,
): T | null {
  const livres = roubos.filter((r) => !jaSairam.has(r.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!livres.length) return null;
  return livres[Math.floor(sorteio(sementeDe(`boletim:${dia}`))() * livres.length)]!;
}
