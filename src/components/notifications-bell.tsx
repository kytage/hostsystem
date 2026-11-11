import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";
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

      {aberto && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Fechar notificações"
            onClick={() => setAberto(false)}
          />
          <div
            className="fixed z-50 w-96 overflow-hidden rounded-2xl glass-modal shadow-black/60"
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Notificações</p>
              <div className="flex items-center gap-1">
                {naoLidas > 0 && (
                  <button
                    onClick={() => marcar.mutate()}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="size-3.5" /> Lidas
                  </button>
                )}
                {temLidas && (
                  <button
                    onClick={() => limpar.mutate()}
                    disabled={limpar.isPending}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Limpar notificações lidas"
                  >
                    <Trash2 className="size-3.5" /> Limpar
                  </button>
                )}
              </div>
            </div>
            <div className="scrollbar-thin max-h-[70vh] overflow-y-auto">
              {notificacoes.length === 0 && (
                <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                  <Loader2 className="size-4" /> Nenhuma notificação.
                </p>
              )}
              {notificacoes.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "border-b border-border/50 px-4 py-3.5 text-[13px] leading-relaxed last:border-0",
                    n.lida ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {!n.lida && (
                    <span className="mb-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />
                  )}
                  <p className={cn(!n.lida && "ml-3 -mt-4")}>{n.texto}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                    {fmtDataHora(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
