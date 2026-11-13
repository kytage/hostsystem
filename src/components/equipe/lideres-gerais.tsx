import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, Loader2, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { ROLE_LABELS } from "@/lib/roles";
import { useMyRole } from "@/lib/permissions";
import { useRealtimeTable } from "@/lib/realtime";
import type { EquipeUser } from "@/lib/equipe-merge";

const CHAVE = ["area-grupo-lideres"] as const;
const TABELA = "area_grupo_lideres" as never;

/** Mapa grupo → ids dos líderes gerais. */
export type LideresGerais = Record<string, string[]>;

export function useLideresGerais() {
  useRealtimeTable("area_grupo_lideres", [[...CHAVE]]);
  return useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<LideresGerais> => {
      const { data, error } = await supabase.from(TABELA).select("grupo, user_id");
      if (error) throw error;
      const mapa: LideresGerais = {};
      for (const r of (data ?? []) as unknown as { grupo: string; user_id: string }[]) {
        (mapa[r.grupo] ??= []).push(r.user_id);
      }
      return mapa;
    },
    staleTime: 30_000,
  });
}

/** Founder, CEO e Diretor(a) editam os líderes gerais. */
export function usePodeEditarLideresGerais(): boolean {
  const { data: role } = useMyRole();
  return role === "founder" || role === "c_level" || role === "direcao";
}

export function LiderGeralBloco({
  grupo,
  rotulo,
  ids,
  membros,
  podeEditar,
}: {
  grupo: string;
  rotulo: string;
  ids: string[];
  membros: EquipeUser[];
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const lideres = ids.map((id) => membros.find((m) => m.id === id)).filter((m): m is EquipeUser => !!m);

  return (
    <>
      <div className="lider-geral relative w-[300px] overflow-hidden rounded-[22px] border border-amber-300/25 bg-gradient-to-b from-amber-300/[0.09] to-black/60 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200">
            <Crown className="coroa-brilho size-3.5 text-amber-300" strokeWidth={2} fill="currentColor" fillOpacity={0.25} />
            Líder geral
          </p>
          {podeEditar && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              title={`Editar líderes gerais de ${rotulo}`}
              className="hc-seta !size-6"
            >
              <Pencil className="size-3" />
            </button>
          )}
        </div>
        {lideres.length === 0 ? (
          <p className="mt-1.5 text-xs text-ink-3">Ninguém definido</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lideres.map((l) => (
              <span
                key={l.id}
                title={`${l.username} · ${ROLE_LABELS[l.role]}`}
                className="flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-black/40 py-0.5 pl-0.5 pr-2.5 text-[12px] font-medium"
              >
                <img src={l.avatar_url || DEFAULT_AVATAR_URL} alt="" draggable={false} className="size-5 rounded-full object-cover ring-1 ring-amber-300/50" />
                {l.username}
              </span>
            ))}
          </div>
        )}
      </div>
      {editando && (
        <EditorLideres grupo={grupo} rotulo={rotulo} atuais={ids} membros={membros} onClose={() => setEditando(false)} />
      )}
    </>
  );
}

function EditorLideres({
  grupo,
  rotulo,
  atuais,
  membros,
  onClose,
}: {
  grupo: string;
  rotulo: string;
  atuais: string[];
  membros: EquipeUser[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(atuais));
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return [...membros]
      .filter((m) => !q || m.username.toLowerCase().includes(q))
      .sort((a, b) => Number(marcados.has(b.id)) - Number(marcados.has(a.id)) || a.username.localeCompare(b.username));
    // a ordem só muda ao buscar, para a lista não "pular" ao marcar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membros, busca]);

  const salvar = useMutation({
    mutationFn: async () => {
      const novos = [...marcados].filter((id) => !atuais.includes(id));
      const saem = atuais.filter((id) => !marcados.has(id));
      if (saem.length) {
        const { error } = await supabase
          .from(TABELA)
          .delete()
          .eq("grupo" as never, grupo as never)
          .in("user_id" as never, saem as never);
        if (error) throw error;
      }
      if (novos.length) {
        const { error } = await supabase.from(TABELA).insert(novos.map((user_id) => ({ grupo, user_id })) as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CHAVE });
      toast.success(`Líderes gerais de ${rotulo} atualizados`);
      onClose();
    },
    onError: () => toast.error("Não foi possível salvar. Só Founder, CEO e Diretor(a) podem editar."),
  });

  const alternar = (id: string) =>
    setMarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return createPortal(
    <div className="pf-fade fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pf-modal glass-elevated flex max-h-[80vh] w-full max-w-md flex-col rounded-[22px]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200">
              <Crown className="coroa-brilho size-3.5 text-amber-300" fill="currentColor" fillOpacity={0.25} /> Líder geral
            </p>
            <h3 className="hc-titulo mt-1.5">{rotulo}</h3>
            <p className="hc-nota mt-0.5">Marque uma ou mais pessoas.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="hc-seta">
            <X className="size-3.5" />
          </button>
        </header>
        <div className="px-5 pt-4">
          <label className="campo-busca w-full">
            <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pessoa…"
              aria-label="Buscar pessoa"
            />
          </label>
        </div>
        <ul className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          {lista.map((m) => {
            const on = marcados.has(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => alternar(m.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                    on ? "bg-amber-300/[0.08]" : "hover:bg-white/[0.04]",
                  )}
                >
                  <img src={m.avatar_url || DEFAULT_AVATAR_URL} alt="" className="size-7 rounded-full object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.username}</span>
                    <span className="block text-[11px] text-ink-3">{ROLE_LABELS[m.role]}</span>
                  </span>
                  <span
                    className={cn(
                      "grid size-5 place-items-center rounded-md border transition-colors",
                      on ? "border-amber-300 bg-amber-300 text-black" : "border-white/20",
                    )}
                  >
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
          {lista.length === 0 && <li className="px-3 py-8 text-center text-xs text-ink-3">Ninguém encontrado.</li>}
        </ul>
        <footer className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4">
          <span className="text-xs text-muted-foreground">
            {marcados.size} selecionado{marcados.size === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            disabled={salvar.isPending}
            onClick={() => salvar.mutate()}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {salvar.isPending && <Loader2 className="size-3.5 animate-spin" />} Salvar
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
