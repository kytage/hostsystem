import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchNotificacoes,
  fmtDataHora,
  limparNotificacoesLidas,
  marcarNotificacoesLidas,
} from "@/lib/kanban";
import { useRealtimeTable } from "@/lib/realtime";

export function NotificationsBell() {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({
    left: 0,
    top: 0,
  });
  const btnRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  useRealtimeTable("notificacoes", [["notificacoes"]]);

  const { data: notificacoes = [] } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: fetchNotificacoes,
  });

  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  const temLidas = notificacoes.some((n) => n.lida);

  const marcar = useMutation({
    mutationFn: marcarNotificacoesLidas,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const limpar = useMutation({
    mutationFn: limparNotificacoesLidas,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto]);

  const abrir = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      // no menu lateral o painel abre ao lado do botão; embaixo da tela, abre para cima
      const aoLado = rect.left < 300;
      const left = aoLado
        ? rect.right + 16
        : Math.max(8, Math.min(rect.left, window.innerWidth - 400));
      setPos(
        rect.top > window.innerHeight / 2
          ? { left, bottom: Math.max(12, window.innerHeight - rect.bottom) }
          : { left, top: rect.bottom + 10 },
      );
    }
    setAberto((v) => !v);
    if (!aberto && naoLidas > 0) marcar.mutate();
  };

  return (
    <div>
      <button
        ref={btnRef}
        onClick={abrir}
        aria-label="Notificações"
        title="Notificações"
        data-sem-elastico
        className="relative grid size-8 shrink-0 place-items-center rounded-[10px] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
      >
        <Bell className="size-[15px]" strokeWidth={1.6} />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-[15px] items-center justify-center rounded-full bg-[#e5231b] text-[8.5px] font-semibold text-white shadow-[0_0_10px_rgba(229,35,27,0.7)]">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto &&
        createPortal(
          <>
            <button
              className="fixed inset-0 z-[89] cursor-default"
              aria-label="Fechar notificações"
              onClick={() => setAberto(false)}
            />
            <div
              className="fixed z-[90] w-[min(24rem,calc(100vw-16px))] overflow-hidden rounded-[22px] glass-modal shadow-black/60"
              style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                <p className="hc-titulo">Notificações</p>
                <div className="flex items-center gap-1.5">
                  {naoLidas > 0 && (
                    <button
                      onClick={() => marcar.mutate()}
                      className="hc-pilula"
                      title="Marcar todas como lidas"
                    >
                      <CheckCheck className="size-3.5" /> Lidas
                    </button>
                  )}
                  {temLidas && (
                    <button
                      onClick={() => limpar.mutate()}
                      disabled={limpar.isPending}
                      className="hc-pilula hover:!bg-destructive/15 hover:!text-destructive disabled:opacity-50"
                      title="Limpar notificações lidas"
                    >
                      <Trash2 className="size-3.5" /> Limpar
                    </button>
                  )}
                </div>
              </div>
              <div className="scrollbar-thin max-h-[min(70vh,calc(100dvh-90px))] overflow-y-auto">
                {notificacoes.length === 0 && (
                  <p className="m-4 flex items-center justify-center gap-2 rounded-[14px] border border-dashed border-white/[0.1] px-4 py-8 text-sm text-muted-foreground">
                    <BellOff className="size-4" strokeWidth={1.75} /> Nenhuma notificação.
                  </p>
                )}
                {notificacoes.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "border-b border-white/[0.06] px-4 py-3.5 text-[13px] leading-relaxed last:border-0",
                      n.lida ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    <div className="flex gap-2.5">
                      <span
                        className={cn(
                          "mt-[7px] size-1.5 shrink-0 rounded-full",
                          n.lida ? "bg-transparent" : "bg-primary",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-line break-words">{n.texto}</p>
                        <p className="mt-1.5 text-[11px] text-ink-3">{fmtDataHora(n.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>,
          // fora do menu lateral: lá dentro o painel ficava cortado e preso atrás da página
          document.body,
        )}
    </div>
  );
}
