import { useState } from "react";
import { toast } from "sonner";
import {
  GhostButton,
  ModalBase,
  PrimaryButton,
  inputClasses,
  labelClasses,
} from "@/components/financeiro/modal-base";
import { mesLabel, parseValor, salvarEntrada, type Entrada } from "@/lib/financeiro";

interface EntradaDialogProps {
  mes: string;
  entrada?: Entrada | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Formulário de entrada (nome, valor e observação). */
export function EntradaDialog({ mes, entrada, onClose, onSaved }: EntradaDialogProps) {
  const [titulo, setTitulo] = useState(entrada?.titulo ?? "");
  const [valor, setValor] = useState(entrada ? String(entrada.valor).replace(".", ",") : "");
  const [observacao, setObservacao] = useState(entrada?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);

  const salvar = () => {
    setSalvando(true);
    void salvarEntrada({
      ...(entrada?.id ? { id: entrada.id } : {}),
      mes: entrada?.mes ?? mes,
      titulo,
      valor: parseValor(valor),
      observacao,
    })
      .then(() => {
        toast.success(entrada ? "Entrada atualizada" : "Entrada registrada");
        onSaved();
        onClose();
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Falha ao salvar entrada");
      })
      .finally(() => setSalvando(false));
  };

  return (
    <ModalBase
      title={entrada ? "Editar entrada" : "Nova entrada"}
      subtitle={mesLabel(entrada?.mes ?? mes)}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar entrada"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label className={labelClasses} htmlFor="entrada-nome">
            Nome
          </label>
          <input
            id="entrada-nome"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Vendas VIP"
            className={inputClasses}
          />
        </div>
        <div className="sm:col-span-1">
          <label className={labelClasses} htmlFor="entrada-valor">
            Valor (R$)
          </label>
          <input
            id="entrada-valor"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={inputClasses}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses} htmlFor="entrada-obs">
            Observação
          </label>
          <textarea
            id="entrada-obs"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={4}
            placeholder="Detalhes da entrada..."
            className={inputClasses}
          />
        </div>
      </div>
    </ModalBase>
  );
}
