import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useMyRole } from "@/lib/permissions";
import {
  salvarTokenBotAntiCheat,
  sincronizarAntiCheat,
  statusBotAntiCheat,
  verificarAcessoBot,
} from "@/lib/anticheat-discord.functions";

const A_CADA_MS = 30_000;

/**
 * Enquanto /logs está aberto, pede ao site para ler os canais do Anti-Cheat no Discord (bot).
 * O Founder vê o botão "Bot Anti-Cheat" para colocar/trocar o token.
 */
export function AntiCheatBot({ ativo }: { ativo: boolean }) {
  const { data: role } = useMyRole();
  const queryClient = useQueryClient();
  const isFounder = role === "founder";
  const [aberto, setAberto] = useState(false);
  const rodando = useRef(false);

  const status = useQuery({
    queryKey: ["anticheat-bot-status"],
    queryFn: () => statusBotAntiCheat(),
    enabled: isFounder,
  });

  useEffect(() => {
    if (!ativo) return;
    const rodar = async () => {
      if (rodando.current || document.visibilityState !== "visible") return;
      rodando.current = true;
      try {
        const r = await sincronizarAntiCheat();
        if (r.ok && "novas" in r && r.novas > 0) {
          void queryClient.invalidateQueries({ queryKey: ["server-logs"] });
          void queryClient.invalidateQueries({ queryKey: ["server-logs-resumo"] });
        }
      } catch {
        // sem rede ou Discord fora: tenta de novo na próxima volta
      } finally {
        rodando.current = false;
      }
    };
    void rodar();
    const t = setInterval(() => void rodar(), A_CADA_MS);
    return () => clearInterval(t);
  }, [ativo, queryClient]);

  if (!isFounder) return null;
  const configurado = status.data?.configurado;

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className={cn("pilula flex items-center gap-1.5 rounded-full")}
        title="Bot que copia as logs do Anti-Cheat do Discord para o site"
      >
        <Bot className="size-3.5" />
        Bot Anti-Cheat
        <span
          className={cn(
            "size-1.5 rounded-full",
            configurado ? "bg-success" : configurado === false ? "bg-destructive" : "bg-white/30",
          )}
        />
      </button>
      {aberto && <ModalToken configurado={!!configurado} onClose={() => setAberto(false)} />}
    </>
  );
}

/** Lista os canais que o bot ainda não consegue ler (falta liberar no Discord). */
function AcessoDoBot() {
  const acesso = useQuery({ queryKey: ["bot-acesso"], queryFn: () => verificarAcessoBot(), staleTime: 0 });
  if (acesso.isLoading)
    return (
      <p className="mt-3 flex items-center gap-2 text-[12px] text-ink-3">
        <Loader2 className="size-3.5 animate-spin" /> Testando o acesso aos canais...
      </p>
    );
  if (!acesso.data) return null;
  const { total, semAcesso } = acesso.data;
  return (
    <div
      className={cn(
        "mt-3 rounded-xl px-3 py-2 text-[12px]",
        semAcesso.length ? "bg-orange-500/10 text-orange-200" : "bg-emerald-500/10 text-emerald-200",
      )}
      data-bot-acesso
    >
      {semAcesso.length === 0 ? (
        <>O bot lê todos os {total} canais.</>
      ) : (
        <>
          <b>
            Sem acesso em {semAcesso.length} de {total} canais
          </b>{" "}
          — no Discord, dê ao cargo “HOST Logs Anti-Cheat” acesso a:
          <span className="mt-1 block font-mono text-[11px] leading-relaxed text-orange-100/80">
            {semAcesso.map((c) => `#${c}`).join("  ")}
          </span>
        </>
      )}
    </div>
  );
}

function ModalToken({ configurado, onClose }: { configurado: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const salvar = useMutation({
    mutationFn: () => salvarTokenBotAntiCheat({ data: { token: token.trim() } }),
    onSuccess: (r) => {
      toast.success(`Bot ${r.bot} conectado. As logs do Anti-Cheat começam a chegar em até 30s.`);
      void queryClient.invalidateQueries({ queryKey: ["anticheat-bot-status"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[22px] glass-modal p-5">
        <header className="flex items-center justify-between">
          <h3 className="hc-titulo">Bot do Anti-Cheat</h3>
          <button onClick={onClose} className="hc-seta">
            <X className="size-4" />
          </button>
        </header>
        <p className="hc-nota mt-2">
          {configurado
            ? "O bot já está conectado. Cole um token novo só se quiser trocar."
            : "Cole o token do bot do Discord. Ele só lê os canais do Anti-Cheat e dos scripts protegidos."}
        </p>
        {configurado && <AcessoDoBot />}
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Token do bot"
          autoComplete="off"
          className="mt-4 w-full rounded-xl glass-inset px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="pilula rounded-full">
            Cancelar
          </button>
          <button
            onClick={() => salvar.mutate()}
            disabled={token.trim().length < 50 || salvar.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {salvar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Conectar
          </button>
        </div>
      </div>
    </div>
  );
}
