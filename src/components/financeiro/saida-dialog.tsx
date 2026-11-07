import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import {
  GhostButton,
  ModalBase,
  PrimaryButton,
  inputClasses,
  labelClasses,
} from "@/components/financeiro/modal-base";
import { fileImageToDataUrl, pasteImageFromEvent } from "@/lib/clipboard-image";
import {
  STATUS_LABELS,
  SUBTIPO_LABELS,
  TIPO_LABELS,
  mesLabel,
  parseValor,
  salvarSaida,
  type Saida,
  type SaidaStatus,
  type SaidaSubtipo,
  type SaidaTipo,
} from "@/lib/financeiro";

interface SaidaDialogProps {
  mes: string;
  saida?: Saida | null;
  onClose: () => void;
  onSaved: () => void;
}

const TIPOS: SaidaTipo[] = ["fixa", "variavel", "contrato"];
const SUBTIPOS: SaidaSubtipo[] = ["staff", "servico", "outro"];
const STATUSES: SaidaStatus[] = ["pendente", "atrasado", "pago", "cancelado"];

/** Formulário completo de saída/despesa, com comprovante em imagem ou link. */
export function SaidaDialog({ mes, saida, onClose, onSaved }: SaidaDialogProps) {
  const [titulo, setTitulo] = useState(saida?.titulo ?? "");
  const [valor, setValor] = useState(saida ? String(saida.valor).replace(".", ",") : "");
  const [dataPagamento, setDataPagamento] = useState(
    () => saida?.dataPagamento ?? new Date().toLocaleDateString("sv-SE"),
  );
  const [tipo, setTipo] = useState<SaidaTipo>(saida?.tipo ?? "variavel");
  const [subtipo, setSubtipo] = useState<SaidaSubtipo>(saida?.subtipo ?? "outro");
  const [status, setStatus] = useState<SaidaStatus>(saida?.status ?? "pendente");
  const [observacao, setObservacao] = useState(saida?.observacao ?? "");
  const [comprovante, setComprovante] = useState(saida?.comprovante ?? "");
  const [repetir, setRepetir] = useState(11);
  const [salvando, setSalvando] = useState(false);

  const ehImagem = comprovante.startsWith("data:image") || /\.(png|jpe?g|webp|gif)$/i.test(comprovante);

  const salvar = () => {
    setSalvando(true);
    void salvarSaida({
      ...(saida?.id ? { id: saida.id } : {}),
      mes: saida?.mes ?? mes,
      titulo,
      valor: parseValor(valor),
      dataPagamento: dataPagamento || null,
      tipo,
      subtipo,
      status,
      observacao,
      comprovante,
      repetirMeses: repetir,
    })
      .then(() => {
        toast.success(saida ? "Saída atualizada" : "Saída registrada");
        onSaved();
        onClose();
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Falha ao salvar saída");
      })
      .finally(() => setSalvando(false));
  };

  return (
    <ModalBase
      title={saida ? "Editar saída" : "Nova saída"}
      subtitle={mesLabel(saida?.mes ?? mes)}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar saída"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses} htmlFor="saida-titulo">
            Título
          </label>
          <input
            id="saida-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Salário staff"
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses} htmlFor="saida-valor">
            Valor (R$)
          </label>
          <input
            id="saida-valor"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses} htmlFor="saida-data">
            Data de pagamento
          </label>
          <input
            id="saida-data"
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses} htmlFor="saida-tipo">
            Tipo
          </label>
          <select
            id="saida-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as SaidaTipo)}
            className={inputClasses}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClasses} htmlFor="saida-subtipo">
            Sub seleção
          </label>
          <select
            id="saida-subtipo"
            value={subtipo}
            onChange={(e) => setSubtipo(e.target.value as SaidaSubtipo)}
            className={inputClasses}
          >
            {SUBTIPOS.map((t) => (
              <option key={t} value={t}>
                {SUBTIPO_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClasses} htmlFor="saida-status">
            Status
          </label>
          <select
            id="saida-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as SaidaStatus)}
            className={inputClasses}
          >
            {STATUSES.map((t) => (
              <option key={t} value={t}>
                {STATUS_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {tipo === "fixa" && !saida ? (
          <div className="sm:col-span-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
            <label className={labelClasses} htmlFor="saida-repetir">
              Repetir nos próximos meses
            </label>
            <input
              id="saida-repetir"
              type="number"
              min={0}
              max={36}
              value={repetir}
              onChange={(e) => setRepetir(Number(e.target.value) || 0)}
              className={inputClasses}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Despesa fixa: será lançada neste mês e replicada nos {repetir} meses seguintes
              como pendente.
            </p>
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <label className={labelClasses} htmlFor="saida-obs">
            Observação
          </label>
          <textarea
            id="saida-obs"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            className={inputClasses}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClasses} htmlFor="saida-comprovante">
            Comprovante (link ou imagem — cole com Ctrl+V)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="saida-comprovante"
              value={comprovante.startsWith("data:") ? "" : comprovante}
              onChange={(e) => setComprovante(e.target.value)}
              onPaste={(e) => pasteImageFromEvent(e, setComprovante)}
              placeholder={comprovante.startsWith("data:") ? "Imagem anexada" : "https://..."}
              className={`${inputClasses} flex-1`}
            />
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground">
              <ImagePlus className="size-4" /> Imagem
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void fileImageToDataUrl(file)
                    .then((url) => {
                      if (url) setComprovante(url);
                    })
                    .catch(() => toast.error("Não foi possível ler a imagem"));
                }}
              />
            </label>
            {comprovante ? (
              <button
                type="button"
                onClick={() => setComprovante("")}
                aria-label="Remover comprovante"
                className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
          {comprovante && ehImagem ? (
            <img
              src={comprovante}
              alt="Comprovante"
              className="mt-3 max-h-40 rounded-lg border border-border object-contain"
            />
          ) : null}
        </div>
      </div>
    </ModalBase>
  );
}
