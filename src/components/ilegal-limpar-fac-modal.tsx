import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eraser, Loader2, X } from "lucide-react";
import { getCurrentUsername } from "@/lib/kanban";
import { fetchDetalhes, type IlegalOrg } from "@/lib/ilegal-data";
import {
  limparFac,
  LIMPAR_FAC_DEFAULT,
  type LimparFacOpcoes,
} from "@/lib/ilegal-limpar";
import { cn } from "@/lib/utils";

interface IlegalLimparFacModalProps {
  org: IlegalOrg;
  categoriaNome: string;
  onClose: () => void;
  /** Chamado após a limpeza concluir com sucesso. */
  onDone: () => void;
}

const OPCOES: { key: keyof LimparFacOpcoes; label: string; hint: string }[] = [
  {
    key: "historicoOnline",
    label: "Histórico de online",
    hint: "Zera o histórico no painel; as capturas seguem armazenadas",
  },
  {
    key: "registros",
    label: "Denúncias e punições",
    hint: "Somente na visão do Ilegal e nos relatórios da org — /punicoes continua intacto",
  },
  {
    key: "contatos",
    label: "Contatos, organização e status",
    hint: "Limpa nomes, telefones, logo, anotações e deixa a setagem como Livre",
  },
  {
    key: "vips",
    label: "VIP FAC",
    hint: "Salários, baú, carro VIP, barbearia, garagem pounder...",
  },
  {
    key: "criarPendencia",
    label: "Criar pendência no Desenvolvimento",
    hint: "Só é criada quando existe VIP FAC para remover — sem VIP, apenas reseta os dados",
  },
];

/** Confirmação da limpeza de facção — ação destrutiva, exige digitar a setagem. */
export function IlegalLimparFacModal({
  org,
  categoriaNome,
  onClose,
  onDone,
}: IlegalLimparFacModalProps) {
  const queryClient = useQueryClient();
  const [opcoes, setOpcoes] = useState<LimparFacOpcoes>({ ...LIMPAR_FAC_DEFAULT });
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");

  const { data: detalhes } = useQuery({
    queryKey: ["ilegal-detalhes", org.id],
    queryFn: () => fetchDetalhes(org.id),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const autor = await getCurrentUsername();
      return limparFac(org, opcoes, autor);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ilegal-orgs"] });
      void queryClient.invalidateQueries({ queryKey: ["ilegal-detalhes", org.id] });
      void queryClient.invalidateQueries({ queryKey: ["set-online-historico"] });
      void queryClient.invalidateQueries({ queryKey: ["punicoes-setagem", org.setagem] });
      void queryClient.invalidateQueries({ queryKey: ["kanban-cards"] });
      onDone();
    },
    onError: (e) => setErro(e instanceof Error ? e.message : "Falha ao limpar a facção."),
  });

  const algumaOpcao = Object.values(opcoes).some(Boolean);
  const confirmado = confirmacao.trim().toLowerCase() === org.setagem.toLowerCase();
  const vips = detalhes?.vips ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-primary/40 glass p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground font-display">
              <Eraser className="size-5 text-primary" /> Limpar Fac
            </h2>
            <p className="text-xs text-muted-foreground">
              {org.setagem} · {categoriaNome}
              {org.organizacao ? ` · ${org.organizacao}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-xs text-foreground">
            A limpeza libera a setagem e reinicia o painel desta facção. Os registros de{" "}
            <b>/punicoes</b> e as capturas de online <b>não são apagados</b> — apenas deixam de
            aparecer na visão do Ilegal e nos relatórios da organização.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {OPCOES.map((o) => {
            const ativo = opcoes[o.key];
            return (
              <button
                key={o.key}
                onClick={() => setOpcoes((p) => ({ ...p, [o.key]: !p[o.key] }))}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  ativo
                    ? "border-white/15 bg-white/[0.07]"
                    : "border-border bg-white/[0.035] hover:bg-accent/50"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                    ativo ? "border-primary bg-primary" : "border-border"
                  )}
                >
                  {ativo && <span className="size-1.5 rounded-sm bg-primary-foreground" />}
                </span>
                <span>
                  <span
                    className={cn(
                      "block text-xs font-semibold",
                      ativo ? "text-primary" : "text-foreground"
                    )}
                  >
                    {o.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">{o.hint}</span>
                  {o.key === "vips" && vips.length > 0 && (
                    <span className="mt-1 block text-[11px] font-semibold text-warning">
                      {vips.map((v) => v.label || "item").join(" · ")}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Digite <b className="text-foreground">{org.setagem}</b> para confirmar
          </span>
          <input
            className="w-full rounded-lg border border-border bg-white/[0.05] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder={org.setagem}
          />
        </label>

        {erro && <p className="mt-3 text-xs font-semibold text-primary">{erro}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-white/[0.08]"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!confirmado || !algumaOpcao || mutation.isPending}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Eraser className="size-4" />
            )}
            Limpar facção
          </button>
        </div>
      </div>
    </div>
  );
}
