import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Quanto dura a contagem (regra da skill de design: 1 segundo, uma vez). */
const DURACAO = 1000;

/**
 * Só números puros contam: "128", "1.280", "37%". Dinheiro, datas, horas e frações ("R$ 12,50",
 * "3/10", "12:30") ficam como estão: um preço rolando parece um preço mudando.
 */
const NUMERO = /^(\d{1,3}(?:\.\d{3})+|\d+)(%?)$/;

function ler(valor: ReactNode) {
  if (typeof valor === "number")
    return Number.isInteger(valor) && valor >= 0 ? { n: valor, milhar: false, sufixo: "" } : null;
  if (typeof valor !== "string") return null;
  const m = NUMERO.exec(valor.trim());
  if (!m) return null;
  const inteiro = m[1] ?? "";
  return {
    n: Number(inteiro.replace(/\./g, "")),
    milhar: inteiro.includes("."),
    sufixo: m[2] ?? "",
  };
}

/**
 * O número de um quadro (`<Indice>`) contando de zero até o valor, uma vez, quando ele chega.
 * Depois disso, se o valor mudar, o número novo só aparece (sem contar de novo). Com "reduzir
 * movimento" ligado no sistema, o valor aparece direto.
 */
export function Contagem({ valor }: { valor: ReactNode }) {
  const lido = ler(valor);
  const alvo = lido ? lido.n : null;
  // null = mostra o valor como veio; um número = a contagem está nele
  const [mostra, setMostra] = useState<number | null>(() => (alvo !== null && alvo > 0 ? 0 : null));
  /** Já contou até o fim uma vez (não conta de novo). */
  const contou = useRef(false);
  /** O último número mostrado: se o valor mudar no meio da contagem, ela segue dali. */
  const daqui = useRef(0);

  useLayoutEffect(() => {
    if (alvo === null || alvo <= 0) {
      setMostra(null);
      return;
    }
    if (contou.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      contou.current = true;
      setMostra(null);
      return;
    }
    const de = daqui.current;
    setMostra(de);
    let quadro = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - inicio) / DURACAO);
      if (p >= 1) {
        contou.current = true;
        daqui.current = alvo;
        setMostra(null);
        return;
      }
      // sai rápido e pousa macio, sem passar do valor
      daqui.current = de + (alvo - de) * (1 - Math.pow(1 - p, 4));
      setMostra(daqui.current);
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo]);

  if (!lido || mostra === null) return <>{valor}</>;
  const n = Math.round(mostra);
  return <>{(lido.milhar ? n.toLocaleString("pt-BR") : String(n)) + lido.sufixo}</>;
}
