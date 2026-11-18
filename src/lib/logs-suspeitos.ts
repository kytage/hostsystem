/**
 * Logs: SUSPEITOS — quem matou 4 ou mais pessoas em 60 segundos. Os alertas são criados no banco
 * (gatilho em public.server_logs para o canal "players/death"); aqui só lemos e avisamos.
 */
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAcessoLogs } from "@/lib/logs-acesso";

export interface Suspeito {
  id: number;
  jogador_id: string;
  jogador_nome: string | null;
  kills: number;
  inicio: string;
  fim: string;
  logs: number[];
}

export const CHAVE_SUSPEITOS = ["server-log-suspeitos"];
/** A aba SUSPEITOS abre sozinha quando a pessoa chega pelo aviso. */
export const CHAVE_ABRIR_SUSPEITOS = "logs-abrir-suspeitos";

/** Os alertas dos últimos 7 dias, do mais novo para o mais antigo. */
export function useSuspeitos(ativo = true) {
  return useQuery({
    queryKey: CHAVE_SUSPEITOS,
    queryFn: async (): Promise<Suspeito[]> => {
      const desde = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("server_log_suspeitos")
        .select("id, jogador_id, jogador_nome, kills, inicio, fim, logs")
        .gte("fim", desde)
        .order("fim", { ascending: false })
        .limit(100);
      // (tabela ainda não criada no banco: nenhum alerta)
      if (error) return [];
      return (data ?? []) as Suspeito[];
    },
    enabled: ativo,
    staleTime: 15_000,
  });
}

/** Quantos segundos entre a primeira e a última kill do alerta. */
export const segundosDoAlerta = (s: Pick<Suspeito, "inicio" | "fim">) =>
  Math.max(1, Math.round((new Date(s.fim).getTime() - new Date(s.inicio).getTime()) / 1000));

/**
 * Aviso no painel inteiro: quem pode ver as mortes (categoria Player's) recebe uma notificação
 * na hora em que um suspeito aparece, com o botão para abrir a aba SUSPEITOS.
 */
export function useAvisoDeSuspeitos() {
  const acesso = useAcessoLogs();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const pode = !acesso.carregando && acesso.podeVer("players");
  const avisados = useRef(new Set<number>());

  useEffect(() => {
    if (!pode) return;
    const canal = supabase
      .channel(`suspeitos-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "server_log_suspeitos" },
        (e) => {
          void qc.invalidateQueries({ queryKey: CHAVE_SUSPEITOS });
          if (e.eventType !== "INSERT") return;
          const s = e.new as Suspeito;
          if (avisados.current.has(s.id)) return;
          avisados.current.add(s.id);
          toast.warning(`Suspeito: ${s.jogador_nome ?? "Jogador"} #${s.jogador_id}`, {
            description: `${s.kills} kills em ${segundosDoAlerta(s)} segundos.`,
            duration: 15_000,
            action: {
              label: "Ver logs",
              onClick: () => {
                try {
                  sessionStorage.setItem(CHAVE_ABRIR_SUSPEITOS, String(s.id));
                } catch {
                  // sem armazenamento: só abre a tela
                }
                void navegar({ to: "/logs" });
              },
            },
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [pode, qc, navegar]);
}
