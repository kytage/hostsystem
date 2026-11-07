import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyAreas, ROLE_ORDER, useMyRole } from "@/lib/permissions";

/** Bipe curto gerado via WebAudio — evita depender de arquivo de áudio. */
function tocarBipe(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + start + dur
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.02);
    };
    beep(880, 0, 0.16);
    beep(1174, 0.18, 0.2);
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // navegador bloqueou o áudio — o toast já cobre o aviso
  }
}

/**
 * Notifica (toast + notificação nativa + som) os integrantes da área Ilegal
 * quando um Coordinator+ publica um novo aviso do Ilegal.
 */
export function useIlegalAvisoNotify(): void {
  const { data: areas } = useMyAreas();
  const { data: role } = useMyRole();

  // Quem faz parte do Ilegal: possui a área, ou é Coordinator+ (visão geral).
  const habilitado =
    (areas?.includes("ilegal") ?? false) ||
    ROLE_ORDER.indexOf(role ?? "staff") <= ROLE_ORDER.indexOf("coordinator");

  const pedido = useRef(false);

  useEffect(() => {
    if (!habilitado || pedido.current) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    pedido.current = true;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [habilitado]);

  useEffect(() => {
    if (!habilitado) return;

    const channel = supabase
      .channel(`ilegal-avisos-notify-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ilegal_avisos" },
        (payload) => {
          const row = payload.new as { titulo?: string; criado_por?: string };
          const titulo = "Novo aviso do Ilegal";
          const corpo = `${row.titulo ?? ""}${
            row.criado_por ? ` — por ${row.criado_por}` : ""
          }`.trim();

          tocarBipe();
          toast(titulo, { description: corpo, duration: 8000 });

          try {
            if (
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              const n = new Notification(titulo, { body: corpo });
              n.onclick = () => {
                window.focus();
                window.location.assign("/ilegal");
              };
            }
          } catch {
            // sem suporte / bloqueado — toast já exibido
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [habilitado]);
}
