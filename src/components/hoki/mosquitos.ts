import type * as TH from "three";

/**
 * Nuvem de mosquitos zumbindo em volta de um ponto (a cabeça de um HOKI sujo).
 * São só uns pontinhos escuros, baratos de desenhar, que giram e tremem no ar.
 */
export function criarMosquitos(THREE: typeof TH, quantos = 7, raio = 0.45, tamanho = 0.06) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(quantos * 3);
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: 0x141414,
    size: tamanho,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const pontos = new THREE.Points(g, m);
  pontos.frustumCulled = false;
  const fase = Array.from({ length: quantos }, (_, i) => i * 2.399 + i * i * 0.37);
  return {
    pontos,
    /** Faz os mosquitos zumbirem em volta de (x, y, z). */
    atualizar(t: number, x: number, y: number, z: number) {
      for (let i = 0; i < quantos; i++) {
        const f = fase[i] ?? 0;
        const a = t * (2.2 + (i % 3) * 0.7) + f;
        const r = raio * (0.6 + 0.4 * Math.sin(t * 3.1 + f * 2));
        pos[i * 3] = x + Math.cos(a) * r + Math.sin(t * 17 + f) * raio * 0.07;
        pos[i * 3 + 1] =
          y + Math.sin(t * 2.7 + f * 1.3) * raio * 0.5 + Math.sin(t * 23 + f) * raio * 0.05;
        pos[i * 3 + 2] = z + Math.sin(a) * r;
      }
      (g.getAttribute("position") as TH.BufferAttribute).needsUpdate = true;
    },
    descartar() {
      g.dispose();
      m.dispose();
    },
  };
}
