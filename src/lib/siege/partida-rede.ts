/**
 * Estado da partida para mandar pela rede. Os relógios dos computadores são
 * diferentes, então todo instante vira "quanto falta" (ms) na ida e volta a ser
 * um instante do relógio local na chegada.
 */
import type { EventoSiege, Partida } from "./partida";

type Snap = {
  fase: Partida["fase"];
  fim: number;
  limite: number;
  g: { v: [number, number, unknown]; a: [number, number, unknown] };
  f: [string, number, string | null, boolean, number];
  pontos: Partida["pontos"];
  dano: Partida["danoAcumulado"];
  pd: Partida["pontosDeDano"];
  ped: number[];
  pr: [number, string, string, number, number, number, number, number, boolean][];
  fu: [string, number, number, number][];
  r: Partida["resultado"];
  j: unknown[];
  ev: EventoSiege[];
};

const rel = (t: number, agora: number) => (t > 0 ? Math.round(t - agora) : -1);
const abs = (r: number, agora: number) => (r === -1 ? 0 : agora + r);

export function serializar(p: Partida, agora: number, eventos: EventoSiege[]): Snap {
  const g = (t: "vermelho" | "azul"): [number, number, unknown] => {
    const G = p.guardioes[t];
    return [
      G.hp,
      rel(G.expostoAte, agora),
      G.ataque
        ? [
            G.ataque.tipo,
            rel(G.ataque.inicio, agora),
            rel(G.ataque.impacto, agora),
            G.ataque.x,
            G.ataque.z,
            G.ataque.rumo,
          ]
        : null,
    ];
  };
  return {
    fase: p.fase,
    fim: rel(p.fimDaFase, agora),
    limite: rel(p.limiteProrrogacao, agora),
    g: { v: g("vermelho"), a: g("azul") },
    f: [
      p.forja.estado,
      p.forja.progresso,
      p.forja.time,
      p.forja.contestada,
      rel(p.forja.ate, agora),
    ],
    pontos: p.pontos,
    dano: p.danoAcumulado,
    pd: p.pontosDeDano,
    ped: p.pedestais.map((x) => rel(x.prontoEm, agora)),
    pr: p.projeteis.map((x) => [x.id, x.de, x.time, x.x, x.z, x.y, x.vx, x.vz, x.gelo]),
    fu: p.fumacas.map((x) => [x.time, x.x, x.z, rel(x.ate, agora)]),
    r: p.resultado,
    j: [...p.jogadores.values()].map((x) => [
      x.id,
      x.hp,
      x.escudo.valor,
      rel(x.escudo.ate, agora),
      x.lento.fator,
      rel(x.lento.ate, agora),
      x.morto,
      rel(x.renasceEm, agora),
      rel(x.protegidoAte, agora),
      rel(x.proximoAtaque, agora),
      rel(x.recarga[2], agora),
      rel(x.recarga[3], agora),
      x.pocao,
      rel(x.bebendoAte, agora),
      x.kit,
      x.kitPedido,
      x.stats,
      x.x,
      x.z,
    ]),
    ev: eventos,
  };
}

/** Aplica o estado que chegou do anfitrião (menos a minha posição, que é minha). Devolve os eventos. */
export function aplicarEstado(p: Partida, s: unknown, agora: number, euId: string): EventoSiege[] {
  const snap = s as Snap;
  if (!snap || !snap.fase) return [];
  p.fase = snap.fase;
  p.fimDaFase = abs(snap.fim, agora);
  p.limiteProrrogacao = abs(snap.limite, agora);
  for (const [t, v] of [
    ["vermelho", snap.g.v],
    ["azul", snap.g.a],
  ] as const) {
    const G = p.guardioes[t];
    G.hp = v[0];
    G.expostoAte = abs(v[1], agora);
    const at = v[2] as [string, number, number, number, number, number] | null;
    G.ataque = at
      ? {
          tipo: at[0] as "golpe" | "pisada",
          inicio: abs(at[1], agora),
          impacto: abs(at[2], agora),
          x: at[3],
          z: at[4],
          rumo: at[5],
        }
      : null;
  }
  p.forja.estado = snap.f[0] as Partida["forja"]["estado"];
  p.forja.progresso = snap.f[1];
  p.forja.time = snap.f[2] as Partida["forja"]["time"];
  p.forja.contestada = snap.f[3];
  p.forja.ate = abs(snap.f[4], agora);
  p.pontos = snap.pontos;
  p.danoAcumulado = snap.dano;
  p.pontosDeDano = snap.pd;
  snap.ped.forEach((r, i) => {
    const ped = p.pedestais[i];
    if (ped) ped.prontoEm = abs(r, agora);
  });
  p.projeteis = snap.pr.map((x) => ({
    id: x[0],
    de: x[1],
    time: x[2] as "vermelho" | "azul",
    x: x[3],
    z: x[4],
    y: x[5],
    vx: x[6],
    vz: x[7],
    gelo: x[8],
    dano: 0,
    restante: 1,
    basico: true,
  }));
  p.fumacas = snap.fu.map((x) => ({
    time: x[0] as "vermelho" | "azul",
    x: x[1],
    z: x[2],
    ate: abs(x[3], agora),
  }));
  p.resultado = snap.r;
  for (const linha of snap.j as unknown[][]) {
    const j = p.jogadores.get(linha[0] as string);
    if (!j) continue;
    j.hp = linha[1] as number;
    j.escudo = { valor: linha[2] as number, ate: abs(linha[3] as number, agora) };
    j.lento = { fator: linha[4] as number, ate: abs(linha[5] as number, agora) };
    j.morto = linha[6] as boolean;
    j.renasceEm = abs(linha[7] as number, agora);
    j.protegidoAte = abs(linha[8] as number, agora);
    j.proximoAtaque = abs(linha[9] as number, agora);
    j.recarga = { 2: abs(linha[10] as number, agora), 3: abs(linha[11] as number, agora) };
    j.pocao = linha[12] as number;
    j.bebendoAte = abs(linha[13] as number, agora);
    j.kit = linha[14] as typeof j.kit;
    j.kitPedido = linha[15] as typeof j.kitPedido;
    j.stats = linha[16] as typeof j.stats;
    if (j.id !== euId) {
      j.x = linha[17] as number;
      j.z = linha[18] as number;
    }
  }
  return snap.ev ?? [];
}
