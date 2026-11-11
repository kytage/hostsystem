import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Avisa quando sai uma versão nova do painel. Quem deixa a aba aberta o dia
 * todo continuaria com a versão antiga (e, por exemplo, não apareceria na
 * praça junto com quem já atualizou). A cada 3 minutos, e ao voltar para a
 * aba, confere se os arquivos do site mudaram; se mudaram, mostra um aviso fixo
 * com o botão de atualizar (não recarrega sozinho para ninguém perder o que
 * estava escrevendo).
 */
const INTERVALO_MS = 3 * 60_000;

async function arquivosDoSite(): Promise<string | null> {
  try {
    const r = await fetch(`/?v=${Date.now()}`, { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return null;
    const html = await r.text();
    // na versão publicada os arquivos têm um código no nome que muda a cada publicação
    const nomes = [...new Set(html.match(/\/assets\/[\w.-]+\.(?:js|css)/g) ?? [])].sort();
    return nomes.length ? nomes.join("|") : null;
  } catch {
    return null;
  }
}

export function useVersaoNova() {
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let base: string | null = null;
    let avisou = false;
    let parado = false;

    const conferir = async () => {
      if (parado || avisou) return;
      const atual = await arquivosDoSite();
      if (!atual || parado) return;
      if (base === null) {
        base = atual;
        return;
      }
      if (atual === base) return;
      avisou = true;
      toast("Saiu uma versão nova do painel", {
        description: "Atualize para ver as novidades e encontrar todo mundo na praça.",
        duration: Infinity,
        action: { label: "Atualizar", onClick: () => window.location.reload() },
      });
    };

    void conferir();
    const id = window.setInterval(() => void conferir(), INTERVALO_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void conferir();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      parado = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);
}
