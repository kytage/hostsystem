/**
 * Sons curtos da interface gerados com Web Audio (sem arquivos de áudio).
 * O usuário pode silenciar; a preferência fica no localStorage.
 */
const KEY = "host-sfx-mudo";
let ctx: AudioContext | null = null;

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
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, gain = 0.08, type: OscillatorType = "sine", endFreq?: number) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export type Sfx = "check" | "uncheck" | "complete" | "add" | "remove" | "click";

export function playSfx(kind: Sfx) {
  if (sfxMuted()) return;
  try {
    switch (kind) {
      case "check":
        tone(880, 0, 0.09, 0.07, "triangle", 1320);
        tone(1320, 0.05, 0.12, 0.05, "sine");
        break;
      case "uncheck":
        tone(520, 0, 0.1, 0.06, "triangle", 360);
        break;
      case "complete":
        [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.22, 0.06, "sine"));
        break;
      case "add":
        tone(660, 0, 0.08, 0.06, "sine", 990);
        break;
      case "remove":
        tone(300, 0, 0.12, 0.06, "sine", 180);
        break;
      case "click":
        tone(1200, 0, 0.035, 0.04, "square");
        break;
    }
  } catch {
    /* áudio indisponível */
  }
}
