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
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[22px] border border-primary/40 glass-modal p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {/* ação destrutiva: o ícone fica vermelho */}
            <span className="hc-icone">
              <Eraser className="size-4 text-primary" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="hc-titulo">Limpar Fac</h2>
              <p className="hc-nota mt-1">
                {org.setagem} · {categoriaNome}
                {org.organizacao ? ` · ${org.organizacao}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="hc-seta"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="hc-dentro mt-4 flex gap-2 p-3">
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
                aria-pressed={ativo}
                onClick={() => setOpcoes((p) => ({ ...p, [o.key]: !p[o.key] }))}
                className={cn(
                  "hc-dentro flex w-full items-start gap-3 p-3 text-left transition-colors",
                  ativo && "!border-foreground/30 !bg-foreground/[0.07]"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                    ativo ? "border-foreground bg-foreground" : "border-foreground/25"
                  )}
                >
                  {ativo && <span className="size-1.5 rounded-sm bg-background" />}
                </span>
                <span>
                  <span
                    className={cn(
                      "block text-xs font-semibold",
                      ativo ? "text-foreground" : "text-muted-foreground"
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
            className="w-full rounded-xl border border-input bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/30"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder={org.setagem}
          />
        </label>

        {erro && <p className="mt-3 text-xs font-semibold text-primary">{erro}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="pilula rounded-full"
          >
            Cancelar
          </button>
          {/* confirmação destrutiva: fica vermelha */}
          <button
            onClick={() => mutation.mutate()}
            disabled={!confirmado || !algumaOpcao || mutation.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-destructive px-4 text-[13px] font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
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
