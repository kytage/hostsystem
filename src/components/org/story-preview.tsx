import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  baixarStory,
  compartilharStory,
  desenharStory,
  podeCompartilharImagem,
  STORY_H,
  STORY_W,
  type StoryDados,
} from "@/lib/story-ato";

/** Prévia da arte dos stories (a mesma imagem que será baixada, só que reduzida). */
export function StoryPreview({ dados, className }: { dados: StoryDados; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [pronto, setPronto] = useState(false);
  const { chamada, nome, etiqueta } = dados;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let vivo = true;
    setPronto(false);
    void desenharStory(canvas, { chamada, nome, etiqueta })
      .catch(() => undefined)
      .then(() => {
        if (vivo) setPronto(true);
      });
    return () => {
      vivo = false;
    };
  }, [chamada, nome, etiqueta]);

  return (
    <div
      className={cn("relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-black shadow-[0_24px_60px_rgba(0,0,0,0.6)]", className)}
      style={{ aspectRatio: `${STORY_W} / ${STORY_H}` }}
    >
      <canvas
        ref={ref}
        role="img"
        aria-label={`Arte dos stories de ${nome}`}
        className={cn("size-full transition-opacity duration-500", pronto ? "opacity-100" : "opacity-0")}
      />
      {!pronto && (
        <div className="absolute inset-0 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

/** Botões de salvar a imagem e, no celular, de compartilhar direto. */
export function StoryAcoes({ dados, className }: { dados: StoryDados; className?: string }) {
  const [ocupado, setOcupado] = useState<"baixar" | "compartilhar" | null>(null);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);
  useEffect(() => setPodeCompartilhar(podeCompartilharImagem()), []);

  const rodar = async (tipo: "baixar" | "compartilhar", acao: () => Promise<void>) => {
    if (ocupado) return;
    setOcupado(tipo);
    try {
      await acao();
      if (tipo === "baixar") toast.success("Imagem salva. Agora é só postar nos stories.");
    } catch (e) {
      // Fechar o menu de compartilhar sem escolher nada não é erro.
      if (!(e instanceof Error && e.name === "AbortError")) toast.error("Não foi possível gerar a imagem. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  };

  const botao = "flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-60";
  return (
    <div className={cn("flex gap-2", className)}>
      <button type="button" disabled={!!ocupado} onClick={() => void rodar("baixar", () => baixarStory(dados))} className={cn(botao, "bg-primary text-white hover:bg-primary/90")}>
        {ocupado === "baixar" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Salvar imagem
      </button>
      {podeCompartilhar && (
        <button
          type="button"
          disabled={!!ocupado}
          onClick={() => void rodar("compartilhar", () => compartilharStory(dados))}
          className={cn(botao, "border border-white/[0.1] bg-white/[0.05] text-foreground hover:bg-white/[0.09]")}
        >
          {ocupado === "compartilhar" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} Compartilhar
        </button>
      )}
    </div>
  );
}
