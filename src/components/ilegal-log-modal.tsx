import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface LogRow {
  id: string;
  tabela: string;
  acao: "INSERT" | "UPDATE" | "DELETE";
  registro: string;
  resumo: string;
  campos: string[];
  usuario: string;
  created_at: string;
}

const TABELA_LABEL: Record<string, string> = {
  ilegal_orgs: "Organização",
  ilegal_detalhes: "Detalhes/VIP",
  ilegal_coroas: "Coroa",
  ilegal_cronograma: "Cronograma",
  ilegal_avisos: "Aviso",
  ilegal_anotacoes: "Anotação",
};
const ACAO_LABEL = { INSERT: "Criou", UPDATE: "Alterou", DELETE: "Removeu" } as const;
// cor do selo de cada ação: verde para criou, neutro para alterou e vermelho só para removeu
const ACAO_CLASS = {
  INSERT: "!border-success/25 !bg-success/15 !text-success",
  UPDATE: "!text-foreground",
  DELETE: "!border-destructive/25 !bg-destructive/15 !text-destructive",
} as const;

/** Botão com relógio que abre o histórico completo de alterações do Ilegal. */
export function IlegalLogButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Histórico de alterações"
        aria-label="Histórico de alterações"
        className="hc-seta !size-9"
      >
        <History className="size-4" />
      </button>
      {open && <IlegalLogModal onClose={() => setOpen(false)} />}
    </>
  );
}

function IlegalLogModal({ onClose }: { onClose: () => void }) {
  const [busca, setBusca] = useState("");
  const [tabela, setTabela] = useState("todas");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["ilegal-log"],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase
        .from("ilegal_log")
        .select("id, tabela, acao, registro, resumo, campos, usuario, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
    staleTime: 10_000,
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return data.filter(
      (l) =>
        (tabela === "todas" || l.tabela === tabela) &&
        (!q ||
          [l.registro, l.resumo, l.usuario, l.campos.join(" ")].join(" ").toLowerCase().includes(q))
    );
  }, [data, busca, tabela]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-[22px] glass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hc-icone">
              <History className="size-4" strokeWidth={1.75} />
            </span>
            <h2 className="hc-titulo">Histórico de alterações — Ilegal</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="hc-seta">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-col gap-2 border-b border-white/[0.06] p-4 sm:flex-row">
          <label className="campo-busca flex-1">
            <Search className="size-[15px] shrink-0" strokeWidth={1.75} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por set, usuário, campo..." aria-label="Buscar no histórico" />
          </label>
          <select value={tabela} onChange={(e) => setTabela(e.target.value)} className="h-9 rounded-full border border-input bg-white/[0.03] px-3 text-[12.5px] text-foreground">
            <option value="todas">Todas as seções</option>
            {Object.entries(TABELA_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando...
            </p>
          )}
          {error && <p className="text-sm text-destructive">Falha ao carregar o histórico.</p>}
          {!isLoading && filtrados.length === 0 && (
            <p className="rounded-[14px] border border-dashed border-white/[0.1] p-8 text-center text-sm text-muted-foreground">
              Nenhum registro encontrado.
            </p>
          )}
          <ul className="space-y-2">
            {filtrados.map((l) => (
              <li key={l.id} className="hc-dentro p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("hc-selo", ACAO_CLASS[l.acao])}>{ACAO_LABEL[l.acao]}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{TABELA_LABEL[l.tabela] ?? l.tabela}</span>
                  <span className="font-semibold text-foreground">{l.registro}</span>
                  {l.resumo && l.resumo !== l.registro && <span className="truncate text-muted-foreground">· {l.resumo}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {l.usuario} · {new Date(l.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {l.campos.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">Campos: {l.campos.join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
