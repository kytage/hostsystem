import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CANAL_REINICIO,
  conferirAvisoReinicio,
  EVENTO_REINICIO,
  reiniciarSite,
  SEGUNDOS_REINICIO,
  type AvisoReinicio,
} from "@/lib/reinicio.functions";

/**
 * Ouve o aviso de "reiniciar o site" e, quando chega um aviso válido, mostra a
 * contagem de 15 segundos e recarrega a página no fim (como um F5).
 * Fica montado em toda a área logada.
 */
export function OuvinteReinicio() {
  const [restam, setRestam] = useState<number | null>(null);
  const jaVistos = useRef(new Set<string>());

  useEffect(() => {
    const canal = supabase
      .channel(CANAL_REINICIO)
      .on("broadcast", { event: EVENTO_REINICIO }, async ({ payload }) => {
        const aviso = payload as AvisoReinicio;
        if (!aviso?.id || jaVistos.current.has(aviso.id)) return;
        jaVistos.current.add(aviso.id);
        try {
          const r = await conferirAvisoReinicio({ data: aviso });
          if (!r.valido) return;
        } catch {
          return;
        }
        setRestam(SEGUNDOS_REINICIO);
        toast("O site vai reiniciar", {
          description: `A página recarrega sozinha em ${SEGUNDOS_REINICIO} segundos.`,
          duration: SEGUNDOS_REINICIO * 1000,
        });
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          document.visibilityState !== "visible"
        ) {
          try {
            new Notification("HOST — o site vai reiniciar", {
              body: `A página recarrega sozinha em ${SEGUNDOS_REINICIO} segundos.`,
              tag: "host-reinicio",
            });
          } catch {
            /* sem aviso no computador */
          }
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, []);

  const ativo = restam !== null;
  useEffect(() => {
    if (!ativo) return;
    const fim = Date.now() + SEGUNDOS_REINICIO * 1000;
    const id = window.setInterval(() => {
      const falta = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
      setRestam(falta);
      if (falta <= 0) {
        window.clearInterval(id);
        window.location.reload();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [ativo]);

  if (restam === null) return null;
  const progresso = (restam / SEGUNDOS_REINICIO) * 100;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <div className="hc w-full max-w-sm p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-primary/40">
          <RotateCw className="size-5 text-primary" />
        </div>
        <h2 className="font-display text-lg font-semibold text-foreground">O site vai reiniciar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Salve o que estiver fazendo. A página recarrega sozinha em
        </p>
        <p className="my-4 font-display text-5xl font-bold tabular-nums text-foreground">{restam}</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-primary transition-[width] duration-200 ease-linear"
            style={{ width: `${progresso}%` }}
          />
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Recarregar agora
        </button>
      </div>
    </div>
  );
}

/** Botão da página Equipe (só FOUNDER; o servidor confere de novo). */
export function BotaoReiniciarSite() {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const disparar = async () => {
    setEnviando(true);
    try {
      await reiniciarSite();
      toast.success("Aviso enviado para todos os usuários logados.");
      setAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu para reiniciar o site.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="pilula rounded-full"
        title="Recarregar o site para todos os usuários logados"
      >
        <RotateCw className="size-4 text-primary" /> Reiniciar site
      </button>
      <AlertDialog open={aberto} onOpenChange={(v) => !enviando && setAberto(v)}>
        <AlertDialogContent className="rounded-[22px] sm:rounded-[22px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="hc-titulo">Reiniciar o site para todos?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os usuários logados vão ver um aviso e a página deles recarrega sozinha em{" "}
              {SEGUNDOS_REINICIO} segundos. A sua também.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={enviando}
              onClick={(e) => {
                e.preventDefault();
                void disparar();
              }}
            >
              {enviando ? <Loader2 className="size-4 animate-spin" /> : null}
              Reiniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
