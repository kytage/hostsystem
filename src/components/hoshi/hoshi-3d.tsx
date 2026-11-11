import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { trajeDe, VISUAL_PADRAO, type Humor, type Visual } from "@/lib/hoshi";
import { criarMascote, type Modelo, type Reacao } from "./mascote";

/** Lê o binário do modelo (gerado a partir do .obj) e monta a malha. Fica guardado para as próximas vezes. */
let modeloEmCache: Promise<{ pos: Float32Array; uv: Float32Array; nor: Float32Array; idx: Uint32Array } | null> | null = null;
function lerModelo() {
  modeloEmCache ??= fetch("/hoshi/hoshi.bin")
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("modelo"))))
    .then((buf) => {
      const dv = new DataView(buf);
      if (dv.getUint32(0, true) !== 0x48534f48) throw new Error("formato");
      const n = dv.getUint32(4, true);
      const ni = dv.getUint32(8, true);
      const mn = [0, 1, 2].map((i) => dv.getFloat32(12 + i * 4, true));
      const mx = [0, 1, 2].map((i) => dv.getFloat32(24 + i * 4, true));
      let o = 36;
      const qPos = new Uint16Array(buf, o, n * 3);
      o += n * 6;
      const qUv = new Uint16Array(buf.slice(o, o + n * 4));
      o += n * 4;
      const qNor = new Int8Array(buf, o, n * 3);
      o += n * 3;
      o += (4 - (o % 4)) % 4;
      const idx = new Uint32Array(buf, o, ni);
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) pos[i] = mn[i % 3]! + (qPos[i]! / 65535) * (mx[i % 3]! - mn[i % 3]!);
      const uv = new Float32Array(n * 2);
      for (let i = 0; i < n * 2; i++) uv[i] = qUv[i]! / 65535;
      const nor = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) nor[i] = qNor[i]! / 127;
      return { pos, uv, nor, idx };
    })
    .catch(() => null);
  return modeloEmCache;
}

export type { Reacao };

/**
 * Palco 3D do HOSHI. O boneco é montado em ./mascote; aqui ficam câmera,
 * luzes, sombra de contato e o laço de animação. A câmera se ajusta sozinha
 * à altura do personagem (orelhas longas, chapéus, bandeira), então ele
 * aparece sempre inteiro. Com `interativo`, dá para girar arrastando e
 * aproximar um pouco com a rolagem.
 */
export function Hoshi3D({
  humor,
  reacao,
  visual = VISUAL_PADRAO,
  interativo = false,
  className,
}: {
  humor: Humor;
  reacao: { tipo: Reacao; n: number } | null;
  visual?: Visual;
  interativo?: boolean;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const estado = useRef({ humor, reacao, inicio: 0 });
  const controle = useRef({ giro: 0, zoom: 1 });
  const [falhou, setFalhou] = useState(false);
  // O boneco é refeito sempre que alguma parte do visual muda.
  const chave = JSON.stringify(visual);

  useEffect(() => {
    estado.current.humor = humor;
  }, [humor]);
  useEffect(() => {
    estado.current.reacao = reacao;
    estado.current.inicio = performance.now();
  }, [reacao]);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    let vivo = true;
    let limpar = () => {};

    const visualAtual = JSON.parse(chave) as Visual;
    const precisaModelo = trajeDe(visualAtual).id === "traje:hoshi";
    void Promise.all([import("three"), precisaModelo ? lerModelo() : Promise.resolve(null)])
      .then(async ([THREE, dados]) => {
        if (!vivo) return;
        let modelo: Modelo | undefined;
        if (dados) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(dados.pos, 3));
          geo.setAttribute("normal", new THREE.BufferAttribute(dados.nor, 3));
          geo.setAttribute("uv", new THREE.BufferAttribute(dados.uv, 2));
          geo.setIndex(new THREE.BufferAttribute(dados.idx, 1));
          const tex = await new THREE.TextureLoader().loadAsync("/hoshi/hoshi.webp").catch(() => null);
          if (!vivo) return;
          if (tex) {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            modelo = { geo, tex };
          } else geo.dispose();
        }
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        el.appendChild(renderer.domElement);
        renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

        const cena = new THREE.Scene();
        const FOV = 28;
        const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);

        // luz suave de estúdio: céu claro, chão quente, uma luz principal e um contorno vermelho por trás
        cena.add(new THREE.HemisphereLight(0xffffff, 0x3a2a2a, 1.45));
        const sol = new THREE.DirectionalLight(0xffffff, 1.5);
        sol.position.set(2.2, 4, 3.6);
        cena.add(sol);
        const preenche = new THREE.DirectionalLight(0xffffff, 0.45);
        preenche.position.set(-3, 1.5, 2);
        cena.add(preenche);
        const contorno = new THREE.PointLight(0xff3a3a, 8, 10);
        contorno.position.set(-2, 1.6, -2.2);
        cena.add(contorno);

        const palco = new THREE.Group();
        cena.add(palco);
        const mascote = criarMascote(THREE, visualAtual, modelo);
        palco.add(mascote.raiz);

        const geoSombra = new THREE.CircleGeometry(0.42, 40);
        const matSombra = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 });
        const sombra = new THREE.Mesh(geoSombra, matSombra);
        sombra.rotation.x = -Math.PI / 2;
        sombra.position.y = 0.004;
        palco.add(sombra);

        // enquadra o corpo inteiro: do chão ao topo do acessório mais alto, com folga
        let distancia = 6;
        const alto = mascote.topo + 0.14;
        const enquadrar = () => {
          const w = el.clientWidth || 1;
          const h = el.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          const meio = Math.tan((FOV * Math.PI) / 360);
          distancia = Math.max(alto / 2 / meio, mascote.largura / 2 / (meio * camera.aspect)) * 1.06;
          camera.updateProjectionMatrix();
        };
        const observador = new ResizeObserver(enquadrar);
        observador.observe(el);
        enquadrar();

        const mouse = { x: 0, y: 0 };
        const aoMover = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          mouse.x = Math.max(-1.6, Math.min(1.6, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
          mouse.y = Math.max(-1.6, Math.min(1.6, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
        };
        window.addEventListener("pointermove", aoMover, { passive: true });

        // girar arrastando e zoom limitado
        let arrastando: number | null = null;
        const aoBaixar = (e: PointerEvent) => {
          arrastando = e.clientX;
          el.setPointerCapture(e.pointerId);
        };
        const aoArrastar = (e: PointerEvent) => {
          if (arrastando === null) return;
          controle.current.giro += (e.clientX - arrastando) * 0.012;
          arrastando = e.clientX;
        };
        const aoSoltar = () => (arrastando = null);
        const aoRolar = (e: WheelEvent) => {
          e.preventDefault();
          controle.current.zoom = Math.max(0.72, Math.min(1.25, controle.current.zoom + e.deltaY * 0.0012));
        };
        if (interativo) {
          el.addEventListener("pointerdown", aoBaixar);
          el.addEventListener("pointermove", aoArrastar);
          el.addEventListener("pointerup", aoSoltar);
          el.addEventListener("pointercancel", aoSoltar);
          el.addEventListener("wheel", aoRolar, { passive: false });
        }

        const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let raf = 0;
        const quadro = (agora: number) => {
          raf = requestAnimationFrame(quadro);
          const { humor: h, reacao: r, inicio } = estado.current;
          const salto = mascote.atualizar({ t: agora / 1000, humor: h, reacao: r?.tipo ?? null, p: (agora - inicio) / 1000, mouse: arrastando === null ? mouse : { x: 0, y: 0 }, calmo });
          sombra.scale.setScalar(1 - Math.min(0.5, salto * 0.5));
          sombra.position.x = mascote.raiz.position.x;
          palco.rotation.y = controle.current.giro;
          const d = distancia * controle.current.zoom;
          camera.position.set(0, alto / 2 + 0.25, d);
          camera.lookAt(0, alto / 2 - 0.02, 0);
          renderer.render(cena, camera);
        };
        raf = requestAnimationFrame(quadro);

        limpar = () => {
          cancelAnimationFrame(raf);
          observador.disconnect();
          window.removeEventListener("pointermove", aoMover);
          el.removeEventListener("pointerdown", aoBaixar);
          el.removeEventListener("pointermove", aoArrastar);
          el.removeEventListener("pointerup", aoSoltar);
          el.removeEventListener("pointercancel", aoSoltar);
          el.removeEventListener("wheel", aoRolar);
          mascote.descartar();
          modelo?.geo.dispose();
          modelo?.tex.dispose();
          geoSombra.dispose();
          matSombra.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });

    return () => {
      vivo = false;
      limpar();
    };
  }, [chave, interativo]);

  return (
    <div ref={caixa} className={cn("relative", interativo && "cursor-grab touch-none active:cursor-grabbing", className)} role="img" aria-label="HOSHI, o pet da HOST">
      {falhou && <span className="absolute inset-0 grid place-items-center text-7xl">🐶</span>}
    </div>
  );
}
