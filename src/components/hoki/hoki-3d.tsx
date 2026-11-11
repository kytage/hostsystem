import { useEffect, useRef, useState } from "react";
import type * as TH from "three";
import { cn } from "@/lib/utils";
import { nomeDoLetreiro, peca, VISUAL_PADRAO, type Humor, type Visual } from "@/lib/hoki";
import { criarFundo, criarLetreiro } from "./cenario";
import { criarMosquitos } from "./mosquitos";
import { criarPodio } from "./podios";
import { criarMascote, type Reacao } from "./mascote";
import { modeloCompleto, type Modelo } from "./modelo";
import {
  anoitecerLuzes,
  COR_NEVOA,
  COR_NEVOA_NOITE,
  montarLuzes,
  nivelDaNoite,
  prepararDesenho,
  texturaMancha,
} from "./luz";
import { ceu } from "./voxel";

export type { Reacao };

/** Nome e nível mostrados no cenário: letreiro em cima do HOKI e brasão no pódio. */
export interface Placa {
  nome: string;
  nivel: number;
}
export type ReacaoAtual = { tipo: Reacao; n: number } | null;

/**
 * Palco 3D do HOKI. Fica vivo enquanto o componente existir: trocar roupa,
 * pódio ou nome refaz só a peça que mudou (sem recriar o WebGL). Com `cenario`,
 * mostra céu, ilhas, pódio e letreiro; sem ele, só o boneco em fundo transparente.
 */
function criarPalco(
  THREE: typeof TH,
  el: HTMLDivElement,
  opcoes: { interativo: boolean; cenario: boolean },
) {
  const { cenario } = opcoes;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !cenario });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  prepararDesenho(THREE, renderer);
  renderer.autoClear = !cenario;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

  const cena = new THREE.Scene();
  const FOV = 28;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 90);
  // mesma luz da praça: sol quente pela esquerda, céu azulado preenchendo e um contraluz para o contorno
  const luzes = montarLuzes(THREE, cena, {
    alvo: { x: 0, y: 1.2, z: 0 },
    area: [4.4, 4.4],
    distancia: 14,
    mapa: 1024,
    maciez: 1.6,
  });
  const realce = new THREE.DirectionalLight(0xfff0dc, cenario ? 1.1 : 0.7);
  realce.position.set(3.5, 5, -7);
  cena.add(realce);
  if (!cenario) {
    luzes.ceu.groundColor.set(0x3a2a2a);
    const contorno = new THREE.PointLight(0xff3a3a, 8, 10);
    contorno.position.set(-2, 1.6, -2.2);
    cena.add(contorno);
  }

  // o fundo é desenhado à parte, num quadro menor, e entra levemente desfocado atrás do pedestal
  const texCeu = cenario ? ceu(THREE) : null;
  const fundo = cenario ? criarFundo(THREE) : null;
  const cenaFundo = new THREE.Scene();
  let luzesDoFundo: ReturnType<typeof montarLuzes> | null = null;
  if (fundo && texCeu) {
    cenaFundo.background = texCeu;
    cenaFundo.fog = new THREE.Fog(COR_NEVOA, 16, 62);
    luzesDoFundo = montarLuzes(THREE, cenaFundo, { area: [1, 1], distancia: 14, sombras: false });
    cenaFundo.add(fundo.longe);
    cena.add(fundo.perto);
  }
  const flutuante =
    renderer.extensions.has("EXT_color_buffer_float") ||
    renderer.extensions.has("EXT_color_buffer_half_float");
  const quadroFundo = cenario
    ? new THREE.WebGLRenderTarget(2, 2, {
        type: flutuante ? THREE.HalfFloatType : THREE.UnsignedByteType,
      })
    : null;
  const passo = new THREE.Vector2(1, 1);
  const gTela = new THREE.PlaneGeometry(2, 2);
  const mTela = new THREE.ShaderMaterial({
    uniforms: { tFundo: { value: quadroFundo?.texture ?? null }, uPasso: { value: passo } },
    vertexShader:
      "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 1.0, 1.0 ); }",
    fragmentShader: `
      uniform sampler2D tFundo;
      uniform vec2 uPasso;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D( tFundo, vUv ).rgb * 0.16;
        for ( int i = 0; i < 6; i ++ ) {
          float a = float( i ) * 1.0472;
          c += texture2D( tFundo, vUv + vec2( cos( a ), sin( a ) ) * uPasso * 1.3 ).rgb * 0.09;
          c += texture2D( tFundo, vUv + vec2( cos( a + 0.5236 ), sin( a + 0.5236 ) ) * uPasso * 2.7 ).rgb * 0.05;
        }
        gl_FragColor = vec4( c, 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const tela = new THREE.Mesh(gTela, mTela);
  tela.frustumCulled = false;
  const cenaTela = new THREE.Scene();
  cenaTela.add(tela);
  const camTela = new THREE.Camera();

  const giravel = new THREE.Group(); // pódio + mascote: é o que gira ao arrastar
  const suporte = new THREE.Group(); // segura o mascote em cima do pódio
  giravel.add(suporte);
  cena.add(giravel);
  // sombra de contato embaixo dos pés: uma mancha macia, mais definida que a sombra do sol
  const texSombra = texturaMancha(THREE);
  const geoSombra = new THREE.PlaneGeometry(1.2, 1.2);
  geoSombra.rotateX(-Math.PI / 2);
  const matSombra = new THREE.MeshBasicMaterial({
    map: texSombra,
    color: 0x1d150c,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const sombra = new THREE.Mesh(geoSombra, matSombra);
  sombra.position.y = 0.012;
  sombra.renderOrder = 2;
  giravel.add(sombra);

  let mascote: ReturnType<typeof criarMascote> | null = null;
  let modelo: Modelo | undefined;
  let podio: ReturnType<typeof criarPodio> | null = null;
  let letreiro: ReturnType<typeof criarLetreiro> | null = null;
  const chaves = { visual: "", podio: "", nome: "" };
  const enquadre = { alto: 2, largura: 1.6 };
  const suave = { alto: 2, dist: 6, perto: 0 };
  const estado = { humor: "normal" as Humor, reacao: null as ReacaoAtual, inicio: 0 };
  const controle = { giro: 0, zoom: 1 };
  let margem = 0;
  let pedido = 0;
  let morto = false;
  let primeiro = true;
  const fontes =
    document.fonts?.load(`800 40px Manrope`).catch(() => undefined) ?? Promise.resolve();

  const medir = () => {
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    if (quadroFundo) {
      const pr = renderer.getPixelRatio();
      const lw = Math.max(2, Math.round((w * pr) / 2));
      const lh = Math.max(2, Math.round((h * pr) / 2));
      quadroFundo.setSize(lw, lh);
      passo.set(1 / lw, 1 / lh);
    }
    const util = Math.max(60, h - margem);
    // a cena é enquadrada na parte de cima (livre); a faixa de baixo fica atrás dos controles
    camera.aspect = w / util;
    if (margem > 0) camera.setViewOffset(w, util, 0, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  const observador = new ResizeObserver(medir);
  observador.observe(el);
  medir();

  const comSombra = (o: TH.Object3D) =>
    o.traverse((m) => {
      if (m instanceof THREE.Mesh && !(m.material as TH.Material).transparent) m.castShadow = true;
    });

  /** Mostra este visual e esta placa, refazendo só o que mudou. */
  async function definir(visual: Visual, placa: Placa | null) {
    const meu = ++pedido;
    const chaveVisual = JSON.stringify(visual);
    const tipoPodio = peca(visual.podio)?.tipo ?? "pedra";
    const chavePodio = cenario && placa ? `${tipoPodio}|${placa.nivel}` : "";
    const chaveNome = cenario && placa ? nomeDoLetreiro(placa.nome) : "";

    if (chaveVisual !== chaves.visual) {
      // todo visual usa o modelo 3D original; as roupas vestem por cima dele
      const novo = await modeloCompleto(THREE);
      if (meu !== pedido || morto) {
        novo?.geo.dispose();
        novo?.tex?.dispose();
        return;
      }
      if (mascote) {
        suporte.remove(mascote.raiz);
        mascote.descartar();
      }
      modelo?.geo.dispose();
      modelo?.tex?.dispose();
      modelo = novo;
      mascote = criarMascote(THREE, visual, { modelo });
      comSombra(mascote.raiz);
      suporte.add(mascote.raiz);
      chaves.visual = chaveVisual;
    }
    if (chavePodio !== chaves.podio) {
      if (podio) {
        giravel.remove(podio.grupo);
        podio.descartar();
        podio = null;
      }
      if (chavePodio && placa) {
        podio = criarPodio(THREE, tipoPodio, placa.nivel);
        giravel.add(podio.grupo);
      }
      chaves.podio = chavePodio;
    }
    if (chaveNome !== chaves.nome) {
      await fontes;
      if (meu !== pedido || morto) return;
      if (letreiro) {
        cena.remove(letreiro.grupo);
        letreiro.descartar();
        letreiro = null;
      }
      if (chaveNome) {
        letreiro = criarLetreiro(THREE, chaveNome);
        cena.add(letreiro.grupo);
      }
      chaves.nome = chaveNome;
    }
    const base = podio?.altura ?? 0;
    suporte.position.y = base;
    sombra.position.y = base + 0.012;
    const topoMascote = base + (mascote?.topo ?? 1.8);
    if (letreiro) letreiro.grupo.position.set(0, topoMascote + 0.62, 0);
    enquadre.alto = letreiro ? topoMascote + 1.22 : topoMascote + 0.14;
    enquadre.largura = Math.max(
      mascote?.largura ?? 1.5,
      letreiro?.largura ?? 0,
      podio?.largura ?? 0,
    );
  }

  const mouse = { x: 0, y: 0 };
  const aoMover = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    mouse.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
    mouse.y = Math.max(-1.6, Math.min(1.6, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
  };
  window.addEventListener("pointermove", aoMover, { passive: true });

  // girar arrastando e zoom limitado (só no modo interativo)
  let arrastando: number | null = null;
  const aoBaixar = (e: PointerEvent) => {
    arrastando = e.clientX;
    el.setPointerCapture(e.pointerId);
  };
  const aoArrastar = (e: PointerEvent) => {
    if (arrastando === null) return;
    controle.giro += (e.clientX - arrastando) * 0.012;
    arrastando = e.clientX;
  };
  const aoSoltar = () => (arrastando = null);
  const aoRolar = (e: WheelEvent) => {
    e.preventDefault();
    // de 0,24 (bem no rosto) a 1,25 (afastado)
    controle.zoom = Math.max(0.24, Math.min(1.25, controle.zoom + e.deltaY * 0.0011));
  };
  if (opcoes.interativo) {
    el.addEventListener("pointerdown", aoBaixar);
    el.addEventListener("pointermove", aoArrastar);
    el.addEventListener("pointerup", aoSoltar);
    el.addEventListener("pointercancel", aoSoltar);
    el.addEventListener("wheel", aoRolar, { passive: false });
  }

  // não gasta bateria desenhando quando o palco está fora da tela
  let visivel = true;
  const olheiro = new IntersectionObserver((e) => (visivel = e[0]?.isIntersecting ?? true));
  olheiro.observe(el);

  const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const meio = Math.tan((FOV * Math.PI) / 360);
  let raf = 0;
  // foco de luz direto no HOKI e no nome: acende à noite, para ele não sumir no escuro
  const foco = new THREE.SpotLight(0xfff1d6, 0, 0, 0.66, 0.7, 0);
  foco.position.set(0.5, 3.1, 3.5);
  foco.target.position.set(0, 1.45, 0);
  cena.add(foco, foco.target);
  // dia e noite andam junto com a praça (mesmo relógio): as luzes viram luar e o fundo escurece
  let noiteAtual = -1;
  const corDaNevoa = { dia: new THREE.Color(COR_NEVOA), noite: new THREE.Color(COR_NEVOA_NOITE) };
  const anoitecer = (v: number) => {
    if (Math.abs(v - noiteAtual) < 0.003) return;
    noiteAtual = v;
    // no HOKI a noite entra mais leve, e o foco compensa; o fundo escurece de verdade
    anoitecerLuzes(luzes, v * 0.75);
    foco.intensity = v * 6.5;
    if (luzesDoFundo) anoitecerLuzes(luzesDoFundo, v);
    cenaFundo.backgroundIntensity = 1 - 0.88 * v;
    if (cenaFundo.fog) cenaFundo.fog.color.copy(corDaNevoa.dia).lerp(corDaNevoa.noite, v);
  };

  const quadro = (agora: number) => {
    raf = requestAnimationFrame(quadro);
    if (!visivel || !mascote) return;
    const t = agora / 1000;
    if (cenario) anoitecer(nivelDaNoite());
    const salto = mascote.atualizar({
      t,
      humor: estado.humor,
      reacao: estado.reacao?.tipo ?? null,
      p: (agora - estado.inicio) / 1000,
      mouse: arrastando === null ? mouse : { x: 0, y: 0 },
      calmo,
    });
    fundo?.atualizar(t);
    podio?.atualizar(t);
    // HOKI sujo: mosquitos zumbindo em cima da cabeça
    if (mosquitos && mascote)
      mosquitos.atualizar(t, 0, suporte.position.y + mascote.topo * 0.92, 0.05);
    letreiro?.atualizar(t);
    sombra.scale.setScalar(1 - Math.min(0.5, salto * 0.5));
    giravel.rotation.y = controle.giro;

    // enquadra do chão ao topo (letreiro, chapéu ou orelhas), com folga; muda suave quando o visual troca.
    // No cenário sobra um pouco embaixo, para aparecer a frente inteira do pedestal e o piso.
    const baixo = cenario ? 0.5 : 0;
    const dist =
      Math.max((enquadre.alto + baixo) / 2 / meio, enquadre.largura / 2 / (meio * camera.aspect)) *
      1.05 *
      controle.zoom;
    const k = primeiro ? 1 : 0.12;
    primeiro = false;
    suave.alto += (enquadre.alto - suave.alto) * k;
    suave.dist += (dist - suave.dist) * k;
    // ao aproximar (rodinha do mouse), a câmera desce do enquadramento geral para o rosto
    const perto = Math.max(0, Math.min(1, (1 - controle.zoom) / 0.76));
    const rosto = (podio?.altura ?? 0) + (mascote.topo ?? 1.8) * 0.6;
    suave.perto += (perto - suave.perto) * k;
    const meioY = (suave.alto - baixo) / 2 + (rosto - (suave.alto - baixo) / 2) * suave.perto;
    camera.position.set(0, meioY + (cenario ? 1.2 : 0.25) * (1 - suave.perto * 0.85), suave.dist);
    camera.lookAt(0, meioY - (cenario ? 0.06 : 0.03) * (1 - suave.perto), 0);
    if (quadroFundo) {
      renderer.setRenderTarget(quadroFundo);
      renderer.clear();
      renderer.render(cenaFundo, camera);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(cenaTela, camTela);
      renderer.clearDepth();
    }
    renderer.render(cena, camera);
  };
  raf = requestAnimationFrame(quadro);

  let mosquitos: ReturnType<typeof criarMosquitos> | null = null;
  return {
    definir,
    /** Sujo: põe (ou tira) os mosquitos em volta da cabeça. */
    setSujo(sujo: boolean) {
      if (sujo && !mosquitos) {
        mosquitos = criarMosquitos(THREE, 8, 0.34, 0.035);
        cena.add(mosquitos.pontos);
      } else if (!sujo && mosquitos) {
        cena.remove(mosquitos.pontos);
        mosquitos.descartar();
        mosquitos = null;
      }
    },
    setEstado(humor: Humor, reacao: ReacaoAtual) {
      estado.humor = humor;
      if (reacao !== estado.reacao) {
        estado.reacao = reacao;
        estado.inicio = performance.now();
      }
    },
    setMargem(px: number) {
      margem = Math.max(0, px);
      medir();
    },
    descartar() {
      morto = true;
      cancelAnimationFrame(raf);
      observador.disconnect();
      olheiro.disconnect();
      window.removeEventListener("pointermove", aoMover);
      el.removeEventListener("pointerdown", aoBaixar);
      el.removeEventListener("pointermove", aoArrastar);
      el.removeEventListener("pointerup", aoSoltar);
      el.removeEventListener("pointercancel", aoSoltar);
      el.removeEventListener("wheel", aoRolar);
      mascote?.descartar();
      modelo?.geo.dispose();
      modelo?.tex?.dispose();
      podio?.descartar();
      letreiro?.descartar();
      fundo?.descartar();
      texCeu?.dispose();
      geoSombra.dispose();
      matSombra.dispose();
      texSombra.dispose();
      quadroFundo?.dispose();
      gTela.dispose();
      mTela.dispose();
      mosquitos?.descartar();
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/**
 * HOKI em 3D. Com `placa`, aparece no cenário completo: céu, pódio com o
 * nível e letreiro com o nome. `margemBase` reserva a faixa de baixo (em px)
 * para controles por cima da cena. Com `interativo`, gira ao arrastar.
 */
export function Hoki3D({
  humor,
  reacao,
  visual = VISUAL_PADRAO,
  placa = null,
  interativo = false,
  margemBase = 0,
  sujo = false,
  className,
}: {
  humor: Humor;
  reacao: ReacaoAtual;
  visual?: Visual;
  placa?: Placa | null;
  interativo?: boolean;
  margemBase?: number;
  /** HOKI sujo: aparecem mosquitos em volta da cabeça. */
  sujo?: boolean;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const palco = useRef<ReturnType<typeof criarPalco> | null>(null);
  const [falhou, setFalhou] = useState(false);
  const atual = useRef({ humor, reacao, visual, placa, margemBase });
  atual.current = { humor, reacao, visual, placa, margemBase };
  const comCenario = placa !== null;

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    let vivo = true;
    void import("three")
      .then((THREE) => {
        if (!vivo) return;
        const p = criarPalco(THREE, el, { interativo, cenario: comCenario });
        palco.current = p;
        const a = atual.current;
        p.setMargem(a.margemBase);
        p.setEstado(a.humor, a.reacao);
        p.setSujo(atualSujo.current);
        void p.definir(a.visual, a.placa);
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
      palco.current?.descartar();
      palco.current = null;
    };
  }, [interativo, comCenario]);

  const chave = JSON.stringify(visual);
  const nome = placa?.nome;
  const nivel = placa?.nivel;
  useEffect(() => {
    void palco.current?.definir(atual.current.visual, atual.current.placa);
  }, [chave, nome, nivel]);
  useEffect(() => palco.current?.setEstado(humor, reacao), [humor, reacao]);
  useEffect(() => palco.current?.setMargem(margemBase), [margemBase]);
  const atualSujo = useRef(sujo);
  atualSujo.current = sujo;
  useEffect(() => palco.current?.setSujo(sujo), [sujo]);

  return (
    <div
      ref={caixa}
      className={cn(
        "relative",
        interativo && "cursor-grab touch-none active:cursor-grabbing",
        className,
      )}
      role="img"
      aria-label="HOKI, o pet da HOST"
    >
      {falhou && <span className="absolute inset-0 grid place-items-center text-7xl">🐶</span>}
    </div>
  );
}
