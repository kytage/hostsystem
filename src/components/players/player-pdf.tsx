import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getCurrentUsername } from "@/lib/kanban";
import type { Player } from "@/lib/players";
import {
  cargoDoPlayer,
  fetchLogsDoPlayer,
  fetchPunicoesDoPlayer,
  lerGrupos,
  rankDoNivel,
  resumirLogs,
  type Situacao,
} from "@/lib/player-perfil";
import { OPCOES_PDF_PADRAO, gerarPdfPlayer, type OpcoesPdfPlayer } from "@/lib/relatorio-player";

const SECOES: { k: keyof OpcoesPdfPlayer; rotulo: string; dica: string }[] = [
  { k: "estatisticas", rotulo: "Estatísticas das logs", dica: "Números, gráfico de 14 dias e categorias" },
  { k: "grupos", rotulo: "Grupos", dica: "Todos os grupos (com nível quando houver)" },
  { k: "inventario", rotulo: "Inventário", dica: "Itens com spawn e quantidade" },
  { k: "veiculos", rotulo: "Veículos", dica: "Spawn e index de cada veículo" },
  { k: "listaLogs", rotulo: "Lista de logs", dica: "As logs mais recentes, com detalhes" },
  { k: "punicoes", rotulo: "Punições", dica: "Punições registradas para o ID" },
];

/** Opções e geração do PDF (1920x1080) de um player. */
export function PdfDoPlayer({
  p,
  foto,
  situacao,
  onClose,
}: {
  p: Player;
  /** Foto já escolhida pelo painel (Admin = foto do site). */
  foto: string;
  situacao: Situacao;
  onClose: () => void;
}) {
  const id = p.passaporte?.trim() ?? "";
  const [o, setO] = useState<OpcoesPdfPlayer>({ ...OPCOES_PDF_PADRAO });
  const [gerando, setGerando] = useState(false);
  // mesma busca do painel (já está em cache quando o perfil está aberto)
  const logs = useQuery({
    queryKey: ["player-logs", id],
    queryFn: () => fetchLogsDoPlayer(id, 30),
    enabled: !!id,
    staleTime: 30_000,
  });

  const set = <K extends keyof OpcoesPdfPlayer>(k: K, v: OpcoesPdfPlayer[K]) => setO((x) => ({ ...x, [k]: v }));

  const gerar = async () => {
    setGerando(true);
    try {
      const [punicoes, geradoPor] = await Promise.all([
        o.punicoes && id ? fetchPunicoesDoPlayer(id) : Promise.resolve([]),
        getCurrentUsername().catch(() => ""),
      ]);
      const grupos = lerGrupos(p.grupos);
      const lista = logs.data ?? [];
      await gerarPdfPlayer(
        {
          p,
          situacao,
          cargo: cargoDoPlayer(grupos),
          rank: rankDoNivel(p.level),
          grupos,
          logs: lista,
          resumo: resumirLogs(lista),
          punicoes,
          geradoPor,
          foto,
        },
        o,
      );
      toast.success("PDF gerado.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? `Não deu para gerar o PDF: ${e.message}` : "Não deu para gerar o PDF.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[22px] border border-white/[0.08] bg-[#111] p-5 shadow-2xl">
        <header className="flex items-center justify-between">
          <div>
            <h3 className="hc-titulo">PDF do player</h3>
            <p className="hc-nota">
              {p.nome} #{id || "-"} · página 1920x1080
            </p>
          </div>
          <button onClick={onClose} className="hc-seta" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </header>

        <p className="hc-sobre mt-4 mb-2">O que vai no PDF</p>
        <div className="rounded-xl bg-white/[0.03] px-3 py-1">
          <label className="flex items-center gap-3 border-b border-white/[0.05] py-2 text-[13px] text-ink-3">
            <input type="checkbox" checked disabled className="size-4 accent-[#e5231b]" />
            <span>
              <b className="block text-foreground/80">Ficha do player</b>
              Perfil, status, situação, identificação e nível (sempre vai)
            </span>
          </label>
          {SECOES.map((s) => (
            <label
              key={s.k}
              className="flex cursor-pointer items-center gap-3 border-b border-white/[0.05] py-2 text-[12px] text-ink-3 last:border-0"
            >
              <input
                type="checkbox"
                checked={!!o[s.k]}
                onChange={(e) => set(s.k, e.target.checked as never)}
                className="size-4 accent-[#e5231b]"
              />
              <span className="flex-1">
                <b className="block text-[13px] text-foreground">{s.rotulo}</b>
                {s.dica}
              </span>
              {s.k === "listaLogs" && o.listaLogs && (
                <select
                  value={o.qtdLogs}
                  onChange={(e) => set("qtdLogs", Number(e.target.value))}
                  onClick={(e) => e.preventDefault()}
                  className="rounded-lg bg-white/[0.06] px-2 py-1 text-[12px] text-foreground"
                >
                  {[26, 60, 120, 250].map((n) => (
                    <option key={n} value={n} className="bg-[#111]">
                      {n} logs
                    </option>
                  ))}
                </select>
              )}
            </label>
          ))}
        </div>

        <p className="hc-sobre mt-4 mb-2">Observação (opcional)</p>
        <textarea
          value={o.observacao}
          onChange={(e) => set("observacao", e.target.value)}
          rows={2}
          maxLength={400}
          placeholder="Ex.: motivo da análise, ticket, quem pediu..."
          className="w-full resize-none rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className={cn("text-[11px] text-ink-3", logs.isLoading && "animate-pulse")}>
            {logs.isLoading ? "Carregando logs..." : `${logs.data?.length ?? 0} logs nos últimos 30 dias`}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="pilula rounded-full">
              Cancelar
            </button>
            <button
              onClick={() => void gerar()}
              disabled={gerando || logs.isLoading}
              className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {gerando ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
              Gerar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
