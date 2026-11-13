import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Code2, Loader2, NotebookPen, Rocket, Search, UserPlus, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { ROLE_LABELS } from "@/lib/roles";
import { playSfx } from "@/lib/sfx";
import { addTarefa, designarTarefa } from "@/lib/tarefas";
import { areaLabel, marcarPendenciaEncaminhada, type PendenciaArea } from "@/lib/area-manager";
import type { Prioridade } from "@/lib/kanban";
import type { EquipeUser } from "@/lib/equipe-merge";
import { NovaSolicitacaoModal } from "@/components/desenvolvimento/nova-solicitacao";
import { NovoProjetoModal } from "@/components/update/novo-projeto-modal";

type Janela = "designar" | "dev" | "update" | null;

const PRIORIDADES_DEV = new Set<string>(["baixa", "media", "alta"]);

/** Texto da tarefa: descrição da pendência, de onde veio e os anexos (prints viram miniaturas). */
function textoDaTarefa(p: PendenciaArea): string {
  const anexos = p.anexos.map((a) => (a.url.startsWith("data:image/") ? a.url : `📎 ${a.nome}: ${a.url}`));
  return [
    p.descricao.trim(),
    `Pendência da área ${areaLabel(p.area)}, aberta por ${p.criadoPor || "—"}.`,
    ...anexos,
  ]
    .filter(Boolean)
    .join("\n");
}

function Opcao({
  icon: Icon,
  titulo,
  sub,
  onClick,
  carregando,
}: {
  icon: LucideIcon;
  titulo: string;
  sub: string;
  onClick: () => void;
  carregando?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={carregando}
      className="hc-dentro group flex items-center gap-2.5 px-3 py-2.5 text-left disabled:opacity-60"
    >
      <span className="hc-icone !size-8">
        {carregando ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" strokeWidth={1.8} />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium text-foreground">{titulo}</span>
        <span className="block truncate text-[10.5px] text-ink-3">{sub}</span>
      </span>
    </button>
  );
}

/**
 * "Encaminhar para": só Coordinator+ vê. Manda a pendência para a própria tarefa particular,
 * para a tarefa de outra pessoa, para o quadro do Desenvolvimento ou para o HOST UPDATE.
 */
export function EncaminharPendencia({
  p,
  eu,
  equipe,
}: {
  p: PendenciaArea;
  eu: string;
  equipe: EquipeUser[];
}) {
  const qc = useQueryClient();
  const [janela, setJanela] = useState<Janela>(null);

  const pronto = (msg: string) => {
    playSfx("success");
    toast.success(msg);
    void qc.invalidateQueries({ queryKey: ["pendencias-area"] });
    void qc.invalidateQueries({ queryKey: ["tarefas-particulares"] });
  };

  const minhaTarefa = useMutation({
    mutationFn: async () => {
      await addTarefa(p.titulo, textoDaTarefa(p));
      await marcarPendenciaEncaminhada(p, eu, `Tarefa de ${eu}`);
    },
    onSuccess: () => pronto("Foi para as suas tarefas particulares."),
    onError: () => toast.error("Não foi possível encaminhar. Tente novamente."),
  });

  const designar = useMutation({
    mutationFn: async (u: EquipeUser) => {
      await designarTarefa({ titulo: p.titulo, descricao: textoDaTarefa(p), destinatarioId: u.id, designadaPor: eu });
      await marcarPendenciaEncaminhada(p, eu, `Tarefa de ${u.username}`);
      return u;
    },
    onSuccess: (u) => {
      setJanela(null);
      pronto(`Foi para as tarefas de ${u.username}.`);
    },
    onError: () => toast.error("Não foi possível designar. Tente novamente."),
  });

  return (
    <div className="hc-dentro p-2.5">
      <p className="hc-sobre mb-2 px-0.5">Encaminhar para</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <Opcao
          icon={NotebookPen}
          titulo="Minha tarefa"
          sub="Suas tarefas particulares"
          carregando={minhaTarefa.isPending}
          onClick={() => minhaTarefa.mutate()}
        />
        <Opcao icon={UserPlus} titulo="Designar tarefa" sub="Vai para a tarefa da pessoa" onClick={() => setJanela("designar")} />
        <Opcao icon={Code2} titulo="Desenvolvimento" sub="Quadro do Dev" onClick={() => setJanela("dev")} />
        <Opcao icon={Rocket} titulo="Update" sub="HOST UPDATE" onClick={() => setJanela("update")} />
      </div>

      {janela === "designar" && (
        <EscolherPessoa
          equipe={equipe}
          titulo={p.titulo}
          enviando={designar.isPending}
          onEscolher={(u) => designar.mutate(u)}
          onClose={() => setJanela(null)}
        />
      )}
      {janela === "dev" && (
        <NovaSolicitacaoModal
          criadoPor={p.criadoPor || eu}
          inicial={{
            titulo: p.titulo,
            descricao: `${p.descricao.trim()}\n\nPendência da área ${areaLabel(p.area)}, aberta por ${p.criadoPor || "—"}.`.trim(),
            prioridade: (PRIORIDADES_DEV.has(p.prioridade) ? p.prioridade : "media") as Prioridade,
            anexos: p.anexos,
          }}
          onClose={() => setJanela(null)}
          onCriado={async (cardId) => {
            await marcarPendenciaEncaminhada(p, eu, "Desenvolvimento", cardId);
            pronto("Solicitação criada no Desenvolvimento.");
          }}
        />
      )}
      {janela === "update" && (
        <NovoProjetoModal
          inicial={{ titulo: p.titulo, descricao: p.descricao.trim() }}
          onClose={() => setJanela(null)}
          onCriado={async () => {
            await marcarPendenciaEncaminhada(p, eu, "HOST UPDATE");
            setJanela(null);
            pronto("Projeto criado no HOST UPDATE.");
          }}
        />
      )}
    </div>
  );
}

function EscolherPessoa({
  equipe,
  titulo,
  enviando,
  onEscolher,
  onClose,
}: {
  equipe: EquipeUser[];
  titulo: string;
  enviando: boolean;
  onEscolher: (u: EquipeUser) => void;
  onClose: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<EquipeUser | null>(null);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return [...equipe]
      .filter((u) => !q || u.username.toLowerCase().includes(q))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [equipe, busca]);

  return createPortal(
    <div className="pf-fade fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pf-modal glass-elevated flex max-h-[80vh] w-full max-w-md flex-col rounded-[22px]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <p className="hc-sobre">Designar tarefa</p>
            <h3 className="hc-titulo mt-1.5 truncate">{titulo}</h3>
            <p className="hc-nota mt-1">Escolha quem vai receber. A tarefa cai no quadro da pessoa.</p>
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
          {lista.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setEscolhido(u)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                  escolhido?.id === u.id ? "bg-foreground/[0.07]" : "hover:bg-foreground/[0.04]",
                )}
              >
                <img src={u.avatar_url || DEFAULT_AVATAR_URL} alt="" className="size-7 rounded-full object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.username}</span>
                  <span className="block text-[11px] text-ink-3">{ROLE_LABELS[u.role]}</span>
                </span>
                <span
                  className={cn(
                    "size-4 rounded-full border transition-colors",
                    escolhido?.id === u.id
                      ? "border-foreground bg-foreground"
                      : "border-foreground/20",
                  )}
                />
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="px-3 py-8 text-center text-xs text-ink-3">Ninguém encontrado.</li>}
        </ul>
        <footer className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-5 py-4">
          <button
            type="button"
            disabled={!escolhido || enviando}
            onClick={() => escolhido && onEscolher(escolhido)}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {enviando && <Loader2 className="size-3.5 animate-spin" />}
            {escolhido ? `Designar para ${escolhido.username}` : "Escolha alguém"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
