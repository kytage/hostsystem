// Gaveta (painel lateral), janela, confirmação e menu de ações.
import { useSyncExternalStore, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, X, type LucideIcon } from "lucide-react";
import { Botao, cn } from "./kit.tsx";

/** Painel que entra pela direita no computador e ocupa a tela toda no celular. */
export function Gaveta({ titulo, sobretitulo, aoFechar, children, rodape, larga, acoes }: { titulo: ReactNode; sobretitulo?: ReactNode; aoFechar: () => void; children: ReactNode; rodape?: ReactNode; larga?: boolean; acoes?: ReactNode }) {
  return (
    <Dialog.Root open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <Dialog.Portal>
        <div className="hc-avancado">
        <Dialog.Overlay className="fundo-escuro" />
        <Dialog.Content className={cn("gaveta", larga && "gaveta-larga")} aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="gaveta-topo">
            <div className="min-w-0">
              {sobretitulo && <div className="sobretitulo mb-1.5 flex flex-wrap items-center gap-2">{sobretitulo}</div>}
              <Dialog.Title className="font-display text-[19px] font-semibold leading-tight tracking-[-0.02em]">{titulo}</Dialog.Title>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {acoes}
              <Dialog.Close className="botao-icone" aria-label="Fechar" title="Fechar">
                <X size={17} />
              </Dialog.Close>
            </div>
          </div>
          <div className="gaveta-corpo">{children}</div>
          {rodape && <div className="gaveta-rodape">{rodape}</div>}
        </Dialog.Content>
      </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Janela centralizada (formulários curtos, importação, confirmação). */
export function Janela({ titulo, descricao, aoFechar, children, rodape, larga }: { titulo: ReactNode; descricao?: ReactNode; aoFechar: () => void; children?: ReactNode; rodape?: ReactNode; larga?: boolean }) {
  return (
    <Dialog.Root open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <Dialog.Portal>
        <div className="hc-avancado">
        <Dialog.Overlay className="fundo-escuro fundo-escuro-janela" />
        <Dialog.Content className={cn("janela", larga && "janela-larga")} aria-describedby={undefined}>
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-[17px] font-semibold tracking-[-0.015em]">{titulo}</Dialog.Title>
              {descricao && <p className="mt-1 text-[12.5px] text-tx-2">{descricao}</p>}
            </div>
            <Dialog.Close className="botao-icone" aria-label="Fechar">
              <X size={17} />
            </Dialog.Close>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-1">{children}</div>}
          {rodape && <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] px-4 py-3">{rodape}</div>}
        </Dialog.Content>
      </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ---------------- confirmar (pergunta antes de apagar) ---------------- */

interface Pergunta {
  titulo: string;
  texto?: string;
  perigo?: boolean;
  confirmar?: string;
  resolver: (v: boolean) => void;
}
let pergunta: Pergunta | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

/** `if (await confirmar({ titulo: "Apagar?" })) ...` */
export function confirmar(opcoes: { titulo: string; texto?: string; perigo?: boolean; confirmar?: string }): Promise<boolean> {
  return new Promise((resolver) => {
    pergunta = { ...opcoes, resolver };
    avisar();
  });
}

/** Colocar uma vez no app. */
export function ConfirmarHost() {
  const atual = useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => pergunta,
  );
  if (!atual) return null;
  const responder = (v: boolean) => {
    atual.resolver(v);
    pergunta = null;
    avisar();
  };
  return (
    <Janela
      titulo={atual.titulo}
      descricao={atual.texto}
      aoFechar={() => responder(false)}
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => responder(false)}>
            Cancelar
          </Botao>
          <Botao variante={atual.perigo ? "perigo" : "principal"} onClick={() => responder(true)} autoFocus>
            {atual.confirmar ?? "Confirmar"}
          </Botao>
        </>
      }
    />
  );
}

/* ---------------- menu de ações ---------------- */

export interface Acao {
  rotulo: string;
  icone?: LucideIcon;
  aoClicar: () => void;
  perigo?: boolean;
}
export function MenuAcoes({ acoes, rotulo = "Mais ações", gatilho }: { acoes: Acao[]; rotulo?: string; gatilho?: ReactNode }) {
  if (acoes.length === 0) return null;
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        {gatilho ?? (
          <button type="button" className="botao-icone" aria-label={rotulo} title={rotulo} onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal size={17} />
          </button>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <div className="hc-avancado">
        <Menu.Content className="dica-menu" align="end" sideOffset={6} onClick={(e) => e.stopPropagation()}>
          {acoes.map((a) => (
            <Menu.Item key={a.rotulo} className="dica-menu-item" data-perigo={a.perigo ? "" : undefined} onSelect={() => a.aoClicar()}>
              {a.icone && <a.icone size={15} strokeWidth={1.75} />}
              {a.rotulo}
            </Menu.Item>
          ))}
        </Menu.Content>
      </div>
      </Menu.Portal>
    </Menu.Root>
  );
}
