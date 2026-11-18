import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, NotebookPen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUserData } from "@/lib/auth-cache";
import { roleRank } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Anotações sobre cada staff (observações, conversas, avisos): só Coordinator e acima leem e
 * escrevem (public.staff_anotacoes). Quem escreveu, ou o Founder, pode apagar.
 */

export interface StaffAnotacao {
  id: number;
  staff_id: string;
  autor_id: string | null;
  autor_nome: string | null;
  texto: string;
  criado_em: string;
}

export const podeAnotar = (role: string | null | undefined) =>
  !!role && roleRank(role) <= roleRank("coordinator");

const CHAVE = ["staff-anotacoes"];

/** Todas as anotações (a lista da equipe mostra quantas cada um tem). */
export function useStaffAnotacoes(ativo: boolean) {
  return useQuery({
    queryKey: CHAVE,
    enabled: ativo,
    queryFn: async (): Promise<StaffAnotacao[]> => {
      const { data, error } = await supabase
        .from("staff_anotacoes")
        .select("id, staff_id, autor_id, autor_nome, texto, criado_em")
        .order("criado_em", { ascending: false });
      // (tabela ainda não criada no banco: nenhuma anotação)
      if (error) return [];
      return (data ?? []) as StaffAnotacao[];
    },
    staleTime: 30_000,
  });
}

/** O botão de caderno ao lado do ID: abre as anotações daquele staff. */
export function BotaoAnotacoes({
  staffId,
  staffNome,
  anotacoes,
  souFounder,
}: {
  staffId: string;
  staffNome: string;
  anotacoes: StaffAnotacao[];
  souFounder: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const minhas = anotacoes.filter((a) => a.staff_id === staffId);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={cn("staff-anotar", minhas.length > 0 && "staff-anotar-tem")}
        title={minhas.length ? `${minhas.length} anotação(ões)` : "Adicionar anotação"}
        aria-label={`Anotações de ${staffNome}`}
      >
        <NotebookPen className="size-3.5" strokeWidth={1.75} />
        {minhas.length > 0 && <span>{minhas.length}</span>}
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Anotações · {staffNome}</DialogTitle>
          </DialogHeader>
          <PainelAnotacoes staffId={staffId} lista={minhas} souFounder={souFounder} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function PainelAnotacoes({
  staffId,
  lista,
  souFounder,
}: {
  staffId: string;
  lista: StaffAnotacao[];
  souFounder: boolean;
}) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const { data: eu } = useQuery({
    queryKey: ["chat-me"],
    queryFn: async () => (await getAuthUserData()).user?.id ?? null,
  });

  const salvar = useMutation({
    mutationFn: async (t: string) => {
      const auth = await getAuthUserData();
      if (!auth.user) throw new Error("Sem login");
      const { data: p } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", auth.user.id)
        .maybeSingle();
      const { error } = await supabase.from("staff_anotacoes").insert({
        staff_id: staffId,
        autor_id: auth.user.id,
        autor_nome: p?.username ?? null,
        texto: t,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTexto("");
      void qc.invalidateQueries({ queryKey: CHAVE });
    },
    onError: () => toast.error("Não deu para salvar a anotação."),
  });

  const apagar = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("staff_anotacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: CHAVE }),
    onError: () => toast.error("Não deu para apagar."),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="Escreva uma observação sobre este staff…"
          className="w-full resize-none rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus:border-white/25"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && texto.trim())
              salvar.mutate(texto.trim());
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="hc-nota">Só Coordinator e acima veem.</span>
          <button
            type="button"
            className="hc-pilula"
            disabled={!texto.trim() || salvar.isPending}
            onClick={() => salvar.mutate(texto.trim())}
          >
            {salvar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Salvar anotação
          </button>
        </div>
      </div>
      <div className="scrollbar-thin flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
        {lista.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-white/10 p-6 text-center text-xs text-muted-foreground">
            Nenhuma anotação ainda.
          </p>
        ) : (
          lista.map((a) => (
            <div key={a.id} className="rounded-[14px] bg-white/[0.04] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold">{a.autor_nome ?? "—"}</span>
                <span className="hc-nota">
                  {new Date(a.criado_em).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {(a.autor_id === eu || souFounder) && (
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    title="Apagar anotação"
                    onClick={() => apagar.mutate(a.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-[13px]">{a.texto}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
