import { useState } from "react";
import { Check, Copy, ExternalLink, GitCommitHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { copiarTexto } from "@/lib/copiar";

/**
 * Puxar commit (só Founder): confere no GitHub se o commit existe, copia a
 * mensagem pronta para o Lovable e abre o projeto lá. O painel não consegue
 * mandar o Lovable importar e publicar sozinho, então colar a mensagem e
 * clicar em Publish continuam sendo feitos no Lovable.
 */
const REPOSITORIO = "kytage/hostsystem";
const PROJETO_NO_LOVABLE = "https://lovable.dev/projects/59e7e70d-bcb6-463f-a7eb-131d40dc5329";

interface Achado {
  sha: string;
  titulo: string;
  quando: string;
}

const mensagemPara = (c: Achado) =>
  `Importe para este projeto o commit ${c.sha.slice(0, 7)} (SHA completo ${c.sha}) da branch main do repositório GitHub ${REPOSITORIO}, deixando o código igual a esse commit, incluindo os arquivos binários da pasta public. Não faça outras alterações, não mude o visual e não rode migrações no banco: elas já foram aplicadas. Não coloque segredos no código. Depois de importar, publique.`;

export function PuxarCommit() {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [achado, setAchado] = useState<Achado | null>(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);

  const conferir = async () => {
    const limpo = codigo.trim().toLowerCase();
    setErro("");
    setAchado(null);
    setCopiado(false);
    if (!/^[0-9a-f]{7,40}$/.test(limpo)) {
      setErro("Código inválido: use as 7 letras e números do commit (ex.: 318c055).");
      return;
    }
    setBuscando(true);
    try {
      const r = await fetch(`https://api.github.com/repos/${REPOSITORIO}/commits/${limpo}`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (r.status === 404 || r.status === 422) {
        setErro("Esse commit não existe no GitHub. Confira o código.");
        return;
      }
      if (!r.ok) {
        setErro("O GitHub não respondeu agora. Tente de novo em instantes.");
        return;
      }
      const d = (await r.json()) as {
        sha?: string;
        commit?: { message?: string; author?: { date?: string } };
      };
      if (!d.sha) {
        setErro("O GitHub não devolveu o commit. Tente de novo.");
        return;
      }
      setAchado({
        sha: d.sha,
        titulo: (d.commit?.message ?? "").split("\n")[0]?.slice(0, 120) ?? "",
        quando: d.commit?.author?.date ?? "",
      });
    } catch {
      setErro("Sem conexão com o GitHub. Tente de novo.");
    } finally {
      setBuscando(false);
    }
  };

  const copiarEAbrir = async () => {
    if (!achado) return;
    const ok = await copiarTexto(mensagemPara(achado));
    setCopiado(ok);
    if (!ok) {
      toast.error("Não deu para copiar. Selecione a mensagem e copie à mão.");
      return;
    }
    toast.success("Mensagem copiada. Cole no chat do Lovable e depois clique em Publish.");
    window.open(PROJETO_NO_LOVABLE, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        title="Conferir um commit e levar para o Lovable"
        className="pilula flex items-center gap-1.5 rounded-full"
      >
        <GitCommitHorizontal className="size-4" /> Puxar commit
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent aria-describedby={undefined} className="max-w-md gap-0 p-5">
          <DialogTitle className="font-display text-lg font-semibold">Puxar commit</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Digite o código do commit. O painel confere no GitHub, copia a mensagem pronta e abre o
            Lovable. Lá é só colar no chat e clicar em Publish.
          </p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void conferir();
            }}
          >
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="318c055"
              autoFocus
              autoCapitalize="none"
              spellCheck={false}
              aria-label="Código do commit"
              className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-black/40 px-3 font-mono text-sm outline-none focus:border-white/30"
            />
            <button
              type="submit"
              disabled={buscando}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-60"
            >
              {buscando && <Loader2 className="size-4 animate-spin" />} Conferir
            </button>
          </form>
          {erro && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-xs text-red-200"
            >
              {erro}
            </p>
          )}
          {achado && (
            <div className="mt-4 space-y-3">
              <div className="glass-inset rounded-xl border p-3">
                <p className="flex items-center gap-1.5 text-xs text-emerald-300">
                  <Check className="size-3.5" /> Commit encontrado
                </p>
                <p className="mt-1 text-sm font-medium leading-snug">{achado.titulo}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {achado.sha.slice(0, 7)}
                  {achado.quando &&
                    ` · ${new Date(achado.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
                </p>
              </div>
              <textarea
                readOnly
                value={mensagemPara(achado)}
                rows={5}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Mensagem para colar no Lovable"
                className="w-full resize-none rounded-xl border border-white/[0.1] bg-black/40 p-3 text-[11.5px] leading-relaxed text-foreground/85 outline-none"
              />
              <button
                onClick={() => void copiarEAbrir()}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-black"
              >
                {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                Copiar mensagem e abrir o Lovable <ExternalLink className="size-3.5" />
              </button>
              <p className="text-[11px] text-muted-foreground">
                No Lovable: cole a mensagem no chat, espere ele aplicar e clique em <b>Publish</b>.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
