import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { deleteOrg, type IlegalOrg } from "@/lib/ilegal-data";
import { confirmaExclusaoSetagem } from "@/lib/ilegal-excluir";

export interface IlegalExcluirModalProps {
  org: IlegalOrg;
  onClose: () => void;
  onDone: () => void;
}

export function IlegalExcluirModal({ org, onClose, onDone }: IlegalExcluirModalProps) {
  const queryClient = useQueryClient();
  const [confirmacao, setConfirmacao] = useState("");
  const mutation = useMutation({
    mutationFn: () => deleteOrg({ id: org.id, setagem: org.setagem, confirmacao }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ilegal-orgs"] });
      queryClient.removeQueries({ queryKey: ["ilegal-detalhes", org.id] });
      await queryClient.invalidateQueries({ queryKey: ["ilegal-log"] });
      toast.success(`${org.setagem} excluída.`);
      onDone();
    },
  });

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}>
      <AlertDialogContent className="z-[60] max-w-[calc(100%-2rem)] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir setagem {org.setagem}?</AlertDialogTitle>
        <AlertDialogDescription className="space-y-1">
          <span className="block">
            Isso exclui <strong className="text-destructive">TUDO</strong> da setagem{" "}
            <strong>{org.setagem}</strong> de forma definitiva: ficha, logo, contatos, CDS,
            garagens, uniforme, VIP FAC, coroas e anotações.
          </span>
          <span className="block font-medium text-destructive">
            Não há como desfazer nem recuperar depois. A vaga não fica livre para outra organização.
          </span>
          <span className="block">
            Denúncias, punições e capturas de online ficam guardadas no histórico para relatórios.
          </span>
        </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="space-y-2 text-sm">
          <span>Para confirmar, digite <strong className="text-destructive tracking-wide">EXCLUIR</strong></span>
          <input aria-label="Digite EXCLUIR para confirmar" value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)} disabled={mutation.isPending}
            autoComplete="off" placeholder="EXCLUIR"
            className="w-full rounded-md border border-input bg-black/25 px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !confirmaExclusaoSetagem(org.setagem, confirmacao)}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Excluir tudo definitivamente
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}