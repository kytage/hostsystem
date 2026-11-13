import type * as TH from "three";

/**
 * Arco do RANKING (modelo em public/hoki/ranking) com os textos flutuando no vão,
 * no lugar do antigo pódio. Os textos são planos com textura de canvas (um "atlas" só,
 * uma faixa por linha) que boiam de leve, como letreiro de holograma.
 */

export interface LinhaRanking {
  nome: string;
  valor: string;
}
export interface QuadroRanking {
  titulo: string;
  sub: string;
  linhas: LinhaRanking[];
  /** Qual dos rankings está na tela (0…total-1), para as bolinhas. */
  pagina: number;
  total: number;
}

/** O modelo tem 0,98 × 0,77 × 0,21 (base no chão, frente para +z). */
export const ESCALA_ARCO = 6;
export const ALTURA_ARCO = 0.766 * ESCALA_ARCO;
export const LARGURA_ARCO = 0.98 * ESCALA_ARCO;
/** Espessura do arco (de trás até a frente). */
export const PROFUNDIDADE_ARCO = 0.212 * ESCALA_ARCO;
/** Colunas (para as colisões): centro em x e raio, já na escala. */
export const COLUNAS_ARCO = { x: 0.366 * ESCALA_ARCO, r: 0.62 };

// atlas: 1024 de largura, uma faixa por linha (de cima para baixo)
const LARG = 1024;
const FAIXAS = [
  { id: "titulo", h: 128 },
  { id: "sub", h: 70 },
  { id: "l0", h: 98 },
  { id: "l1", h: 98 },
  { id: "l2", h: 98 },
  { id: "l3", h: 98 },
  { id: "l4", h: 98 },
  { id: "rodape", h: 80 },
] as const;
const ALT = 1024;
/** Largura dos textos no mundo (o vão entre as colunas tem ~3,6 m). */
const LARGURA_TEXTO = 3.4;
/** Altura (centro) de cada linha no vão, de cima para baixo. */
const ALTURAS = [2.62, 2.29, 1.97, 1.645, 1.32, 0.995, 0.67, 0.36];

const FONTE = "'Manrope', 'Inter', ui-sans-serif, system-ui, sans-serif";

function cortar(ctx: CanvasRenderingContext2D, texto: string, max: number) {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Escreve com contorno escuro e um brilho de holograma (legível de dia e de noite). */
function escrever(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  cor: string,
  brilho: string,
  contorno = 9,
) {
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.lineWidth = contorno;
  ctx.strokeStyle = "rgba(14, 10, 6, 0.92)";
  ctx.strokeText(texto, x, y);
  ctx.shadowColor = brilho;
  ctx.shadowBlur = 18;
  ctx.fillStyle = cor;
  ctx.fillText(texto, x, y);
  ctx.shadowBlur = 0;
}

function desenhar(ctx: CanvasRenderingContext2D, q: QuadroRanking) {
  ctx.clearRect(0, 0, LARG, ALT);
  ctx.textBaseline = "middle";
  let topo = 0;
  const centro = (h: number) => topo + h / 2;
  for (const f of FAIXAS) {
    const meio = centro(f.h);
    if (f.id === "titulo") {
      ctx.font = `900 96px ${FONTE}`;
      ctx.textAlign = "center";
      escrever(ctx, q.titulo.toUpperCase(), LARG / 2, meio + 4, "#ffe066", "rgba(255, 196, 60, 0.85)", 14);
    } else if (f.id === "sub") {
      ctx.font = `700 42px ${FONTE}`;
      ctx.textAlign = "center";
      const bolinhas = Array.from({ length: q.total }, (_, i) => (i === q.pagina ? "●" : "○")).join(" ");
      escrever(ctx, `${q.sub}   ${bolinhas}`, LARG / 2, meio, "#dfe8ff", "rgba(150, 190, 255, 0.7)", 7);
    } else if (f.id === "rodape") {
      ctx.font = `800 50px ${FONTE}`;
      ctx.textAlign = "center";
      escrever(ctx, "E  PRÓXIMO          F  SAIR", LARG / 2, meio, "#ffffff", "rgba(255,255,255,0.55)", 8);
    } else {
      const i = Number(f.id.slice(1));
      const l = q.linhas[i];
      ctx.font = `900 72px ${FONTE}`;
      ctx.textAlign = "left";
      escrever(ctx, `${i + 1}.`, 70, meio, "#ffd84a", "rgba(255, 196, 60, 0.8)", 11);
      ctx.font = `800 70px ${FONTE}`;
      const nome = l ? l.nome.toUpperCase() : "—";
      escrever(ctx, cortar(ctx, nome, 520), 175, meio, l ? "#ffffff" : "rgba(255,255,255,0.45)", "rgba(255,255,255,0.6)", 11);
      if (l) {
        ctx.font = `900 70px ${FONTE}`;
        ctx.textAlign = "right";
        escrever(ctx, l.valor.toUpperCase(), LARG - 70, meio, "#ffd84a", "rgba(255, 196, 60, 0.8)", 11);
      }
    }
    topo += f.h;
  }
}

export function criarArcoDoRanking(THREE: typeof TH, pai: TH.Object3D, pos: { x: number; z: number }) {
  const raiz = new THREE.Group();
  raiz.position.set(pos.x, 0, pos.z);
  pai.add(raiz);
  const lixo: { dispose(): void }[] = [];
  let descartado = false;

  // ---------------- o arco (carrega depois, como a logo) ----------------
  void import("three/examples/jsm/loaders/GLTFLoader.js")
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync("/hoki/ranking/ranking-arco.glb"))
    .then((gltf) => {
      const arco = gltf.scene;
      const meus: { dispose(): void }[] = [];
      arco.traverse((o) => {
        const m = o as TH.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        meus.push(m.geometry);
        const mat = m.material as TH.MeshStandardMaterial;
        meus.push(mat);
        if (mat.map) {
          mat.map.anisotropy = 8;
          meus.push(mat.map);
          // brilho próprio leve: o letreiro continua legível à sombra e à noite
          mat.emissive = new THREE.Color(0xffffff);
          mat.emissiveMap = mat.map;
          mat.emissiveIntensity = 0.12;
        }
      });
      if (descartado) return meus.forEach((x) => x.dispose());
      lixo.push(...meus);
      arco.scale.setScalar(ESCALA_ARCO);
      raiz.add(arco);
    })
    .catch(() => undefined);

  // ---------------- os textos flutuando no vão ----------------
  const canvas = document.createElement("canvas");
  canvas.width = LARG;
  canvas.height = ALT;
  const ctx = canvas.getContext("2d");
  const base = new THREE.CanvasTexture(canvas);
  base.colorSpace = THREE.SRGBColorSpace;
  base.anisotropy = 8;
  lixo.push(base);
  const linhas: { malha: TH.Mesh; mat: TH.MeshBasicMaterial; tex: TH.Texture; y: number }[] = [];
  let topo = 0;
  FAIXAS.forEach((f, i) => {
    const tex = base.clone();
    tex.repeat.set(1, f.h / ALT);
    tex.offset.set(0, 1 - (topo + f.h) / ALT);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    const geo = new THREE.PlaneGeometry(LARGURA_TEXTO, (LARGURA_TEXTO * f.h) / LARG);
    const malha = new THREE.Mesh(geo, mat);
    const y = ALTURAS[i] ?? 0;
    malha.position.set(0, y, 0.08);
    malha.renderOrder = 6;
    raiz.add(malha);
    linhas.push({ malha, mat, tex, y });
    lixo.push(tex, mat, geo);
    topo += f.h;
  });

  let quadro: QuadroRanking = { titulo: "Ranking", sub: "Carregando…", linhas: [], pagina: 0, total: 5 };
  let chave = "";
  let trocou = true;
  let inicioDaTroca = 0;
  const redesenhar = () => {
    if (!ctx) return;
    desenhar(ctx, quadro);
    base.needsUpdate = true;
    for (const l of linhas) l.tex.needsUpdate = true;
  };
  redesenhar();
  // a fonte do site pode chegar depois: redesenha quando ela estiver pronta
  void document.fonts?.ready.then(() => !descartado && redesenhar());

  return {
    raiz,
    definir(q: QuadroRanking) {
      const nova = JSON.stringify(q);
      if (nova === chave) return;
      const mudouPagina = q.pagina !== quadro.pagina || q.titulo !== quadro.titulo;
      chave = nova;
      quadro = q;
      redesenhar();
      if (mudouPagina) trocou = true;
    },
    atualizar(t: number) {
      if (trocou) {
        trocou = false;
        inicioDaTroca = t;
      }
      linhas.forEach((l, i) => {
        // cada linha entra um pouquinho depois da outra, e todas boiam de leve
        const k = Math.min(1, Math.max(0, (t - inicioDaTroca - i * 0.05) / 0.35));
        const e = 1 - Math.pow(1 - k, 3);
        l.mat.opacity = 0.25 + 0.75 * e;
        l.malha.scale.set(0.94 + 0.06 * e, 0.8 + 0.2 * e, 1);
        l.malha.position.y = l.y + Math.sin(t * 1.3 + i * 0.75) * 0.03 + (1 - e) * 0.08;
      });
    },
    descartar() {
      descartado = true;
      raiz.removeFromParent();
      lixo.forEach((x) => x.dispose());
    },
  };
}
