/**
 * Sons curtos da interface gerados com Web Audio (sem arquivos de áudio).
 * São discretos de propósito: um "toc" macio ao apertar, um sopro ao trocar
 * de página, duas notas quando algo dá certo. O usuário pode silenciar; a
 * preferência fica no localStorage.
 */
const KEY = "host-sfx-mudo";
let ctx: AudioContext | null = null;
let saida: AudioNode | null = null;

export function sfxMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean) {
  try {
    localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {
    /* sem storage: só não persiste */
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    // tudo passa por um filtro que tira o agudo "de plástico": os sons ficam mais macios
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 5200;
    filtro.connect(ctx.destination);
    saida = filtro;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, gain = 0.08, type: OscillatorType = "sine", endFreq?: number) {
  const ac = audio();
  if (!ac || !saida) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(saida);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Sopro de ar (ruído filtrado que sobe ou desce): usado na troca de página e nas janelas. */
function sopro(dur: number, de: number, ate: number, gain = 0.012) {
  const ac = audio();
  if (!ac || !saida) return;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const dados = buf.getChannelData(0);
  for (let i = 0; i < n; i++) dados[i] = Math.random() * 2 - 1;
  const fonte = ac.createBufferSource();
  fonte.buffer = buf;
  const faixa = ac.createBiquadFilter();
  faixa.type = "bandpass";
  faixa.Q.value = 0.9;
  faixa.frequency.setValueAtTime(de, ac.currentTime);
  faixa.frequency.exponentialRampToValueAtTime(ate, ac.currentTime + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  fonte.connect(faixa).connect(g).connect(saida);
  fonte.start();
}

export type Sfx = "check" | "uncheck" | "complete" | "add" | "remove" | "click" | "tap" | "hover" | "nav" | "open" | "close" | "toggle" | "success" | "error" | "pop" | "toc";

let ultimoToque = 0;
export function playSfx(kind: Sfx) {
  if (sfxMuted()) return;
  try {
    // um aperto só faz um som, mesmo que a tela e o botão peçam ao mesmo tempo
    if (kind === "tap" || kind === "click" || kind === "toggle") {
      const agora = performance.now();
      if (agora - ultimoToque < 70) return;
      ultimoToque = agora;
    }
    switch (kind) {
      case "tap":
      case "click":
        tone(220, 0, 0.055, 0.05, "sine", 150);
        tone(1500, 0, 0.012, 0.01, "triangle");
        break;
      case "hover":
        tone(2100, 0, 0.02, 0.007, "sine");
        break;
      case "nav":
        tone(330, 0, 0.11, 0.028, "sine", 520);
        tone(660, 0.05, 0.13, 0.016, "sine", 880);
        sopro(0.16, 700, 3000, 0.01);
        break;
      case "open":
        tone(392, 0, 0.12, 0.03, "sine", 587);
        tone(784, 0.04, 0.14, 0.016, "sine");
        sopro(0.14, 500, 2400, 0.008);
        break;
      case "close":
        tone(587, 0, 0.1, 0.026, "sine", 392);
        sopro(0.12, 2400, 500, 0.007);
        break;
      case "toggle":
        tone(740, 0, 0.05, 0.035, "triangle", 988);
        break;
      case "success":
        tone(659, 0, 0.09, 0.04, "sine");
        tone(988, 0.07, 0.18, 0.04, "sine");
        break;
      case "error":
        tone(196, 0, 0.16, 0.05, "triangle", 147);
        tone(185, 0.03, 0.16, 0.03, "sine");
        break;
      case "toc":
        // duas batidas secas, como na porta ("toc toc")
        for (const quando of [0, 0.17]) {
          tone(210, quando, 0.07, 0.11, "triangle", 120);
          tone(520, quando, 0.03, 0.05, "square", 260);
        }
        break;
      case "pop":
        tone(880, 0, 0.06, 0.03, "sine", 1320);
        break;
      case "check":
        tone(880, 0, 0.09, 0.06, "triangle", 1320);
        tone(1320, 0.05, 0.12, 0.045, "sine");
        break;
      case "uncheck":
        tone(520, 0, 0.1, 0.05, "triangle", 360);
        break;
      case "complete":
        [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.22, 0.055, "sine"));
        break;
      case "add":
        tone(660, 0, 0.08, 0.05, "sine", 990);
        break;
      case "remove":
        tone(300, 0, 0.12, 0.05, "sine", 180);
        break;
    }
  } catch {
    /* áudio indisponível */
  }
}

const CLICAVEL = "button, a[href], [role='tab'], [role='menuitem'], [role='option'], [role='radio'], [role='switch'], [role='checkbox'], summary, select, .pilula";
const JANELA = "[role='dialog'], [role='alertdialog'], .pf-modal";
/**
 * Liga os sons na interface inteira, sem precisar mexer em cada botão: aperto,
 * passar o mouse no menu, janelas abrindo e fechando. Devolve como desligar.
 */
export function instalarSonsDaInterface() {
  if (typeof document === "undefined") return () => undefined;
  const aoApertar = (e: PointerEvent) => {
    if (e.button !== 0 || !(e.target instanceof Element)) return;
    const el = e.target.closest(CLICAVEL);
    if (!el || el.closest("[data-sem-som]") || (el instanceof HTMLButtonElement && el.disabled)) return;
    playSfx(el.matches("[role='switch'], [role='checkbox']") ? "toggle" : "tap");
  };
  let sobre: Element | null = null;
  const aoPassar = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || !(e.target instanceof Element)) return;
    const el = e.target.closest("[data-som-passar]");
    if (el && el !== sobre) playSfx("hover");
    sobre = el;
  };
  const temJanela = (n: Node) => n instanceof Element && (n.matches(JANELA) || !!n.querySelector(JANELA));
  const obs = new MutationObserver((mudancas) => {
    let abriu = false;
    let fechou = false;
    for (const m of mudancas) {
      m.addedNodes.forEach((n) => (abriu ||= temJanela(n)));
      m.removedNodes.forEach((n) => (fechou ||= temJanela(n)));
    }
    if (abriu) playSfx("open");
    else if (fechou) playSfx("close");
  });
  // avisos (toasts) de sucesso e de erro também soam
  void import("sonner").then(({ toast }) => {
    const marca = toast as unknown as { __comSom?: boolean };
    if (marca.__comSom) return;
    marca.__comSom = true;
    const certo = toast.success.bind(toast);
    const errado = toast.error.bind(toast);
    toast.success = ((...a: Parameters<typeof toast.success>) => (playSfx("success"), certo(...a))) as typeof toast.success;
    toast.error = ((...a: Parameters<typeof toast.error>) => (playSfx("error"), errado(...a))) as typeof toast.error;
  });
  document.addEventListener("pointerdown", aoApertar, true);
  document.addEventListener("pointerover", aoPassar, true);
  obs.observe(document.body, { childList: true, subtree: true });
  return () => {
    document.removeEventListener("pointerdown", aoApertar, true);
    document.removeEventListener("pointerover", aoPassar, true);
    obs.disconnect();
  };
}
