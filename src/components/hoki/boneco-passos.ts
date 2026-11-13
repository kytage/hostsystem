import type * as TH from "three";

/**
 * Corrida "estilo Fortnite" feita por código, para o boneco não andar como se
 * carregasse uma caixa (o pacote 2 de animações não tem andar nem correr comuns).
 *
 * A partir da pose de "parado", cada osso gira em volta dos eixos do mundo
 * (X = lado, Y = cima), já convertidos para o espaço do pai do osso; assim a
 * conta não depende de como cada osso foi montado no arquivo. Sai uma volta
 * completa (passo esquerdo + direito) que fica repetindo.
 *
 * - trote: o padrão (sem Shift): braços dobrados balançando, corpo um pouco à frente;
 * - disparada: com Shift: passada longa, joelho alto, braços socando o ar, corpo bem inclinado.
 *
 * Quando o pacote 1 (com Jog_Fwd_Loop e Sprint_Loop) chegar, ele tem prioridade.
 */

interface Jeito {
  nome: string;
  /** Duração de uma volta (dois passos), em segundos. */
  volta: number;
  coxa: number;
  joelho: number;
  joelhoApoio: number;
  braco: number;
  cotovelo: number;
  inclina: number;
  quica: number;
  torce: number;
  quadril: number;
}

export const JEITOS: Jeito[] = [
  {
    nome: "Proc_Trote",
    volta: 0.66,
    coxa: 0.62,
    joelho: 1.25,
    joelhoApoio: 0.22,
    braco: 0.55,
    cotovelo: 1.25,
    inclina: 0.16,
    quica: 0.035,
    torce: 0.12,
    quadril: 0.1,
  },
  {
    nome: "Proc_Disparada",
    volta: 0.54,
    coxa: 0.86,
    joelho: 1.65,
    joelhoApoio: 0.3,
    braco: 0.85,
    cotovelo: 1.5,
    inclina: 0.32,
    quica: 0.05,
    torce: 0.16,
    quadril: 0.12,
  },
];

const QUADROS = 24;

/**
 * Gera as corridas a partir da pose `base` (o "parado"), usando a figura para
 * medir os ossos. A figura não pode estar dentro de outro objeto girado.
 */
export function gerarPassos(
  THREE: typeof TH,
  figura: TH.Object3D,
  base: TH.AnimationClip,
): TH.AnimationClip[] {
  // põe a figura na pose base (primeiro quadro do "parado") para medir
  const mixer = new THREE.AnimationMixer(figura);
  mixer.clipAction(base).play();
  mixer.update(0);
  figura.updateMatrixWorld(true);

  const X = new THREE.Vector3(1, 0, 0);
  const Y = new THREE.Vector3(0, 1, 0);
  interface Osso {
    nome: string;
    q: TH.Quaternion;
    /** Eixos X e Y do mundo, no espaço do pai do osso. */
    x: TH.Vector3;
    y: TH.Vector3;
    pos: TH.Vector3;
    /** Quanto a posição local muda para subir 1 metro (só a bacia usa). */
    sobe: TH.Vector3;
  }
  const ossos = new Map<string, Osso>();
  const medir = (nome: string) => {
    const o = figura.getObjectByName(nome);
    if (!o || !o.parent) return;
    const pai = o.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const mundo = o.getWorldPosition(new THREE.Vector3());
    const escala = figura.getWorldScale(new THREE.Vector3()).y;
    const l0 = o.parent.worldToLocal(mundo.clone());
    const l1 = o.parent.worldToLocal(mundo.clone().add(new THREE.Vector3(0, escala, 0)));
    ossos.set(nome, {
      nome: o.name,
      q: o.quaternion.clone(),
      x: X.clone().applyQuaternion(pai),
      y: Y.clone().applyQuaternion(pai),
      pos: o.position.clone(),
      sobe: l1.sub(l0),
    });
  };
  for (const n of [
    "pelvis",
    "spine_01",
    "spine_02",
    "spine_03",
    "neck_01",
    "thigh_l",
    "thigh_r",
    "calf_l",
    "calf_r",
    "foot_l",
    "foot_r",
    "upperarm_l",
    "upperarm_r",
    "lowerarm_l",
    "lowerarm_r",
  ])
    medir(n);
  mixer.stopAllAction();
  mixer.uncacheRoot(figura);

  const rx = new THREE.Quaternion();
  const ry = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  return JEITOS.map((j) => {
    const tempos: number[] = [];
    const valores = new Map<string, number[]>();
    const posBacia: number[] = [];
    const girar = (nome: string, ax: number, ay = 0) => {
      const o = ossos.get(nome);
      if (!o) return;
      rx.setFromAxisAngle(o.x, ax);
      ry.setFromAxisAngle(o.y, ay);
      q.copy(ry).multiply(rx).multiply(o.q);
      let l = valores.get(nome);
      if (!l) valores.set(nome, (l = []));
      l.push(q.x, q.y, q.z, q.w);
    };
    for (let k = 0; k <= QUADROS; k++) {
      const t = (k / QUADROS) * j.volta;
      const f = (k / QUADROS) * Math.PI * 2;
      tempos.push(t);
      for (const [lado, fase] of [
        ["l", f],
        ["r", f + Math.PI],
      ] as const) {
        // coxa: para a frente é giro negativo em X (o boneco olha para +Z)
        const coxa = -j.coxa * Math.sin(fase);
        // joelho: dobra mais quando a perna passa por baixo do corpo, indo para a frente
        const joelho = j.joelhoApoio + j.joelho * Math.pow(Math.max(0, Math.cos(fase)), 1.4);
        girar(`thigh_${lado}`, coxa);
        girar(`calf_${lado}`, joelho);
        girar(`foot_${lado}`, -(coxa + joelho) * 0.55);
        // braço do mesmo lado vai ao contrário da perna; cotovelo dobrado, socando junto
        const braco = j.braco * Math.sin(fase);
        girar(`upperarm_${lado}`, braco);
        girar(`lowerarm_${lado}`, -j.cotovelo - Math.max(0, -Math.sin(fase)) * 0.35);
      }
      girar("pelvis", 0, -j.quadril * Math.sin(f));
      girar("spine_01", j.inclina * 0.5);
      girar("spine_02", j.inclina * 0.5, j.torce * Math.sin(f));
      girar("spine_03", 0, j.torce * 0.5 * Math.sin(f));
      girar("neck_01", -j.inclina * 0.7);
      // a bacia sobe e desce duas vezes por volta (mais baixa quando o pé toca o chão)
      const b = ossos.get("pelvis");
      if (b) {
        const dy = j.quica * (Math.cos(2 * f) - 0.4);
        posBacia.push(b.pos.x + b.sobe.x * dy, b.pos.y + b.sobe.y * dy, b.pos.z + b.sobe.z * dy);
      }
    }
    const trilhas: TH.KeyframeTrack[] = [];
    for (const [nome, v] of valores)
      trilhas.push(new THREE.QuaternionKeyframeTrack(`${nome}.quaternion`, tempos, v));
    const bacia = ossos.get("pelvis");
    if (bacia && posBacia.length)
      trilhas.push(new THREE.VectorKeyframeTrack(`${bacia.nome}.position`, tempos, posBacia));
    // os outros ossos (dedos, cabeça, ombros) ficam na pose de parado
    for (const t of base.tracks) {
      const nome = t.name.slice(0, t.name.lastIndexOf("."));
      if (valores.has(nome) || (nome === "pelvis" && t.name.endsWith(".position"))) continue;
      const n = t.getValueSize();
      const Tipo = t.constructor as new (n: string, t: number[], v: number[]) => TH.KeyframeTrack;
      trilhas.push(new Tipo(t.name, [0], Array.from(t.values.slice(0, n))));
    }
    return new THREE.AnimationClip(j.nome, j.volta, trilhas);
  });
}
