import { test } from "node:test";
import assert from "node:assert/strict";
import { CULTURAS, lucroDe, nivelDoXp, progressoDoNivel, xpDoNivel, corDoSelo } from "./catalogo";
import {
  adubar,
  aplicar,
  creditarXP,
  areaDoTrator,
  diaBR,
  ErroDoJogo,
  novaIlha,
  novoJogador,
  registrarPresenca,
  roubar,
  roubosRestantes,
  semanaBR,
  textoDoRoubo,
  type Acao,
  type Estado,
  type Evento,
} from "./regras";

let seq = 0;
const ctx = (agora: number, vizinhos = 0) => ({ agora, novoId: () => `id${++seq}`, vizinhos });
const T0 = Date.UTC(2026, 10, 20, 15, 0, 0);
const faz = (e: Estado, a: Acao, agora = T0, vizinhos = 0) => aplicar(e, a, ctx(agora, vizinhos));
const erro = (f: () => unknown) => assert.throws(f, ErroDoJogo);

test("tabela de XP acumulado bate com a especificação", () => {
  const tabela: [number, number][] = [
    [1, 0],
    [2, 20],
    [3, 60],
    [5, 200],
    [10, 900],
    [15, 2200],
    [20, 4100],
    [30, 9700],
    [50, 28100],
    [70, 56100],
    [100, 116100],
    [150, 264100],
    [200, 472100],
    [250, 740100],
  ];
  for (const [n, xp] of tabela) assert.equal(xpDoNivel(n), xp, `nível ${n}`);
  assert.equal(nivelDoXp(27), 2);
  assert.equal(nivelDoXp(59), 2);
  assert.equal(nivelDoXp(60), 3);
  assert.equal(nivelDoXp(10_000_000), 250);
  assert.deepEqual(progressoDoNivel(27), {
    nivel: 2,
    noNivel: 7,
    paraSubir: 40,
    pct: 17.5,
    maximo: false,
  });
});

test("lucro do catálogo bate com a tabela (venda − semente − 30 de arar)", () => {
  const lucros = [25, 45, 70, 100, 150, 210, 300, 410, 550, 725, 965, 1370];
  CULTURAS.forEach((c, k) => assert.equal(lucroDe(c), lucros[k], c.nome));
});

test("tutorial completo: 27 XP, nível 2, 1 Grana e 1.220 Ouros", () => {
  let e: Estado = { j: novoJogador(T0), i: novaIlha() };
  assert.equal(e.j.ouros, 800);
  assert.equal(Object.keys(e.i.canteiros).length, 4);
  e = faz(e, { t: "tutorialLoja" });
  assert.equal(e.j.tutorial, 2);
  for (const [x, z] of [
    [3, 3],
    [4, 3],
    [3, 4],
    [4, 4],
  ] as const)
    e = faz(e, { t: "plantar", x, z, cultura: "morango" });
  assert.equal(e.j.ouros, 720);
  assert.equal(e.j.tutorial, 3);
  erro(() => faz(e, { t: "colher", x: 3, z: 3 }, T0 + 30_000));
  const depois = T0 + 61_000;
  for (const [x, z] of [
    [3, 3],
    [4, 3],
    [3, 4],
    [4, 4],
  ] as const)
    e = faz(e, { t: "colher", x, z }, depois);
  assert.equal(e.j.ouros, 1020);
  assert.equal(e.j.xp, 12);
  assert.equal(e.j.tutorial, 5);
  assert.equal(e.j.conquistas["primeira-colheita"], "pendente");
  const galinha = e.j.inventario.find((g) => g.origem === "tutorial");
  assert.ok(galinha);
  // a primeira colheita só pode ser resgatada depois do tutorial
  erro(() => faz(e, { t: "conquista", id: "primeira-colheita" }, depois));
  e = faz(e, { t: "colocar", id: galinha.id, x: 0, z: 0, rot: 0 }, depois);
  assert.equal(e.j.tutorial, 6);
  const r = faz(e, { t: "kit" }, depois);
  e = r;
  assert.equal(e.j.xp, 27);
  assert.equal(e.j.nivel, 2);
  assert.equal(e.j.granas, 1);
  assert.equal(e.j.ouros, 1220);
  assert.deepEqual(e.j.materiais, { tabua: 2, tijolo: 2, cimento: 2, ferramenta: 0 });
  assert.ok(r.ev.some((x: Evento) => x.tipo === "nivel"));
  erro(() => faz(e, { t: "kit" }, depois));
  // a galinha do tutorial não se vende, só se guarda
  erro(() => faz(e, { t: "vender", id: galinha.id }, depois));
  e = faz(e, { t: "conquista", id: "primeira-colheita" }, depois);
  assert.equal(e.j.ouros, 1320);
  assert.equal(e.j.xp, 37);
});

test("ciclo do canteiro: arar, plantar, colher volta a livre; remover não dá nada", () => {
  let e: Estado = { j: novoJogador(T0), i: novaIlha() };
  e = faz(e, { t: "arar", x: 0, z: 7 });
  assert.equal(e.j.ouros, 770);
  assert.equal(e.j.xp, 1);
  erro(() => faz(e, { t: "arar", x: 0, z: 7 }));
  erro(() => faz(e, { t: "arar", x: 8, z: 0 }));
  erro(() => faz(e, { t: "plantar", x: 0, z: 7, cultura: "alface" }));
  e = faz(e, { t: "plantar", x: 0, z: 7, cultura: "morango" });
  const r = faz(e, { t: "remover", x: 0, z: 7 });
  assert.equal(r.j.ouros, e.j.ouros);
  assert.equal(r.j.xp, e.j.xp);
  assert.equal(r.i.canteiros["0,7"], undefined);
});

test("adubo: a melancia com 2 h restantes perde 18 min; 1 por ciclo e cotas", () => {
  const dono: Estado = { j: novoJogador(T0), i: novaIlha() };
  dono.i.canteiros["3,3"] = {
    estado: "crescendo",
    cultura: "melancia",
    plantadoEm: T0 - 2 * 3_600_000,
    maduroEm: T0 + 2 * 3_600_000,
    plantioId: "p1",
    valorVenda: 480,
    xpColheita: 12,
  };
  const visitante = novoJogador(T0);
  const r = adubar(visitante, dono.i, "dono", { id: "v", nome: "Amigo" }, 3, 3, "p1", ctx(T0));
  assert.equal(r.reducao, 18 * 60_000);
  assert.equal(r.ilha.canteiros["3,3"]!.maduroEm, T0 + 102 * 60_000);
  assert.equal(r.visitante.xp, 3);
  erro(() => adubar(r.visitante, r.ilha, "dono", { id: "v", nome: "Amigo" }, 3, 3, "p1", ctx(T0)));
  // limite de 30 minutos e sem adubo com 60 s ou menos
  dono.i.canteiros["4,4"] = {
    estado: "crescendo",
    cultura: "pitaya",
    maduroEm: T0 + 20 * 3_600_000,
    plantioId: "p2",
  };
  assert.equal(
    adubar(visitante, dono.i, "dono", { id: "v", nome: "A" }, 4, 4, "p2", ctx(T0)).reducao,
    30 * 60_000,
  );
  dono.i.canteiros["4,3"] = {
    estado: "crescendo",
    cultura: "morango",
    maduroEm: T0 + 50_000,
    plantioId: "p3",
  };
  erro(() => adubar(visitante, dono.i, "dono", { id: "v", nome: "A" }, 4, 3, "p3", ctx(T0)));
  // 3 por ilha por dia
  let v = visitante;
  let ilha = dono.i;
  for (let k = 0; k < 3; k++) {
    ilha.canteiros[`0,${k}`] = {
      estado: "crescendo",
      cultura: "tomate",
      maduroEm: T0 + 3_600_000,
      plantioId: `q${k}`,
    };
    const rr = adubar(v, ilha, "dono", { id: "v", nome: "A" }, 0, k, `q${k}`, ctx(T0));
    v = rr.visitante;
    ilha = rr.ilha;
  }
  ilha.canteiros["1,0"] = {
    estado: "crescendo",
    cultura: "tomate",
    maduroEm: T0 + 3_600_000,
    plantioId: "q9",
  };
  erro(() => adubar(v, ilha, "dono", { id: "v", nome: "A" }, 1, 0, "q9", ctx(T0)));
});

test("expansão: nível, vizinhos (só nos Ouros) e Granas", () => {
  const e: Estado = { j: novoJogador(T0), i: novaIlha() };
  e.j.ouros = 10_000;
  e.j.granas = 10;
  erro(() => faz(e, { t: "expandir", rota: "ouros" }, T0, 5));
  e.j.xp = 200;
  e.j.nivel = 5;
  erro(() => faz(e, { t: "expandir", rota: "ouros" }, T0, 0));
  const r = faz(e, { t: "expandir", rota: "ouros" }, T0, 1);
  assert.equal(r.i.tamanho, 10);
  assert.equal(r.j.ouros, 7500);
  const g = faz(e, { t: "expandir", rota: "granas" }, T0, 0);
  assert.equal(g.i.tamanho, 10);
  assert.equal(g.j.granas, 4);
});

test("trator: área 2 × 2, cobra tudo ou nada e gasta 1 carga por operação", () => {
  let e: Estado = { j: novoJogador(T0), i: novaIlha() };
  e.j.nivel = 20;
  e.j.xp = 4100;
  e.j.ouros = 20_000;
  e = faz(e, { t: "comprarTrator", qual: "trator" });
  assert.equal(e.i.maquinas.trator?.cargas, 20);
  assert.deepEqual(areaDoTrator("superTrator", 0, 0, 1), [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 0],
    [2, 1],
    [3, 0],
    [3, 1],
  ]);
  e = faz(e, { t: "trator", qual: "trator", modo: "arar", x: 0, z: 0, rot: 0 });
  assert.equal(
    Object.keys(e.i.canteiros).filter((k) => k.startsWith("0,") || k.startsWith("1,")).length,
    4,
  );
  assert.equal(e.i.maquinas.trator?.cargas, 19);
  // área sem quadrado válido não gasta carga
  const vazio = faz(e, { t: "trator", qual: "trator", modo: "colher", x: 6, z: 6, rot: 0 });
  assert.equal(vazio.i.maquinas.trator?.cargas, 19);
  e.j.ouros = 50;
  erro(() =>
    faz(e, {
      t: "trator",
      qual: "trator",
      modo: "plantar",
      x: 0,
      z: 0,
      rot: 0,
      cultura: "morango",
    }),
  );
});

test("missão diária paga sozinha ao completar (depois do tutorial)", () => {
  let e: Estado = { j: novoJogador(T0), i: novaIlha() };
  e.j.tutorial = 7;
  e.j.ouros = 100_000;
  for (let k = 0; k < 12; k++) {
    const x = k % 8;
    const z = Math.floor(k / 8) + 5;
    e = faz(e, { t: "arar", x, z });
    e = faz(e, { t: "plantar", x, z, cultura: "morango" });
  }
  assert.ok(e.j.diario.feitas.includes("d-plantar"));
  assert.equal(e.j.materiais.cimento, 1);
});

test("datas de Brasília: o dia vira às 03:00 UTC e a semana na segunda", () => {
  assert.equal(diaBR(Date.UTC(2026, 10, 20, 2, 59)), "2026-11-19");
  assert.equal(diaBR(Date.UTC(2026, 10, 20, 3, 0)), "2026-11-20");
  assert.equal(semanaBR(Date.UTC(2026, 10, 22, 12, 0)), "2026-11-16");
  assert.equal(semanaBR(Date.UTC(2026, 10, 23, 12, 0)), "2026-11-23");
});

test("presença: 7 dias seguidos dão 3 Granas e o contador recomeça", () => {
  const j = novoJogador(T0);
  const ev: Evento[] = [];
  for (let d = 0; d < 7; d++) registrarPresenca(j, T0 + d * 86_400_000, ev);
  assert.equal(j.granas, 3);
  registrarPresenca(j, T0 + 7 * 86_400_000, ev);
  assert.equal(j.presenca.sequencia, 1);
  registrarPresenca(j, T0 + 9 * 86_400_000, ev);
  assert.equal(j.presenca.sequencia, 1);
});

test("cor do selo: a equipada só vale com o nível; senão vermelho", () => {
  assert.equal(corDoSelo("dourado", 36).id, "dourado");
  assert.equal(corDoSelo("dourado", 20).id, "vermelho");
  let e: Estado = { j: novoJogador(T0), i: novaIlha() };
  erro(() => faz(e, { t: "cor", id: "dourado" }));
  e.j.xp = 40_000;
  e.j.nivel = nivelDoXp(40_000);
  e = faz(e, { t: "cor", id: "dourado" });
  assert.equal(e.j.corLevel, "dourado");
});

test("subir do 34 ao 36 de uma vez dá 2 Granas e libera o Dourado", () => {
  const j = novoJogador(T0);
  j.xp = xpDoNivel(34);
  j.nivel = 34;
  const ev: Evento[] = [];
  creditarXP(j, xpDoNivel(36) - xpDoNivel(34), ev);
  assert.equal(j.nivel, 36);
  assert.equal(j.granas, 2);
  assert.ok(ev.some((x) => x.tipo === "cor" && x.texto.includes("Dourado")));
  // do 100 em diante não ganha mais Grana por nível
  const k = novoJogador(T0);
  k.xp = xpDoNivel(99);
  k.nivel = 99;
  creditarXP(k, xpDoNivel(102) - xpDoNivel(99), ev);
  assert.equal(k.nivel, 102);
  assert.equal(k.granas, 1);
  assert.ok(k.titulos.includes("Mestre da HOST Fazendas"));
});

test("colheita e coleta mandam o produto para a mochila do HOKI (e os Ouros continuam)", () => {
  let e: Estado = { j: novoJogador(T0), i: novaIlha() };
  e = faz(e, { t: "plantar", x: 3, z: 3, cultura: "morango" });
  const antes = e.j.ouros;
  const colheita = faz(e, { t: "colher", x: 3, z: 3 }, T0 + 61_000);
  assert.equal(colheita.j.ouros, antes + 75);
  const produtos = colheita.ev.filter((x) => x.tipo === "produto");
  assert.deepEqual(
    produtos.map((x) => x.fonte),
    ["morango"],
  );
  // a galinha colocada na ilha bota ovo: a coleta também manda um produto
  e = colheita;
  e.j.inventario.push({ id: "g1", item: "galinha", restanteMs: null, origem: "loja" });
  e = faz(e, { t: "colocar", id: "g1", x: 0, z: 0, rot: 0 }, T0 + 61_000);
  const coleta = faz(e, { t: "coletar", id: "g1" }, T0 + 61_000 + 21 * 60_000);
  assert.ok(coleta.ev.some((x) => x.tipo === "produto" && x.fonte === "galinha"));
});

test("estruturas dos animais (projetos 2 × 2) mudam de lugar com a mão", () => {
  let e: Estado = { j: novoJogador(T0), i: novaIlha() };
  e.j.nivel = 8;
  e = faz(e, { t: "projetoColocar", id: "galinheiro", x: 0, z: 0 });
  e.j.inventario.push({ id: "g1", item: "galinha", restanteMs: null, origem: "loja" });
  e = faz(e, { t: "colocar", id: "g1", x: 6, z: 0, rot: 0 });
  // os canteiros (3..4, 3..4), a galinha e a borda do terreno barram o 2 × 2
  erro(() => faz(e, { t: "mover", id: "galinheiro", x: 2, z: 2, rot: 0 }));
  erro(() => faz(e, { t: "mover", id: "galinheiro", x: 5, z: 0, rot: 0 }));
  erro(() => faz(e, { t: "mover", id: "galinheiro", x: 7, z: 7, rot: 0 }));
  // pode encostar no lugar onde ele mesmo está
  e = faz(e, { t: "mover", id: "galinheiro", x: 1, z: 1, rot: 0 });
  assert.deepEqual([e.i.projetos[0]!.x, e.i.projetos[0]!.z], [1, 1]);
  e = faz(e, { t: "mover", id: "galinheiro", x: 5, z: 6, rot: 0 });
  assert.deepEqual([e.i.projetos[0]!.x, e.i.projetos[0]!.z], [5, 6]);
  assert.equal(e.i.projetos[0]!.etapa, 0);
  // o lugar antigo ficou livre para outra coisa
  e = faz(e, { t: "arar", x: 0, z: 0 });
  assert.equal(e.i.canteiros["0,0"]?.estado, "arado");
});

test("roubo: leva as maduras mais valiosas e a produção pronta, pisoteia 2 e respeita os limites", () => {
  const ladrao = novoJogador(T0);
  const ilha = novaIlha();
  const planta = (k: string, cultura: string, maduroEm: number, valorVenda: number) =>
    (ilha.canteiros[k] = {
      estado: "crescendo",
      cultura,
      plantadoEm: T0 - 3_600_000,
      maduroEm,
      plantioId: `p${k}`,
      valorVenda,
      xpColheita: 1,
    });
  planta("0,0", "morango", T0 - 1, 75);
  planta("1,0", "melancia", T0 - 1, 500);
  planta("2,0", "morango", T0 - 1, 75);
  planta("3,0", "alface", T0 - 1, 90);
  planta("0,1", "milho", T0 + 3_600_000, 200);
  planta("1,1", "milho", T0 + 3_600_000, 200);
  planta("2,1", "milho", T0 + 3_600_000, 200);
  ilha.objetos.push({
    id: "g",
    item: "galinha",
    x: 7,
    z: 7,
    rot: 0,
    prontoEm: T0 - 1,
    origem: "loja",
  });
  const vit = { id: "dono-1", tutorial: 7 };
  const r = roubar(ladrao, ilha, vit, { ...ctx(T0), sorte: () => 0 });
  // as 3 maduras mais valiosas (melancia, alface e um morango) e os ovos da galinha
  assert.equal(r.roubo.ouros, 500 + 90 + 75 + 45);
  assert.equal(r.ladrao.ouros, ladrao.ouros + 710);
  assert.equal(r.ladrao.xp, 0);
  assert.equal(Object.values(r.ilha.canteiros).filter((c) => c.cultura === "morango").length, 1);
  assert.equal(r.ilha.canteiros["1,0"], undefined);
  assert.equal(r.ilha.objetos[0]!.prontoEm, T0 + 20 * 60_000);
  // pisoteou 2 dos 3 milhos (viram canteiro arado) e um ficou
  assert.equal(r.roubo.estragados, 2);
  const milhos = ["0,1", "1,1", "2,1"].map((k) => r.ilha.canteiros[k]!);
  assert.equal(milhos.filter((c) => c.estado === "arado" && !c.cultura).length, 2);
  assert.equal(milhos.filter((c) => c.cultura === "milho").length, 1);
  assert.deepEqual(
    r.ev.filter((x) => x.tipo === "produto").map((x) => x.fonte),
    ["melancia", "alface", "morango", "galinha"],
  );
  assert.equal(
    textoDoRoubo(r.roubo),
    "levou 1× Melancia, 1× Alface, 1× Morango e 1× Ovos e estragou 2 canteiros",
  );
  assert.equal(roubosRestantes(r.ladrao, T0), 2);
  assert.deepEqual(r.ilha.roubos, { dia: diaBR(T0), quantos: 1 });
  // a mesma fazenda só uma vez por dia; quem está no tutorial não é roubado
  erro(() => roubar(r.ladrao, r.ilha, vit, ctx(T0)));
  erro(() => roubar(r.ladrao, ilha, { id: "novato", tutorial: 3 }, ctx(T0)));
  // terra vazia: nada para levar nem estragar (e não gasta o roubo)
  erro(() => roubar(r.ladrao, novaIlha(), { id: "vazia", tutorial: 7 }, ctx(T0)));
  // 3 por dia para quem rouba
  let l = r.ladrao;
  for (const id of ["dono-2", "dono-3"]) l = roubar(l, ilha, { id, tutorial: 7 }, ctx(T0)).ladrao;
  assert.equal(roubosRestantes(l, T0), 0);
  erro(() => roubar(l, ilha, { id: "dono-4", tutorial: 7 }, ctx(T0)));
  // no dia seguinte volta a ter 3, e a mesma fazenda pode ser roubada de novo
  const amanha = T0 + 86_400_000;
  assert.equal(roubosRestantes(l, amanha), 3);
  assert.ok(roubar(l, ilha, vit, ctx(amanha)).roubo.ouros > 0);
  // cada fazenda aguenta até 3 roubos por dia, de pessoas diferentes
  let alvo = ilha;
  for (let k = 0; k < 3; k++) {
    alvo.canteiros["5,5"] = { ...ilha.canteiros["0,0"]! };
    alvo = roubar(novoJogador(T0), alvo, vit, ctx(T0)).ilha;
  }
  alvo.canteiros["5,5"] = { ...ilha.canteiros["0,0"]! };
  erro(() => roubar(novoJogador(T0), alvo, vit, ctx(T0)));
  assert.equal(roubar(novoJogador(T0), alvo, vit, ctx(amanha)).ilha.roubos?.quantos, 1);
});
