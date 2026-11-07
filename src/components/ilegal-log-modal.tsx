import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, X, Search } from "lucide-react";
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
const ACAO_CLASS = {
  INSERT: "bg-primary/15 text-primary",
  UPDATE: "bg-accent text-foreground",
  DELETE: "bg-destructive/15 text-destructive",
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
        className="flex size-9 items-center justify-center rounded-full glass text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
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
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl glass" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground font-display">
            <History className="size-5 text-primary" /> Histórico de alterações — Ilegal
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-muted-foreground hover:bg-white/[0.08]">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por set, usuário, campo..." className="w-full rounded-lg border border-border bg-black/25 py-2 pl-9 pr-3 text-sm text-foreground" />
          </div>
          <select value={tabela} onChange={(e) => setTabela(e.target.value)} className="rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground">
            <option value="todas">Todas as seções</option>
            {Object.entries(TABELA_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {error && <p className="text-sm text-destructive">Falha ao carregar o histórico.</p>}
          {!isLoading && filtrados.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>}
          <ul className="space-y-2">
            {filtrados.map((l) => (
              <li key={l.id} className="rounded-xl border border-border bg-black/25 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ACAO_CLASS[l.acao])}>{ACAO_LABEL[l.acao]}</span>
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
