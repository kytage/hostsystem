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

export type Sfx = "check" | "uncheck" | "complete" | "add" | "remove" | "click" | "tap" | "hover" | "nav" | "open" | "close" | "toggle" | "success" | "error" | "pop" | "toc"
  // eventos da praça do HOKI
  | "trovao" | "splash" | "fogos" | "explosao" | "aviao" | "tique" | "gelo" | "vitoria" | "apito" | "sino";

/**
 * Ruído filtrado com ataque e queda: a base do trovão, do mergulho, dos fogos e
 * da explosão. `tipo` é o filtro; a frequência vai de `de` até `ate`.
 */
function ruido(
  dur: number,
  tipo: BiquadFilterType,
  de: number,
  ate: number,
  gain: number,
  inicio = 0,
  ataque = 0.01,
) {
  const ac = audio();
  if (!ac || !saida) return;
  const t = ac.currentTime + inicio;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const dados = buf.getChannelData(0);
  for (let i = 0; i < n; i++) dados[i] = Math.random() * 2 - 1;
  const fonte = ac.createBufferSource();
  fonte.buffer = buf;
  const filtro = ac.createBiquadFilter();
  filtro.type = tipo;
  filtro.Q.value = 0.8;
  filtro.frequency.setValueAtTime(de, t);
  filtro.frequency.exponentialRampToValueAtTime(ate, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  fonte.connect(filtro).connect(g).connect(saida);
  fonte.start(t);
}

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
      case "trovao":
        // estalo seco e um ronco grave que rola por uns segundos
        ruido(0.35, "highpass", 3000, 900, 0.32, 0, 0.004);
        ruido(3.4, "lowpass", 900, 60, 0.42, 0.05, 0.06);
        ruido(2.6, "lowpass", 380, 50, 0.25, 0.9, 0.3);
        tone(55, 0.05, 2.2, 0.16, "sawtooth", 32);
        break;
      case "splash":
        ruido(0.55, "bandpass", 2600, 500, 0.2, 0, 0.005);
        ruido(0.9, "lowpass", 1400, 200, 0.12, 0.05);
        break;
      case "fogos":
        // assobio subindo e o estouro
        tone(900, 0, 0.5, 0.025, "sine", 2400);
        ruido(0.9, "lowpass", 2200, 90, 0.26, 0.55, 0.004);
        ruido(1.2, "highpass", 4000, 6000, 0.04, 0.62, 0.05);
        break;
      case "explosao":
        ruido(1.3, "lowpass", 1800, 50, 0.38, 0, 0.004);
        tone(90, 0, 0.8, 0.2, "sine", 30);
        break;
      case "aviao":
        // motor de hélice: zumbido grave com tremido, subindo
        for (let i = 0; i < 14; i++) tone(70 + i * 3, i * 0.18, 0.24, 0.05, "sawtooth", 76 + i * 3);
        ruido(2.6, "bandpass", 300, 900, 0.07, 0, 0.4);
        break;
      case "tique":
        tone(1300, 0, 0.04, 0.05, "square", 900);
        break;
      case "gelo":
        [2093, 2637, 3136, 2349].forEach((f, i) => tone(f, i * 0.045, 0.32, 0.03, "triangle"));
        ruido(0.4, "highpass", 5000, 8000, 0.05, 0, 0.01);
        break;
      case "vitoria":
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
          tone(f, i * 0.11, i === 5 ? 0.5 : 0.16, 0.06, "triangle"),
        );
        break;
      case "sino":
        // "dlim-dlom" de sino: duas batidas com o harmônico agudo que fica soando
        [0, 0.42].forEach((t, k) => {
          const f = k ? 1318 : 1568;
          tone(f, t, 1.1, 0.07, "sine");
          tone(f * 2.76, t, 0.5, 0.018, "sine");
          tone(f * 5.4, t, 0.18, 0.008, "sine");
        });
        break;
      case "apito":
        // "piuí" do trenzinho
        tone(1180, 0, 0.18, 0.05, "square", 1320);
        tone(1320, 0.22, 0.34, 0.05, "square", 1180);
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
