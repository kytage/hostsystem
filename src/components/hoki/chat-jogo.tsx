import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VISUAL_PADRAO, type Visual } from "@/lib/hoki";
import { enviarNaPraca, ouvirNaPraca, usePresencaHoki } from "@/lib/hoki-presenca";
import { Hoki2D } from "./hoki-2d";

/**
 * Chat do jogo: o mesmo da praça, pronto para usar em outras telas (HOST FAZENDAS,
 * mini-games…). Usa o canal único do site (hoki-presenca), então quem está na praça,
 * na fazenda ou num mini-game conversa junto.
 *
 * T (ou o botão "T falar") abre o campo; Enter envia; Esc fecha. As últimas mensagens
 * aparecem como pílulas (fotinha, cargo, nome e texto) e somem depois de um minuto.
 * Mensagens começadas por "/" são comandos e não vão para o chat.
 */

/** Quantas mensagens ficam na tela e por quanto tempo (igual à praça). */
const MAX_CONVERSA = 4;
const CONVERSA_MS = 60_000;
/** Tamanho máximo de uma mensagem e o intervalo mínimo entre duas (igual à praça). */
const MAX_TEXTO = 90;
const ESPERA_MS = 700;

interface Quem {
  nome: string;
  tag: string;
  visual: Visual;
}
interface Linha extends Quem {
  chave: string;
  texto: string;
  em: number;
}

/* ---------- as mensagens ficam guardadas aqui (sobrevivem a trocar de ilha, que remonta a tela) ---------- */
let linhas: Linha[] = [];
const assinantes = new Set<() => void>();
const avisar = () => assinantes.forEach((f) => f());
function anotar(quem: Quem, texto: string) {
  linhas = [
    ...linhas,
    {
      ...quem,
      texto,
      em: Date.now(),
      chave: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    },
  ].slice(-MAX_CONVERSA);
  avisar();
}
function podar() {
  const agora = Date.now();
  const restam = linhas.filter((l) => agora - l.em < CONVERSA_MS);
  if (restam.length === linhas.length) return;
  linhas = restam;
  avisar();
}
const assinar = (f: () => void) => {
  assinantes.add(f);
  return () => void assinantes.delete(f);
};
const ler = () => linhas;

/* ---------- ouvir o canal: um ouvinte só, mesmo com mais de um chat na tela ---------- */
let montados = 0;
let pararDeOuvir: (() => void) | null = null;
/** Descobre nome, cargo e aparência de quem mandou (o chat montado mais recente atualiza isto). */
let quemE: (id: string) => Quem = () => ({ nome: "alguém", tag: "", visual: VISUAL_PADRAO });
let ultimaFala = 0;

export interface ChatJogoProps {
  /** Quem eu sou: aparece nas minhas mensagens e vai junto (pelo id) para os outros. */
  eu: { id: string; nome: string; tag?: string; visual: Visual };
  /** Desligado (ex.: uma janela aberta por cima), a tecla T não abre o campo. Padrão: ligado. */
  ativo?: boolean;
  /** Onde fica na tela. Padrão: canto de cima à esquerda, logo abaixo da HUD (como na praça). */
  className?: string;
  /** Mostra o botão "T falar" quando o campo está fechado (bom para celular). Padrão: sim. */
  botao?: boolean;
  /**
   * Comandos (mensagens começadas por "/"). Devolva true se a tela tratou o comando;
   * senão aparece o aviso de comando desconhecido. Comandos nunca vão para o chat.
   */
  onComando?: (comando: string) => boolean;
}

export function ChatJogo({
  eu,
  ativo = true,
  className = "absolute left-3 top-[52px] z-20",
  botao = true,
  onComando,
}: ChatJogoProps) {
  const conversa = useSyncExternalStore(assinar, ler, ler);
  const { outros } = usePresencaHoki();
  const [falando, setFalando] = useState(false);
  const [texto, setTexto] = useState("");
  const raiz = useRef<HTMLDivElement>(null);

  // nome, cargo e fotinha de quem mandou: vêm da presença (o canal único do site)
  quemE = (id) => {
    const o = outros[id];
    return { nome: o?.nome ?? "alguém", tag: o?.tag ?? "", visual: o?.visual ?? VISUAL_PADRAO };
  };

  useEffect(() => {
    montados += 1;
    if (!pararDeOuvir)
      pararDeOuvir = ouvirNaPraca("fala", (p) => {
        const { id, texto: t } = p;
        if (typeof id !== "string" || typeof t !== "string" || !t.trim()) return;
        anotar(quemE(id), t.slice(0, MAX_TEXTO));
      });
    return () => {
      montados -= 1;
      if (montados === 0) {
        pararDeOuvir?.();
        pararDeOuvir = null;
      }
    };
  }, []);

  // cada mensagem some depois de um minuto
  const temConversa = conversa.length > 0;
  useEffect(() => {
    if (!temConversa) return;
    const id = setInterval(podar, 2000);
    return () => clearInterval(id);
  }, [temConversa]);

  // desligou (ex.: abriu uma janela por cima): fecha o campo
  useEffect(() => {
    if (!ativo) setFalando(false);
  }, [ativo]);

  // tecla T abre o campo (nunca enquanto digita em outro campo nem com uma janela por cima)
  const ativoRef = useRef(ativo);
  ativoRef.current = ativo;
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "t" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (!ativoRef.current) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      // outra janela aberta (que não é a tela onde este chat mora) também bloqueia
      const aqui = raiz.current;
      const janelas = document.querySelectorAll("[role='dialog'], [role='alertdialog']");
      if (Array.from(janelas).some((j) => !aqui || !j.contains(aqui))) return;
      // o campo já recebe o foco; a própria letra não entra no texto
      e.preventDefault();
      setFalando(true);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim().slice(0, MAX_TEXTO);
    // Enter com o campo vazio só fecha
    if (!t) {
      setFalando(false);
      return;
    }
    // comandos não vão para o chat
    if (t.startsWith("/")) {
      setTexto("");
      setFalando(false);
      if (!onComando?.(t.toLowerCase())) toast.info("Esse comando não funciona aqui.");
      return;
    }
    if (Date.now() - ultimaFala < ESPERA_MS) return;
    ultimaFala = Date.now();
    setTexto("");
    setFalando(false);
    anotar({ nome: eu.nome, tag: eu.tag ?? "", visual: eu.visual }, t);
    enviarNaPraca("fala", { id: eu.id, texto: t });
  };

  const abrir = ativo && falando;
  return (
    <div
      ref={raiz}
      className={cn(
        "pointer-events-none flex w-[min(360px,calc(100%-1.5rem))] flex-col items-start gap-1.5",
        className,
      )}
    >
      {conversa.length > 0 && (
        <div className="flex max-w-full flex-col items-start gap-1">
          {conversa.map((m) => (
            <div
              key={m.chave}
              className="pf-pop flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/60 py-0.5 pl-0.5 pr-2.5 text-[11.5px] text-white backdrop-blur-md"
            >
              <span className="block size-5 shrink-0 overflow-hidden rounded-full border border-white/15 bg-black/50">
                <Hoki2D visual={m.visual} busto />
              </span>
              {m.tag && (
                <span className="shrink-0 rounded bg-primary px-1 text-[8.5px] font-bold leading-[13px]">
                  {m.tag}
                </span>
              )}
              <span className="shrink-0 font-semibold">{m.nome}</span>
              <span className="truncate text-white/85">{m.texto}</span>
            </div>
          ))}
        </div>
      )}
      {abrir ? (
        <form
          onSubmit={enviar}
          className="pf-pop pointer-events-auto flex w-full items-center gap-1.5 rounded-xl border border-white/15 bg-black/80 p-1 pl-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          <kbd className="shrink-0 rounded-md bg-white px-1.5 py-px font-sans text-[10.5px] font-bold text-black">
            T
          </kbd>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setFalando(false);
              }
            }}
            onBlur={() => {
              if (!texto.trim()) setFalando(false);
            }}
            autoFocus
            maxLength={MAX_TEXTO}
            placeholder="Fale algo e aperte Enter (Esc fecha)"
            aria-label="Mensagem para o chat"
            className="h-8 min-w-0 flex-1 bg-transparent px-1.5 text-[13px] text-white outline-none placeholder:text-white/45"
          />
          <button
            type="submit"
            disabled={!texto.trim()}
            className="h-8 shrink-0 rounded-lg bg-primary px-3 text-[12px] font-semibold text-white transition-opacity disabled:opacity-35"
          >
            Enviar
          </button>
        </form>
      ) : (
        botao &&
        ativo && (
          <button
            type="button"
            onClick={() => setFalando(true)}
            title="Falar no chat (tecla T)"
            className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 text-[11.5px] text-white/70 backdrop-blur-md transition-colors hover:text-white"
          >
            <kbd className="rounded-md bg-white px-1.5 py-px font-sans text-[10.5px] font-bold text-black">
              T
            </kbd>
            falar
          </button>
        )
      )}
    </div>
  );
}
