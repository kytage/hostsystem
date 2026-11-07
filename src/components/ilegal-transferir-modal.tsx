import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategorias, type IlegalOrg } from "@/lib/ilegal-data";
import { cn } from "@/lib/utils";

interface IlegalTransferirModalProps {
  org: IlegalOrg;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Transfere a facção para outra setagem: leva organização, status, contatos,
 * VIP FAC, denúncias, VAR, coroas e cronograma. A setagem de origem fica Livre.
 */
export function IlegalTransferirModal({ org, onClose, onDone }: IlegalTransferirModalProps) {
  const queryClient = useQueryClient();
  const [destino, setDestino] = useState("");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const { data: categorias = [] } = useQuery({
    queryKey: ["ilegal-orgs"],
    queryFn: fetchCategorias,
  });

  const opcoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return categorias
      .flatMap((c) => c.orgs)
      .filter((o) => o.id !== org.id && o.setagem)
      .filter(
        (o) =>
          !q ||
          o.setagem.toLowerCase().includes(q) ||
          o.organizacao.toLowerCase().includes(q)
      );
  }, [categorias, busca, org.id]);

  const alvo = opcoes.find((o) => o.id === destino);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("ilegal_transferir_org", {
        _origem: org.id,
        _destino: destino,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ilegal-orgs"] });
      void queryClient.invalidateQueries({ queryKey: ["ilegal-detalhes"] });
      void queryClient.invalidateQueries({ queryKey: ["punicoes-setagem"] });
      void queryClient.invalidateQueries({ queryKey: ["punicoes"] });
      void queryClient.invalidateQueries({ queryKey: ["ilegal-coroas"] });
      onDone();
    },
    onError: (e) => setErro(e instanceof Error ? e.message : "Falha ao transferir."),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-primary/40 glass p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground font-display">
              <ArrowRightLeft className="size-5 text-primary" /> Transferir
            </h2>
            <p className="text-xs text-muted-foreground">
              {org.setagem}
              {org.organizacao ? ` · ${org.organizacao}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-4 rounded-xl glass-inset p-3 text-xs text-foreground">
          Leva organização, status, contatos, VIP FAC, denúncias, VAR, coroas e cronograma para
          o novo set, sem perder histórico. <b>{org.setagem}</b> fica Livre. O online continua
          registrado por set, como o jogo envia.
        </p>

        <input
          className="mt-4 w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
          placeholder="Buscar setagem..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="mt-2 grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
          {opcoes.map((o) => (
            <button
              key={o.id}
              onClick={() => setDestino(o.id)}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-left text-xs transition-colors",
                destino === o.id
                  ? "border-white/15 bg-white/[0.07] text-foreground"
                  : "border-border hover:bg-white/[0.08]"
              )}
            >
              <span className="block font-semibold">{o.setagem}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {o.organizacao || o.status}
              </span>
            </button>
          ))}
        </div>

        {alvo && alvo.organizacao && (
          <p className="mt-3 text-xs font-semibold text-warning">
            {alvo.setagem} já tem "{alvo.organizacao}" — será substituída.
          </p>
        )}
        {erro && <p className="mt-3 text-xs font-semibold text-primary">{erro}</p>}

        {confirmando && alvo && (
          <div className="mt-4 rounded-xl border border-warning/50 bg-warning/10 p-4">
            <p className="text-sm font-semibold text-foreground">
              Confirmar transferência de {org.setagem} para {alvo.setagem}?
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              <li>Organização, status, contatos, CDS e VIP FAC vão para {alvo.setagem}.</li>
              <li>Todo o histórico de online, denúncias, VAR, coroas e cronograma acompanha a facção.</li>
              <li>{org.setagem} fica Livre e herda o histórico que era de {alvo.setagem}.</li>
              {alvo.organizacao && (
                <li className="font-semibold text-warning">
                  "{alvo.organizacao}" sai de {alvo.setagem} (o set fica com a facção transferida).
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={confirmando ? () => setConfirmando(false) : onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-white/[0.08]"
          >
            {confirmando ? "Voltar" : "Cancelar"}
          </button>
          <button
            onClick={() => (confirmando ? mutation.mutate() : setConfirmando(true))}
            disabled={!destino || mutation.isPending}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRightLeft className="size-4" />}
            {confirmando
              ? `Confirmar transferência para ${alvo?.setagem ?? ""}`
              : `Transferir ${alvo ? `para ${alvo.setagem}` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
