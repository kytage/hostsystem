import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import { fetchCards, fetchDevs, fetchPatchNotes, fetchProfilesBasic, getCurrentUsername } from "@/lib/kanban";
import { fetchDevTasks } from "@/lib/dev-tasks";
import { fetchCategorias } from "@/lib/ilegal-data";
import { fetchIlegalAvisos } from "@/lib/ilegal-avisos";
import { fetchCronograma } from "@/lib/ilegal-cronograma";
import { fetchAnotacoesIlegal } from "@/lib/ilegal-anotacoes";
import { fetchPendenciasArea, fetchSolicitacoesAdmin } from "@/lib/area-manager";
import { fetchEventos } from "@/lib/eventos";
import { fetchAvisos } from "@/lib/avisos";
import { fetchTarefas, fetchAnotacao } from "@/lib/tarefas";

type Prefetcher = (qc: QueryClient) => void;

const warm = (qc: QueryClient, key: unknown[], fn: () => Promise<unknown>) =>
  void qc.prefetchQuery({ queryKey: key, queryFn: fn, staleTime: 60_000 });

/**
 * Dados principais de cada aba. Ao passar o mouse no menu já buscamos o
 * conteúdo, então ao clicar a página abre com o cache pronto (sem spinner).
 */
const ROUTE_PREFETCH: Record<string, Prefetcher> = {
  "/desenvolvimento": (qc) => {
    warm(qc, ["kanban-cards"], () => fetchCards(false));
    warm(qc, ["kanban-devs"], fetchDevs);
    warm(qc, ["patch-notes"], fetchPatchNotes);
    warm(qc, ["kanban-profiles-basic"], fetchProfilesBasic);
    warm(qc, ["my-username-kanban"], getCurrentUsername);
    warm(qc, ["dev-tasks"], fetchDevTasks);
  },
  "/ilegal": (qc) => {
    warm(qc, ["ilegal-orgs"], fetchCategorias);
    warm(qc, ["ilegal-avisos"], fetchIlegalAvisos);
    warm(qc, ["ilegal-cronograma"], fetchCronograma);
    warm(qc, ["ilegal-anotacoes"], fetchAnotacoesIlegal);
  },
  "/area-manager": (qc) => {
    warm(qc, ["pendencias-area"], fetchPendenciasArea);
    warm(qc, ["solicitacoes-admin"], fetchSolicitacoesAdmin);
  },
  "/eventos": (qc) => warm(qc, ["eventos"], fetchEventos),
  "/avisos": (qc) => warm(qc, ["avisos"], fetchAvisos),
  "/perfil": (qc) => {
    warm(qc, ["tarefas-particulares"], fetchTarefas);
    warm(qc, ["anotacoes"], fetchAnotacao);
  },
  "/": (qc) => {
    warm(qc, ["eventos"], fetchEventos);
    warm(qc, ["dev-tasks"], fetchDevTasks);
  },
};

/** Handlers para pré-aquecer o cache da rota no hover/foco do link. */
export function usePrefetchRoute(url: string | undefined) {
  const qc = useQueryClient();
  const run = useCallback(() => {
    if (!url) return;
    ROUTE_PREFETCH[url]?.(qc);
  }, [url, qc]);

  return { onMouseEnter: run, onFocus: run };
}
