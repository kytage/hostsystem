// Som "plim" de notificação para cutucadas — gerado via Web Audio API (sem assets).
let audioCtx: AudioContext | null = null;

export function playPlim(): void {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const now = audioCtx.currentTime;

    // Dois toques curtos tipo "plim-plim"
    [0, 0.18].forEach((offset, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(i === 0 ? 987.77 : 1318.51, now + offset); // B5 -> E6
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.4);
    });
  } catch {
    // Áudio bloqueado pelo navegador — ignora silenciosamente
  }
}

export interface CutucadaPayload {
  de: string;
  para: string; // username de destino
}
