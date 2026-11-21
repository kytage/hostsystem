import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Janela de coalescing: rajadas de eventos viram uma única atualização. */
const COALESCE_MS = 120;

/**
 * Tabelas que mudam o tempo todo (o servidor FiveM escreve nelas sem parar): no máximo uma
 * atualização a cada X ms. Sem isso, cada log nova fazia toda aba aberta na tela de Logs buscar a
 * lista inteira de novo (dezenas de vezes por minuto, por pessoa).
 */
const INTERVALO_MINIMO: Record<string, number> = {
  server_logs: 15_000,
  players: 30_000,
};

/** A aba está sendo vista? (aba escondida não busca nada; atualiza quando a pessoa voltar) */
const abaVisivel = () => typeof document === "undefined" || document.visibilityState === "visible";

/**
 * Assina mudanças em tempo real de uma tabela e invalida as queries
 * relacionadas, mantendo todos os usuários sincronizados.
 *
 * Eventos em rajada (arrastar vários cards, arquivamento em lote) são
 * agrupados em uma única invalidação para reduzir requisições.
 */
export function useRealtimeTable(table: string, queryKeys: string[][]) {
  const queryClient = useQueryClient();
  const keysRef = useRef(queryKeys);
  keysRef.current = queryKeys;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // chegou mudança enquanto a aba estava escondida: atualiza quando ela voltar a aparecer
    let pendente = false;
    let ultima = 0;
    const espera = INTERVALO_MINIMO[table] ?? COALESCE_MS;

    const flush = () => {
      timer = null;
      if (!abaVisivel()) {
        pendente = true;
        return;
      }
      pendente = false;
      ultima = Date.now();
      for (const key of keysRef.current) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };

    const agendar = () => {
      if (timer) return;
      // tabelas agitadas: espera o que falta para completar o intervalo mínimo
      const falta = Math.max(COALESCE_MS, espera - (Date.now() - ultima));
      timer = setTimeout(flush, falta);
    };

    const aoVoltar = () => {
      if (pendente && abaVisivel()) agendar();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    // Nome único por instância: canais Supabase são reutilizados por tópico,
    // e reusar o mesmo nome em dois componentes lança
    // "cannot add postgres_changes callbacks after subscribe()".
    const topic = `realtime-${table}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(topic)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (!abaVisivel()) {
          pendente = true;
          return;
        }
        agendar();
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, queryClient]);
}

interface RowSyncOptions<TRow, TItem> {
  /** Tabela do Postgres a observar. */
  table: string;
  /** Chave da query cujo cache (array de itens) será atualizado. */
  queryKey: string[];
  /** Converte a linha crua do Postgres no formato usado pela UI. */
  mapRow: (row: TRow) => TItem;
  /** `false` remove a linha da lista (ex.: card arquivado). */
  belongs?: (row: TRow) => boolean;
  /** Ordenação aplicada após o patch. */
  sort?: (a: TItem, b: TItem) => number;
  /** Chaves extras invalidadas (contadores, rankings) com coalescing. */
  alsoInvalidate?: string[][];
}

/**
 * Sincronização em tempo real de baixa latência: aplica o payload do evento
 * diretamente no cache do React Query, sem refetch da lista inteira.
 *
 * Reduz "1 evento = 1 requisição" para "1 evento = 0 requisição", eliminando
 * o atraso em que dois devs viam estados diferentes do mesmo card.
 */
export function useRealtimeRowSync<TRow extends { id: string }, TItem extends { id: string }>(
  options: RowSyncOptions<TRow, TItem>
) {
  const queryClient = useQueryClient();
  const optsRef = useRef(options);
  optsRef.current = options;
  const { table, queryKey } = options;
  const queryKeyId = queryKey.join("|");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleExtras = () => {
      const extras = optsRef.current.alsoInvalidate;
      if (!extras || extras.length === 0 || timer) return;
      timer = setTimeout(() => {
        timer = null;
        for (const key of optsRef.current.alsoInvalidate ?? []) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }, COALESCE_MS);
    };

    const key = queryKeyId.split("|");
    const topic = `rowsync-${table}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          const { mapRow, belongs, sort } = optsRef.current;

          queryClient.setQueryData<TItem[]>(key, (old) => {
            if (!old) return old; // sem cache ainda: o loader/query cuidará
            const oldRow = payload.old as Partial<TRow> | null;
            const newRow = payload.new as TRow | null;

            if (payload.eventType === "DELETE") {
              const id = oldRow?.id;
              return id ? old.filter((i) => i.id !== id) : old;
            }

            if (!newRow?.id) return old;

            // Linha saiu do escopo da lista (ex.: arquivada).
            if (belongs && !belongs(newRow)) {
              return old.filter((i) => i.id !== newRow.id);
            }

            let item: TItem;
            try {
              item = mapRow(newRow);
            } catch {
              // Payload inesperado: cai para refetch em vez de corromper a UI.
              void queryClient.invalidateQueries({ queryKey: key });
              return old;
            }

            const idx = old.findIndex((i) => i.id === item.id);
            const next = idx >= 0 ? old.map((i, n) => (n === idx ? item : i)) : [...old, item];
            return sort ? [...next].sort(sort) : next;
          });

          scheduleExtras();
        }
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, queryKeyId, queryClient]);
}
