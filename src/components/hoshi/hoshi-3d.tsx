import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { VISUAL_PADRAO, type Humor, type Visual } from "@/lib/hoshi";
import { criarMascote, type Reacao } from "./mascote";

export type { Reacao };

/**
 * Palco 3D do HOSHI. O mascote é criado do zero em ./mascote; aqui ficam a
 * câmera, as luzes, o chão e o laço de animação. A biblioteca 3D só é baixada
 * quando o pet aparece na tela.
 */
export function Hoshi3D({
  humor,
  reacao,
  visual = VISUAL_PADRAO,
  className,
}: {
  humor: Humor;
  reacao: { tipo: Reacao; n: number } | null;
  visual?: Visual;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const estado = useRef({ humor, reacao, inicio: 0 });
  const [falhou, setFalhou] = useState(false);
  // O mascote é refeito sempre que alguma parte do visual muda.
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

    void import("three")
      .then((THREE) => {
        if (!vivo) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        el.appendChild(renderer.domElement);
        renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

        const cena = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
        camera.position.set(0, 1.15, 5.4);
        camera.lookAt(0, 0.86, 0);

        cena.add(new THREE.HemisphereLight(0xffffff, 0x2a1414, 1.3));
        const sol = new THREE.DirectionalLight(0xffffff, 1.8);
        sol.position.set(2.5, 4, 3.5);
        cena.add(sol);
        const contraluz = new THREE.PointLight(0xff2a2a, 12, 12);
        contraluz.position.set(-2.4, 1.6, -2.2);
        cena.add(contraluz);

        const mascote = criarMascote(THREE, JSON.parse(chave) as Visual);
        cena.add(mascote.raiz);

        const geoSombra = new THREE.CircleGeometry(0.8, 40);
        const matSombra = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
        const sombra = new THREE.Mesh(geoSombra, matSombra);
        sombra.rotation.x = -Math.PI / 2;
        sombra.position.y = 0.005;
        cena.add(sombra);

        const mouse = { x: 0, y: 0 };
        const aoMover = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          mouse.x = Math.max(-1.6, Math.min(1.6, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
          mouse.y = Math.max(-1.6, Math.min(1.6, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
        };
        window.addEventListener("pointermove", aoMover, { passive: true });

        const ajustar = () => {
          const w = el.clientWidth || 1;
          const h = el.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        const observador = new ResizeObserver(ajustar);
        observador.observe(el);
        ajustar();

        const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let raf = 0;
        const quadro = (agora: number) => {
          raf = requestAnimationFrame(quadro);
          const { humor: h, reacao: r, inicio } = estado.current;
          const salto = mascote.atualizar({ t: agora / 1000, humor: h, reacao: r?.tipo ?? null, p: (agora - inicio) / 1000, mouse, calmo });
          sombra.scale.setScalar(1 - Math.min(0.5, salto * 0.45));
          sombra.position.x = mascote.raiz.position.x;
          renderer.render(cena, camera);
        };
        raf = requestAnimationFrame(quadro);

        limpar = () => {
          cancelAnimationFrame(raf);
          observador.disconnect();
          window.removeEventListener("pointermove", aoMover);
          mascote.descartar();
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
  }, [chave]);

  return (
    <div ref={caixa} className={cn("relative", className)} role="img" aria-label="HOSHI, o pet da HOST">
      {falhou && <span className="absolute inset-0 grid place-items-center text-7xl">🐶</span>}
    </div>
  );
}
