import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  createCaptacao,
  updateCaptacao,
  TIPO_LABELS,
  STATUS_LABELS,
  type Captacao,
  type CaptacaoStatus,
  type CaptacaoTipo,
} from "@/lib/captacoes";
import { fetchCategorias } from "@/lib/ilegal-data";
import { getAuthUserData } from "@/lib/auth-cache";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface CaptacaoPrefill {
  organizacao?: string;
  setagem?: string;
  local?: string;
  tipo?: CaptacaoTipo;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Quando presente, edita; senão cria. */
  captacao?: Captacao | null;
  prefill?: CaptacaoPrefill | undefined;
}

export function CaptacaoDialog({ open, onClose, captacao, prefill }: Props) {
  const qc = useQueryClient();
  const editando = !!captacao;

  const [organizacao, setOrganizacao] = useState("");
  const [lider, setLider] = useState("");
  const [contato, setContato] = useState("");
  const [tipo, setTipo] = useState<CaptacaoTipo>("pvp");
  const [setagem, setSetagem] = useState("");
  const [local, setLocal] = useState("");
  const [onlineEsperado, setOnlineEsperado] = useState("");
  const [status, setStatus] = useState<CaptacaoStatus>("pendente");
  const [captador, setCaptador] = useState("");
  const [captadorId, setCaptadorId] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open) return;
    if (captacao) {
      setOrganizacao(captacao.organizacao);
      setLider(captacao.lider);
      setContato(captacao.contato);
      setTipo(captacao.tipo);
      setSetagem(captacao.setagem);
      setLocal(captacao.local);
      setOnlineEsperado(captacao.onlineEsperado);
      setStatus(captacao.status);
      setCaptador(captacao.captador);
      setCaptadorId(captacao.captadorId);
      setObservacao(captacao.observacao);
    } else {
      setOrganizacao(prefill?.organizacao ?? "");
      setLider("");
      setContato("");
      setTipo(prefill?.tipo ?? "pvp");
      setSetagem(prefill?.setagem ?? "");
      setLocal(prefill?.local ?? "");
      setOnlineEsperado("");
      setStatus("pendente");
      setCaptador("");
      setCaptadorId(null);
      setObservacao("");
      // Captador padrão = usuário logado
      void getAuthUserData().then(async (auth) => {
        if (!auth.user) return;
        const { data } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (data?.username) {
          setCaptador(data.username);
          setCaptadorId(auth.user.id);
        }
      });
    }
  }, [open, captacao, prefill]);

  const { data: categorias } = useQuery({
    queryKey: ["ilegal-orgs"],
    queryFn: fetchCategorias,
    staleTime: 30_000,
  });
  const setagensLivres = (categorias ?? []).flatMap((c) =>
    c.orgs
      .filter((o) => o.status === "Livre" || o.id === setagem)
      .map((o) => ({ id: o.id, setagem: o.setagem, local: o.local })),
  );

  const { data: membros } = useQuery({
    queryKey: ["captacoes-membros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .order("username");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const input = {
        organizacao: organizacao.trim(),
        lider: lider.trim(),
        contato: contato.trim(),
        tipo,
        setagem,
        local: local.trim(),
        onlineEsperado: onlineEsperado.trim(),
        status,
        captador: captador.trim(),
        captadorId,
        observacao: observacao.trim(),
      };
      if (editando && captacao) await updateCaptacao(captacao.id, input);
      else await createCaptacao(input);
    },
    onSuccess: () => {
      toast.success(editando ? "Captação atualizada" : "Captação criada");
      void qc.invalidateQueries({ queryKey: ["captacoes"] });
      onClose();
    },
    onError: () => toast.error("Falha ao salvar captação"),
  });

  const inputCls =
    "w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "hc-sobre mb-1.5 block";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="hc-titulo">{editando ? "Editar captação" : "Nova captação"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Nome da organização *</label>
            <input
              className={inputCls}
              value={organizacao}
              onChange={(e) => setOrganizacao(e.target.value)}
              placeholder="Ex.: CYBER"
            />
          </div>
          <div>
            <label className={labelCls}>Líder</label>
            <input
              className={inputCls}
              value={lider}
              onChange={(e) => setLider(e.target.value)}
              placeholder="Ex.: Nevez"
            />
          </div>
          <div>
            <label className={labelCls}>Contato</label>
            <input
              className={inputCls}
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="Discord, telefone, Instagram…"
            />
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Tipo</label>
            <div className="segmentos w-full" role="group" aria-label="Tipo">
              {(Object.keys(TIPO_LABELS) as CaptacaoTipo[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tipo === t}
                  onClick={() => setTipo(t)}
                  className="flex-1 justify-center"
                >
                  {TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Vaga (setagem do Ilegal)</label>
            <select
              className={inputCls}
              value={setagem}
              onChange={(e) => {
                setSetagem(e.target.value);
                const found = setagensLivres.find((s) => s.id === e.target.value);
                if (found && !local) setLocal(found.local);
              }}
            >
              <option value="">Sem vínculo</option>
              {setagensLivres.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.setagem} — {s.local}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Local</label>
            <input
              className={inputCls}
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex.: Favela Chapadão"
            />
          </div>

          <div>
            <label className={labelCls}>Online esperado</label>
            <input
              className={inputCls}
              value={onlineEsperado}
              onChange={(e) => setOnlineEsperado(e.target.value)}
              placeholder="Ex.: 15-20 online"
            />
          </div>
          <div>
            <label className={labelCls}>Captador</label>
            <select
              className={inputCls}
              value={captadorId ?? ""}
              onChange={(e) => {
                const m = (membros ?? []).find((x) => x.id === e.target.value);
                setCaptadorId(m?.id ?? null);
                setCaptador(m?.username ?? "");
              }}
            >
              <option value="">Selecionar…</option>
              {(membros ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.username}
                </option>
              ))}
            </select>
          </div>

          {editando && (
            <div className="col-span-2">
              <label className={labelCls}>Status</label>
              <select
                className={inputCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as CaptacaoStatus)}
              >
                {(Object.keys(STATUS_LABELS) as CaptacaoStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="col-span-2">
            <label className={labelCls}>Observação</label>
            <textarea
              className={cn(inputCls, "min-h-20 resize-y")}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Anotações da negociação…"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={!organizacao.trim() || salvar.isPending}
          onClick={() => salvar.mutate()}
          className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
          {editando ? "Salvar alterações" : "Criar captação"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
