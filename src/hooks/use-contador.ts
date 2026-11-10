import { useEffect, useRef, useState } from "react";

/**
 * Anima um número do valor que está na tela até o alvo, desacelerando no final.
 * Respeita quem pede menos movimento no sistema.
 */
export function useContador(alvo: number, duracao = 900): number {
  const [valor, setValor] = useState(0);
  const atual = useRef(0);

  useEffect(() => {
    const definir = (v: number) => {
      atual.current = v;
      setValor(v);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      definir(alvo);
      return;
    }
    let raf = 0;
    const de = atual.current;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const x = Math.min(1, (agora - inicio) / duracao);
      definir(de + (alvo - de) * (1 - Math.pow(1 - x, 4)));
      if (x < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracao]);

  return valor;
}
